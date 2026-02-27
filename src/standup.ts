import type { ResumeSummary } from './types';

export interface StandupOptions {
  checkpointNext?: string;
}

export function buildStandupUpdate(
  summary: ResumeSummary,
  workspaceLabel: string,
  generatedAt: number,
  options: StandupOptions = {},
): string {
  const done = summary.doneSinceLastResume?.slice(0, 3) ?? [];
  const checkpointNext = options.checkpointNext?.trim();
  const next = summary.nextSteps.slice(0, 3);
  const nextLines = checkpointNext
    ? [checkpointNext, ...next.filter((item) => item !== checkpointNext)]
    : next;
  const blockers = summary.pendingBlocked?.slice(0, 3) ?? [];
  const blockerLines = summary.lastFailingCommand
    ? [`Failing command: ${summary.lastFailingCommand}`, ...blockers]
    : blockers;

  const doneLines = done.length > 0 ? done : ['No explicit done items captured.'];
  const outputNextLines =
    nextLines.length > 0 ? nextLines.slice(0, 3) : ['Refresh summary to regenerate next steps.'];
  const blockerOutput = blockerLines.length > 0 ? blockerLines : ['No active blockers captured.'];

  const evidenceFooter = [
    summary.currentBranch ? `Branch: ${summary.currentBranch}` : '',
    summary.topFiles.length > 0 ? `Top files: ${summary.topFiles.slice(0, 3).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return [
    `# Standup Update (${workspaceLabel})`,
    '',
    `Generated: ${new Date(generatedAt).toLocaleString()}`,
    '',
    '## Done',
    ...doneLines.map((item) => `- ${item}`),
    '',
    '## Next',
    ...outputNextLines.map((item) => `- ${item}`),
    '',
    '## Blockers',
    ...blockerOutput.map((item) => `- ${item}`),
    '',
    evidenceFooter ? `Evidence: ${evidenceFooter}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
