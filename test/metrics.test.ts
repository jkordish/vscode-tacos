import { buildMetricsCsv, hasAnyRecordedMetric } from '../src/metrics';
import type { MetricRecord } from '../src/types';

describe('hasAnyRecordedMetric', () => {
  it('treats companion-only usage as a captured metric session', () => {
    const metric: MetricRecord = {
      startedAt: 1_700_000_000_000,
      workspaceRoot: '/workspace/repo',
      trigger: 'focus',
      companionPromptImpressions: 2,
    };

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('returns false for empty metric sessions', () => {
    const metric: MetricRecord = {
      startedAt: 1_700_000_000_000,
      workspaceRoot: '/workspace/repo',
      trigger: 'focus',
    };

    expect(hasAnyRecordedMetric(metric)).toBe(false);
  });
});

describe('buildMetricsCsv', () => {
  it('emits stable csv rows with derived companion rates', () => {
    const csv = buildMetricsCsv([
      {
        startedAt: Date.UTC(2026, 0, 5, 18, 20, 0),
        workspaceRoot: '/workspace/repo,feature',
        trigger: 'manual',
        firstMeaningfulEditLagMs: 1200,
        firstRunLagMs: 2100,
        companionPromptImpressions: 4,
        companionForcedOpenDetailsClicks: 1,
        companionQuickActionsTaken: 3,
      },
    ]);

    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toContain('companionActionFollowThroughRate');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"/workspace/repo,feature"');
    expect(lines[1]).toContain(',0.7500,');
    expect(lines[1]).toContain(',0.2500');
  });
});
