import {
  buildMetricsBaselineSnapshotMarkdown,
  buildMetricsCsv,
  deriveUxFrictionScore,
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

  it('treats note events as recorded metric activity', () => {
    const metric: MetricRecord = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'manual',
      noteCreated: 1,
    };

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('treats scratchpad events as recorded metric activity', () => {
    const metric: MetricRecord = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'manual',
      scratchpadOpened: 1,
    };

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('treats quiet-mode actions as recorded metric activity', () => {
    const metric: MetricRecord = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'manual',
      summaryQuietActions: 1,
    };

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('treats sanitizer counters as recorded metric activity', () => {
    const metric: MetricRecord = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'manual',
      aiSendBlockedBySanitizerTotal: 1,
    };

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('treats low-confidence clarification metric as recorded metric activity', () => {
    const metric = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'other',
      lowConfidenceClarificationRate: 1,
    } as unknown as MetricRecord;

    expect(hasAnyRecordedMetric(metric)).toBe(true);
  });

  it('treats interruption timing class annotations as recorded metric activity', () => {
    const metric = {
      startedAt: Date.UTC(2026, 1, 1, 12, 0, 0),
      workspaceRoot: '/workspace/repo',
      trigger: 'other',
      interruptionTimingClass: 'boundary',
    } as unknown as MetricRecord;

    expect(hasAnyRecordedMetric(metric)).toBe(true);
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
        interruptionTimingClass: 'unknown',
        firstMeaningfulEditLagMs: 1200,
        firstRunLagMs: 2100,
        firstActionLagMs: 1300,
        companionPromptImpressions: 4,
        companionForcedOpenDetailsClicks: 1,
        companionQuickActionsTaken: 3,
        companionPrimaryCtaImpressions: 2,
        companionPrimaryCtaSourceClass: 'next-step-action:openFile',
        companionPrimaryCtaClicks: 1,
        companionPrimaryCtaCompletions: 1,
        helpfulnessRating: 4,
        pauseActions: 1,
        snoozeActions: 0,
        summaryQuietActions: 2,
        disableActions: 0,
        resumePathCompletions: 0,
        scratchpadOpened: 2,
        scratchpadAppended: 1,
      },
    ]);

    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toContain('firstActionLagMs');
    expect(lines[0]).toContain('helpfulnessRating');
    expect(lines[0]).toContain('percolationDismissActions');
    expect(lines[0]).toContain('percolationSnoozeActions');
    expect(lines[0]).toContain('percolationSuppressedLowConfidence');
    expect(lines[0]).toContain('lowConfidenceClarificationRate');
    expect(lines[0]).toContain('companionActionFollowThroughRate');
    expect(lines[0]).toContain('summaryQuietActions');
    expect(lines[0]).toContain('interruptionTimingClass');
    expect(lines[0]).toContain('surfaceSelectionNone');
    expect(lines[0]).toContain('surfaceSelectionStatusbar');
    expect(lines[0]).toContain('surfaceSelectionPanel');
    expect(lines[0]).toContain('surfaceSelectionNotification');
    expect(lines[0]).toContain('companionPrimaryCtaImpressions');
    expect(lines[0]).toContain('companionPrimaryCtaSourceClass');
    expect(lines[0]).toContain('companionPrimaryCtaClicks');
    expect(lines[0]).toContain('companionPrimaryCtaCompletions');
    expect(lines[0]).toContain('resumePathCompletions');
    expect(lines[0]).toContain('companionPrimaryCtaClickThroughRate');
    expect(lines[0]).toContain('companionPrimaryCtaCompletionRate');
    expect(lines[0]).toContain('noteCreated');
    expect(lines[0]).toContain('resumeWithNote');
    expect(lines[0]).toContain('scratchpadOpened');
    expect(lines[0]).toContain('scratchpadAppended');
    expect(lines[0]).toContain('redactionEventsTotal');
    expect(lines[0]).toContain('redactionHighRiskDetectedTotal');
    expect(lines[0]).toContain('aiSendBlockedBySanitizerTotal');
    expect(lines[0]).toContain('aiSendAllowedAfterReviewTotal');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"/workspace/repo,feature"');
    expect(lines[1]).toContain(',statusbar,,,,,0,unknown,');
    expect(lines[1]).toContain(',2,next-step-action:openFile,1,1,');
    expect(lines[1]).toContain(',0.7500,0.2500,0.5000,1.0000');
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
          companionPrimaryCtaImpressions: 1,
          companionPrimaryCtaClicks: 1,
          companionPrimaryCtaCompletions: 1,
          interruptionTimingClass: 'boundary',
          scratchpadOpened: 1,
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
          companionPrimaryCtaImpressions: 2,
          companionPrimaryCtaClicks: 1,
          companionPrimaryCtaCompletions: 1,
          interruptionTimingClass: 'mid-activity',
          scratchpadAppended: 2,
        },
        {
          startedAt: Date.UTC(2026, 1, 1, 10, 10, 0),
          workspaceRoot: '/workspace/c',
          trigger: 'cached',
          firstMeaningfulEditLagMs: 3000,
          firstActionLagMs: 3500,
          interruptionTimingClass: 'unknown',
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
    expect(markdown).toContain('| Companion quick actions taken (total) | 0 |');
    expect(markdown).toContain(
      '| Companion follow-through rate (`quickActions/prompt`) | 0.0000 |',
    );
    expect(markdown).toContain('| Primary CTA impressions (total) | 3 |');
    expect(markdown).toContain('| Primary CTA clicks (total) | 2 |');
    expect(markdown).toContain('| Primary CTA completions (total) | 2 |');
    expect(markdown).toContain(
      '| Primary CTA click-through rate (`clicks/impressions`) | 0.6667 |',
    );
    expect(markdown).toContain('| Primary CTA completion rate (`completions/clicks`) | 1.0000 |');
    expect(markdown).toContain('| boundary | 1 | 0.3333 |');
    expect(markdown).toContain('| mid-activity | 1 | 0.3333 |');
    expect(markdown).toContain('| unknown | 1 | 0.3333 |');
    expect(markdown).toContain('Derived UX friction score (lower is better):');
    expect(markdown).toContain('- UX friction score (`0-100`): 52.50 (medium)');
    expect(markdown).toContain(
      '| firstActionLagMs p50 / 5000ms | 2500 (2.5s) | 0.45 | 0.5000 | 22.50 |',
    );
    expect(markdown).toContain('| companionForcedOpenRate | 0.4000 | 0.25 | 0.4000 | 10.00 |');
    expect(markdown).toContain(
      '| mid-activity timing share (boundary+mid-activity only) | 0.5000 | 0.20 | 0.5000 | 10.00 |',
    );
    expect(markdown).toContain(
      '| 1 - companionActionFollowThroughRate | 1.0000 | 0.10 | 1.0000 | 10.00 |',
    );
    expect(markdown).toContain('| scratchpadOpened (total) | 1 |');
    expect(markdown).toContain('| scratchpadAppended (total) | 2 |');
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

describe('deriveUxFrictionScore', () => {
  it('computes a deterministic weighted score with explainable components', () => {
    const score = deriveUxFrictionScore({
      firstActionLagP50: 2500,
      forcedOpenRate: 0.4,
      midActivityRate: 1 / 3,
      followThroughRate: 0,
    });

    expect(score.score).toBeCloseTo(49.1667, 4);
    expect(score.interpretation).toBe('medium');
    expect(score.availableWeight).toBeCloseTo(1, 6);
    expect(score.totalWeight).toBeCloseTo(1, 6);
    expect(score.components).toHaveLength(4);
    expect(score.components[0]?.weightedContribution).toBeCloseTo(22.5, 4);
    expect(score.components[1]?.weightedContribution).toBeCloseTo(10, 4);
  });

  it('uses only available components when partial data is present', () => {
    const score = deriveUxFrictionScore({
      firstActionLagP50: 4000,
      forcedOpenRate: 0.2,
    });

    expect(score.availableWeight).toBeCloseTo(0.7, 6);
    expect(score.score).toBeCloseTo(58.5714, 4);
    expect(score.interpretation).toBe('medium');
  });

  it('supports classified-only interruption coverage for mid-activity component', () => {
    const score = deriveUxFrictionScore({
      firstActionLagP50: 2500,
      forcedOpenRate: 0.4,
      midActivityRate: 0.5,
      followThroughRate: 0,
    });

    expect(score.score).toBeCloseTo(52.5, 4);
    expect(score.interpretation).toBe('medium');
    expect(
      score.components.find((component) => component.key === 'midActivityRate')
        ?.weightedContribution,
    ).toBeCloseTo(10, 4);
  });

  it('excludes non-finite inputs from score availability and weight', () => {
    const score = deriveUxFrictionScore({
      firstActionLagP50: Number.NaN,
      forcedOpenRate: Number.POSITIVE_INFINITY,
      midActivityRate: 0.5,
      followThroughRate: Number.NaN,
    });

    expect(score.availableWeight).toBeCloseTo(0.2, 6);
    expect(score.score).toBeCloseTo(50, 6);
    expect(score.interpretation).toBe('medium');
    expect(score.components.find((component) => component.key === 'lagP50')?.normalizedValue).toBe(
      undefined,
    );
    expect(
      score.components.find((component) => component.key === 'forcedOpenRate')?.normalizedValue,
    ).toBe(undefined);
    expect(
      score.components.find((component) => component.key === 'followThroughGap')?.normalizedValue,
    ).toBe(undefined);
  });
});
