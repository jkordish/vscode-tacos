import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import { normalizeHttpUrl, resolveFileTargetInWorkspace } from './pathSafety';
import type {
  ExtensionConfig,
  ResumeSummary,
  ResumeSignals,
  SummaryEvidenceItem,
  SummaryLink,
} from './types';

interface OpenAiSummaryPayload {
  intent: unknown;
  next_steps: unknown;
  top_links: unknown;
}

interface OpenAiNextStep {
  text: unknown;
  evidence_ids: unknown;
}

interface ValidatedOpenAiSummaryPayload {
  intent: string;
  nextSteps: string[];
  nextStepEvidenceIds: string[][];
  links: SummaryLink[];
}

type OpenAiResponseFormat =
  | {
      type: 'json_schema';
      json_schema: ReturnType<typeof jsonSchema>;
    }
  | {
      type: 'json_object';
    };

function trimToMax(value: string, max = 300): string {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(value);
  }
  return result;
}

function toOpenableLink(item: SummaryEvidenceItem, workspaceRoot: string): SummaryLink | undefined {
  if (item.kind === 'url') {
    if (typeof item.target !== 'string') {
      return undefined;
    }

    const target = normalizeHttpUrl(item.target);
    if (!target) {
      return undefined;
    }

    return {
      label: trimToMax(item.label, 160),
      target,
      kind: 'url',
    };
  }

  if (item.kind === 'file') {
    if (typeof item.target !== 'string') {
      return undefined;
    }

    const target = resolveFileTargetInWorkspace(item.target, workspaceRoot);
    if (!target) {
      return undefined;
    }

    return {
      label: trimToMax(item.label, 160),
      target,
      kind: 'file',
    };
  }

  return undefined;
}

function parseNextSteps(value: unknown, min: number, max: number): OpenAiNextStep[] {
  if (!Array.isArray(value)) {
    throw new Error('next_steps must be an array');
  }

  const items = value.filter(
    (entry): entry is OpenAiNextStep => Boolean(entry) && typeof entry === 'object',
  );

  if (items.length < min || items.length > max) {
    throw new Error(`next_steps must include ${min}-${max} items`);
  }

  return items.slice(0, max);
}

export function validateOpenAiSummaryPayload(
  payload: unknown,
  evidenceCatalog: SummaryEvidenceItem[],
  workspaceRoot: string,
): ValidatedOpenAiSummaryPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('summary payload must be an object');
  }

  const typed = payload as OpenAiSummaryPayload;
  if (typeof typed.intent !== 'string' || !typed.intent.trim()) {
    throw new Error('intent must be a non-empty string');
  }

  const nextStepEntries = parseNextSteps(typed.next_steps, 2, 3);
  const nextSteps: string[] = [];
  for (const step of nextStepEntries) {
    if (typeof step.text !== 'string' || !step.text.trim()) {
      throw new Error('next_steps entries must each include a non-empty text field');
    }

    nextSteps.push(trimToMax(step.text, 240));
  }
  if (!Array.isArray(typed.top_links)) {
    throw new Error('top_links must be an array');
  }

  const evidenceById = new Map(evidenceCatalog.map((item) => [item.id, item] as const));
  const topLinkIds = uniqueBy(
    typed.top_links
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => {
        const evidence = evidenceById.get(entry);
        return Boolean(evidence) && (evidence?.kind === 'file' || evidence?.kind === 'url');
      }),
    (value) => value,
  ).slice(0, 3);

  const links = uniqueBy(
    topLinkIds
      .map((id) => evidenceById.get(id))
      .filter((item): item is SummaryEvidenceItem => Boolean(item))
      .map((item) => toOpenableLink(item, workspaceRoot))
      .filter((link): link is SummaryLink => Boolean(link)),
    (link) => `${link.kind}:${link.target}`,
  ).slice(0, 3);

  const fallbackEvidenceId = evidenceCatalog[0]?.id;
  const nextStepEvidenceIds: string[][] = [];

  for (let index = 0; index < nextSteps.length; index += 1) {
    const step = nextStepEntries[index];
    const providedEvidenceIds = Array.isArray(step?.evidence_ids) ? step.evidence_ids : [];
    const normalizedEvidenceIds = uniqueBy(
      providedEvidenceIds
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => evidenceById.has(value)),
      (value) => value,
    ).slice(0, 3);

    if (normalizedEvidenceIds.length > 0) {
      nextStepEvidenceIds.push(normalizedEvidenceIds);
      continue;
    }

    if (topLinkIds[index]) {
      nextStepEvidenceIds.push([topLinkIds[index]]);
      continue;
    }

    if (fallbackEvidenceId) {
      nextStepEvidenceIds.push([fallbackEvidenceId]);
      continue;
    }

    nextStepEvidenceIds.push([]);
  }

  return {
    intent: trimToMax(typed.intent, 500),
    nextSteps,
    nextStepEvidenceIds,
    links,
  };
}

function extractResponseText(responsePayload: unknown): string {
  if (!responsePayload || typeof responsePayload !== 'object') {
    throw new Error('OpenAI response payload is invalid');
  }

  const anyPayload = responsePayload as Record<string, unknown>;

  const choices = anyPayload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const message = (choices[0] as Record<string, unknown>).message as
      | Record<string, unknown>
      | undefined;
    const refusal = message?.refusal;
    if (typeof refusal === 'string' && refusal.trim()) {
      throw new Error(`OpenAI model refused summary request: ${trimToMax(refusal, 200)}`);
    }

    const content = message?.content;
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textChunks = content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          const typed = item as Record<string, unknown>;
          return typeof typed.text === 'string' ? typed.text : '';
        })
        .filter(Boolean);

      if (textChunks.length > 0) {
        return textChunks.join('\n');
      }
    }
  }

  throw new Error('Could not extract message content from OpenAI response');
}

export function shouldRetryWithJsonObjectFallback(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() ?? '';
  if (!message) {
    return false;
  }

  if (message.includes('timed out') || message.includes('refused summary request')) {
    return false;
  }

  return (
    message.includes('json_schema') ||
    (message.includes('response_format') &&
      (message.includes('unsupported') ||
        message.includes('not supported') ||
        message.includes('invalid') ||
        message.includes('must be')))
  );
}

export function buildSummaryInstructionsPrompt(): string {
  return [
    "You summarize a developer's paused task from IDE evidence.",
    'Be concise, avoid speculation, and return JSON only.',
    'Output schema:',
    '{"intent": string, "next_steps": [{"text": string, "evidence_ids": string[]} (2..3)], "top_links": string[] (<=3)}',
    'You may only return evidence IDs explicitly listed in the evidence catalog.',
    'Do not invent paths, URLs, or IDs.',
    'Use evidence directly and avoid repeating done items as next steps.',
  ].join('\n');
}

export function buildSummaryContextPrompt(signals: ResumeSignals, base: ResumeSummary): string {
  const evidenceCatalog = base.evidenceCatalog ?? [];
  const evidenceLines =
    evidenceCatalog.length > 0
      ? evidenceCatalog
          .map((item) => {
            // Do not expose local absolute file paths in model prompts.
            const target =
              item.kind === 'url' && typeof item.target === 'string'
                ? ` | target=${item.target}`
                : '';
            return `- id=${item.id} | kind=${item.kind} | label=${item.label}${target}`;
          })
          .join('\n')
      : '- (none)';

  const correctionLines =
    base.userCorrections && base.userCorrections.length > 0
      ? ['', 'User corrections (must respect):', ...base.userCorrections.map((item) => `- ${item}`)]
      : [];

  return [
    'Summarize this resume context:',
    '',
    `Workspace: ${signals.workspaceName}`,
    signals.branch ? `Branch: ${signals.branch}` : 'Branch: (unknown)',
    '',
    'Evidence:',
    base.detailsMarkdown,
    '',
    'Evidence catalog (use IDs from this list only):',
    evidenceLines,
    '',
    `Done items (avoid repeating): ${signals.doneItems.join(' | ') || '(none)'}`,
    `Latest failing command: ${signals.failingCommand ?? '(none)'}`,
    ...correctionLines,
  ].join('\n');
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const client = isHttps ? https : http;

  const payload = JSON.stringify(body);

  return new Promise<unknown>((resolve, reject) => {
    const req = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          const raw = Buffer.concat(chunks).toString('utf8');

          if (status < 200 || status >= 300) {
            reject(new Error(`OpenAI request failed (${status}): ${raw.slice(0, 500)}`));
            return;
          }

          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch (error) {
            reject(new Error(`Failed parsing OpenAI JSON response: ${(error as Error).message}`));
          }
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`OpenAI request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function jsonSchema() {
  return {
    name: 'task_context_summary',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['intent', 'next_steps', 'top_links'],
      properties: {
        intent: { type: 'string' },
        next_steps: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['text', 'evidence_ids'],
            properties: {
              text: { type: 'string' },
              evidence_ids: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        top_links: {
          type: 'array',
          maxItems: 3,
          items: { type: 'string' },
        },
      },
    },
  };
}

export function buildAiSummary(
  base: ResumeSummary,
  validated: ValidatedOpenAiSummaryPayload,
  source: Extract<ResumeSummary['source'], 'openai' | 'vscode-lm'>,
  sourceLabel: string,
): ResumeSummary {
  const topFiles = uniqueBy(
    validated.links.filter((link) => link.kind === 'file').map((link) => link.label),
    (value) => value,
  )
    .slice(0, 3)
    .concat(base.topFiles)
    .slice(0, 3);

  const links = validated.links.length > 0 ? validated.links : base.links;
  const details = [
    `## LLM Summary (${sourceLabel})`,
    `- ${validated.intent}`,
    '',
    '## Next steps',
    ...validated.nextSteps.map((step, index) => {
      const evidenceIds = validated.nextStepEvidenceIds[index] ?? [];
      if (evidenceIds.length === 0) {
        return `- ${step}`;
      }

      return `- ${step} (evidence: ${evidenceIds.join(', ')})`;
    }),
    '',
    '## Top links/files',
    ...(links.length > 0
      ? links.map((link) => `- [${link.kind}] ${link.label} -> ${link.target}`)
      : ['- None returned']),
    '',
    '---',
    base.detailsMarkdown,
  ].join('\n');

  return {
    ...base,
    source,
    localGeneratedAt: base.localGeneratedAt ?? base.generatedAt,
    intent: validated.intent,
    nextSteps: validated.nextSteps,
    nextStepEvidenceIds: validated.nextStepEvidenceIds,
    topFiles,
    links,
    evidenceCatalog: base.evidenceCatalog,
    detailsMarkdown: details,
    generatedAt: Date.now(),
  };
}

export async function tryGenerateOpenAiSummary(
  signals: ResumeSignals,
  base: ResumeSummary,
  config: ExtensionConfig,
  apiKey: string,
  log: (message: string) => void,
): Promise<ResumeSummary | undefined> {
  if (!apiKey) {
    log('OpenAI mode requested but no API key was found. Falling back to local summary.');
    return undefined;
  }

  const baseUrl = config.openaiBaseUrl.trim().replace(/\/$/, '') || 'https://api.openai.com/v1';
  const endpoint = `${baseUrl}/chat/completions`;

  const systemPrompt = buildSummaryInstructionsPrompt();
  const contextPrompt = buildSummaryContextPrompt(signals, base);

  const requestSummary = async (responseFormat: OpenAiResponseFormat): Promise<ResumeSummary> => {
    const requestBody = {
      model: config.openaiModel,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
      response_format: responseFormat,
    };

    const responsePayload = await postJson(
      endpoint,
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      requestBody,
      config.openaiTimeoutMs,
    );

    const content = extractResponseText(responsePayload);
    const parsed = JSON.parse(content) as unknown;
    const validated = validateOpenAiSummaryPayload(
      parsed,
      base.evidenceCatalog ?? [],
      signals.workspaceRoot,
    );
    return buildAiSummary(base, validated, 'openai', 'OpenAI');
  };

  try {
    return await requestSummary({
      type: 'json_schema',
      json_schema: jsonSchema(),
    });
  } catch (structuredError) {
    if (!shouldRetryWithJsonObjectFallback(structuredError)) {
      log(`OpenAI summary failed: ${(structuredError as Error).message}`);
      return undefined;
    }

    log(
      'OpenAI model appears incompatible with json_schema response_format. Retrying with json_object.',
    );

    try {
      return await requestSummary({ type: 'json_object' });
    } catch (fallbackError) {
      log(`OpenAI summary failed after json_object fallback: ${(fallbackError as Error).message}`);
      return undefined;
    }
  }
}
