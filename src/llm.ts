import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { URL } from 'node:url';
import type { ExtensionConfig, ResumeSummary, ResumeSignals, SummaryLink } from './types';

interface OpenAiLink {
  label: string;
  target: string;
  kind?: unknown;
}

interface OpenAiSummaryPayload {
  intent: unknown;
  next_steps: unknown;
  links: unknown;
}

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

function inferLinkKind(target: string): 'file' | 'url' {
  return /^https?:\/\//i.test(target) ? 'url' : 'file';
}

function normalizeLinks(links: OpenAiLink[], workspaceRoot: string): SummaryLink[] {
  const normalized: SummaryLink[] = [];

  for (const item of links) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const label = typeof item.label === 'string' ? trimToMax(item.label, 160) : '';
    const rawTarget = typeof item.target === 'string' ? item.target.trim() : '';
    if (!label || !rawTarget) {
      continue;
    }

    const kind = item.kind === 'file' || item.kind === 'url' ? item.kind : inferLinkKind(rawTarget);
    const target = kind === 'url' ? rawTarget : path.isAbsolute(rawTarget) ? rawTarget : path.join(workspaceRoot, rawTarget);

    normalized.push({ label, target, kind });
  }

  return uniqueBy(normalized, (link) => `${link.kind}:${link.target}`).slice(0, 3);
}

function parseStringArray(value: unknown, min: number, max: number): string[] {
  if (!Array.isArray(value)) {
    throw new Error('next_steps must be an array');
  }

  const items = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => trimToMax(entry, 240))
    .filter(Boolean);

  if (items.length < min || items.length > max) {
    throw new Error(`next_steps must include ${min}-${max} items`);
  }

  return items.slice(0, max);
}

export function validateOpenAiSummaryPayload(
  payload: unknown,
  workspaceRoot: string
): { intent: string; nextSteps: string[]; links: SummaryLink[] } {
  if (!payload || typeof payload !== 'object') {
    throw new Error('summary payload must be an object');
  }

  const typed = payload as OpenAiSummaryPayload;
  if (typeof typed.intent !== 'string' || !typed.intent.trim()) {
    throw new Error('intent must be a non-empty string');
  }

  const nextSteps = parseStringArray(typed.next_steps, 2, 3);
  if (!Array.isArray(typed.links)) {
    throw new Error('links must be an array');
  }

  const links = normalizeLinks(typed.links as OpenAiLink[], workspaceRoot);

  return {
    intent: trimToMax(typed.intent, 500),
    nextSteps,
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
    const message = (choices[0] as Record<string, unknown>).message as Record<string, unknown> | undefined;
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

function buildSystemPrompt(): string {
  return [
    'You summarize a developer\'s paused task from IDE evidence.',
    'Be concise, avoid speculation, and return JSON only.',
    'Output schema:',
    '{"intent": string, "next_steps": string[2..3], "links": [{"label": string, "target": string, "kind": "file"|"url"}] (<=3)}',
    'Use evidence directly and avoid repeating done items as next steps.',
  ].join('\n');
}

function buildUserPrompt(signals: ResumeSignals, base: ResumeSummary): string {
  return [
    'Summarize this resume context:',
    '',
    `Workspace: ${signals.workspaceName}`,
    signals.branch ? `Branch: ${signals.branch}` : 'Branch: (unknown)',
    '',
    'Evidence:',
    base.detailsMarkdown,
    '',
    `Done items (avoid repeating): ${signals.doneItems.join(' | ') || '(none)'}`,
    `Latest failing command: ${signals.failingCommand ?? '(none)'}`,
  ].join('\n');
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
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
      }
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
      required: ['intent', 'next_steps', 'links'],
      properties: {
        intent: { type: 'string' },
        next_steps: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: { type: 'string' },
        },
        links: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'target', 'kind'],
            properties: {
              label: { type: 'string' },
              target: { type: 'string' },
              kind: { type: 'string', enum: ['file', 'url'] },
            },
          },
        },
      },
    },
  };
}

function buildOpenAiSummary(
  base: ResumeSummary,
  validated: { intent: string; nextSteps: string[]; links: SummaryLink[] }
): ResumeSummary {
  const topFiles = uniqueBy(
    validated.links.filter((link) => link.kind === 'file').map((link) => link.label),
    (value) => value
  )
    .slice(0, 3)
    .concat(base.topFiles)
    .slice(0, 3);

  const links = validated.links.length > 0 ? validated.links : base.links;
  const details = [
    '## LLM Summary (OpenAI)',
    `- ${validated.intent}`,
    '',
    '## Next steps',
    ...validated.nextSteps.map((step) => `- ${step}`),
    '',
    '## Top links/files',
    ...(links.length > 0 ? links.map((link) => `- [${link.kind}] ${link.label} -> ${link.target}`) : ['- None returned']),
    '',
    '---',
    base.detailsMarkdown,
  ].join('\n');

  return {
    ...base,
    source: 'openai',
    intent: validated.intent,
    nextSteps: validated.nextSteps,
    topFiles,
    links,
    detailsMarkdown: details,
    generatedAt: Date.now(),
  };
}

export async function tryGenerateOpenAiSummary(
  signals: ResumeSignals,
  base: ResumeSummary,
  config: ExtensionConfig,
  log: (message: string) => void
): Promise<ResumeSummary | undefined> {
  const apiKey = config.openaiApiKey.trim() || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    log('OpenAI mode requested but no API key was found. Falling back to local summary.');
    return undefined;
  }

  const baseUrl = config.openaiBaseUrl.trim().replace(/\/$/, '') || 'https://api.openai.com/v1';
  const endpoint = `${baseUrl}/chat/completions`;

  const requestBody = {
    model: config.openaiModel,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
      {
        role: 'user',
        content: buildUserPrompt(signals, base),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: jsonSchema(),
    },
  };

  try {
    const responsePayload = await postJson(
      endpoint,
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      requestBody,
      config.openaiTimeoutMs
    );

    const content = extractResponseText(responsePayload);
    const parsed = JSON.parse(content) as unknown;
    const validated = validateOpenAiSummaryPayload(parsed, signals.workspaceRoot);
    return buildOpenAiSummary(base, validated);
  } catch (error) {
    log(`OpenAI summary failed: ${(error as Error).message}`);
    return undefined;
  }
}
