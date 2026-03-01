import {
  computeRestoreAvailability,
  describeRerunDebugUnavailableReason,
  describeRerunTaskUnavailableReason,
} from '../src/restoreSafety';

describe('computeRestoreAvailability', () => {
  it('disables risky actions in restricted mode', () => {
    const result = computeRestoreAvailability({
      trusted: false,
      hasLastTask: true,
      hasLastDebug: true,
      hasFailingCommand: true,
      hasRecentEditLocation: true,
      currentBranch: 'feature/a',
      previousBranch: 'main',
    });

    expect(result).toEqual({
      canRerunTask: false,
      canRerunDebug: false,
      canCheckoutPreviousBranch: false,
      canCopyFailingCommand: true,
      canJumpToLastEdit: true,
    });
  });

  it('enables trusted actions only when corresponding evidence exists', () => {
    const result = computeRestoreAvailability({
      trusted: true,
      hasLastTask: true,
      hasLastDebug: false,
      hasFailingCommand: false,
      hasRecentEditLocation: true,
      currentBranch: 'feature/a',
      previousBranch: 'main',
    });

    expect(result).toEqual({
      canRerunTask: true,
      canRerunDebug: false,
      canCheckoutPreviousBranch: true,
      canCopyFailingCommand: false,
      canJumpToLastEdit: true,
    });
  });

  it('blocks checkout-previous when branch did not change', () => {
    const result = computeRestoreAvailability({
      trusted: true,
      hasLastTask: false,
      hasLastDebug: false,
      hasFailingCommand: false,
      hasRecentEditLocation: false,
      currentBranch: 'main',
      previousBranch: 'main',
    });

    expect(result.canCheckoutPreviousBranch).toBe(false);
    expect(result.canJumpToLastEdit).toBe(false);
  });
});

describe('restore unavailable reasons', () => {
  it('reports restricted-mode reason for rerun task/debug actions', () => {
    expect(
      describeRerunTaskUnavailableReason({
        trusted: false,
        hasLastTask: true,
      }),
    ).toContain('Restricted Mode');

    expect(
      describeRerunDebugUnavailableReason({
        trusted: false,
        hasLastDebug: true,
      }),
    ).toContain('Restricted Mode');
  });

  it('reports missing-history reason only in trusted mode', () => {
    expect(
      describeRerunTaskUnavailableReason({
        trusted: true,
        hasLastTask: false,
      }),
    ).toContain('no previous task run is known');
    expect(
      describeRerunDebugUnavailableReason({
        trusted: true,
        hasLastDebug: false,
      }),
    ).toContain('no previous debug session is known');
  });

  it('returns undefined when action should be available', () => {
    expect(
      describeRerunTaskUnavailableReason({
        trusted: true,
        hasLastTask: true,
      }),
    ).toBeUndefined();
    expect(
      describeRerunDebugUnavailableReason({
        trusted: true,
        hasLastDebug: true,
      }),
    ).toBeUndefined();
  });
});
