import {
  buildMetricsBaselineSnapshotMarkdown,
  buildMetricsCsv,
  hasAnyRecordedMetric,
  pruneMetricsForWorkspace,
  removeMetricsForWorkspace,
} from '../src/metrics';
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
      startedAt: Number.NaN,
      workspaceRoot: '',
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
        uiSurface: 'statusbar',
        interruptionEvent: 0,
        firstMeaningfulEditLagMs: 1200,
        firstRunLagMs: 2100,
        firstActionLagMs: 1300,
        companionPromptImpressions: 4,
        companionForcedOpenDetailsClicks: 1,
        companionQuickActionsTaken: 3,
        helpfulnessRating: 4,
        pauseActions: 1,
        snoozeActions: 0,
        disableActions: 0,
      },
    ]);

    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toContain('firstActionLagMs');
    expect(lines[0]).toContain('helpfulnessRating');
    expect(lines[0]).toContain('companionActionFollowThroughRate');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"/workspace/repo,feature"');
    expect(lines[1]).toContain(',statusbar,0,');
    expect(lines[1]).toContain(',0.7500,');
    expect(lines[1]).toContain(',0.2500');
  });
});

describe('workspace metric helpers', () => {
  const seedMetrics: MetricRecord[] = [
    {
      startedAt: Date.UTC(2026, 1, 1, 10, 0, 0),
      workspaceRoot: '/workspace/a',
      trigger: 'focus',
    },
    {
      startedAt: Date.UTC(2026, 1, 1, 10, 5, 0),
      workspaceRoot: '/workspace/b',
      trigger: 'manual',
    },
    {
      startedAt: Date.UTC(2026, 1, 1, 10, 10, 0),
      workspaceRoot: '/workspace/a',
      trigger: 'cached',
    },
  ];

  it('removes only the targeted workspace metrics', () => {
    const result = removeMetricsForWorkspace(seedMetrics, '/workspace/a');

    expect(result).toHaveLength(1);
    expect(result[0].workspaceRoot).toBe('/workspace/b');
  });

  it('prunes retention only for the targeted workspace', () => {
    const cutoffAt = Date.UTC(2026, 1, 1, 10, 7, 0);
    const result = pruneMetricsForWorkspace(seedMetrics, '/workspace/a', cutoffAt);

    expect(result).toEqual([
      {
        startedAt: Date.UTC(2026, 1, 1, 10, 5, 0),
        workspaceRoot: '/workspace/b',
        trigger: 'manual',
      },
      {
        startedAt: Date.UTC(2026, 1, 1, 10, 10, 0),
        workspaceRoot: '/workspace/a',
        trigger: 'cached',
      },
    ]);
  });
});

describe('buildMetricsBaselineSnapshotMarkdown', () => {
  it('includes lag quantiles, rates, and dogfooding gate status', () => {
    const markdown = buildMetricsBaselineSnapshotMarkdown(
      [
        {
          startedAt: Date.UTC(2026, 1, 1, 10, 0, 0),
          workspaceRoot: '/workspace/a',
          trigger: 'focus',
          firstMeaningfulEditLagMs: 1000,
          firstRunLagMs: 2000,
          firstActionLagMs: 1500,
          companionPromptImpressions: 2,
          companionForcedOpenDetailsClicks: 1,
          companionNudgeImpressions: 1,
        },
        {
          startedAt: Date.UTC(2026, 1, 1, 10, 5, 0),
          workspaceRoot: '/workspace/b',
          trigger: 'manual',
          firstMeaningfulEditLagMs: 2000,
          firstRunLagMs: 4000,
          firstActionLagMs: 2500,
          companionPromptImpressions: 3,
          companionForcedOpenDetailsClicks: 1,
          companionNudgeImpressions: 2,
        },
        {
          startedAt: Date.UTC(2026, 1, 1, 10, 10, 0),
          workspaceRoot: '/workspace/c',
          trigger: 'cached',
          firstMeaningfulEditLagMs: 3000,
          firstActionLagMs: 3500,
        },
      ],
      { generatedAt: Date.UTC(2026, 1, 1, 12, 0, 0) },
    );

    expect(markdown).toContain('# TaCoS Metrics Baseline Snapshot');
    expect(markdown).toContain('Date: `2026-02-01T12:00:00.000Z`');
    expect(markdown).toContain(
      'Dogfooding gate (`>=30 sessions` and `>=3 workspaces`): not yet met',
    );
    expect(markdown).toContain('| `firstMeaningfulEditLagMs` | 3 | 2000 (2.0s) | 2900 (2.9s) |');
    expect(markdown).toContain('| `firstRunLagMs` | 2 | 3000 (3.0s) | 3900 (3.9s) |');
    expect(markdown).toContain('| `firstActionLagMs` | 3 | 2500 (2.5s) | 3400 (3.4s) |');
    expect(markdown).toContain('| Prompt impressions (total) | 5 |');
    expect(markdown).toContain('| Prompt impressions per session | 1.67 |');
    expect(markdown).toContain('| Forced-open details clicks (total) | 2 |');
    expect(markdown).toContain('| Forced-open rate (`forced/prompt`) | 0.4000 |');
    expect(markdown).toContain('| Nudge impressions (total) | 3 |');
    expect(markdown).toContain('| Nudge impressions per session | 1.00 |');
  });

  it('stays privacy-safe and marks gate as met for qualifying dogfooding sample', () => {
    const metrics: MetricRecord[] = Array.from({ length: 30 }, (_, index) => ({
      startedAt: Date.UTC(2026, 1, 10, 9, index, 0),
      workspaceRoot: `/Users/private/workspace-${index % 3}`,
      trigger: 'focus',
      firstMeaningfulEditLagMs: 2000 + index,
      firstRunLagMs: 4000 + index,
      firstActionLagMs: 2500 + index,
      companionPromptImpressions: 1,
      companionForcedOpenDetailsClicks: index % 2,
      companionNudgeImpressions: index % 3,
    }));

    const markdown = buildMetricsBaselineSnapshotMarkdown(metrics, {
      generatedAt: Date.UTC(2026, 1, 15, 12, 0, 0),
    });

    expect(markdown).toContain('Dogfooding gate (`>=30 sessions` and `>=3 workspaces`): met');
    expect(markdown).toContain('- Sessions: 30');
    expect(markdown).toContain('- Distinct workspaces: 3');
    expect(markdown).not.toContain('/Users/private/workspace-0');
    expect(markdown).not.toContain('/Users/private/workspace-1');
    expect(markdown).not.toContain('/Users/private/workspace-2');
  });
});
