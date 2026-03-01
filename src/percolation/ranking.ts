import type { PercolationPolicyInput, SurfacedItem } from './types';

export interface RankingWeights {
  urgency: number;
  actionability: number;
  continuity: number;
  novelty: number;
  interruptCost: number;
  confidence: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  urgency: 0.3,
  actionability: 0.25,
  continuity: 0.2,
  novelty: 0.1,
  interruptCost: 0.1,
  confidence: 0.05,
};

export interface RankingScoreBreakdown {
  urgency: number;
  actionability: number;
  continuity: number;
  novelty: number;
  interruptCost: number;
  confidence: number;
  total: number;
}

export interface RankedSurfacedItem extends SurfacedItem {
  score: number;
  scoreBreakdown: RankingScoreBreakdown;
}

export interface RankedCandidatesResult {
  ranked: RankedSurfacedItem[];
  primary?: RankedSurfacedItem;
  secondary?: RankedSurfacedItem;
}

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readNumericMeta(item: SurfacedItem, key: string): number | undefined {
  const candidate = item.meta[key];
  if (typeof candidate !== 'number' || Number.isNaN(candidate)) {
    return undefined;
  }

  return clamp01(candidate, 0);
}

function resolveActionability(item: SurfacedItem): number {
  const explicit = readNumericMeta(item, 'actionability');
  if (explicit !== undefined) {
    return explicit;
  }

  return item.actionId ? 0.8 : 0.35;
}

function resolveContinuity(item: SurfacedItem): number {
  const explicit = readNumericMeta(item, 'continuity');
  if (explicit !== undefined) {
    return explicit;
  }

  if (item.kind === 'recommended-action' || item.kind === 'next-step') {
    return 0.8;
  }

  if (item.kind === 'blocked') {
    return 0.7;
  }

  if (item.kind === 'restore') {
    return 0.65;
  }

  if (item.kind === 'evidence' || item.kind === 'trust-privacy') {
    return 0.5;
  }

  return 0.45;
}

function mergeWeights(overrides?: Partial<RankingWeights>): RankingWeights {
  if (!overrides) {
    return DEFAULT_RANKING_WEIGHTS;
  }

  return {
    urgency: overrides.urgency ?? DEFAULT_RANKING_WEIGHTS.urgency,
    actionability: overrides.actionability ?? DEFAULT_RANKING_WEIGHTS.actionability,
    continuity: overrides.continuity ?? DEFAULT_RANKING_WEIGHTS.continuity,
    novelty: overrides.novelty ?? DEFAULT_RANKING_WEIGHTS.novelty,
    interruptCost: overrides.interruptCost ?? DEFAULT_RANKING_WEIGHTS.interruptCost,
    confidence: overrides.confidence ?? DEFAULT_RANKING_WEIGHTS.confidence,
  };
}

function scoreItem(item: SurfacedItem, weights: RankingWeights): RankedSurfacedItem {
  const urgency = clamp01(item.urgency, 0.5);
  const actionability = resolveActionability(item);
  const continuity = resolveContinuity(item);
  const novelty = clamp01(item.novelty, 0.5);
  const interruptCost = clamp01(item.interruptCost, 0.5);
  const confidence = clamp01(item.confidence, 0.5);

  const breakdown = {
    urgency: roundScore(urgency * weights.urgency),
    actionability: roundScore(actionability * weights.actionability),
    continuity: roundScore(continuity * weights.continuity),
    novelty: roundScore(novelty * weights.novelty),
    interruptCost: roundScore(interruptCost * weights.interruptCost),
    confidence: roundScore(confidence * weights.confidence),
    total: 0,
  };

  breakdown.total = roundScore(
    breakdown.urgency +
      breakdown.actionability +
      breakdown.continuity +
      breakdown.novelty +
      breakdown.confidence -
      breakdown.interruptCost,
  );

  return {
    ...item,
    score: breakdown.total,
    scoreBreakdown: breakdown,
  };
}

function compareRanked(left: RankedSurfacedItem, right: RankedSurfacedItem): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.urgency !== right.urgency) {
    return right.urgency - left.urgency;
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence;
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.id.localeCompare(right.id);
}

export function rankCandidates(
  input: PercolationPolicyInput,
  options: { weights?: Partial<RankingWeights> } = {},
): RankedCandidatesResult {
  const weights = mergeWeights(options.weights);
  const ranked = input.candidates.map((item) => scoreItem(item, weights)).sort(compareRanked);
  const [primary, secondary] = ranked;

  return {
    ranked,
    primary,
    secondary,
  };
}
