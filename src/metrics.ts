import type { MetricRecord } from './types';

const CSV_HEADERS = [
  'startedAtMs',
  'startedAtIso',
  'sessionDate',
  'workspaceRoot',
  'trigger',
  'uiSurface',
  'interruptionEvent',
  'interruptionTimingClass',
  'firstMeaningfulEditLagMs',
  'firstRunLagMs',
  'firstActionLagMs',
  'companionFirstActionLagMs',
  'companionPromptImpressions',
  'companionForcedOpenDetailsClicks',
  'companionQuickActionsTaken',
  'companionNudgeImpressions',
  'companionPrimaryCtaImpressions',
  'companionPrimaryCtaClicks',
  'companionPrimaryCtaCompletions',
  'helpfulnessRating',
  'pauseActions',
  'snoozeActions',
  'disableActions',
  'noteCreated',
  'noteMarkedDone',
  'notePinned',
  'resumePathCompletions',
  'resumeWithNote',
  'scratchpadOpened',
  'scratchpadAppended',
  'redactionEventsTotal',
  'redactionHighRiskDetectedTotal',
  'aiSendBlockedBySanitizerTotal',
  'aiSendAllowedAfterReviewTotal',
  'companionActionFollowThroughRate',
  'companionForcedOpenRate',
  'companionPrimaryCtaClickThroughRate',
  'companionPrimaryCtaCompletionRate',
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

function formatMs(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${Math.round(value)} (${(value / 1000).toFixed(1)}s)`;
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  return value.toFixed(digits);
}

interface LagSummary {
  n: number;
  p50?: number;
  p95?: number;
}

function summarizeLag(metrics: MetricRecord[], lagField: keyof MetricRecord): LagSummary {
  const values = metrics
    .map((metric) => toFiniteNumber(metric[lagField]))
    .filter((value): value is number => typeof value === 'number');

  return {
    n: values.length,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
  };
}

function summarizeTotal(metrics: MetricRecord[], field: keyof MetricRecord): number {
  return metrics.reduce((sum, metric) => sum + (toFiniteNumber(metric[field]) ?? 0), 0);
}

function summarizeTimingClassCounts(
  metrics: MetricRecord[],
): Record<'boundary' | 'mid-activity' | 'unknown', number> {
  const counts = {
    boundary: 0,
    'mid-activity': 0,
    unknown: 0,
  };
  for (const metric of metrics) {
    const value = metric.interruptionTimingClass;
    if (value === 'boundary' || value === 'mid-activity' || value === 'unknown') {
      counts[value] += 1;
    }
  }
  return counts;
}

export interface MetricsBaselineSnapshotOptions {
  generatedAt?: number;
  sourceLabel?: string;
}

export function buildMetricsBaselineSnapshotMarkdown(
  metrics: MetricRecord[],
  options: MetricsBaselineSnapshotOptions = {},
): string {
  const generatedAtIso = new Date(options.generatedAt ?? Date.now()).toISOString();
  const sessions = metrics.length;
  const workspaceCount = new Set(
    metrics.map((metric) => metric.workspaceRoot.trim()).filter((workspaceRoot) => workspaceRoot),
  ).size;
  const dogfoodingGateMet = sessions >= 30 && workspaceCount >= 3;

  const lagEdit = summarizeLag(metrics, 'firstMeaningfulEditLagMs');
  const lagRun = summarizeLag(metrics, 'firstRunLagMs');
  const lagAction = summarizeLag(metrics, 'firstActionLagMs');

  const promptImpressions = summarizeTotal(metrics, 'companionPromptImpressions');
  const forcedOpenClicks = summarizeTotal(metrics, 'companionForcedOpenDetailsClicks');
  const nudgeImpressions = summarizeTotal(metrics, 'companionNudgeImpressions');
  const primaryCtaImpressions = summarizeTotal(metrics, 'companionPrimaryCtaImpressions');
  const primaryCtaClicks = summarizeTotal(metrics, 'companionPrimaryCtaClicks');
  const primaryCtaCompletions = summarizeTotal(metrics, 'companionPrimaryCtaCompletions');
  const notesCreated = summarizeTotal(metrics, 'noteCreated');
  const notesMarkedDone = summarizeTotal(metrics, 'noteMarkedDone');
  const notesPinned = summarizeTotal(metrics, 'notePinned');
  const resumePathCompletions = summarizeTotal(metrics, 'resumePathCompletions');
  const scratchpadOpened = summarizeTotal(metrics, 'scratchpadOpened');
  const scratchpadAppended = summarizeTotal(metrics, 'scratchpadAppended');
  const redactionEventsTotal = summarizeTotal(metrics, 'redactionEventsTotal');
  const redactionHighRiskDetectedTotal = summarizeTotal(metrics, 'redactionHighRiskDetectedTotal');
  const aiSendBlockedBySanitizerTotal = summarizeTotal(metrics, 'aiSendBlockedBySanitizerTotal');
  const aiSendAllowedAfterReviewTotal = summarizeTotal(metrics, 'aiSendAllowedAfterReviewTotal');
  const sessionsWithNote = metrics.filter((metric) => metric.resumeWithNote === 1).length;
  const lagActionWithNote = summarizeLag(
    metrics.filter((metric) => metric.resumeWithNote === 1),
    'firstActionLagMs',
  );
  const lagActionWithoutNote = summarizeLag(
    metrics.filter((metric) => metric.resumeWithNote !== 1),
    'firstActionLagMs',
  );
  const forcedOpenRate = promptImpressions > 0 ? forcedOpenClicks / promptImpressions : undefined;
  const primaryCtaClickThroughRate =
    primaryCtaImpressions > 0 ? primaryCtaClicks / primaryCtaImpressions : undefined;
  const primaryCtaCompletionRate =
    primaryCtaClicks > 0 ? primaryCtaCompletions / primaryCtaClicks : undefined;
  const promptPerSession = sessions > 0 ? promptImpressions / sessions : undefined;
  const nudgePerSession = sessions > 0 ? nudgeImpressions / sessions : undefined;
  const timingClassCounts = summarizeTimingClassCounts(metrics);
  const timingClassRate = (value: number): number | undefined =>
    sessions > 0 ? value / sessions : undefined;

  const lines = [
    '# TaCoS Metrics Baseline Snapshot',
    '',
    `Date: \`${generatedAtIso}\``,
    `Source: \`${options.sourceLabel ?? 'Local workspace-state metric history'}\``,
    '',
    'Status:',
    `- Dogfooding gate (\`>=30 sessions\` and \`>=3 workspaces\`): ${dogfoodingGateMet ? 'met' : 'not yet met'}`,
    `- Sessions: ${sessions}`,
    `- Distinct workspaces: ${workspaceCount}`,
    '',
    'Lag summary:',
    '',
    '| Metric | n | p50 (ms / s) | p95 (ms / s) |',
    '| --- | ---: | ---: | ---: |',
    `| \`firstMeaningfulEditLagMs\` | ${lagEdit.n} | ${formatMs(lagEdit.p50)} | ${formatMs(lagEdit.p95)} |`,
    `| \`firstRunLagMs\` | ${lagRun.n} | ${formatMs(lagRun.p50)} | ${formatMs(lagRun.p95)} |`,
    `| \`firstActionLagMs\` | ${lagAction.n} | ${formatMs(lagAction.p50)} | ${formatMs(lagAction.p95)} |`,
    '',
    'Prompt and nudge rates:',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Prompt impressions (total) | ${promptImpressions} |`,
    `| Prompt impressions per session | ${formatNumber(promptPerSession)} |`,
    `| Forced-open details clicks (total) | ${forcedOpenClicks} |`,
    `| Forced-open rate (\`forced/prompt\`) | ${formatNumber(forcedOpenRate, 4)} |`,
    `| Nudge impressions (total) | ${nudgeImpressions} |`,
    `| Nudge impressions per session | ${formatNumber(nudgePerSession)} |`,
    `| Primary CTA impressions (total) | ${primaryCtaImpressions} |`,
    `| Primary CTA clicks (total) | ${primaryCtaClicks} |`,
    `| Primary CTA completions (total) | ${primaryCtaCompletions} |`,
    `| Primary CTA click-through rate (\`clicks/impressions\`) | ${formatNumber(primaryCtaClickThroughRate, 4)} |`,
    `| Primary CTA completion rate (\`completions/clicks\`) | ${formatNumber(primaryCtaCompletionRate, 4)} |`,
    `| noteCreated (total) | ${notesCreated} |`,
    `| noteMarkedDone (total) | ${notesMarkedDone} |`,
    `| notePinned (total) | ${notesPinned} |`,
    `| resumePathCompletions (total) | ${resumePathCompletions} |`,
    `| scratchpadOpened (total) | ${scratchpadOpened} |`,
    `| scratchpadAppended (total) | ${scratchpadAppended} |`,
    `| redactionEventsTotal (total) | ${redactionEventsTotal} |`,
    `| redactionHighRiskDetectedTotal (total) | ${redactionHighRiskDetectedTotal} |`,
    `| aiSendBlockedBySanitizerTotal (total) | ${aiSendBlockedBySanitizerTotal} |`,
    `| aiSendAllowedAfterReviewTotal (total) | ${aiSendAllowedAfterReviewTotal} |`,
    '',
    'Interruption timing class:',
    '',
    '| Class | Sessions | Share |',
    '| --- | ---: | ---: |',
    `| boundary | ${timingClassCounts.boundary} | ${formatNumber(timingClassRate(timingClassCounts.boundary), 4)} |`,
    `| mid-activity | ${timingClassCounts['mid-activity']} | ${formatNumber(timingClassRate(timingClassCounts['mid-activity']), 4)} |`,
    `| unknown | ${timingClassCounts.unknown} | ${formatNumber(timingClassRate(timingClassCounts.unknown), 4)} |`,
    '',
    'Resumption lag by note usage (`firstActionLagMs`):',
    '',
    '| Cohort | Sessions | p50 (ms / s) | p95 (ms / s) |',
    '| --- | ---: | ---: | ---: |',
    `| resumeWithNote = 1 | ${lagActionWithNote.n} | ${formatMs(lagActionWithNote.p50)} | ${formatMs(lagActionWithNote.p95)} |`,
    `| resumeWithNote = 0 | ${lagActionWithoutNote.n} | ${formatMs(lagActionWithoutNote.p50)} | ${formatMs(lagActionWithoutNote.p95)} |`,
    '',
    `Sessions with checkpoint note on resume: ${sessionsWithNote}/${sessions}`,
    '',
    'Notes:',
    '- Snapshot contains aggregate-only values and excludes raw workspace paths.',
  ];

  return `${lines.join('\n')}\n`;
}

export function hasAnyRecordedMetric(metric: MetricRecord): boolean {
  if (!Number.isFinite(metric.startedAt) || !metric.workspaceRoot.trim()) {
    return false;
  }

  return (
    metric.trigger === 'focus' ||
    metric.trigger === 'manual' ||
    metric.trigger === 'cached' ||
    metric.interruptionTimingClass === 'boundary' ||
    metric.interruptionTimingClass === 'mid-activity' ||
    metric.interruptionTimingClass === 'unknown' ||
    metric.firstMeaningfulEditLagMs !== undefined ||
    metric.firstRunLagMs !== undefined ||
    metric.firstActionLagMs !== undefined ||
    metric.companionFirstActionLagMs !== undefined ||
    (metric.companionPromptImpressions ?? 0) > 0 ||
    (metric.companionForcedOpenDetailsClicks ?? 0) > 0 ||
    (metric.companionQuickActionsTaken ?? 0) > 0 ||
    (metric.companionNudgeImpressions ?? 0) > 0 ||
    (metric.companionPrimaryCtaImpressions ?? 0) > 0 ||
    (metric.companionPrimaryCtaClicks ?? 0) > 0 ||
    (metric.companionPrimaryCtaCompletions ?? 0) > 0 ||
    typeof metric.helpfulnessRating === 'number' ||
    (metric.pauseActions ?? 0) > 0 ||
    (metric.snoozeActions ?? 0) > 0 ||
    (metric.disableActions ?? 0) > 0 ||
    (metric.noteCreated ?? 0) > 0 ||
    (metric.noteMarkedDone ?? 0) > 0 ||
    (metric.notePinned ?? 0) > 0 ||
    (metric.resumePathCompletions ?? 0) > 0 ||
    metric.resumeWithNote === 1 ||
    (metric.scratchpadOpened ?? 0) > 0 ||
    (metric.scratchpadAppended ?? 0) > 0 ||
    (metric.redactionEventsTotal ?? 0) > 0 ||
    (metric.redactionHighRiskDetectedTotal ?? 0) > 0 ||
    (metric.aiSendBlockedBySanitizerTotal ?? 0) > 0 ||
    (metric.aiSendAllowedAfterReviewTotal ?? 0) > 0
  );
}

export function buildMetricsCsv(metrics: MetricRecord[]): string {
  const lines = [CSV_HEADERS.join(',')];

  for (const metric of metrics) {
    const prompts = metric.companionPromptImpressions ?? 0;
    const forcedOpens = metric.companionForcedOpenDetailsClicks ?? 0;
    const quickActions = metric.companionQuickActionsTaken ?? 0;
    const primaryCtaImpressions = metric.companionPrimaryCtaImpressions ?? 0;
    const primaryCtaClicks = metric.companionPrimaryCtaClicks ?? 0;
    const primaryCtaCompletions = metric.companionPrimaryCtaCompletions ?? 0;
    const sessionDate = new Date(metric.startedAt).toISOString().slice(0, 10);
    const fields = [
      String(metric.startedAt),
      new Date(metric.startedAt).toISOString(),
      sessionDate,
      metric.workspaceRoot,
      metric.trigger,
      metric.uiSurface ?? '',
      toOptionalNumber(metric.interruptionEvent),
      metric.interruptionTimingClass ?? '',
      toOptionalNumber(metric.firstMeaningfulEditLagMs),
      toOptionalNumber(metric.firstRunLagMs),
      toOptionalNumber(metric.firstActionLagMs),
      toOptionalNumber(metric.companionFirstActionLagMs),
      toOptionalNumber(metric.companionPromptImpressions),
      toOptionalNumber(metric.companionForcedOpenDetailsClicks),
      toOptionalNumber(metric.companionQuickActionsTaken),
      toOptionalNumber(metric.companionNudgeImpressions),
      toOptionalNumber(metric.companionPrimaryCtaImpressions),
      toOptionalNumber(metric.companionPrimaryCtaClicks),
      toOptionalNumber(metric.companionPrimaryCtaCompletions),
      toOptionalNumber(metric.helpfulnessRating),
      toOptionalNumber(metric.pauseActions),
      toOptionalNumber(metric.snoozeActions),
      toOptionalNumber(metric.disableActions),
      toOptionalNumber(metric.noteCreated),
      toOptionalNumber(metric.noteMarkedDone),
      toOptionalNumber(metric.notePinned),
      toOptionalNumber(metric.resumePathCompletions),
      toOptionalNumber(metric.resumeWithNote),
      toOptionalNumber(metric.scratchpadOpened),
      toOptionalNumber(metric.scratchpadAppended),
      toOptionalNumber(metric.redactionEventsTotal),
      toOptionalNumber(metric.redactionHighRiskDetectedTotal),
      toOptionalNumber(metric.aiSendBlockedBySanitizerTotal),
      toOptionalNumber(metric.aiSendAllowedAfterReviewTotal),
      toRatio(quickActions, prompts),
      toRatio(forcedOpens, prompts),
      toRatio(primaryCtaClicks, primaryCtaImpressions),
      toRatio(primaryCtaCompletions, primaryCtaClicks),
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
