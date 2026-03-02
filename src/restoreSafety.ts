export interface RestoreAvailabilityInput {
  trusted: boolean;
  hasLastTask: boolean;
  hasLastDebug: boolean;
  hasFailingCommand: boolean;
  hasRecentEditLocation: boolean;
  currentBranch?: string;
  previousBranch?: string;
}

export interface RestoreAvailability {
  canRerunTask: boolean;
  canRerunDebug: boolean;
  canCheckoutPreviousBranch: boolean;
  canCopyFailingCommand: boolean;
  canJumpToLastEdit: boolean;
}

export function describeRerunTaskUnavailableReason(input: {
  trusted: boolean;
  hasLastTask: boolean;
}): string | undefined {
  if (!input.trusted) {
    return 'Rerun task is unavailable in Restricted Mode: trust this workspace to enable task execution.';
  }
  if (!input.hasLastTask) {
    return 'Rerun task is unavailable: no previous task run is known.';
  }
  return undefined;
}

export function describeRerunDebugUnavailableReason(input: {
  trusted: boolean;
  hasLastDebug: boolean;
}): string | undefined {
  if (!input.trusted) {
    return 'Rerun debug is unavailable in Restricted Mode: trust this workspace to enable debug execution.';
  }
  if (!input.hasLastDebug) {
    return 'Rerun debug is unavailable: no previous debug session is known.';
  }
  return undefined;
}

export function describeCheckoutPreviousBranchUnavailableReason(input: {
  trusted: boolean;
  currentBranch?: string;
  previousBranch?: string;
}): string | undefined {
  if (!input.trusted) {
    return 'Checkout previous branch is unavailable in Restricted Mode: trust this workspace to enable branch execution.';
  }

  const currentBranch = input.currentBranch?.trim();
  const previousBranch = input.previousBranch?.trim();
  if (!currentBranch || !previousBranch || currentBranch === previousBranch) {
    return 'Checkout previous branch is unavailable: no previous branch target is known.';
  }

  return undefined;
}

export function computeRestoreAvailability(input: RestoreAvailabilityInput): RestoreAvailability {
  if (!input.trusted) {
    return {
      canRerunTask: false,
      canRerunDebug: false,
      canCheckoutPreviousBranch: false,
      canCopyFailingCommand: input.hasFailingCommand,
      canJumpToLastEdit: input.hasRecentEditLocation,
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
    canJumpToLastEdit: input.hasRecentEditLocation,
  };
}
