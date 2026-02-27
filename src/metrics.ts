import type { MetricRecord } from './types';

const CSV_HEADERS = [
  'startedAtMs',
  'startedAtIso',
  'sessionDate',
  'workspaceRoot',
  'trigger',
  'uiSurface',
  'interruptionEvent',
  'firstMeaningfulEditLagMs',
  'firstRunLagMs',
  'firstActionLagMs',
  'companionFirstActionLagMs',
  'companionPromptImpressions',
  'companionForcedOpenDetailsClicks',
  'companionQuickActionsTaken',
  'companionNudgeImpressions',
  'helpfulnessRating',
  'pauseActions',
  'snoozeActions',
  'disableActions',
  'companionActionFollowThroughRate',
  'companionForcedOpenRate',
] as const;

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function toOptionalNumber(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function toRatio(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return '';
  }

  return (numerator / denominator).toFixed(4);
}

export function hasAnyRecordedMetric(metric: MetricRecord): boolean {
  if (!Number.isFinite(metric.startedAt) || !metric.workspaceRoot.trim()) {
    return false;
  }

  return (
    metric.trigger === 'focus' ||
    metric.trigger === 'manual' ||
    metric.trigger === 'cached' ||
    metric.firstMeaningfulEditLagMs !== undefined ||
    metric.firstRunLagMs !== undefined ||
    metric.firstActionLagMs !== undefined ||
    metric.companionFirstActionLagMs !== undefined ||
    (metric.companionPromptImpressions ?? 0) > 0 ||
    (metric.companionForcedOpenDetailsClicks ?? 0) > 0 ||
    (metric.companionQuickActionsTaken ?? 0) > 0 ||
    (metric.companionNudgeImpressions ?? 0) > 0 ||
    typeof metric.helpfulnessRating === 'number' ||
    (metric.pauseActions ?? 0) > 0 ||
    (metric.snoozeActions ?? 0) > 0 ||
    (metric.disableActions ?? 0) > 0
  );
}

export function buildMetricsCsv(metrics: MetricRecord[]): string {
  const lines = [CSV_HEADERS.join(',')];

  for (const metric of metrics) {
    const prompts = metric.companionPromptImpressions ?? 0;
    const forcedOpens = metric.companionForcedOpenDetailsClicks ?? 0;
    const quickActions = metric.companionQuickActionsTaken ?? 0;
    const sessionDate = new Date(metric.startedAt).toISOString().slice(0, 10);
    const fields = [
      String(metric.startedAt),
      new Date(metric.startedAt).toISOString(),
      sessionDate,
      metric.workspaceRoot,
      metric.trigger,
      metric.uiSurface ?? '',
      toOptionalNumber(metric.interruptionEvent),
      toOptionalNumber(metric.firstMeaningfulEditLagMs),
      toOptionalNumber(metric.firstRunLagMs),
      toOptionalNumber(metric.firstActionLagMs),
      toOptionalNumber(metric.companionFirstActionLagMs),
      toOptionalNumber(metric.companionPromptImpressions),
      toOptionalNumber(metric.companionForcedOpenDetailsClicks),
      toOptionalNumber(metric.companionQuickActionsTaken),
      toOptionalNumber(metric.companionNudgeImpressions),
      toOptionalNumber(metric.helpfulnessRating),
      toOptionalNumber(metric.pauseActions),
      toOptionalNumber(metric.snoozeActions),
      toOptionalNumber(metric.disableActions),
      toRatio(quickActions, prompts),
      toRatio(forcedOpens, prompts),
    ];

    lines.push(fields.map((value) => csvEscape(value)).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export function removeMetricsForWorkspace(
  metrics: MetricRecord[],
  workspaceRoot: string,
): MetricRecord[] {
  return metrics.filter((metric) => metric.workspaceRoot !== workspaceRoot);
}

export function pruneMetricsForWorkspace(
  metrics: MetricRecord[],
  workspaceRoot: string,
  cutoffAt: number,
): MetricRecord[] {
  return metrics.filter(
    (metric) => metric.workspaceRoot !== workspaceRoot || metric.startedAt >= cutoffAt,
  );
}
