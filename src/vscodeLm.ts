import { buildAiSummary, buildSummaryContextPrompt, buildSummaryInstructionsPrompt, validateOpenAiSummaryPayload } from './llm';
import type { ResumeSignals, ResumeSummary } from './types';

interface LmChatMessageLike {
  role: 'user' | 'assistant';
  content: string;
}

type LmResponseTextStream = AsyncIterable<unknown> | Iterable<unknown> | string;

interface LmResponseLike {
  text?: LmResponseTextStream;
}

export interface VscodeLmModelLike {
  id?: string;
  name?: string;
  vendor?: string;
  family?: string;
  sendRequest: (
    messages: LmChatMessageLike[],
    options?: Record<string, unknown>,
    token?: unknown
  ) => Promise<unknown>;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}

function fragmentToText(fragment: unknown): string {
  if (typeof fragment === 'string') {
    return fragment;
  }

  if (fragment && typeof fragment === 'object') {
    const asRecord = fragment as Record<string, unknown>;
    if (typeof asRecord.value === 'string') {
      return asRecord.value;
    }
    if (typeof asRecord.text === 'string') {
      return asRecord.text;
    }
  }

  return '';
}

async function readModelResponseText(response: unknown): Promise<string> {
  const textLike = (response as LmResponseLike | undefined)?.text;
  if (typeof textLike === 'string') {
    return textLike;
  }

  const chunks: string[] = [];
  if (isAsyncIterable(textLike)) {
    for await (const fragment of textLike) {
      const chunk = fragmentToText(fragment);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks.join('');
  }

  if (isIterable(textLike)) {
    for (const fragment of textLike) {
      const chunk = fragmentToText(fragment);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return chunks.join('');
  }

  throw new Error('VS Code LM response did not contain a readable text stream.');
}

function parseJsonCandidate(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function tryParseFirstJsonObject(raw: string): unknown | undefined {
  const start = raw.indexOf('{');
  if (start < 0) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = raw.slice(start, index + 1);
        return parseJsonCandidate(candidate);
      }
    }
  }

  return undefined;
}

export function extractJsonPayloadFromLmText(rawText: string): unknown | undefined {
  const direct = parseJsonCandidate(rawText);
  if (direct) {
    return direct;
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const fenced = parseJsonCandidate(fencedMatch[1]);
    if (fenced) {
      return fenced;
    }
  }

  return tryParseFirstJsonObject(rawText);
}

export async function tryGenerateVscodeLmSummary(
  signals: ResumeSignals,
  base: ResumeSummary,
  model: VscodeLmModelLike,
  log: (message: string) => void
): Promise<ResumeSummary | undefined> {
  const prompt = [
    buildSummaryInstructionsPrompt(),
    'Return only JSON that matches the schema exactly.',
    '',
    buildSummaryContextPrompt(signals, base),
  ].join('\n');

  try {
    const response = await model.sendRequest(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      { temperature: 0.1 }
    );

    const rawText = await readModelResponseText(response);
    const parsed = extractJsonPayloadFromLmText(rawText);
    if (!parsed) {
      throw new Error('Failed to parse JSON payload from VS Code LM response.');
    }

    const validated = validateOpenAiSummaryPayload(parsed, base.evidenceCatalog ?? [], signals.workspaceRoot);
    return buildAiSummary(base, validated, 'vscode-lm', 'VS Code LM');
  } catch (error) {
    log(`VS Code LM summary failed: ${(error as Error).message}`);
    return undefined;
  }
}
