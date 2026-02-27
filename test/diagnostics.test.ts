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
      recentMetrics: [buildMetric({ workspaceRoot: '/Users/real/secret-workspace' })],
    });

    expect(diagnostics).not.toContain('/Users/real/secret-workspace');
    expect(diagnostics).toContain('workspaceTrust: restricted');
    expect(diagnostics).toContain('summaryProvider: openai');
  });
});
