import { shouldAutoTriggerSummary, shouldPromptCheckpointOnBlur } from '../src/noiseControl';

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

  it('allows trigger when workspace switched and cooldown passed', () => {
    const result = shouldAutoTriggerSummary({
      now: 20 * 60_000,
      lastBlurAt: 19 * 60_000,
      lastSummaryAt: 10 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: true,
      significantChange: false,
    });

    expect(result).toBe(true);
  });

  it('allows trigger when idle threshold is met and cooldown passed', () => {
    const result = shouldAutoTriggerSummary({
      now: 30 * 60_000,
      lastBlurAt: 0,
      lastSummaryAt: 20 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: false,
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

describe('shouldPromptCheckpointOnBlur', () => {
  it('blocks prompt when there was no meaningful activity', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 100_000,
        lastSummaryAt: 0,
        lastCheckpointPromptAt: 0,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 45,
        meaningfulChangeSinceLastPrompt: false,
      }),
    ).toBe(false);
  });

  it('blocks repeated prompts inside checkpoint cooldown window', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 60 * 60_000,
        lastSummaryAt: 0,
        lastCheckpointPromptAt: 30 * 60_000,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 45,
        meaningfulChangeSinceLastPrompt: true,
      }),
    ).toBe(false);
  });

  it('allows prompt when meaningful activity exists and cooldowns are satisfied', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 120 * 60_000,
        lastSummaryAt: 10 * 60_000,
        lastCheckpointPromptAt: 50 * 60_000,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 45,
        meaningfulChangeSinceLastPrompt: true,
      }),
    ).toBe(true);
  });
});
