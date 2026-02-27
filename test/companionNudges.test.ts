import {
  __test__,
  chooseCompanionNudges,
  describeCompanionNudgeReason,
  describeCompanionNudgeSuppression,
} from '../src/companionNudges';
import type { ResumeSummary } from '../src/types';

function buildSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'continue auth fix',
    nextSteps: ['Run auth tests', 'Fix failing assertion'],
    topFiles: ['src/auth.ts'],
    links: [],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'ctx',
    generatedAt: 1_700_000_000_000,
    source: 'local',
    ...overrides,
  };
}

type NudgeInput = Parameters<typeof chooseCompanionNudges>[0];

function buildInput(overrides: Partial<NudgeInput> = {}): NudgeInput {
  return {
    summary: buildSummary(),
    provider: 'local',
    mode: 'active',
    now: 1_700_000_000_000,
    enabled: true,
    aggressiveness: 'balanced',
    quietHours: '',
    cooldownMinutes: 10,
    lastShownAt: 0,
    ...overrides,
  };
}

describe('chooseCompanionNudges', () => {
  it('is deterministic for the same summary state and ranking', () => {
    const summary = buildSummary({
      lastFailingCommand: 'npm test -- auth',
      currentBranch: 'feature/auth',
      previousBranch: 'main',
    });

    const first = chooseCompanionNudges(buildInput({ summary }));
    const second = chooseCompanionNudges(buildInput({ summary }));

    expect(first).toEqual(second);
    expect(first.primary?.id).toBe('fix-failing-command');
    expect(first.secondary?.id).toBe('branch-switch');
  });

  it('suppresses nudges when feature is disabled', () => {
    const result = chooseCompanionNudges(buildInput({ enabled: false }));

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('disabled');
  });

  it.each(['paused', 'restricted', 'disabled'] as const)(
    'suppresses nudges outside active mode (%s)',
    (mode) => {
      const result = chooseCompanionNudges(buildInput({ mode }));

      expect(result.primary).toBeUndefined();
      expect(result.suppressedReason).toBe('inactive-mode');
    },
  );

  it('suppresses nudges when within cooldown window and reports next eligible time', () => {
    const result = chooseCompanionNudges(
      buildInput({
        summary: buildSummary({
          lastFailingCommand: 'npm test',
        }),
        now: 1_700_000_000_000,
        cooldownMinutes: 15,
        lastShownAt: 1_699_999_500_000,
      }),
    );

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('cooldown');
    expect(result.nextEligibleAt).toBe(1_699_999_500_000 + 15 * 60_000);
  });

  it('allows nudges exactly at cooldown boundary', () => {
    const cooldownMinutes = 5;
    const lastShownAt = 1_699_999_700_000;
    const now = lastShownAt + cooldownMinutes * 60_000;
    const result = chooseCompanionNudges(
      buildInput({
        summary: buildSummary({
          lastFailingCommand: 'npm test',
        }),
        cooldownMinutes,
        lastShownAt,
        now,
      }),
    );

    expect(result.suppressedReason).toBeUndefined();
    expect(result.primary?.id).toBe('fix-failing-command');
  });

  it('suppresses nudges during quiet hours windows', () => {
    const januaryNightLocal = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const result = chooseCompanionNudges(
      buildInput({
        summary: buildSummary({
          lastFailingCommand: 'npm test',
        }),
        now: januaryNightLocal,
        aggressiveness: 'high',
        quietHours: '22:00-07:00',
        cooldownMinutes: 5,
      }),
    );

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('quiet-hours');
  });

  it('returns no-candidate when no items meet aggressiveness threshold', () => {
    const result = chooseCompanionNudges(
      buildInput({
        summary: buildSummary({
          nextSteps: [],
        }),
        aggressiveness: 'low',
      }),
    );

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('no-candidate');
  });
});

describe('quiet hour parser', () => {
  it('parses standard and whitespace-padded ranges', () => {
    expect(__test__.parseQuietHoursWindow('09:30-17:45')).toEqual({
      startMinute: 570,
      endMinute: 1065,
    });
    expect(__test__.parseQuietHoursWindow(' 22:00 - 07:00 ')).toEqual({
      startMinute: 1320,
      endMinute: 420,
    });
  });

  it.each(['', 'bad', '25:00-07:00', '22:60-07:00', '22:00-22:00', '22:00'])(
    'rejects invalid quiet-hour inputs: %s',
    (value) => {
      expect(__test__.parseQuietHoursWindow(value)).toBeUndefined();
    },
  );

  it('handles wrap-around ranges', () => {
    const januaryNightLocal = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const januaryMorningLocal = new Date(2026, 0, 10, 6, 30, 0).getTime();
    const januaryDayLocal = new Date(2026, 0, 10, 12, 30, 0).getTime();

    expect(__test__.isInQuietHours(januaryNightLocal, '22:00-07:00')).toBe(true);
    expect(__test__.isInQuietHours(januaryMorningLocal, '22:00-07:00')).toBe(true);
    expect(__test__.isInQuietHours(januaryDayLocal, '22:00-07:00')).toBe(false);
  });

  it('handles daytime ranges', () => {
    const januaryMorningLocal = new Date(2026, 0, 10, 10, 0, 0).getTime();
    const januaryLateLocal = new Date(2026, 0, 10, 17, 0, 0).getTime();

    expect(__test__.isInQuietHours(januaryMorningLocal, '09:00-12:00')).toBe(true);
    expect(__test__.isInQuietHours(januaryLateLocal, '09:00-12:00')).toBe(false);
  });
});

describe('nudge explainability helpers', () => {
  it.each([
    [
      'fix-failing-command',
      'A recent failing command was detected for this context, so TaCoS prioritizes remediation.',
    ],
    ['branch-switch', 'TaCoS detected a branch switch between your last and current context.'],
    [
      'resume-next-step',
      'TaCoS found a saved next step and surfaced it as the fastest way to resume.',
    ],
    [
      'refresh-guidance',
      'No concrete next step was available, so TaCoS suggests regenerating guidance.',
    ],
  ] as const)('maps nudge reason text for %s', (id, expected) => {
    const decision = chooseCompanionNudges(
      buildInput({
        aggressiveness: id === 'refresh-guidance' ? 'high' : 'balanced',
        summary: buildSummary({
          lastFailingCommand: id === 'fix-failing-command' ? 'npm test' : undefined,
          currentBranch: id === 'branch-switch' ? 'feature/a' : undefined,
          previousBranch: id === 'branch-switch' ? 'main' : undefined,
          nextSteps: id === 'refresh-guidance' ? [] : ['Do thing'],
        }),
      }),
    );

    const nudge =
      decision.primary?.id === id
        ? decision.primary
        : decision.secondary?.id === id
          ? decision.secondary
          : undefined;
    expect(nudge).toBeDefined();
    expect(describeCompanionNudgeReason(nudge!)).toBe(expected);
  });

  it('renders suppression reasons including no-candidate and cooldown timestamp', () => {
    const disabled = describeCompanionNudgeSuppression({ suppressedReason: 'disabled' });
    const inactive = describeCompanionNudgeSuppression({ suppressedReason: 'inactive-mode' });
    const quiet = describeCompanionNudgeSuppression({ suppressedReason: 'quiet-hours' });
    const noCandidate = describeCompanionNudgeSuppression({ suppressedReason: 'no-candidate' });
    const cooldown = describeCompanionNudgeSuppression(
      {
        suppressedReason: 'cooldown',
        nextEligibleAt: 1_700_000_000_000,
      },
      {
        formatTimestamp: () => 'soon',
      },
    );

    expect(disabled).toBe('Companion nudges are disabled in settings.');
    expect(inactive).toBe('Nudges are hidden while companion mode is paused or restricted.');
    expect(quiet).toBe('Nudges are currently in your configured quiet hours window.');
    expect(noCandidate).toBe('No high-confidence nudge is available for this context yet.');
    expect(cooldown).toBe('Nudges are cooling down until soon.');
  });
});
