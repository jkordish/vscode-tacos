import type { ResumeSummary } from '../types';
import type { RankedSurfacedItem } from './ranking';
import type { PercolationSuppressionReason, SurfacedItemKind } from './types';

export interface PercolationExplainabilityPayload {
  surfacedItemId?: string;
  surfacedItemKind?: SurfacedItemKind;
  surfacedTitle?: string;
  surfacedDetail?: string;
  score?: number;
  confidence?: number;
  evidenceIds: string[];
  suppressionReason?: PercolationSuppressionReason;
  reasons: string[];
  missingSignals: string[];
}

export interface BuildPercolationExplainabilityInput {
  summary: ResumeSummary;
  primary?: RankedSurfacedItem;
  suppressionReason?: PercolationSuppressionReason;
}

function describeSuppressionReason(reason: PercolationSuppressionReason): string {
  switch (reason) {
    case 'quiet-hours':
      return 'Surfacing is currently suppressed by quiet hours.';
    case 'cooldown':
      return 'Surfacing is currently suppressed by cooldown.';
    case 'no-change':
      return 'Surfacing is suppressed because context has not changed.';
    case 'noise-budget':
      return 'Surfacing is suppressed by the interruption noise budget.';
    case 'disabled':
      return 'Surfacing is suppressed because the feature is disabled.';
    case 'paused':
      return 'Surfacing is suppressed because companion mode is paused.';
    case 'restricted':
      return 'Restricted Mode filtered execution-oriented candidates from surfacing until workspace trust is granted.';
    case 'low-confidence':
      return 'Surfacing is suppressed until confidence is rebuilt.';
    case 'no-candidate':
      return 'Surfacing is suppressed because no candidate met policy requirements.';
    default: {
      const exhaustive: never = reason;
      return `Surfacing is suppressed (${String(exhaustive)}).`;
    }
  }
}

function summarizeTopFactors(primary: RankedSurfacedItem): string | undefined {
  const contributions = [
    ['urgency', primary.scoreBreakdown.urgency],
    ['actionability', primary.scoreBreakdown.actionability],
    ['continuity', primary.scoreBreakdown.continuity],
    ['novelty', primary.scoreBreakdown.novelty],
    ['interruptCost', -primary.scoreBreakdown.interruptCost],
    ['confidence', primary.scoreBreakdown.confidence],
    ['userPrior', primary.scoreBreakdown.userPrior],
  ] as const;

  const top = [...contributions]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
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
    if (primary.meta.userPriorApplied === true) {
      const priorSources: string[] = [];
      if (primary.meta.priorPromotionCheckpoint === true) {
        priorSources.push('checkpoint note');
      }
      if (primary.meta.priorPromotionCorrections === true) {
        priorSources.push('saved correction');
      }
      if (primary.meta.priorPromotionScratchpad === true) {
        priorSources.push('scratchpad');
      }
      if (priorSources.length > 0) {
        reasons.push(`User-authored priors influenced ranking: ${priorSources.join(', ')}.`);
      }
      if (primary.meta.priorSuppressionCorrections === true) {
        reasons.push('Saved corrections suppressed weaker candidate matches.');
      }
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
