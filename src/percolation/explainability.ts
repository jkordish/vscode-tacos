import type { ResumeSummary } from '../types';
import type { RankedSurfacedItem } from './ranking';

export interface PercolationExplainabilityPayload {
  surfacedItemId?: string;
  surfacedItemKind?: string;
  surfacedTitle?: string;
  surfacedDetail?: string;
  score?: number;
  confidence?: number;
  evidenceIds: string[];
  suppressionReason?: string;
  reasons: string[];
  missingSignals: string[];
}

export interface BuildPercolationExplainabilityInput {
  summary: ResumeSummary;
  primary?: RankedSurfacedItem;
  suppressionReason?: string;
}

function describeSuppressionReason(reason: string): string {
  if (reason === 'quiet-hours') {
    return 'Surfacing is currently suppressed by quiet hours.';
  }
  if (reason === 'cooldown') {
    return 'Surfacing is currently suppressed by cooldown.';
  }
  if (reason === 'no-change') {
    return 'Surfacing is suppressed because context has not changed.';
  }
  if (reason === 'noise-budget') {
    return 'Surfacing is suppressed by the interruption noise budget.';
  }
  if (reason === 'disabled') {
    return 'Surfacing is suppressed because the feature is disabled.';
  }
  if (reason === 'paused') {
    return 'Surfacing is suppressed because companion mode is paused.';
  }
  if (reason === 'restricted') {
    return 'Surfacing is suppressed because workspace trust is restricted.';
  }

  return `Surfacing is suppressed (${reason}).`;
}

function summarizeTopFactors(primary: RankedSurfacedItem): string | undefined {
  const contributions = [
    ['urgency', primary.scoreBreakdown.urgency],
    ['actionability', primary.scoreBreakdown.actionability],
    ['continuity', primary.scoreBreakdown.continuity],
    ['novelty', primary.scoreBreakdown.novelty],
    ['confidence', primary.scoreBreakdown.confidence],
  ] as const;

  const top = [...contributions]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, value]) => `${label}=${value.toFixed(3)}`);

  if (top.length === 0) {
    return undefined;
  }

  return `Top weighted factors: ${top.join(', ')}.`;
}

export function buildPercolationExplainabilityPayload(
  input: BuildPercolationExplainabilityInput,
): PercolationExplainabilityPayload {
  const primary = input.primary;
  const reasons: string[] = [];
  if (primary) {
    reasons.push('A deterministic ranking policy selected the highest-scoring candidate.');
    const topFactors = summarizeTopFactors(primary);
    if (topFactors) {
      reasons.push(topFactors);
    }
  }

  if (input.suppressionReason) {
    reasons.push(describeSuppressionReason(input.suppressionReason));
  }

  if (reasons.length === 0) {
    reasons.push('No percolation candidate scored high enough to be promoted.');
  }

  const missingSignals: string[] = [];
  if (input.summary.lowConfidence) {
    missingSignals.push('Summary is marked low-confidence.');
  }
  if ((input.summary.evidenceCatalog?.length ?? 0) === 0) {
    missingSignals.push('No evidence items were attached to this summary.');
  }
  if (input.summary.nextSteps.length === 0) {
    missingSignals.push('No concrete next-step signals were available.');
  }
  if (!input.summary.lastFailingCommand) {
    missingSignals.push('No recent failing command signal was detected.');
  }

  const evidenceIds = primary?.evidenceIds
    ?.slice()
    .sort((left, right) => left.localeCompare(right));

  return {
    surfacedItemId: primary?.id,
    surfacedItemKind: primary?.kind,
    surfacedTitle: primary?.title,
    surfacedDetail: primary?.detail,
    score: primary?.score,
    confidence: primary?.confidence,
    evidenceIds: evidenceIds ?? [],
    suppressionReason: input.suppressionReason,
    reasons,
    missingSignals,
  };
}

export function formatPercolationExplainabilityLines(
  payload: PercolationExplainabilityPayload,
): string[] {
  const lines: string[] = [];
  if (payload.surfacedTitle) {
    lines.push(`Surfaced item: ${payload.surfacedTitle}`);
  }
  if (payload.surfacedItemKind) {
    lines.push(`Kind: ${payload.surfacedItemKind}`);
  }
  if (typeof payload.score === 'number') {
    lines.push(`Score: ${payload.score.toFixed(3)}`);
  }
  if (typeof payload.confidence === 'number') {
    lines.push(`Confidence: ${(payload.confidence * 100).toFixed(0)}%`);
  }
  if (payload.evidenceIds.length > 0) {
    lines.push(`Evidence IDs: ${payload.evidenceIds.join(', ')}`);
  } else {
    lines.push('Evidence IDs: none attached');
  }
  if (payload.suppressionReason) {
    lines.push(`Suppression: ${payload.suppressionReason}`);
  }
  for (const reason of payload.reasons) {
    lines.push(`Reason: ${reason}`);
  }
  for (const missing of payload.missingSignals) {
    lines.push(`Missing signal: ${missing}`);
  }
  return lines;
}
