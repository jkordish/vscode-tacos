import type { StructuredTaskState } from './taskState';
import type { ResumeSummary } from './types';

export interface StructuredRecoveryContext {
  currentBranch?: string;
  currentTaskPartition?: string;
  now?: number;
}

const STRUCTURED_RECOVERY_HEADINGS = {
  whatYouWereDoing: '## What You Were Doing',
  whatChangedSince: '## What Changed Since',
  nextLikelySafeMove: '## Next Likely Safe Move',
  openQuestions: '## Open Questions / Unresolved Blockers',
  timelineCues: '## Timeline / Evidence / Retrieval Cues',
} as const;

function dedupe(values: string[], maxItems = values.length): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value))).slice(
    0,
    maxItems,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function buildStructuredRecoverySections(
  whatYouWereDoing: string[],
  whatChangedSince: string[],
  nextLikelySafeMove: string,
  openQuestions: string[],
  timelineCues: string[],
): string {
  return [
    STRUCTURED_RECOVERY_HEADINGS.whatYouWereDoing,
    ...whatYouWereDoing.map((item) => `- ${item}`),
    '',
    STRUCTURED_RECOVERY_HEADINGS.whatChangedSince,
    ...(whatChangedSince.length > 0
      ? whatChangedSince.map((item) => `- ${item}`)
      : ['- No deterministic changes captured yet.']),
    '',
    STRUCTURED_RECOVERY_HEADINGS.nextLikelySafeMove,
    `- ${nextLikelySafeMove}`,
    '',
    STRUCTURED_RECOVERY_HEADINGS.openQuestions,
    ...(openQuestions.length > 0 ? openQuestions.map((item) => `- ${item}`) : ['- None captured.']),
    '',
    STRUCTURED_RECOVERY_HEADINGS.timelineCues,
    ...(timelineCues.length > 0
      ? timelineCues.map((item) => `- ${item}`)
      : ['- No timeline cues captured.']),
  ].join('\n');
}

function stripLeadingStructuredRecoveryBlock(value: string): string {
  const bulletBlock = '(?:- .*\\n?)+';
  const pattern = new RegExp(
    `^\\s*${escapeRegExp(STRUCTURED_RECOVERY_HEADINGS.whatYouWereDoing)}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.whatChangedSince,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.nextLikelySafeMove,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.openQuestions,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.timelineCues,
    )}\\n${bulletBlock}\\n*`,
    'u',
  );

  return value.replace(pattern, '').replace(/^\s+/u, '');
}

function stripTrailingStructuredRecoveryBlock(value: string): string {
  const bulletBlock = '(?:- .*\\n?)+';
  const pattern = new RegExp(
    `\\n*${escapeRegExp(STRUCTURED_RECOVERY_HEADINGS.whatYouWereDoing)}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.whatChangedSince,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.nextLikelySafeMove,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.openQuestions,
    )}\\n${bulletBlock}\\n+${escapeRegExp(
      STRUCTURED_RECOVERY_HEADINGS.timelineCues,
    )}\\n${bulletBlock}\\s*$`,
    'u',
  );

  return value.replace(pattern, '').replace(/\s+$/u, '');
}

export function stripStructuredTaskStateFromSummary(summary: ResumeSummary): ResumeSummary {
  const nextLikelySafeMove = summary.nextLikelySafeMove?.trim();
  const blockerTexts = (summary.openQuestions ?? [])
    .filter((item) => item.startsWith('Blocker: '))
    .map((item) => item.slice('Blocker: '.length).trim())
    .filter(Boolean);
  const nextSteps = nextLikelySafeMove
    ? summary.nextSteps.filter((step) => step.trim() !== nextLikelySafeMove)
    : [...summary.nextSteps];
  const recommendedFirstAction =
    nextLikelySafeMove && summary.recommendedFirstAction?.trim() === nextLikelySafeMove
      ? nextSteps[0]
      : summary.recommendedFirstAction;
  const pendingBlocked =
    blockerTexts.length > 0
      ? (summary.pendingBlocked ?? []).filter((item) => !blockerTexts.includes(item.trim()))
      : summary.pendingBlocked;

  return {
    ...summary,
    whatYouWereDoing: undefined,
    whatChangedSince: undefined,
    nextLikelySafeMove: undefined,
    openQuestions: undefined,
    timelineCues: undefined,
    structuredTaskStateUsed: undefined,
    structuredTaskStateFreshness: undefined,
    structuredTaskSwitchClass: undefined,
    nextSteps,
    recommendedFirstAction,
    pendingBlocked,
    detailsMarkdown: stripLeadingStructuredRecoveryBlock(summary.detailsMarkdown),
    codexPrompt: stripTrailingStructuredRecoveryBlock(summary.codexPrompt),
  };
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

  const baseSummary = stripStructuredTaskStateFromSummary(summary);
  const currentBranch = context.currentBranch?.trim() ?? baseSummary.currentBranch?.trim();
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
      baseSummary.changesSinceLastResume?.[0] ?? '',
      baseSummary.changesSinceLastResume?.[1] ?? '',
    ],
    4,
  );
  const nextLikelySafeMove = `Suggested next move: ${task.nextAction}. Verify against ${verificationCue}.`;
  const openQuestions = dedupe(
    [
      ...task.blockers.map((item) => `Blocker: ${item}`),
      ...task.assumptions.map((item) => `Assumption to verify: ${item}`),
      ...(baseSummary.pendingBlocked ?? []),
    ],
    6,
  );
  const timelineCues = dedupe(
    [
      baseSummary.lastActionLabel ? `Last action: ${baseSummary.lastActionLabel}` : '',
      `Checkpoint updated: ${new Date(task.updatedAt).toISOString()}`,
      formatBreakpoint(task) ? `Last known safe breakpoint: ${formatBreakpoint(task)}` : '',
      ...task.workingSet.slice(0, 3).map((entry) => `Working set cue: ${entry.label}`),
    ],
    6,
  );
  const detailsSections = buildStructuredRecoverySections(
    whatYouWereDoing,
    whatChangedSince,
    nextLikelySafeMove,
    openQuestions,
    timelineCues,
  );
  const nextSteps = dedupe([nextLikelySafeMove, ...(baseSummary.nextSteps ?? [])], 3);

  return {
    ...baseSummary,
    intent: baseSummary.intentOverridden ? baseSummary.intent : task.objective,
    whatYouWereDoing,
    whatChangedSince,
    nextLikelySafeMove,
    openQuestions,
    timelineCues,
    structuredTaskStateUsed: true,
    nextSteps,
    recommendedFirstAction: nextLikelySafeMove,
    pendingBlocked: dedupe([...(baseSummary.pendingBlocked ?? []), ...task.blockers], 6),
    detailsMarkdown: `${detailsSections}\n\n${baseSummary.detailsMarkdown}`.trim(),
    codexPrompt: `${baseSummary.codexPrompt}\n\n${detailsSections}`.trim(),
  };
}
