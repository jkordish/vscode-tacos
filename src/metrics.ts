import type { MetricRecord } from './types';

const CSV_HEADERS = [
  'startedAtMs',
  'startedAtIso',
  'workspaceRoot',
  'trigger',
  'firstMeaningfulEditLagMs',
  'firstRunLagMs',
  'companionFirstActionLagMs',
  'companionPromptImpressions',
  'companionForcedOpenDetailsClicks',
  'companionQuickActionsTaken',
  'companionNudgeImpressions',
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
  return (
    metric.firstMeaningfulEditLagMs !== undefined ||
    metric.firstRunLagMs !== undefined ||
    metric.companionFirstActionLagMs !== undefined ||
    (metric.companionPromptImpressions ?? 0) > 0 ||
    (metric.companionForcedOpenDetailsClicks ?? 0) > 0 ||
    (metric.companionQuickActionsTaken ?? 0) > 0 ||
    (metric.companionNudgeImpressions ?? 0) > 0
  );
}

export function buildMetricsCsv(metrics: MetricRecord[]): string {
  const lines = [CSV_HEADERS.join(',')];

  for (const metric of metrics) {
    const prompts = metric.companionPromptImpressions ?? 0;
    const forcedOpens = metric.companionForcedOpenDetailsClicks ?? 0;
    const quickActions = metric.companionQuickActionsTaken ?? 0;
    const fields = [
      String(metric.startedAt),
      new Date(metric.startedAt).toISOString(),
      metric.workspaceRoot,
      metric.trigger,
      toOptionalNumber(metric.firstMeaningfulEditLagMs),
      toOptionalNumber(metric.firstRunLagMs),
      toOptionalNumber(metric.companionFirstActionLagMs),
      toOptionalNumber(metric.companionPromptImpressions),
      toOptionalNumber(metric.companionForcedOpenDetailsClicks),
      toOptionalNumber(metric.companionQuickActionsTaken),
      toOptionalNumber(metric.companionNudgeImpressions),
      toRatio(quickActions, prompts),
      toRatio(forcedOpens, prompts),
    ];

    lines.push(fields.map((value) => csvEscape(value)).join(','));
  }

  return `${lines.join('\n')}\n`;
}
