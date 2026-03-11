import type { StructuredTaskState } from './taskState';
import type { ResumeSummary } from './types';

export interface StructuredRecoveryContext {
  currentBranch?: string;
  currentTaskPartition?: string;
  now?: number;
}

function dedupe(values: string[], maxItems = values.length): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value))).slice(
    0,
    maxItems,
  );
}

function formatBreakpoint(task: StructuredTaskState): string | undefined {
  const file = task.lastKnownSafeBreakpoint.file?.trim();
  const line = task.lastKnownSafeBreakpoint.line;
  if (!file) {
    return task.lastKnownSafeBreakpoint.label?.trim();
  }
  return typeof line === 'number' ? `${file}:${line}` : file;
}

function buildVerificationCue(task: StructuredTaskState): string {
  return (
    formatBreakpoint(task) ??
    task.workingSet[0]?.label ??
    'the latest evidence and current branch before taking action'
  );
}

export function applyStructuredTaskStateToSummary(
  summary: ResumeSummary,
  task: StructuredTaskState | undefined,
  context: StructuredRecoveryContext = {},
): ResumeSummary {
  if (!task) {
    return summary;
  }

  const currentBranch = context.currentBranch?.trim() ?? summary.currentBranch?.trim();
  const currentTaskPartition = context.currentTaskPartition?.trim();
  const verificationCue = buildVerificationCue(task);
  const whatYouWereDoing = dedupe(
    [
      task.objective,
      task.currentHypothesis ? `Hypothesis: ${task.currentHypothesis}` : '',
      task.workingSet.length > 0
        ? `Working set: ${task.workingSet
            .slice(0, 4)
            .map((entry) => entry.label)
            .join(', ')}`
        : '',
    ],
    3,
  );
  const whatChangedSince = dedupe(
    [
      currentBranch && currentBranch !== task.branch
        ? `Branch changed from ${task.branch} to ${currentBranch}.`
        : '',
      currentTaskPartition && currentTaskPartition !== task.taskPartition
        ? `Task partition changed from ${task.taskPartition} to ${currentTaskPartition}.`
        : '',
      summary.changesSinceLastResume?.[0] ?? '',
      summary.changesSinceLastResume?.[1] ?? '',
    ],
    4,
  );
  const nextLikelySafeMove = `Suggested next move: ${task.nextAction}. Verify against ${verificationCue}.`;
  const openQuestions = dedupe(
    [
      ...task.blockers.map((item) => `Blocker: ${item}`),
      ...task.assumptions.map((item) => `Assumption to verify: ${item}`),
      ...(summary.pendingBlocked ?? []),
    ],
    6,
  );
  const timelineCues = dedupe(
    [
      summary.lastActionLabel ? `Last action: ${summary.lastActionLabel}` : '',
      `Checkpoint updated: ${new Date(task.updatedAt).toISOString()}`,
      formatBreakpoint(task) ? `Last known safe breakpoint: ${formatBreakpoint(task)}` : '',
      ...task.workingSet.slice(0, 3).map((entry) => `Working set cue: ${entry.label}`),
    ],
    6,
  );
  const detailsSections = [
    '## What You Were Doing',
    ...whatYouWereDoing.map((item) => `- ${item}`),
    '',
    '## What Changed Since',
    ...(whatChangedSince.length > 0
      ? whatChangedSince.map((item) => `- ${item}`)
      : ['- No deterministic changes captured yet.']),
    '',
    '## Next Likely Safe Move',
    `- ${nextLikelySafeMove}`,
    '',
    '## Open Questions / Unresolved Blockers',
    ...(openQuestions.length > 0 ? openQuestions.map((item) => `- ${item}`) : ['- None captured.']),
    '',
    '## Timeline / Evidence / Retrieval Cues',
    ...(timelineCues.length > 0
      ? timelineCues.map((item) => `- ${item}`)
      : ['- No timeline cues captured.']),
  ].join('\n');
  const nextSteps = dedupe([nextLikelySafeMove, ...(summary.nextSteps ?? [])], 3);

  return {
    ...summary,
    intent: summary.intentOverridden ? summary.intent : task.objective,
    whatYouWereDoing,
    whatChangedSince,
    nextLikelySafeMove,
    openQuestions,
    timelineCues,
    structuredTaskStateUsed: true,
    nextSteps,
    recommendedFirstAction: nextLikelySafeMove,
    pendingBlocked: dedupe([...(summary.pendingBlocked ?? []), ...task.blockers], 6),
    detailsMarkdown: `${detailsSections}\n\n${summary.detailsMarkdown}`.trim(),
    codexPrompt: `${summary.codexPrompt}\n\n${detailsSections}`.trim(),
  };
}
