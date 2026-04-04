import {
  evaluateNoiseBudget,
  shouldAutoTriggerSummary,
  shouldDeferCheckpointPromptHighLoad,
  shouldDeferPromptAfterFocusRegain,
  shouldPromptCheckpointOnBlur,
} from '../src/noiseControl';
import type { CheckpointHighLoadDeferralInput } from '../src/noiseControl';

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

  it('allows trigger exactly at cooldown boundary', () => {
    const result = shouldAutoTriggerSummary({
      now: 20 * 60_000,
      lastBlurAt: 0,
      lastSummaryAt: 15 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: false,
    });

    expect(result).toBe(true);
  });

  it('allows first trigger when no previous summary exists and a primary gate is met', () => {
    const result = shouldAutoTriggerSummary({
      now: 5 * 60_000,
      lastBlurAt: 4 * 60_000,
      lastSummaryAt: 0,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: true,
      significantChange: false,
    });

    expect(result).toBe(true);
  });

  it('defers short-gap focus trigger when boundary mode is enabled and no boundary exists', () => {
    const result = shouldAutoTriggerSummary({
      now: 20 * 60_000,
      lastBlurAt: 20 * 60_000 - 30_000,
      lastSummaryAt: 5 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: true,
      lastBoundarySignalAt: 0,
      boundaryWindowMs: 90_000,
      maxDeferralWithoutBoundaryMs: 180_000,
    });

    expect(result).toBe(false);
  });

  it('allows short-gap focus trigger when recent boundary exists', () => {
    const now = 20 * 60_000;
    const result = shouldAutoTriggerSummary({
      now,
      lastBlurAt: now - 30_000,
      lastSummaryAt: 5 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: true,
      lastBoundarySignalAt: now - 20_000,
      boundaryWindowMs: 90_000,
      maxDeferralWithoutBoundaryMs: 180_000,
    });

    expect(result).toBe(true);
  });

  it('allows trigger once max deferral window has elapsed without boundary', () => {
    const now = 20 * 60_000;
    const result = shouldAutoTriggerSummary({
      now,
      lastBlurAt: now - 4 * 60_000,
      lastSummaryAt: 5 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: false,
      significantChange: true,
      lastBoundarySignalAt: 0,
      boundaryWindowMs: 90_000,
      maxDeferralWithoutBoundaryMs: 180_000,
    });

    expect(result).toBe(true);
  });

  it('allows project switch even when no boundary exists in window', () => {
    const now = 20 * 60_000;
    const result = shouldAutoTriggerSummary({
      now,
      lastBlurAt: now - 30_000,
      lastSummaryAt: 5 * 60_000,
      minIdleMinutes: 10,
      cooldownMinutes: 5,
      projectSwitched: true,
      significantChange: false,
      lastBoundarySignalAt: 0,
      boundaryWindowMs: 90_000,
      maxDeferralWithoutBoundaryMs: 180_000,
    });

    expect(result).toBe(true);
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

  it('allows prompt exactly at checkpoint prompt cooldown boundary', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 100 * 60_000,
        lastSummaryAt: 20 * 60_000,
        lastCheckpointPromptAt: 55 * 60_000,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 45,
        meaningfulChangeSinceLastPrompt: true,
      }),
    ).toBe(true);
  });

  it('blocks prompt when projected idle window still falls within summary cooldown', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 100 * 60_000,
        lastSummaryAt: 108 * 60_000,
        lastCheckpointPromptAt: 0,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 45,
        meaningfulChangeSinceLastPrompt: true,
      }),
    ).toBe(false);
  });

  it('clamps prompt cooldown to at least one minute', () => {
    expect(
      shouldPromptCheckpointOnBlur({
        now: 100 * 60_000,
        lastSummaryAt: 0,
        lastCheckpointPromptAt: 99 * 60_000 + 30_000,
        minIdleMinutes: 10,
        cooldownMinutes: 5,
        promptCooldownMinutes: 0,
        meaningfulChangeSinceLastPrompt: true,
      }),
    ).toBe(false);
  });
});

describe('shouldDeferPromptAfterFocusRegain', () => {
  it('returns true when meaningful activity happens within grace window', () => {
    expect(
      shouldDeferPromptAfterFocusRegain({
        focusGainedAt: 1_000,
        observedAt: 3_100,
        lastMeaningfulActivityAt: 2_000,
        graceWindowMs: 2_000,
      }),
    ).toBe(true);
  });

  it('returns false when no activity occurred in grace window', () => {
    expect(
      shouldDeferPromptAfterFocusRegain({
        focusGainedAt: 1_000,
        observedAt: 3_100,
        lastMeaningfulActivityAt: 0,
        graceWindowMs: 2_000,
      }),
    ).toBe(false);
  });

  it('returns false when observed before grace window elapsed', () => {
    expect(
      shouldDeferPromptAfterFocusRegain({
        focusGainedAt: 1_000,
        observedAt: 2_500,
        lastMeaningfulActivityAt: 2_000,
        graceWindowMs: 2_000,
      }),
    ).toBe(false);
  });
});

describe('evaluateNoiseBudget', () => {
  const policy = {
    windowMs: 15 * 60_000,
    maxSignalsPerWindow: 2,
    blockNudgesAfterSummaryMs: 5 * 60_000,
    blockNudgesAfterCheckpointMs: 3 * 60_000,
    blockCheckpointAfterSummaryMs: 5 * 60_000,
  };

  it('always allows summary prompts (highest priority) while pruning stale events', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'summary-prompt',
      events: [
        { kind: 'nudge', at: now - 10_000 },
        { kind: 'checkpoint-prompt', at: now - 2_000_000 },
      ],
      policy,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.recentEvents).toEqual([{ kind: 'nudge', at: now - 10_000 }]);
  });

  it('suppresses nudges after a recent summary prompt', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'nudge',
      events: [{ kind: 'summary-prompt', at: now - 60_000 }],
      policy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('recent-summary');
    expect(decision.nextEligibleAt).toBe(now - 60_000 + policy.blockNudgesAfterSummaryMs);
  });

  it('suppresses checkpoint prompts after a recent summary prompt', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'checkpoint-prompt',
      events: [{ kind: 'summary-prompt', at: now - 120_000 }],
      policy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('recent-summary');
  });

  it('suppresses nudges after a recent checkpoint prompt', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'nudge',
      events: [{ kind: 'checkpoint-prompt', at: now - 60_000 }],
      policy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('recent-checkpoint');
  });

  it('suppresses lower-priority signals when rolling window is full', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'nudge',
      events: [
        { kind: 'nudge', at: now - 120_000 },
        { kind: 'nudge', at: now - 60_000 },
      ],
      policy,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('window-full');
    expect(decision.nextEligibleAt).toBe(now - 120_000 + policy.windowMs);
  });

  it('allows nudge when no suppression condition is active', () => {
    const now = 1_000_000;
    const decision = evaluateNoiseBudget({
      now,
      signalKind: 'nudge',
      events: [{ kind: 'summary-prompt', at: now - 600_000 }],
      policy,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });
});

describe('shouldDeferCheckpointPromptHighLoad', () => {
  it('returns false when highLoadWindowMs is zero (disabled)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: 99_000,
      highLoadWindowMs: 0,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns false when highLoadWindowMs is negative (disabled)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: 99_000,
      highLoadWindowMs: -1,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns false when lastMeaningfulActivityAt is zero', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: 0,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns false when lastMeaningfulActivityAt is negative', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: -1,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns false when lastMeaningfulActivityAt is not finite (NaN)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: NaN,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns false when lastMeaningfulActivityAt is not finite (Infinity)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: Infinity,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns true when activity is within the high-load window', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: 50_000,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(true);
  });

  it('returns false when activity age exceeds the high-load window', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 200_000,
      lastMeaningfulActivityAt: 50_000,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });

  it('returns true at exact boundary (activityAgeMs === highLoadWindowMs)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 190_000,
      lastMeaningfulActivityAt: 100_000,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(true);
  });

  it('returns false when activity timestamp is in the future (activityAgeMs < 0)', () => {
    const input: CheckpointHighLoadDeferralInput = {
      now: 100_000,
      lastMeaningfulActivityAt: 150_000,
      highLoadWindowMs: 90_000,
    };
    expect(shouldDeferCheckpointPromptHighLoad(input)).toBe(false);
  });
});
