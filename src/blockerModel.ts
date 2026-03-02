import type { RestoreAvailability } from './restoreSafety';

export type BlockerActionType =
  | 'sessionAddCheckpoint'
  | 'restoreRerunTask'
  | 'restoreCopyFailingCommand'
  | 'restoreOpenProblems'
  | 'restoreOpenDiagnosticFile'
  | 'restoreCheckoutPreviousBranch'
  | 'refreshSummary';

export type BlockerKind =
  | 'none'
  | 'restricted'
  | 'taskFailure'
  | 'commandFailure'
  | 'diagnostics'
  | 'branchContext'
  | 'lowConfidence'
  | 'noNextSteps';

export type BlockerSeverityLabel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface BlockerModelInput {
  trusted: boolean;
  longGap: boolean;
  lowConfidence: boolean;
  hasCheckpointNote: boolean;
  hasFailingTask: boolean;
  lastTaskName?: string;
  lastTaskExitCode?: number;
  lastFailingCommand?: string;
  diagnosticsErrorCount: number;
  diagnosticsTopPath?: string;
  diagnosticsTopLine?: number;
  switchedBranches: boolean;
  currentBranch?: string;
  previousBranch?: string;
  hasNextSteps: boolean;
  canOpenProblems: boolean;
  canOpenDiagnosticFile: boolean;
  availability: RestoreAvailability;
}

export interface BlockerPrimaryAction {
  label: string;
  type: BlockerActionType;
  disabled: boolean;
  disabledReason?: string;
}

export interface BlockerDecision {
  kind: BlockerKind;
  hasBlocker: boolean;
  title: string;
  detail: string;
  evidenceLabel?: string;
  confidenceLabel: 'high' | 'medium' | 'low';
  severityLabel: BlockerSeverityLabel;
  severityScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  action?: BlockerPrimaryAction;
}

interface BlockerCandidate extends BlockerDecision {
  priorityScore: number;
  precedenceRank: number;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function toSeverityLabel(score: number): BlockerSeverityLabel {
  if (score >= 0.9) {
    return 'critical';
  }
  if (score >= 0.72) {
    return 'high';
  }
  if (score >= 0.5) {
    return 'medium';
  }
  if (score > 0) {
    return 'low';
  }
  return 'none';
}

function toConfidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.78) {
    return 'high';
  }
  if (score >= 0.52) {
    return 'medium';
  }
  return 'low';
}

function scoreActionability(action: BlockerPrimaryAction | undefined): number {
  if (!action) {
    return 0.2;
  }

  if (action.disabled) {
    return 0.24;
  }

  switch (action.type) {
    case 'restoreRerunTask':
      return 0.94;
    case 'restoreCopyFailingCommand':
      return 0.86;
    case 'restoreOpenDiagnosticFile':
      return 0.82;
    case 'restoreOpenProblems':
      return 0.76;
    case 'restoreCheckoutPreviousBranch':
      return 0.7;
    case 'sessionAddCheckpoint':
      return 0.78;
    case 'refreshSummary':
      return 0.66;
    default:
      return 0.6;
  }
}

function scoreCandidate(
  severityScore: number,
  confidenceScore: number,
  actionabilityScore: number,
): number {
  // Weighted blend tuned to keep severe blockers primary while still preferring actionable options.
  return severityScore * 0.55 + confidenceScore * 0.25 + actionabilityScore * 0.2;
}

function disabledAction(
  label: string,
  type: BlockerActionType,
  disabledReason: string,
): BlockerPrimaryAction {
  return {
    label,
    type,
    disabled: true,
    disabledReason,
  };
}

function enabledAction(label: string, type: BlockerActionType): BlockerPrimaryAction {
  return {
    label,
    type,
    disabled: false,
  };
}

function trustRestrictedReason(actionLabel: string): string {
  return `Restricted Mode: trust this workspace to enable “${actionLabel}”.`;
}

function rerunDisabledReason(input: BlockerModelInput): string {
  if (!input.trusted) {
    return trustRestrictedReason('Rerun last task');
  }
  if (input.longGap) {
    return 'Long-gap reorientation keeps rerun disabled until context is reviewed.';
  }
  return 'No recent task metadata is available for rerun.';
}

function branchDisabledReason(input: BlockerModelInput): string {
  if (!input.trusted) {
    return trustRestrictedReason('Checkout previous branch');
  }
  return 'No previous branch target is available.';
}

function createCandidate(
  base: Omit<
    BlockerCandidate,
    | 'confidenceLabel'
    | 'severityLabel'
    | 'priorityScore'
    | 'severityScore'
    | 'confidenceScore'
    | 'actionabilityScore'
  > & {
    severityScore: number;
    confidenceScore: number;
    actionabilityScore?: number;
  },
): BlockerCandidate {
  const severityScore = clampUnit(base.severityScore);
  const confidenceScore = clampUnit(base.confidenceScore);
  const actionabilityScore = clampUnit(base.actionabilityScore ?? scoreActionability(base.action));
  const priorityScore = scoreCandidate(severityScore, confidenceScore, actionabilityScore);

  return {
    ...base,
    severityScore,
    confidenceScore,
    actionabilityScore,
    severityLabel: toSeverityLabel(severityScore),
    confidenceLabel: toConfidenceLabel(confidenceScore),
    priorityScore,
  };
}

function buildTaskFailureCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (!input.hasFailingTask) {
    return undefined;
  }

  if (input.longGap) {
    const action = input.availability.canCopyFailingCommand
      ? enabledAction('Copy failing command', 'restoreCopyFailingCommand')
      : input.canOpenProblems
        ? enabledAction('Open Problems', 'restoreOpenProblems')
        : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
    return createCandidate({
      kind: 'taskFailure',
      hasBlocker: true,
      title: 'Reorient after a long gap',
      detail: `${input.lastTaskName ?? 'Last task'} exited with code ${input.lastTaskExitCode ?? 'unknown'}. Review context before rerunning.`,
      evidenceLabel: 'task failure',
      action,
      precedenceRank: 1,
      severityScore: 0.96,
      confidenceScore: Number.isInteger(input.lastTaskExitCode) ? 0.95 : 0.86,
    });
  }

  const action = input.availability.canRerunTask
    ? enabledAction('Rerun last task', 'restoreRerunTask')
    : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
  return createCandidate({
    kind: 'taskFailure',
    hasBlocker: true,
    title: 'Last task failed',
    detail: `${input.lastTaskName ?? 'Last task'} exited with code ${input.lastTaskExitCode ?? 'unknown'}.`,
    evidenceLabel: 'task failure',
    action,
    precedenceRank: 1,
    severityScore: 0.97,
    confidenceScore: Number.isInteger(input.lastTaskExitCode) ? 0.97 : 0.88,
  });
}

function buildCommandFailureCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (!input.lastFailingCommand) {
    return undefined;
  }

  if (input.longGap) {
    const action = input.availability.canCopyFailingCommand
      ? enabledAction('Copy failing command', 'restoreCopyFailingCommand')
      : input.canOpenProblems
        ? enabledAction('Open Problems', 'restoreOpenProblems')
        : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
    return createCandidate({
      kind: 'commandFailure',
      hasBlocker: true,
      title: 'Reorient after a long gap',
      detail: `${input.lastFailingCommand}. Review context before rerunning.`,
      evidenceLabel: 'failing command',
      action,
      precedenceRank: 2,
      severityScore: 0.9,
      confidenceScore: 0.86,
    });
  }

  let action: BlockerPrimaryAction;
  if (input.availability.canRerunTask) {
    action = enabledAction('Rerun last task', 'restoreRerunTask');
  } else if (input.availability.canCopyFailingCommand) {
    action = enabledAction('Copy failing command', 'restoreCopyFailingCommand');
  } else {
    action = disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
  }

  return createCandidate({
    kind: 'commandFailure',
    hasBlocker: true,
    title: 'Last command failed',
    detail: input.lastFailingCommand,
    evidenceLabel: 'failing command',
    action,
    precedenceRank: 2,
    severityScore: 0.91,
    confidenceScore: 0.84,
  });
}

function buildDiagnosticsCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (input.diagnosticsErrorCount <= 0) {
    return undefined;
  }

  const action = input.canOpenDiagnosticFile
    ? enabledAction('Open diagnostic file', 'restoreOpenDiagnosticFile')
    : input.canOpenProblems
      ? enabledAction('Open Problems', 'restoreOpenProblems')
      : disabledAction(
          'Open Problems',
          'restoreOpenProblems',
          'No diagnostics are currently available to open.',
        );
  const normalizedDiagnosticsCount = Math.max(0, Math.min(12, input.diagnosticsErrorCount));
  const severityScore = 0.63 + normalizedDiagnosticsCount * 0.018;

  return createCandidate({
    kind: 'diagnostics',
    hasBlocker: true,
    title: 'Diagnostics need attention',
    detail: input.diagnosticsTopPath
      ? `${input.diagnosticsErrorCount} error(s). First at ${input.diagnosticsTopPath}:${(input.diagnosticsTopLine ?? 0) + 1}.`
      : `${input.diagnosticsErrorCount} error(s) in Problems view.`,
    evidenceLabel: 'workspace diagnostics',
    action,
    precedenceRank: 3,
    severityScore,
    confidenceScore: input.diagnosticsTopPath ? 0.84 : 0.74,
  });
}

function buildBranchContextCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (!input.switchedBranches) {
    return undefined;
  }

  const action = input.availability.canCheckoutPreviousBranch
    ? enabledAction('Checkout previous branch', 'restoreCheckoutPreviousBranch')
    : disabledAction(
        'Checkout previous branch',
        'restoreCheckoutPreviousBranch',
        branchDisabledReason(input),
      );

  return createCandidate({
    kind: 'branchContext',
    hasBlocker: true,
    title: 'Branch context changed',
    detail: `You moved from ${input.previousBranch} to ${input.currentBranch}.`,
    evidenceLabel: 'branch switch',
    action,
    precedenceRank: 4,
    severityScore: 0.57,
    confidenceScore: 0.74,
  });
}

function buildLowConfidenceCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (!input.lowConfidence || input.hasCheckpointNote) {
    return undefined;
  }

  return createCandidate({
    kind: 'lowConfidence',
    hasBlocker: true,
    title: 'Low-confidence resume context',
    detail: 'Evidence is sparse. Add a one-line checkpoint before taking risky actions.',
    evidenceLabel: 'sparse evidence',
    action: enabledAction('Add checkpoint', 'sessionAddCheckpoint'),
    precedenceRank: 5,
    severityScore: 0.49,
    confidenceScore: 0.48,
  });
}

function buildRestrictedCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (input.trusted) {
    return undefined;
  }

  return createCandidate({
    kind: 'restricted',
    hasBlocker: true,
    title: 'Workspace is in Restricted Mode',
    detail: 'Task/debug reruns and branch checkout are disabled until workspace trust is granted.',
    evidenceLabel: 'workspace trust',
    action: disabledAction(
      'Rerun last task',
      'restoreRerunTask',
      trustRestrictedReason('Rerun last task'),
    ),
    precedenceRank: 6,
    severityScore: 0.54,
    confidenceScore: 0.97,
  });
}

function buildNoNextStepsCandidate(input: BlockerModelInput): BlockerCandidate | undefined {
  if (input.hasNextSteps) {
    return undefined;
  }

  return createCandidate({
    kind: 'noNextSteps',
    hasBlocker: true,
    title: 'No next steps available',
    detail: 'Refresh summary to regenerate guidance.',
    evidenceLabel: 'summary freshness',
    action: enabledAction('Refresh summary', 'refreshSummary'),
    precedenceRank: 7,
    severityScore: 0.43,
    confidenceScore: 0.67,
  });
}

function compareCandidates(left: BlockerCandidate, right: BlockerCandidate): number {
  if (left.priorityScore !== right.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }
  if (left.severityScore !== right.severityScore) {
    return right.severityScore - left.severityScore;
  }
  if (left.confidenceScore !== right.confidenceScore) {
    return right.confidenceScore - left.confidenceScore;
  }
  if (left.actionabilityScore !== right.actionabilityScore) {
    return right.actionabilityScore - left.actionabilityScore;
  }

  return left.precedenceRank - right.precedenceRank;
}

export function decidePrimaryBlocker(input: BlockerModelInput): BlockerDecision {
  const candidates = [
    buildTaskFailureCandidate(input),
    buildCommandFailureCandidate(input),
    buildDiagnosticsCandidate(input),
    buildBranchContextCandidate(input),
    buildLowConfidenceCandidate(input),
    buildRestrictedCandidate(input),
    buildNoNextStepsCandidate(input),
  ].filter((candidate): candidate is BlockerCandidate => Boolean(candidate));

  const selected = candidates.sort(compareCandidates)[0];
  if (selected) {
    return {
      kind: selected.kind,
      hasBlocker: selected.hasBlocker,
      title: selected.title,
      detail: selected.detail,
      evidenceLabel: selected.evidenceLabel,
      confidenceLabel: selected.confidenceLabel,
      severityLabel: selected.severityLabel,
      severityScore: selected.severityScore,
      confidenceScore: selected.confidenceScore,
      actionabilityScore: selected.actionabilityScore,
      action: selected.action,
    };
  }

  return {
    kind: 'none',
    hasBlocker: false,
    title: 'No active blocker',
    detail: 'Continue with the first suggested next step.',
    confidenceLabel: 'high',
    severityLabel: 'none',
    severityScore: 0,
    confidenceScore: 1,
    actionabilityScore: 0,
  };
}
