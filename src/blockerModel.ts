import type { RestoreAvailability } from './restoreSafety';

export type BlockerActionType =
  | 'sessionAddCheckpoint'
  | 'restoreRerunTask'
  | 'restoreCopyFailingCommand'
  | 'restoreOpenProblems'
  | 'restoreOpenDiagnosticFile'
  | 'restoreCheckoutPreviousBranch'
  | 'refreshSummary';

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
  kind:
    | 'none'
    | 'restricted'
    | 'taskFailure'
    | 'commandFailure'
    | 'diagnostics'
    | 'branchContext'
    | 'lowConfidence'
    | 'noNextSteps';
  hasBlocker: boolean;
  title: string;
  detail: string;
  evidenceLabel?: string;
  confidenceLabel?: 'high' | 'medium' | 'low';
  action?: BlockerPrimaryAction;
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

export function decidePrimaryBlocker(input: BlockerModelInput): BlockerDecision {
  if (input.hasFailingTask) {
    if (input.longGap) {
      const action = input.availability.canCopyFailingCommand
        ? enabledAction('Copy failing command', 'restoreCopyFailingCommand')
        : input.canOpenProblems
          ? enabledAction('Open Problems', 'restoreOpenProblems')
          : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
      return {
        kind: 'taskFailure',
        hasBlocker: true,
        title: 'Reorient after a long gap',
        detail: `${input.lastTaskName ?? 'Last task'} exited with code ${input.lastTaskExitCode ?? 'unknown'}. Review context before rerunning.`,
        evidenceLabel: 'task failure',
        confidenceLabel: 'high',
        action,
      };
    }

    const action = input.availability.canRerunTask
      ? enabledAction('Rerun last task', 'restoreRerunTask')
      : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
    return {
      kind: 'taskFailure',
      hasBlocker: true,
      title: 'Last task failed',
      detail: `${input.lastTaskName ?? 'Last task'} exited with code ${input.lastTaskExitCode ?? 'unknown'}.`,
      evidenceLabel: 'task failure',
      confidenceLabel: 'high',
      action,
    };
  }

  if (input.lastFailingCommand) {
    if (input.longGap) {
      const action = input.availability.canCopyFailingCommand
        ? enabledAction('Copy failing command', 'restoreCopyFailingCommand')
        : input.canOpenProblems
          ? enabledAction('Open Problems', 'restoreOpenProblems')
          : disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
      return {
        kind: 'commandFailure',
        hasBlocker: true,
        title: 'Reorient after a long gap',
        detail: `${input.lastFailingCommand} Review context before rerunning.`,
        evidenceLabel: 'failing command',
        confidenceLabel: 'high',
        action,
      };
    }

    let action: BlockerPrimaryAction;
    if (input.availability.canRerunTask) {
      action = enabledAction('Rerun last task', 'restoreRerunTask');
    } else if (input.availability.canCopyFailingCommand) {
      action = enabledAction('Copy failing command', 'restoreCopyFailingCommand');
    } else {
      action = disabledAction('Rerun last task', 'restoreRerunTask', rerunDisabledReason(input));
    }

    return {
      kind: 'commandFailure',
      hasBlocker: true,
      title: 'Last command failed',
      detail: input.lastFailingCommand,
      evidenceLabel: 'failing command',
      confidenceLabel: 'high',
      action,
    };
  }

  if (input.diagnosticsErrorCount > 0) {
    const action = input.canOpenDiagnosticFile
      ? enabledAction('Open diagnostic file', 'restoreOpenDiagnosticFile')
      : input.canOpenProblems
        ? enabledAction('Open Problems', 'restoreOpenProblems')
        : disabledAction(
            'Open Problems',
            'restoreOpenProblems',
            'No diagnostics are currently available to open.',
          );
    return {
      kind: 'diagnostics',
      hasBlocker: true,
      title: 'Diagnostics need attention',
      detail: input.diagnosticsTopPath
        ? `${input.diagnosticsErrorCount} error(s). First at ${input.diagnosticsTopPath}:${(input.diagnosticsTopLine ?? 0) + 1}.`
        : `${input.diagnosticsErrorCount} error(s) in Problems view.`,
      evidenceLabel: 'workspace diagnostics',
      confidenceLabel: 'high',
      action,
    };
  }

  if (input.switchedBranches) {
    const action = input.availability.canCheckoutPreviousBranch
      ? enabledAction('Checkout previous branch', 'restoreCheckoutPreviousBranch')
      : disabledAction(
          'Checkout previous branch',
          'restoreCheckoutPreviousBranch',
          branchDisabledReason(input),
        );
    return {
      kind: 'branchContext',
      hasBlocker: true,
      title: 'Branch context changed',
      detail: `You moved from ${input.previousBranch} to ${input.currentBranch}.`,
      evidenceLabel: 'branch switch',
      confidenceLabel: 'medium',
      action,
    };
  }

  if (input.lowConfidence && !input.hasCheckpointNote) {
    return {
      kind: 'lowConfidence',
      hasBlocker: true,
      title: 'Low-confidence resume context',
      detail: 'Evidence is sparse. Add a one-line checkpoint before taking risky actions.',
      evidenceLabel: 'sparse evidence',
      confidenceLabel: 'low',
      action: enabledAction('Add checkpoint', 'sessionAddCheckpoint'),
    };
  }

  if (!input.trusted) {
    return {
      kind: 'restricted',
      hasBlocker: true,
      title: 'Workspace is in Restricted Mode',
      detail:
        'Task/debug reruns and branch checkout are disabled until workspace trust is granted.',
      evidenceLabel: 'workspace trust',
      confidenceLabel: 'high',
      action: disabledAction(
        'Rerun last task',
        'restoreRerunTask',
        trustRestrictedReason('Rerun last task'),
      ),
    };
  }

  if (!input.hasNextSteps) {
    return {
      kind: 'noNextSteps',
      hasBlocker: true,
      title: 'No next steps available',
      detail: 'Refresh summary to regenerate guidance.',
      evidenceLabel: 'summary freshness',
      confidenceLabel: 'medium',
      action: enabledAction('Refresh summary', 'refreshSummary'),
    };
  }

  return {
    kind: 'none',
    hasBlocker: false,
    title: 'No active blocker',
    detail: 'Continue with the first suggested next step.',
  };
}
