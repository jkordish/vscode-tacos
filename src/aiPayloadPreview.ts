import type { ResumeSignals, ResumeSummary, SummaryProvider } from './types';

export interface AiPayloadPreviewInput {
  provider: SummaryProvider;
  workspaceName: string;
  generatedAt: number;
  signals: ResumeSignals;
  summary: Pick<ResumeSummary, 'intent' | 'nextSteps' | 'topFiles' | 'links' | 'evidenceCatalog'>;
  maxJsonChars?: number;
}

function truncateJson(json: string, maxChars: number): { value: string; truncated: boolean } {
  if (json.length <= maxChars) {
    return { value: json, truncated: false };
  }

  return {
    value: `${json.slice(0, Math.max(0, maxChars - 20))}\n...truncated...`,
    truncated: true,
  };
}

export function buildAiPayloadPreviewMarkdown(input: AiPayloadPreviewInput): string {
  const payload = {
    provider: input.provider,
    generatedAt: input.generatedAt,
    workspace: input.workspaceName,
    signals: input.signals,
    summary: {
      intent: input.summary.intent,
      nextSteps: input.summary.nextSteps,
      topFiles: input.summary.topFiles,
      links: input.summary.links,
      evidenceCatalog: input.summary.evidenceCatalog ?? [],
    },
  };
  const json = JSON.stringify(payload, null, 2);
  const { value: previewJson, truncated } = truncateJson(json, input.maxJsonChars ?? 12_000);

  const truncationNote = truncated
    ? '\n- Preview JSON is truncated for readability. The sent payload uses full redacted context.\n'
    : '';

  return [
    '# TaCoS AI Payload Preview',
    '',
    'This is the **redacted** payload TaCoS will send for AI refinement.',
    '',
    `- Provider: \`${input.provider}\``,
    `- Workspace: \`${input.workspaceName}\``,
    `- Generated: ${new Date(input.generatedAt).toLocaleString()}`,
    truncationNote,
    '```json',
    previewJson,
    '```',
  ].join('\n');
}
