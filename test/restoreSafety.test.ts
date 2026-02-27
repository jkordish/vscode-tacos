import { computeRestoreAvailability } from '../src/restoreSafety';

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
