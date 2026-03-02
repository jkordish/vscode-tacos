import { bucketForNoveltyScore, isSummaryNoveltyBucket } from '../novelty';
import type { ResumeSummary, SummaryNoveltyBucket } from '../types';

export const PERCOLATION_SCHEMA_VERSION = 1;

export type NormalizedSignalKind =
  | 'resume'
  | 'branch-switch'
  | 'git-commit'
  | 'git-divergence'
  | 'checkpoint-note'
  | 'task-failure'
  | 'debug-failure'
  | 'context-change'
  | 'privacy-change'
  | 'trust-change'
  | 'unknown';

export type PercolationPolicyMode = 'active' | 'paused' | 'restricted' | 'disabled';

export interface NormalizedSignal {
  id: string;
  kind: NormalizedSignalKind;
  observedAt: number;
  confidence: number;
  actionability: number;
  interruptCost: number;
  meta: Record<string, string | number | boolean>;
}

export type SurfacedItemKind =
  | 'clarification'
  | 'recommended-action'
  | 'next-step'
  | 'blocked'
  | 'restore'
  | 'evidence'
  | 'trust-privacy'
  | 'status';

export interface SurfacedItem {
  id: string;
  kind: SurfacedItemKind;
  title: string;
  detail: string;
  actionId?: string;
  confidence: number;
  urgency: number;
  novelty: number;
  interruptCost: number;
  evidenceIds: string[];
  meta: Record<string, string | number | boolean>;
}

export type PercolationSuppressionReason =
  | 'disabled'
  | 'paused'
  | 'restricted'
  | 'low-confidence'
  | 'cooldown'
  | 'quiet-hours'
  | 'no-change'
  | 'noise-budget'
  | 'no-candidate';

export interface PercolationDecision {
  primary?: SurfacedItem;
  secondary: SurfacedItem[];
  surfaced: SurfacedItem[];
  suppressionReason?: PercolationSuppressionReason;
  nextEligibleAt?: number;
  explain: {
    summary: string;
    reasons: string[];
    evidenceIds: string[];
  };
}

export interface PercolationPolicyInput {
  schemaVersion: number;
  contextHash: string;
  now: number;
  mode: PercolationPolicyMode;
  summary: ResumeSummary;
  signals: NormalizedSignal[];
  candidates: SurfacedItem[];
}

export interface PercolationInputOptions {
  now?: number;
  mode?: PercolationPolicyMode;
  signals?: ReadonlyArray<Partial<NormalizedSignal>>;
  candidates?: ReadonlyArray<Partial<SurfacedItem>>;
  priors?: PercolationUserPriors;
}

export interface PercolationUserPriors {
  checkpointNoteText?: string;
  checkpointUpdatedAt?: number;
  correctionHints?: string[];
  correctionsUpdatedAt?: number;
  scratchpadExcerpt?: string;
  scratchpadHasContent?: boolean;
  scratchpadUpdatedAt?: number;
}

export const SCRATCHPAD_LARGE_PREVIEW_UNAVAILABLE_PREFIX =
  'Preview unavailable for large scratchpad';

export function isScratchpadLargePreviewUnavailableLine(value: string): boolean {
  return new RegExp(`^${SCRATCHPAD_LARGE_PREVIEW_UNAVAILABLE_PREFIX}\\s*\\(`, 'iu').test(
    value.trim(),
  );
}

export function formatScratchpadLargePreviewUnavailableLine(sizeBytes: number): string {
  return `${SCRATCHPAD_LARGE_PREVIEW_UNAVAILABLE_PREFIX} (${Math.ceil(sizeBytes / 1024)} KB). Open Scratchpad to view.`;
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

function normalizeMeta(
  meta: unknown,
  fallback: Record<string, string | number | boolean> = {},
): Record<string, string | number | boolean> {
  if (!meta || typeof meta !== 'object') {
    return { ...fallback };
  }

  const entries = Object.entries(meta as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = value;
    }
  }

  return normalized;
}

function resolveSignalId(
  signal: Partial<NormalizedSignal>,
  fallbackKind: NormalizedSignalKind,
): string {
  if (typeof signal.id === 'string') {
    const trimmedId = signal.id.trim();
    if (trimmedId.length > 0) {
      return trimmedId;
    }
  }

  return `signal:${fallbackKind}`;
}

function resolveItemId(item: Partial<SurfacedItem>, fallbackKind: SurfacedItemKind): string {
  if (typeof item.id === 'string') {
    const trimmedId = item.id.trim();
    if (trimmedId.length > 0) {
      return trimmedId;
    }
  }

  const rawTitle = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
  let titleToken = rawTitle.replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  if (!titleToken) {
    titleToken = 'item';
  }
  return `item:${fallbackKind}:${titleToken}`;
}

function normalizeEvidenceIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const unique = new Set<string>();
  for (const candidate of ids) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const value = candidate.trim();
    if (!value) {
      continue;
    }

    unique.add(value);
  }

  return [...unique].sort((left, right) => left.localeCompare(right));
}

const PRIOR_TOKEN_REGEX = /[a-z0-9]{3,}/gu;
const PRIOR_TOKEN_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'over',
  'under',
  'your',
  'you',
  'should',
  'will',
  'have',
  'has',
  'are',
  'was',
  'were',
  'but',
  'then',
  'than',
  'before',
  'after',
  'next',
  'step',
]);
const NEGATION_MARKER_TOKENS = new Set([
  'not',
  'never',
  'without',
  'avoid',
  'skip',
  'prevent',
  'dont',
  'don',
  'cannot',
  'cant',
]);
const NEGATION_CUE_REGEX =
  /\b(?:do\s+not|don['’]?t|cannot|can['’]?t|not|never|without|avoid|skip|prevent)\b/iu;
const PRIOR_FRESHNESS_HALF_LIFE_MS = 12 * 60 * 60 * 1000;
const PRIOR_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const CHECKPOINT_BASE_PROMOTION: Record<SurfacedItemKind, number> = {
  clarification: 0.06,
  'recommended-action': 0.12,
  'next-step': 0.14,
  blocked: 0.05,
  restore: 0.04,
  evidence: 0.02,
  'trust-privacy': 0.02,
  status: 0.02,
};

const CORRECTION_BASE_SUPPRESSION: Record<SurfacedItemKind, number> = {
  clarification: 0.02,
  'recommended-action': 0.2,
  'next-step': 0.18,
  blocked: 0.16,
  restore: 0.08,
  evidence: 0.05,
  'trust-privacy': 0.03,
  status: 0.03,
};

const SCRATCHPAD_BASE_PROMOTION: Record<SurfacedItemKind, number> = {
  clarification: 0.04,
  'recommended-action': 0.07,
  'next-step': 0.08,
  blocked: 0.04,
  restore: 0.04,
  evidence: 0.06,
  'trust-privacy': 0.03,
  status: 0.02,
};

function roundMeta(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toFiniteTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function tokenizePriorText(value: string): string[] {
  const normalizedValue = value
    .toLowerCase()
    .replace(/can['’]?t/gu, 'cannot')
    .replace(/don['’]?t/gu, 'dont');
  const matches = normalizedValue.match(PRIOR_TOKEN_REGEX) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    if (match.length < 3 || PRIOR_TOKEN_STOP_WORDS.has(match)) {
      continue;
    }
    unique.add(match);
  }
  return [...unique].sort((left, right) => left.localeCompare(right));
}

function buildCandidateTokenSet(item: SurfacedItem): ReadonlySet<string> {
  return new Set(tokenizePriorText(`${item.title} ${item.detail} ${item.actionId ?? ''}`));
}

function resolvePriorFreshness(updatedAt: unknown, now: number): number {
  const timestamp = toFiniteTimestamp(updatedAt);
  if (timestamp === undefined) {
    return 0.75;
  }
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs >= PRIOR_STALE_AFTER_MS) {
    return 0.2;
  }
  return Math.max(0.3, Math.min(1, Math.exp((-ageMs * Math.LN2) / PRIOR_FRESHNESS_HALF_LIFE_MS)));
}

function computeTokenOverlap(
  candidateTokens: ReadonlySet<string>,
  priorTokens: ReadonlyArray<string>,
): number {
  if (candidateTokens.size === 0 || priorTokens.length === 0) {
    return 0;
  }
  const uniquePriorTokens = new Set(priorTokens);
  let matches = 0;
  for (const token of uniquePriorTokens.values()) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }
  return matches / uniquePriorTokens.size;
}

function uniqueNonEmptyStrings(values: ReadonlyArray<string>): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    unique.add(trimmed);
  }
  return [...unique];
}

function normalizeScratchpadExcerptForPrior(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const lines = value
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isScratchpadLargePreviewUnavailableLine(line));
  if (lines.length === 0) {
    return undefined;
  }
  return lines.join('\n');
}

function hasNegationCue(value: string): boolean {
  return NEGATION_CUE_REGEX.test(value);
}

function computeNegatedCorrectionMatch(
  candidateTokens: ReadonlySet<string>,
  correctionHints: ReadonlyArray<string>,
): number {
  if (candidateTokens.size === 0 || correctionHints.length === 0) {
    return 0;
  }

  let strongestMatch = 0;
  for (const hint of correctionHints) {
    if (!hasNegationCue(hint)) {
      continue;
    }
    const scopedTokens = tokenizePriorText(hint).filter(
      (token) => !NEGATION_MARKER_TOKENS.has(token),
    );
    const overlap = computeTokenOverlap(candidateTokens, scopedTokens);
    if (overlap > strongestMatch) {
      strongestMatch = overlap;
    }
  }

  return strongestMatch;
}

function resolvePolicyPriors(
  summary: ResumeSummary,
  priors?: PercolationUserPriors,
): PercolationUserPriors | undefined {
  const summaryCorrections = Array.isArray(summary.userCorrections) ? summary.userCorrections : [];
  const correctionHints = Array.isArray(priors?.correctionHints)
    ? uniqueNonEmptyStrings(priors.correctionHints)
    : uniqueNonEmptyStrings(summaryCorrections);
  const checkpointNoteText = priors?.checkpointNoteText?.trim() ?? '';
  const scratchpadExcerpt = normalizeScratchpadExcerptForPrior(priors?.scratchpadExcerpt);
  const hasScratchpadContent = priors?.scratchpadHasContent === true;
  if (
    !checkpointNoteText &&
    correctionHints.length === 0 &&
    !scratchpadExcerpt &&
    !hasScratchpadContent
  ) {
    return undefined;
  }
  return {
    checkpointNoteText: checkpointNoteText || undefined,
    checkpointUpdatedAt: priors?.checkpointUpdatedAt,
    correctionHints,
    correctionsUpdatedAt: priors?.correctionsUpdatedAt,
    scratchpadExcerpt: scratchpadExcerpt || undefined,
    scratchpadHasContent: hasScratchpadContent,
    scratchpadUpdatedAt: priors?.scratchpadUpdatedAt,
  };
}

function annotateCandidateWithUserPriors(
  item: SurfacedItem,
  priors: PercolationUserPriors,
  now: number,
): SurfacedItem {
  const candidateTokens = buildCandidateTokenSet(item);
  const checkpointTokens = priors.checkpointNoteText
    ? tokenizePriorText(priors.checkpointNoteText)
    : [];
  const correctionHints = uniqueNonEmptyStrings(priors.correctionHints ?? []);
  const correctionTokens =
    correctionHints.length > 0 ? tokenizePriorText(correctionHints.join(' ')) : [];
  const negatedCorrectionMatch = computeNegatedCorrectionMatch(candidateTokens, correctionHints);
  const scratchpadTokens = priors.scratchpadExcerpt
    ? tokenizePriorText(priors.scratchpadExcerpt)
    : [];
  const hasScratchpadPrior = priors.scratchpadHasContent === true || scratchpadTokens.length > 0;

  if (checkpointTokens.length === 0 && correctionTokens.length === 0 && !hasScratchpadPrior) {
    return item;
  }

  const checkpointFreshness = resolvePriorFreshness(priors.checkpointUpdatedAt, now);
  const correctionsFreshness = resolvePriorFreshness(priors.correctionsUpdatedAt, now);
  const scratchpadFreshness = resolvePriorFreshness(priors.scratchpadUpdatedAt, now);
  const checkpointMatch = computeTokenOverlap(candidateTokens, checkpointTokens);
  const correctionMatch = computeTokenOverlap(candidateTokens, correctionTokens);
  const scratchpadMatch = computeTokenOverlap(candidateTokens, scratchpadTokens);

  let checkpointPromotion =
    checkpointTokens.length > 0
      ? checkpointFreshness *
        Math.min(0.35, CHECKPOINT_BASE_PROMOTION[item.kind] + checkpointMatch * 0.18)
      : 0;
  let staleCheckpointSuppression = 0;
  if (checkpointTokens.length > 0 && checkpointFreshness < 0.35 && checkpointMatch < 0.1) {
    staleCheckpointSuppression = (0.35 - checkpointFreshness) * 0.2;
  }

  let correctionPromotion =
    correctionTokens.length > 0
      ? item.kind === 'clarification'
        ? correctionsFreshness * (0.06 + correctionMatch * 0.08)
        : correctionsFreshness * correctionMatch * 0.14
      : 0;
  let correctionSuppression =
    correctionTokens.length > 0
      ? correctionsFreshness * CORRECTION_BASE_SUPPRESSION[item.kind] * (1 - correctionMatch)
      : 0;
  if (item.kind === 'clarification') {
    correctionSuppression *= 0.25;
  }
  if (negatedCorrectionMatch > 0) {
    correctionPromotion = 0;
    correctionSuppression = Math.max(
      correctionSuppression,
      correctionsFreshness * Math.min(0.35, 0.12 + negatedCorrectionMatch * 0.24),
    );
  }

  let scratchpadPromotion = 0;
  if (hasScratchpadPrior) {
    const scratchpadMatchBonus = scratchpadTokens.length > 0 ? scratchpadMatch * 0.1 : 0;
    const hasContentBoost = priors.scratchpadHasContent === true ? 0.02 : 0;
    scratchpadPromotion =
      scratchpadFreshness *
      Math.min(0.22, SCRATCHPAD_BASE_PROMOTION[item.kind] + scratchpadMatchBonus + hasContentBoost);
  }

  let resolvedConflict = false;
  if (
    correctionSuppression > 0 &&
    checkpointPromotion > 0 &&
    correctionSuppression >= checkpointPromotion * 0.6
  ) {
    checkpointPromotion *= 0.4;
    resolvedConflict = true;
  }
  if (
    correctionSuppression > 0 &&
    scratchpadPromotion > 0 &&
    correctionSuppression >= scratchpadPromotion * 0.6
  ) {
    scratchpadPromotion *= 0.65;
    resolvedConflict = true;
  }

  const priorPromotion = Math.min(
    1,
    checkpointPromotion + correctionPromotion + scratchpadPromotion,
  );
  const priorSuppression = Math.min(1, correctionSuppression + staleCheckpointSuppression);
  if (priorPromotion <= 0 && priorSuppression <= 0) {
    return item;
  }

  const checkpointPromotionRounded = roundMeta(checkpointPromotion);
  const correctionPromotionRounded = roundMeta(correctionPromotion);
  const scratchpadPromotionRounded = roundMeta(scratchpadPromotion);
  const correctionSuppressionRounded = roundMeta(correctionSuppression);
  const staleCheckpointSuppressionRounded = roundMeta(staleCheckpointSuppression);
  const priorSuppressionRounded = roundMeta(priorSuppression);
  const meta: Record<string, string | number | boolean> = {
    ...item.meta,
    userPriorApplied: true,
    priorPromotion: roundMeta(priorPromotion),
    priorSuppression: priorSuppressionRounded,
  };
  if (checkpointPromotionRounded >= 0.03) {
    meta.priorPromotionCheckpoint = true;
  }
  if (correctionPromotionRounded >= 0.03) {
    meta.priorPromotionCorrections = true;
  }
  if (scratchpadPromotionRounded >= 0.03) {
    meta.priorPromotionScratchpad = true;
  }
  if (correctionSuppressionRounded >= 0.03) {
    meta.priorSuppressionCorrections = true;
  }
  if (negatedCorrectionMatch >= 0.1 && correctionSuppressionRounded >= 0.03) {
    meta.priorSuppressionCorrectionNegation = true;
  }
  if (staleCheckpointSuppressionRounded >= 0.03) {
    meta.priorSuppressionCheckpointStale = true;
  }
  if (resolvedConflict) {
    meta.priorConflictResolution = 'corrections-precedence';
  }

  return {
    ...item,
    meta,
  };
}

function applyUserPriorsToCandidates(
  summary: ResumeSummary,
  candidates: SurfacedItem[],
  now: number,
  priors?: PercolationUserPriors,
): SurfacedItem[] {
  const resolvedPriors = resolvePolicyPriors(summary, priors);
  if (!resolvedPriors) {
    return candidates;
  }
  return candidates.map((item) => annotateCandidateWithUserPriors(item, resolvedPriors, now));
}

export function normalizeSignal(
  signal: Partial<NormalizedSignal>,
  fallbackNow: number,
): NormalizedSignal {
  const kind: NormalizedSignalKind = signal.kind ?? 'unknown';
  return {
    id: resolveSignalId(signal, kind),
    kind,
    observedAt:
      typeof signal.observedAt === 'number' && Number.isFinite(signal.observedAt)
        ? Math.max(0, Math.floor(signal.observedAt))
        : Math.max(0, Math.floor(fallbackNow)),
    confidence: clamp01(signal.confidence, 0.5),
    actionability: clamp01(signal.actionability, 0.5),
    interruptCost: clamp01(signal.interruptCost, 0.5),
    meta: normalizeMeta(signal.meta),
  };
}

export function normalizeSurfacedItem(item: Partial<SurfacedItem>): SurfacedItem {
  const kind: SurfacedItemKind = item.kind ?? 'status';
  const titleValue = typeof item.title === 'string' ? item.title.trim() : '';
  const detailValue = typeof item.detail === 'string' ? item.detail.trim() : '';
  const actionIdValue = typeof item.actionId === 'string' ? item.actionId.trim() : '';
  return {
    id: resolveItemId(item, kind),
    kind,
    title: titleValue || 'Untitled surfaced item',
    detail: detailValue,
    actionId: actionIdValue || undefined,
    confidence: clamp01(item.confidence, 0.5),
    urgency: clamp01(item.urgency, 0.5),
    novelty: clamp01(item.novelty, 0.5),
    interruptCost: clamp01(item.interruptCost, 0.5),
    evidenceIds: normalizeEvidenceIds(item.evidenceIds),
    meta: normalizeMeta(item.meta),
  };
}

export function normalizePercolationDecision(
  decision: Partial<PercolationDecision>,
): PercolationDecision {
  const surfaced = Array.isArray(decision.surfaced)
    ? decision.surfaced.map((item) => normalizeSurfacedItem(item))
    : [];
  const secondary = Array.isArray(decision.secondary)
    ? decision.secondary.map((item) => normalizeSurfacedItem(item))
    : [];
  const primary = decision.primary ? normalizeSurfacedItem(decision.primary) : undefined;

  const reasons = Array.isArray(decision.explain?.reasons)
    ? decision.explain.reasons
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  return {
    primary,
    secondary,
    surfaced,
    suppressionReason: decision.suppressionReason,
    nextEligibleAt:
      typeof decision.nextEligibleAt === 'number' && Number.isFinite(decision.nextEligibleAt)
        ? Math.max(0, Math.floor(decision.nextEligibleAt))
        : undefined,
    explain: {
      summary: typeof decision.explain?.summary === 'string' ? decision.explain.summary.trim() : '',
      reasons,
      evidenceIds: normalizeEvidenceIds(decision.explain?.evidenceIds),
    },
  };
}

function defaultSignalsFromSummary(summary: ResumeSummary, now: number): NormalizedSignal[] {
  const signals: Array<Partial<NormalizedSignal>> = [
    {
      id: 'signal:resume',
      kind: 'resume',
      observedAt: summary.generatedAt || now,
      confidence: summary.lowConfidence ? 0.35 : 0.75,
      actionability: summary.nextSteps.length > 0 ? 0.75 : 0.35,
      interruptCost: 0.25,
      meta: {
        lowConfidence: Boolean(summary.lowConfidence),
        source: summary.source,
      },
    },
  ];

  if (
    summary.currentBranch &&
    summary.previousBranch &&
    summary.currentBranch !== summary.previousBranch
  ) {
    signals.push({
      id: 'signal:branch-switch',
      kind: 'branch-switch',
      observedAt: summary.generatedAt || now,
      confidence: 0.8,
      actionability: 0.7,
      interruptCost: 0.4,
      meta: {
        from: summary.previousBranch,
        to: summary.currentBranch,
      },
    });
  }

  if (summary.lastFailingCommand) {
    signals.push({
      id: 'signal:task-failure',
      kind: 'task-failure',
      observedAt: summary.generatedAt || now,
      confidence: 0.85,
      actionability: 0.9,
      interruptCost: 0.6,
      meta: {
        command: summary.lastFailingCommand,
      },
    });
  }

  return signals.map((signal) => normalizeSignal(signal, now));
}

interface ResolvedSummaryNovelty {
  score: number;
  bucket: SummaryNoveltyBucket;
}

function resolveSummaryNovelty(summary: ResumeSummary): ResolvedSummaryNovelty {
  const explicitProfile = summary.noveltyProfile;
  if (explicitProfile) {
    const normalizedScore = clamp01(explicitProfile.score, 0.5);
    const explicitBucket = explicitProfile.bucket;
    const bucket = isSummaryNoveltyBucket(explicitBucket)
      ? explicitBucket
      : bucketForNoveltyScore(normalizedScore);
    return {
      score: normalizedScore,
      bucket,
    };
  }

  const hasChanges =
    (summary.changesSinceLastResume ?? []).some(
      (line) => line.trim() && !/no recent changes captured/iu.test(line),
    ) || summary.topFiles.length > 0;
  const hasBlocker = Boolean(summary.lastFailingCommand);
  const baseline = hasChanges ? 0.45 : 0.15;
  const blockerBoost = hasBlocker ? 0.2 : 0;
  const score = clamp01(baseline + blockerBoost, baseline);
  return {
    score,
    bucket: bucketForNoveltyScore(score),
  };
}

function defaultCandidatesFromSummary(summary: ResumeSummary): SurfacedItem[] {
  const candidates: Array<Partial<SurfacedItem>> = [];
  const summaryNovelty = resolveSummaryNovelty(summary);
  const clarificationNovelty = clamp01(0.45 + summaryNovelty.score * 0.15, 0.55);
  const recommendedNovelty = clamp01(0.2 + summaryNovelty.score * 0.5, 0.4);
  const blockedNovelty = clamp01(
    0.25 + summaryNovelty.score * 0.45 + (summary.lastFailingCommand ? 0.05 : 0),
    0.4,
  );
  const nextStepNovelty = clamp01(0.2 + summaryNovelty.score * 0.42, 0.4);
  const evidenceNovelty = clamp01(0.12 + summaryNovelty.score * 0.24, 0.25);

  if (summary.lowConfidence) {
    const firstSafeStep = summary.nextSteps[0]?.trim() ?? '';
    const clarificationDetail = firstSafeStep
      ? `Clarify this next safe step before acting: ${firstSafeStep}`
      : 'Add a one-line checkpoint note with your next safe action.';
    candidates.push({
      id: 'candidate:clarification',
      kind: 'clarification',
      title: 'Clarify next safe step',
      detail: clarificationDetail,
      actionId: 'sessionAddCheckpoint',
      confidence: 0.95,
      urgency: 0.82,
      novelty: clarificationNovelty,
      interruptCost: 0.12,
      evidenceIds: summary.nextStepEvidenceIds?.[0] ?? [],
      meta: {
        lowConfidence: true,
        fallback: 'clarification-first',
        noveltyBucket: summaryNovelty.bucket,
        noveltyScore: roundMeta(summaryNovelty.score),
      },
    });
  }

  if (summary.recommendedFirstAction) {
    candidates.push({
      id: 'candidate:recommended-first-action',
      kind: 'recommended-action',
      title: 'Recommended first action',
      detail: summary.recommendedFirstAction,
      actionId: 'runNextStepAction',
      confidence: summary.lowConfidence ? 0.35 : 0.8,
      urgency: 0.7,
      novelty: recommendedNovelty,
      interruptCost: 0.45,
      evidenceIds: summary.nextStepEvidenceIds?.[0] ?? [],
      meta: {
        source: summary.source,
        noveltyBucket: summaryNovelty.bucket,
        noveltyScore: roundMeta(summaryNovelty.score),
      },
    });
  }

  if (summary.pendingBlocked && summary.pendingBlocked.length > 0) {
    candidates.push({
      id: 'candidate:blocker',
      kind: 'blocked',
      title: 'Blocked',
      detail: summary.pendingBlocked[0],
      actionId: summary.lastFailingCommand ? 'restoreCopyFailingCommand' : undefined,
      confidence: summary.lowConfidence ? 0.4 : 0.75,
      urgency: 0.9,
      novelty: blockedNovelty,
      interruptCost: 0.55,
      evidenceIds: summary.lastActionEvidenceId ? [summary.lastActionEvidenceId] : [],
      meta: {
        noveltyBucket: summaryNovelty.bucket,
        noveltyScore: roundMeta(summaryNovelty.score),
      },
    });
  }

  if (summary.nextSteps[0]) {
    candidates.push({
      id: 'candidate:next-step',
      kind: 'next-step',
      title: 'Next',
      detail: summary.nextSteps[0],
      actionId: 'copyNextSteps',
      confidence: summary.lowConfidence ? 0.45 : 0.72,
      urgency: 0.65,
      novelty: nextStepNovelty,
      interruptCost: 0.35,
      evidenceIds: summary.nextStepEvidenceIds?.[0] ?? [],
      meta: {
        noveltyBucket: summaryNovelty.bucket,
        noveltyScore: roundMeta(summaryNovelty.score),
      },
    });
  }

  if (summary.evidenceCatalog && summary.evidenceCatalog.length > 0) {
    candidates.push({
      id: 'candidate:evidence',
      kind: 'evidence',
      title: 'Evidence available',
      detail: `${summary.evidenceCatalog.length} evidence item${summary.evidenceCatalog.length === 1 ? '' : 's'}`,
      actionId: 'openEvidence',
      confidence: 0.8,
      urgency: 0.4,
      novelty: evidenceNovelty,
      interruptCost: 0.15,
      evidenceIds: summary.evidenceCatalog.map((item) => item.id),
      meta: {
        hasExternalLinks: summary.links.some((link) => link.kind === 'url'),
        noveltyBucket: summaryNovelty.bucket,
        noveltyScore: roundMeta(summaryNovelty.score),
      },
    });
  }

  return candidates.map((item) => normalizeSurfacedItem(item));
}

export function createPercolationPolicyInput(
  summary: ResumeSummary,
  options: PercolationInputOptions = {},
): PercolationPolicyInput {
  const now = Math.max(0, Math.floor(options.now ?? Date.now()));
  const mode = options.mode ?? 'active';
  const signals =
    options.signals && options.signals.length > 0
      ? options.signals.map((signal) => normalizeSignal(signal, now))
      : defaultSignalsFromSummary(summary, now);
  const normalizedCandidates =
    options.candidates && options.candidates.length > 0
      ? options.candidates.map((candidate) => normalizeSurfacedItem(candidate))
      : defaultCandidatesFromSummary(summary);
  const candidates = applyUserPriorsToCandidates(
    summary,
    normalizedCandidates,
    now,
    options.priors,
  );

  return {
    schemaVersion: PERCOLATION_SCHEMA_VERSION,
    contextHash: summary.contextHash,
    now,
    mode,
    summary,
    signals,
    candidates,
  };
}
