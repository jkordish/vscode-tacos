export interface RestoreAvailabilityInput {
  trusted: boolean;
  hasLastTask: boolean;
  hasLastDebug: boolean;
  hasFailingCommand: boolean;
  currentBranch?: string;
  previousBranch?: string;
}

export interface RestoreAvailability {
  canRerunTask: boolean;
  canRerunDebug: boolean;
  canCheckoutPreviousBranch: boolean;
  canCopyFailingCommand: boolean;
}

export function computeRestoreAvailability(input: RestoreAvailabilityInput): RestoreAvailability {
  if (!input.trusted) {
    return {
      canRerunTask: false,
      canRerunDebug: false,
      canCheckoutPreviousBranch: false,
      canCopyFailingCommand: input.hasFailingCommand,
    };
  }

  const hasBranchSwitchTarget =
    Boolean(input.currentBranch) &&
    Boolean(input.previousBranch) &&
    input.currentBranch !== input.previousBranch;

  return {
    canRerunTask: input.hasLastTask,
    canRerunDebug: input.hasLastDebug,
    canCheckoutPreviousBranch: hasBranchSwitchTarget,
    canCopyFailingCommand: input.hasFailingCommand,
  };
}
