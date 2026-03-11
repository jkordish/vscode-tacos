import { buildDiagnosticsText } from '../src/diagnostics';
import type { MetricRecord } from '../src/types';

function buildMetric(overrides: Partial<MetricRecord> = {}): MetricRecord {
  return {
    startedAt: 1_700_000_000_000,
    workspaceRoot: '/Users/example/private-project',
    trigger: 'focus',
    uiSurface: 'notification',
    firstMeaningfulEditLagMs: 100_000,
    firstRunLagMs: 220_000,
    firstActionLagMs: 140_000,
    companionPromptImpressions: 1,
    companionForcedOpenDetailsClicks: 0,
    companionNudgeImpressions: 1,
    ...overrides,
  };
}

describe('buildDiagnosticsText', () => {
  it('includes required safe diagnostics metadata and aggregated metrics', () => {
    const diagnostics = buildDiagnosticsText({
      generatedAt: Date.UTC(2026, 1, 27, 18, 0, 0),
      extensionVersion: '0.2.1',
      vscodeVersion: '1.99.0',
      workspaceTrusted: true,
      summaryProvider: 'local',
      uiSurface: 'statusbar',
      companionRuntimeMode: 'active',
      metricsEnabled: true,
      percolationPolicyEnabled: true,
      percolationExplainabilityEnabled: true,
      percolationExplainabilityActive: true,
      percolationNotificationBrokerEnabled: true,
      percolationNotificationBrokerActive: true,
      taskCheckpointEnabled: true,
      taskCheckpointPromptOnLikelySwitch: true,
      activeStructuredTaskFreshness: 'fresh',
      activeStructuredTaskSwitchClass: 'stable',
      activeStructuredTaskCount: 1,
      resolvedStructuredTaskCount: 2,
      lastTaskSwitchSummary: 'Capture a checkpoint before switching partitions.',
      lastTaskSwitchReasonCodes: ['task-partition-changed', 'file-cluster-drift'],
      lastTaskSwitchSuppressionReason: 'noise-budget',
      recentMetrics: [
        buildMetric({
          firstMeaningfulEditLagMs: 120_000,
          firstRunLagMs: 300_000,
          firstActionLagMs: 180_000,
          companionPromptImpressions: 2,
          companionForcedOpenDetailsClicks: 1,
          companionNudgeImpressions: 1,
        }),
        buildMetric({
          firstMeaningfulEditLagMs: 90_000,
          firstRunLagMs: 240_000,
          firstActionLagMs: 130_000,
          companionPromptImpressions: 0,
          companionForcedOpenDetailsClicks: 0,
          companionNudgeImpressions: 2,
        }),
      ],
    });

    expect(diagnostics).toContain('extensionVersion: 0.2.1');
    expect(diagnostics).toContain('vscodeVersion: 1.99.0');
    expect(diagnostics).toContain('workspaceTrust: trusted');
    expect(diagnostics).toContain('summaryProvider: local');
    expect(diagnostics).toContain('percolationPolicyEnabled: true');
    expect(diagnostics).toContain('percolationExplainabilityActive: true');
    expect(diagnostics).toContain('percolationNotificationBrokerActive: true');
    expect(diagnostics).toContain('taskCheckpointEnabled: true');
    expect(diagnostics).toContain('taskCheckpointPromptOnLikelySwitch: true');
    expect(diagnostics).toContain('activeStructuredTaskFreshness: fresh');
    expect(diagnostics).toContain('activeStructuredTaskSwitchClass: stable');
    expect(diagnostics).toContain('activeStructuredTaskCount: 1');
    expect(diagnostics).toContain('resolvedStructuredTaskCount: 2');
    expect(diagnostics).toContain(
      'lastTaskSwitchSummary: Capture a checkpoint before switching partitions.',
    );
    expect(diagnostics).toContain(
      'lastTaskSwitchReasonCodes: task-partition-changed, file-cluster-drift',
    );
    expect(diagnostics).toContain('lastTaskSwitchSuppressionReason: noise-budget');
    expect(diagnostics).toContain('sessions: 2');
    expect(diagnostics).toContain('companionPromptImpressions.total: 2');
    expect(diagnostics).toContain('companionForcedOpenDetailsClicks.total: 1');
    expect(diagnostics).toContain('companionNudgeImpressions.total: 3');
    expect(diagnostics).toContain('companionForcedOpenRate: 0.5000');
  });

  it('omits workspace paths from diagnostics output', () => {
    const diagnostics = buildDiagnosticsText({
      generatedAt: Date.now(),
      extensionVersion: '0.2.1',
      vscodeVersion: '1.99.0',
      workspaceTrusted: false,
      summaryProvider: 'openai',
      uiSurface: 'notification',
      companionRuntimeMode: 'restricted',
      metricsEnabled: true,
      percolationPolicyEnabled: false,
      percolationExplainabilityEnabled: true,
      percolationExplainabilityActive: false,
      percolationNotificationBrokerEnabled: true,
      percolationNotificationBrokerActive: false,
      taskCheckpointEnabled: false,
      taskCheckpointPromptOnLikelySwitch: false,
      recentMetrics: [buildMetric({ workspaceRoot: '/Users/real/secret-workspace' })],
    });

    expect(diagnostics).not.toContain('/Users/real/secret-workspace');
    expect(diagnostics).toContain('workspaceTrust: restricted');
    expect(diagnostics).toContain('summaryProvider: openai');
    expect(diagnostics).toContain('percolationPolicyEnabled: false');
    expect(diagnostics).toContain('percolationExplainabilityActive: false');
    expect(diagnostics).toContain('percolationNotificationBrokerActive: false');
    expect(diagnostics).toContain('taskCheckpointEnabled: false');
    expect(diagnostics).toContain('taskCheckpointPromptOnLikelySwitch: false');
  });

  it('includes runtime performance counters when provided', () => {
    const diagnostics = buildDiagnosticsText({
      generatedAt: Date.now(),
      extensionVersion: '0.6.0',
      vscodeVersion: '1.100.0',
      workspaceTrusted: true,
      summaryProvider: 'local',
      uiSurface: 'statusbar',
      companionRuntimeMode: 'active',
      metricsEnabled: true,
      percolationPolicyEnabled: true,
      percolationExplainabilityEnabled: false,
      percolationExplainabilityActive: false,
      percolationNotificationBrokerEnabled: false,
      percolationNotificationBrokerActive: false,
      taskCheckpointEnabled: true,
      taskCheckpointPromptOnLikelySwitch: true,
      recentMetrics: [buildMetric()],
      performanceCounters: {
        focusHandling: {
          samples: 8,
          slowSamples: 1,
          slowRate: 0.125,
          averageDurationMs: 9.4,
          maxDurationMs: 31.2,
          lastDurationMs: 7.1,
        },
      },
    });

    expect(diagnostics).toContain('performanceCounters(runtime):');
    expect(diagnostics).toContain('focusHandling.samples: 8');
    expect(diagnostics).toContain('focusHandling.slowRate: 0.1250');
    expect(diagnostics).toContain('focusSummary.samples: 0');
    expect(diagnostics).toContain('panelRerender.avgMs: n/a');
  });
});
