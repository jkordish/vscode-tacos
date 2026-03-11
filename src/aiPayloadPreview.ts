import type { ResumeSignals, ResumeSummary, SummaryProvider } from './types';
import type { RedactionReport } from './redaction';

export interface AiPayloadPreviewInput {
  provider: SummaryProvider;
  workspaceName: string;
  generatedAt: number;
  signals: ResumeSignals;
  summary: Pick<
    ResumeSummary,
    'intent' | 'intentOverridden' | 'nextSteps' | 'topFiles' | 'links' | 'evidenceCatalog'
  >;
  includeCheckpointNotes?: boolean;
  includeScratchpad?: boolean;
  scratchpadExcerpt?: string;
  redactionReport?: RedactionReport;
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
  const includeCheckpointNotes = input.includeCheckpointNotes ?? false;
  const includeScratchpad = input.includeScratchpad ?? false;
  const payload = {
    provider: input.provider,
    generatedAt: input.generatedAt,
    workspace: input.workspaceName,
    signals: input.signals,
    summary: {
      intent: input.summary.intent,
      intentSource: input.summary.intentOverridden ? 'user-edited' : 'inferred',
      nextSteps: input.summary.nextSteps,
      topFiles: input.summary.topFiles,
      links: input.summary.links,
      evidenceCatalog: input.summary.evidenceCatalog ?? [],
    },
    scratchpadExcerpt: includeScratchpad ? (input.scratchpadExcerpt ?? '') : undefined,
  };
  const json = JSON.stringify(payload, null, 2);
  const { value: previewJson, truncated } = truncateJson(json, input.maxJsonChars ?? 12_000);

  const truncationNote = truncated
    ? '\n- Preview JSON is truncated for readability. The sent payload uses full redacted context.\n'
    : '';
  const report = input.redactionReport;
  const categoryEntries =
    report && Object.keys(report.categoryCounts).length > 0
      ? Object.entries(report.categoryCounts).sort((a, b) => b[1] - a[1])
      : [];
  const categoryLines =
    categoryEntries.length > 0
      ? categoryEntries.map(([category, count]) => `  - ${category}: ${count}`)
      : ['  - none'];

  return [
    '# TaCoS AI Payload Preview',
    '',
    'This is the **redacted** payload TaCoS will send for AI refinement.',
    '',
    `- Provider: \`${input.provider}\``,
    `- Workspace: \`${input.workspaceName}\``,
    `- Generated: ${new Date(input.generatedAt).toLocaleString()}`,
    `- Intent source: ${input.summary.intentOverridden ? 'user-edited' : 'inferred'}`,
    `- Includes checkpoint context in summary: ${includeCheckpointNotes ? 'yes' : 'no'}`,
    `- Includes scratchpad content: ${includeScratchpad ? 'yes' : 'no'}`,
    '',
    '## Redaction report',
    `- Total replacements: ${report?.totalReplacements ?? 0}`,
    `- Total chars replaced: ${report?.totalCharsReplaced ?? 0}`,
    `- High-risk detected: ${report?.highRiskDetected ? 'yes' : 'no'}`,
    '- Category counts:',
    ...categoryLines,
    truncationNote,
    '```json',
    previewJson,
    '```',
  ].join('\n');
}
