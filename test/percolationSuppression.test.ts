import { evaluatePercolationSuppression } from '../src/percolation/suppression';

describe('evaluatePercolationSuppression', () => {
  it('applies deterministic suppression precedence', () => {
    const now = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const decision = evaluatePercolationSuppression({
      enabled: false,
      mode: 'active',
      now,
      quietHours: '22:00-07:00',
      cooldownMinutes: 5,
      lastShownAt: now - 60_000,
      contextUnchanged: true,
      noiseBudgetAllowed: false,
      noiseBudgetNextEligibleAt: now + 60_000,
    });

    expect(decision).toEqual({
      suppressed: true,
      reason: 'disabled',
    });
  });

  it('returns cooldown with next eligible timestamp', () => {
    const now = 1_700_000_000_000;
    const lastShownAt = now - 60_000;
    const decision = evaluatePercolationSuppression({
      enabled: true,
      mode: 'active',
      now,
      cooldownMinutes: 3,
      lastShownAt,
    });

    expect(decision).toEqual({
      suppressed: true,
      reason: 'cooldown',
      nextEligibleAt: lastShownAt + 3 * 60_000,
    });
  });

  it.each([
    ['paused', 'paused'],
    ['restricted', 'restricted'],
    ['disabled', 'disabled'],
  ] as const)('returns mode-specific suppression reason for non-active mode (%s)', (mode, reason) => {
    const decision = evaluatePercolationSuppression({
      enabled: true,
      mode,
      now: 1_700_000_000_000,
    });

    expect(decision).toEqual({
      suppressed: true,
      reason,
    });
  });

  it('returns no-change when context is unchanged and no earlier gate suppresses', () => {
    const decision = evaluatePercolationSuppression({
      enabled: true,
      mode: 'active',
      now: 1_700_000_000_000,
      contextUnchanged: true,
      noiseBudgetAllowed: false,
      noiseBudgetNextEligibleAt: 1_700_000_200_000,
    });

    expect(decision).toEqual({
      suppressed: true,
      reason: 'no-change',
    });
  });

  it('returns noise-budget with next eligible when budget is blocked', () => {
    const decision = evaluatePercolationSuppression({
      enabled: true,
      mode: 'active',
      now: 1_700_000_000_000,
      noiseBudgetAllowed: false,
      noiseBudgetNextEligibleAt: 1_700_000_100_000,
    });

    expect(decision).toEqual({
      suppressed: true,
      reason: 'noise-budget',
      nextEligibleAt: 1_700_000_100_000,
    });
  });

  it('returns unsuppressed when no gate blocks surfacing', () => {
    const decision = evaluatePercolationSuppression({
      enabled: true,
      mode: 'active',
      now: 1_700_000_000_000,
      quietHours: '22:00-07:00',
      cooldownMinutes: 10,
      lastShownAt: 1_699_000_000_000,
      contextUnchanged: false,
      noiseBudgetAllowed: true,
    });

    expect(decision).toEqual({
      suppressed: false,
    });
  });
});
