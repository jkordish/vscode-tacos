#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function quantile(values, p) {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) {
    return sorted[low];
  }

  const weight = index - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

function formatNumber(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return value.toFixed(digits);
}

function formatMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return `${Math.round(value)} (${(value / 1000).toFixed(1)}s)`;
}

function clamp01(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function summarizeLagRows(rows, field) {
  const values = rows
    .map((row) => toNumber(row[field]))
    .filter((value) => typeof value === 'number');

  return {
    n: values.length,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
  };
}

function summarizeTimingClassCounts(rows) {
  const counts = { boundary: 0, 'mid-activity': 0, unknown: 0 };
  for (const row of rows) {
    const timingClass = (row.interruptionTimingClass || '').trim();
    if (timingClass === 'boundary' || timingClass === 'mid-activity' || timingClass === 'unknown') {
      counts[timingClass] += 1;
    }
  }
  return counts;
}

function deriveUxFrictionScore({
  firstActionLagP50,
  forcedOpenRate,
  midActivityRate,
  followThroughRate,
}) {
  const components = [
    {
      label: 'firstActionLagMs p50 / 5000ms',
      weight: 0.45,
      rawValue: firstActionLagP50,
      normalizedValue:
        typeof firstActionLagP50 === 'number' ? clamp01(firstActionLagP50 / 5000) : undefined,
    },
    {
      label: 'companionForcedOpenRate',
      weight: 0.25,
      rawValue: forcedOpenRate,
      normalizedValue: typeof forcedOpenRate === 'number' ? clamp01(forcedOpenRate) : undefined,
    },
    {
      label: 'mid-activity timing share',
      weight: 0.2,
      rawValue: midActivityRate,
      normalizedValue: typeof midActivityRate === 'number' ? clamp01(midActivityRate) : undefined,
    },
    {
      label: '1 - companionActionFollowThroughRate',
      weight: 0.1,
      rawValue: typeof followThroughRate === 'number' ? 1 - clamp01(followThroughRate) : undefined,
      normalizedValue:
        typeof followThroughRate === 'number' ? clamp01(1 - clamp01(followThroughRate)) : undefined,
    },
  ].map((component) => ({
    ...component,
    weightedContribution:
      typeof component.normalizedValue === 'number'
        ? component.normalizedValue * component.weight * 100
        : undefined,
  }));

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const availableWeight = components.reduce(
    (sum, component) =>
      sum + (typeof component.normalizedValue === 'number' ? component.weight : 0),
    0,
  );
  const weightedSum = components.reduce(
    (sum, component) => sum + (component.weightedContribution || 0),
    0,
  );
  const score = availableWeight > 0 ? weightedSum / availableWeight : undefined;

  let interpretation = 'insufficient-data';
  if (typeof score === 'number') {
    if (score <= 33) {
      interpretation = 'low';
    } else if (score <= 66) {
      interpretation = 'medium';
    } else {
      interpretation = 'high';
    }
  }

  return {
    score,
    interpretation,
    availableWeight,
    totalWeight,
    formula:
      'weighted mean of clamp01(firstActionLagMs_p50/5000), clamp01(companionForcedOpenRate), clamp01(midActivityShare), and clamp01(1-companionActionFollowThroughRate)',
    components,
  };
}

function main() {
  const inputPath = process.argv[2] || '.tacos/metrics.csv';
  const csvPath = resolve(process.cwd(), inputPath);

  let raw;
  try {
    raw = readFileSync(csvPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read CSV at ${csvPath}: ${error.message}`);
    process.exit(1);
  }

  const records = parseCsv(raw);
  if (records.length < 2) {
    console.error(`No metric rows found in ${csvPath}.`);
    process.exit(1);
  }

  const [headers, ...dataRows] = records;
  const rows = dataRows
    .filter((row) => row.length > 1)
    .map((values) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });

  const workspaceCount = new Set(
    rows.map((row) => (row.workspaceRoot || '').trim()).filter((value) => value.length > 0),
  ).size;

  const lagMetrics = [
    { field: 'firstMeaningfulEditLagMs', label: 'First meaningful edit lag' },
    { field: 'firstRunLagMs', label: 'First run lag' },
    { field: 'firstActionLagMs', label: 'First action lag' },
  ].map((metric) => ({ ...metric, ...summarizeLagRows(rows, metric.field) }));

  const promptsTotal = rows.reduce(
    (sum, row) => sum + (toNumber(row.companionPromptImpressions) || 0),
    0,
  );
  const forcedOpenTotal = rows.reduce(
    (sum, row) => sum + (toNumber(row.companionForcedOpenDetailsClicks) || 0),
    0,
  );
  const quickActionsTotal = rows.reduce(
    (sum, row) => sum + (toNumber(row.companionQuickActionsTaken) || 0),
    0,
  );
  const nudgeTotal = rows.reduce(
    (sum, row) => sum + (toNumber(row.companionNudgeImpressions) || 0),
    0,
  );

  const promptSessionCount = rows.filter(
    (row) => (toNumber(row.companionPromptImpressions) || 0) > 0,
  ).length;
  const nudgeSessionCount = rows.filter(
    (row) => (toNumber(row.companionNudgeImpressions) || 0) > 0,
  ).length;

  const forcedOpenRate = promptsTotal > 0 ? forcedOpenTotal / promptsTotal : undefined;
  const followThroughRate = promptsTotal > 0 ? quickActionsTotal / promptsTotal : undefined;
  const promptPerSession = rows.length > 0 ? promptsTotal / rows.length : undefined;
  const nudgePerSession = rows.length > 0 ? nudgeTotal / rows.length : undefined;
  const dogfoodingGateMet = rows.length >= 30 && workspaceCount >= 3;
  const timingClassCounts = summarizeTimingClassCounts(rows);
  const timingClassRate = (value) => (rows.length > 0 ? value / rows.length : undefined);
  const firstActionLagP50 = lagMetrics.find((metric) => metric.field === 'firstActionLagMs')?.p50;
  const uxFriction = deriveUxFrictionScore({
    firstActionLagP50,
    forcedOpenRate,
    midActivityRate: timingClassRate(timingClassCounts['mid-activity']),
    followThroughRate,
  });
  const formatUxRaw = (component) => {
    if (component.label.startsWith('firstActionLagMs')) {
      return formatMs(component.rawValue);
    }
    return formatNumber(component.rawValue, 4);
  };

  const lines = [
    '# TaCoS Metrics Summary',
    '',
    `- Source: \`${csvPath}\``,
    `- Sessions: ${rows.length}`,
    `- Distinct workspaces: ${workspaceCount}`,
    `- Dogfooding gate (>=30 sessions and >=3 workspaces): ${dogfoodingGateMet ? 'met' : 'not yet met'}`,
    '',
    '## Lag Baselines',
    '',
    '| Metric | n | p50 (ms / s) | p95 (ms / s) |',
    '| --- | ---: | ---: | ---: |',
    ...lagMetrics.map(
      (metric) =>
        `| ${metric.label} | ${metric.n} | ${formatMs(metric.p50)} | ${formatMs(metric.p95)} |`,
    ),
    '',
    '## Companion Prompt and Nudge Rates',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Prompt impressions (total) | ${promptsTotal} |`,
    `| Sessions with prompt impressions | ${promptSessionCount} |`,
    `| Prompt impressions per session | ${formatNumber(promptPerSession)} |`,
    `| Forced-open details clicks (total) | ${forcedOpenTotal} |`,
    `| Forced-open rate (forced opens / prompts) | ${formatNumber(forcedOpenRate, 4)} |`,
    `| Companion quick actions taken (total) | ${quickActionsTotal} |`,
    `| Companion follow-through rate (quick actions / prompts) | ${formatNumber(followThroughRate, 4)} |`,
    `| Nudge impressions (total) | ${nudgeTotal} |`,
    `| Sessions with nudge impressions | ${nudgeSessionCount} |`,
    `| Nudge impressions per session | ${formatNumber(nudgePerSession)} |`,
    '',
    '## Interruption Timing Class',
    '',
    '| Class | Sessions | Share |',
    '| --- | ---: | ---: |',
    `| boundary | ${timingClassCounts.boundary} | ${formatNumber(timingClassRate(timingClassCounts.boundary), 4)} |`,
    `| mid-activity | ${timingClassCounts['mid-activity']} | ${formatNumber(timingClassRate(timingClassCounts['mid-activity']), 4)} |`,
    `| unknown | ${timingClassCounts.unknown} | ${formatNumber(timingClassRate(timingClassCounts.unknown), 4)} |`,
    '',
    '## Derived UX Friction Score',
    '',
    `- UX friction score (0-100, lower is better): ${formatNumber(uxFriction.score, 2)} (${uxFriction.interpretation})`,
    `- Coverage weight: ${formatNumber(uxFriction.availableWeight, 2)} / ${formatNumber(uxFriction.totalWeight, 2)}`,
    `- Formula: ${uxFriction.formula}`,
    '',
    '| Component | Raw input | Weight | Normalized (0-1) | Weighted contribution (0-100) |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...uxFriction.components.map(
      (component) =>
        `| ${component.label} | ${formatUxRaw(component)} | ${formatNumber(component.weight, 2)} | ${formatNumber(component.normalizedValue, 4)} | ${formatNumber(component.weightedContribution, 2)} |`,
    ),
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
