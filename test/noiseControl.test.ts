import { shouldAutoTriggerSummary } from '../src/noiseControl';

describe('shouldAutoTriggerSummary', () => {
  it('blocks triggers when idle, project switch, and significant-change gates are all false', () => {
    const result = shouldAutoTriggerSummary({
      now: 10_000,
      lastBlurAt: 9_000,
      lastSummaryAt: 0,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: false,
    });

    expect(result).toBe(false);
  });

  it('allows trigger when significant change is true and cooldown passed', () => {
    const result = shouldAutoTriggerSummary({
      now: 10 * 60_000,
      lastBlurAt: 9 * 60_000,
      lastSummaryAt: 2 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: true,
    });

    expect(result).toBe(true);
  });

  it('blocks trigger within cooldown even if idle threshold is met', () => {
    const result = shouldAutoTriggerSummary({
      now: 12 * 60_000,
      lastBlurAt: 0,
      lastSummaryAt: 9 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: false,
    });

    expect(result).toBe(false);
  });
});
