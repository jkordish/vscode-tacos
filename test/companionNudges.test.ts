import { __test__, chooseCompanionNudges } from '../src/companionNudges';
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

describe('chooseCompanionNudges', () => {
  it('is deterministic for the same summary state', () => {
    const summary = buildSummary({
      lastFailingCommand: 'npm test -- auth',
      currentBranch: 'feature/auth',
      previousBranch: 'main',
    });

    const first = chooseCompanionNudges({
      summary,
      provider: 'local',
      mode: 'active',
      now: 1_700_000_000_000,
      enabled: true,
      aggressiveness: 'balanced',
      quietHours: '',
      cooldownMinutes: 10,
      lastShownAt: 0,
    });
    const second = chooseCompanionNudges({
      summary,
      provider: 'local',
      mode: 'active',
      now: 1_700_000_000_000,
      enabled: true,
      aggressiveness: 'balanced',
      quietHours: '',
      cooldownMinutes: 10,
      lastShownAt: 0,
    });

    expect(first).toEqual(second);
    expect(first.primary?.id).toBe('fix-failing-command');
  });

  it('suppresses nudges when within cooldown window', () => {
    const result = chooseCompanionNudges({
      summary: buildSummary({
        lastFailingCommand: 'npm test',
      }),
      provider: 'local',
      mode: 'active',
      now: 1_700_000_000_000,
      enabled: true,
      aggressiveness: 'high',
      quietHours: '',
      cooldownMinutes: 15,
      lastShownAt: 1_699_999_500_000,
    });

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('cooldown');
    expect(result.nextEligibleAt).toBe(1_699_999_500_000 + 15 * 60_000);
  });

  it('suppresses nudges during quiet hours windows', () => {
    const januaryNightLocal = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const result = chooseCompanionNudges({
      summary: buildSummary({
        lastFailingCommand: 'npm test',
      }),
      provider: 'local',
      mode: 'active',
      now: januaryNightLocal,
      enabled: true,
      aggressiveness: 'high',
      quietHours: '22:00-07:00',
      cooldownMinutes: 5,
      lastShownAt: 0,
    });

    expect(result.primary).toBeUndefined();
    expect(result.suppressedReason).toBe('quiet-hours');
  });
});

describe('quiet hour parser', () => {
  it('handles wrap-around ranges', () => {
    const januaryNightLocal = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const januaryMorningLocal = new Date(2026, 0, 10, 6, 30, 0).getTime();
    const januaryDayLocal = new Date(2026, 0, 10, 12, 30, 0).getTime();

    expect(__test__.isInQuietHours(januaryNightLocal, '22:00-07:00')).toBe(true);
    expect(__test__.isInQuietHours(januaryMorningLocal, '22:00-07:00')).toBe(true);
    expect(__test__.isInQuietHours(januaryDayLocal, '22:00-07:00')).toBe(false);
  });
});
