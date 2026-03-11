import type { MetricRecord, SummaryProvider, UiSurface } from './types';

export type CompanionRuntimeMode = 'active' | 'paused' | 'restricted' | 'disabled';

export interface DiagnosticsInput {
  generatedAt: number;
  extensionVersion: string;
  vscodeVersion: string;
  workspaceTrusted: boolean;
  summaryProvider: SummaryProvider;
  uiSurface: UiSurface;
  companionRuntimeMode: CompanionRuntimeMode;
  metricsEnabled: boolean;
  percolationPolicyEnabled: boolean;
  percolationExplainabilityEnabled: boolean;
  percolationExplainabilityActive: boolean;
  percolationNotificationBrokerEnabled: boolean;
  percolationNotificationBrokerActive: boolean;
  taskCheckpointEnabled: boolean;
  taskCheckpointPromptOnLikelySwitch: boolean;
  activeStructuredTaskFreshness?: 'fresh' | 'stale' | 'none';
  activeStructuredTaskSwitchClass?: 'stable' | 'repeated-switch' | 'none';
  activeStructuredTaskCount?: number;
  resolvedStructuredTaskCount?: number;
  lastTaskSwitchSummary?: string;
  lastTaskSwitchReasonCodes?: string[];
  lastTaskSwitchSuppressionReason?: string;
  recentMetrics: MetricRecord[];
  performanceCounters?: {
    focusHandling?: PerformanceCounterSnapshot;
    focusSummary?: PerformanceCounterSnapshot;
    panelRerender?: PerformanceCounterSnapshot;
    webviewRender?: PerformanceCounterSnapshot;
  };
}

interface PerformanceCounterSnapshot {
  samples: number;
  slowSamples: number;
  slowRate?: number;
  averageDurationMs?: number;
  maxDurationMs?: number;
  lastDurationMs?: number;
}

interface RecentMetricsSummary {
  sessions: number;
  firstMeaningfulEditLagP50Ms?: number;
  firstMeaningfulEditLagP95Ms?: number;
  firstRunLagP50Ms?: number;
  firstRunLagP95Ms?: number;
  firstActionLagP50Ms?: number;
  firstActionLagP95Ms?: number;
  companionPromptImpressionsTotal: number;
  companionForcedOpenDetailsClicksTotal: number;
  companionNudgeImpressionsTotal: number;
  companionForcedOpenRate?: number;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function quantile(values: number[], percentile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function summarizeLag(values: Array<number | undefined>): { p50?: number; p95?: number } {
  const finite = values.filter((value): value is number => typeof value === 'number');
  return {
    p50: quantile(finite, 0.5),
    p95: quantile(finite, 0.95),
  };
}

function formatRate(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  return value.toFixed(4);
}

function formatLag(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${Math.round(value)}`;
}

function formatMsValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  return value.toFixed(2);
}

function summarizeRecentMetrics(metrics: MetricRecord[], limit: number): RecentMetricsSummary {
  const recent = metrics.slice(0, Math.max(0, limit));
  const lagEdit = summarizeLag(
    recent.map((metric) => toFiniteNumber(metric.firstMeaningfulEditLagMs)),
  );
  const lagRun = summarizeLag(recent.map((metric) => toFiniteNumber(metric.firstRunLagMs)));
  const lagAction = summarizeLag(recent.map((metric) => toFiniteNumber(metric.firstActionLagMs)));

  const promptTotal = recent.reduce(
    (sum, metric) => sum + (toFiniteNumber(metric.companionPromptImpressions) ?? 0),
    0,
  );
  const forcedOpenTotal = recent.reduce(
    (sum, metric) => sum + (toFiniteNumber(metric.companionForcedOpenDetailsClicks) ?? 0),
    0,
  );
  const nudgeTotal = recent.reduce(
    (sum, metric) => sum + (toFiniteNumber(metric.companionNudgeImpressions) ?? 0),
    0,
  );

  return {
    sessions: recent.length,
    firstMeaningfulEditLagP50Ms: lagEdit.p50,
    firstMeaningfulEditLagP95Ms: lagEdit.p95,
    firstRunLagP50Ms: lagRun.p50,
    firstRunLagP95Ms: lagRun.p95,
    firstActionLagP50Ms: lagAction.p50,
    firstActionLagP95Ms: lagAction.p95,
    companionPromptImpressionsTotal: promptTotal,
    companionForcedOpenDetailsClicksTotal: forcedOpenTotal,
    companionNudgeImpressionsTotal: nudgeTotal,
    companionForcedOpenRate: promptTotal > 0 ? forcedOpenTotal / promptTotal : undefined,
  };
}

export function buildDiagnosticsText(input: DiagnosticsInput): string {
  const metricSummary = summarizeRecentMetrics(input.recentMetrics, 10);
  const generatedAtIso = new Date(input.generatedAt).toISOString();

  const lines = [
    'TaCoS Diagnostics (Safe Bundle)',
    `generatedAt: ${generatedAtIso}`,
    `extensionVersion: ${input.extensionVersion}`,
    `vscodeVersion: ${input.vscodeVersion}`,
    `workspaceTrust: ${input.workspaceTrusted ? 'trusted' : 'restricted'}`,
    `summaryProvider: ${input.summaryProvider}`,
    `uiSurface: ${input.uiSurface}`,
    `companionRuntimeMode: ${input.companionRuntimeMode}`,
    `metricsEnabled: ${input.metricsEnabled ? 'true' : 'false'}`,
    `percolationPolicyEnabled: ${input.percolationPolicyEnabled ? 'true' : 'false'}`,
    `percolationExplainabilityEnabled: ${input.percolationExplainabilityEnabled ? 'true' : 'false'}`,
    `percolationExplainabilityActive: ${input.percolationExplainabilityActive ? 'true' : 'false'}`,
    `percolationNotificationBrokerEnabled: ${input.percolationNotificationBrokerEnabled ? 'true' : 'false'}`,
    `percolationNotificationBrokerActive: ${input.percolationNotificationBrokerActive ? 'true' : 'false'}`,
    `taskCheckpointEnabled: ${input.taskCheckpointEnabled ? 'true' : 'false'}`,
    `taskCheckpointPromptOnLikelySwitch: ${input.taskCheckpointPromptOnLikelySwitch ? 'true' : 'false'}`,
    `activeStructuredTaskFreshness: ${input.activeStructuredTaskFreshness ?? 'none'}`,
    `activeStructuredTaskSwitchClass: ${input.activeStructuredTaskSwitchClass ?? 'none'}`,
    `activeStructuredTaskCount: ${input.activeStructuredTaskCount ?? 0}`,
    `resolvedStructuredTaskCount: ${input.resolvedStructuredTaskCount ?? 0}`,
    `lastTaskSwitchSummary: ${input.lastTaskSwitchSummary ?? 'n/a'}`,
    `lastTaskSwitchReasonCodes: ${(input.lastTaskSwitchReasonCodes ?? []).join(', ') || 'none'}`,
    `lastTaskSwitchSuppressionReason: ${input.lastTaskSwitchSuppressionReason ?? 'none'}`,
    '',
    'recentMetrics(last10):',
    `sessions: ${metricSummary.sessions}`,
    `firstMeaningfulEditLagMs.p50: ${formatLag(metricSummary.firstMeaningfulEditLagP50Ms)}`,
    `firstMeaningfulEditLagMs.p95: ${formatLag(metricSummary.firstMeaningfulEditLagP95Ms)}`,
    `firstRunLagMs.p50: ${formatLag(metricSummary.firstRunLagP50Ms)}`,
    `firstRunLagMs.p95: ${formatLag(metricSummary.firstRunLagP95Ms)}`,
    `firstActionLagMs.p50: ${formatLag(metricSummary.firstActionLagP50Ms)}`,
    `firstActionLagMs.p95: ${formatLag(metricSummary.firstActionLagP95Ms)}`,
    `companionPromptImpressions.total: ${metricSummary.companionPromptImpressionsTotal}`,
    `companionForcedOpenDetailsClicks.total: ${metricSummary.companionForcedOpenDetailsClicksTotal}`,
    `companionNudgeImpressions.total: ${metricSummary.companionNudgeImpressionsTotal}`,
    `companionForcedOpenRate: ${formatRate(metricSummary.companionForcedOpenRate)}`,
  ];

  if (input.performanceCounters) {
    const formatCounter = (
      label: string,
      snapshot: PerformanceCounterSnapshot | undefined,
    ): string[] => {
      if (!snapshot || snapshot.samples <= 0) {
        return [
          `${label}.samples: 0`,
          `${label}.slowSamples: 0`,
          `${label}.slowRate: n/a`,
          `${label}.avgMs: n/a`,
          `${label}.maxMs: n/a`,
          `${label}.lastMs: n/a`,
        ];
      }

      return [
        `${label}.samples: ${snapshot.samples}`,
        `${label}.slowSamples: ${snapshot.slowSamples}`,
        `${label}.slowRate: ${formatRate(snapshot.slowRate)}`,
        `${label}.avgMs: ${formatMsValue(snapshot.averageDurationMs)}`,
        `${label}.maxMs: ${formatMsValue(snapshot.maxDurationMs)}`,
        `${label}.lastMs: ${formatMsValue(snapshot.lastDurationMs)}`,
      ];
    };

    lines.push(
      '',
      'performanceCounters(runtime):',
      ...formatCounter('focusHandling', input.performanceCounters.focusHandling),
      ...formatCounter('focusSummary', input.performanceCounters.focusSummary),
      ...formatCounter('panelRerender', input.performanceCounters.panelRerender),
      ...formatCounter('webviewRender', input.performanceCounters.webviewRender),
    );
  }

  return `${lines.join('\n')}\n`;
}
