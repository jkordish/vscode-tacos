import type { ResumeSummary } from './types';

export function buildStandupUpdate(
  summary: ResumeSummary,
  workspaceLabel: string,
  generatedAt: number,
): string {
  const done = summary.doneSinceLastResume?.slice(0, 3) ?? [];
  const next = summary.nextSteps.slice(0, 3);
  const blockers = summary.pendingBlocked?.slice(0, 3) ?? [];
  const blockerLines = summary.lastFailingCommand
    ? [`Failing command: ${summary.lastFailingCommand}`, ...blockers]
    : blockers;

  const doneLines = done.length > 0 ? done : ['No explicit done items captured.'];
  const nextLines = next.length > 0 ? next : ['Refresh summary to regenerate next steps.'];
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
    ...nextLines.map((item) => `- ${item}`),
    '',
    '## Blockers',
    ...blockerOutput.map((item) => `- ${item}`),
    '',
    evidenceFooter ? `Evidence: ${evidenceFooter}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
