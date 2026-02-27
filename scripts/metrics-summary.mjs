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
  const promptPerSession = rows.length > 0 ? promptsTotal / rows.length : undefined;
  const nudgePerSession = rows.length > 0 ? nudgeTotal / rows.length : undefined;
  const dogfoodingGateMet = rows.length >= 30 && workspaceCount >= 3;

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
      (metric) => `| ${metric.label} | ${metric.n} | ${formatMs(metric.p50)} | ${formatMs(metric.p95)} |`,
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
    `| Nudge impressions (total) | ${nudgeTotal} |`,
    `| Sessions with nudge impressions | ${nudgeSessionCount} |`,
    `| Nudge impressions per session | ${formatNumber(nudgePerSession)} |`,
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
