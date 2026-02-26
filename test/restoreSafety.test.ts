import { computeRestoreAvailability } from '../src/restoreSafety';

describe('computeRestoreAvailability', () => {
  it('disables risky actions in restricted mode', () => {
    const result = computeRestoreAvailability({
      trusted: false,
      hasLastTask: true,
      hasLastDebug: true,
      hasFailingCommand: true,
      currentBranch: 'feature/a',
      previousBranch: 'main',
    });

    expect(result).toEqual({
      canRerunTask: false,
      canRerunDebug: false,
      canCheckoutPreviousBranch: false,
      canCopyFailingCommand: true,
    });
  });

  it('enables trusted actions only when corresponding evidence exists', () => {
    const result = computeRestoreAvailability({
      trusted: true,
      hasLastTask: true,
      hasLastDebug: false,
      hasFailingCommand: false,
      currentBranch: 'feature/a',
      previousBranch: 'main',
    });

    expect(result).toEqual({
      canRerunTask: true,
      canRerunDebug: false,
      canCheckoutPreviousBranch: true,
      canCopyFailingCommand: false,
    });
  });

  it('blocks checkout-previous when branch did not change', () => {
    const result = computeRestoreAvailability({
      trusted: true,
      hasLastTask: false,
      hasLastDebug: false,
      hasFailingCommand: false,
      currentBranch: 'main',
      previousBranch: 'main',
    });

    expect(result.canCheckoutPreviousBranch).toBe(false);
  });
});
