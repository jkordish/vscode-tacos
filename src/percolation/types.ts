import type { ResumeSummary } from '../types';

export const PERCOLATION_SCHEMA_VERSION = 1;

export type NormalizedSignalKind =
  | 'resume'
  | 'branch-switch'
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

function resolveSignalId(signal: Partial<NormalizedSignal>, fallbackKind: NormalizedSignalKind): string {
  if (signal.id && signal.id.trim().length > 0) {
    return signal.id.trim();
  }

  return `signal:${fallbackKind}`;
}

function resolveItemId(item: Partial<SurfacedItem>, fallbackKind: SurfacedItemKind): string {
  if (item.id && item.id.trim().length > 0) {
    return item.id.trim();
  }

  const rawTitle = (item.title ?? '').trim().toLowerCase();
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

export function normalizeSignal(signal: Partial<NormalizedSignal>, fallbackNow: number): NormalizedSignal {
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
  const title = item.title?.trim() || 'Untitled surfaced item';
  return {
    id: resolveItemId(item, kind),
    kind,
    title,
    detail: item.detail?.trim() ?? '',
    actionId: item.actionId?.trim() || undefined,
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
      summary: decision.explain?.summary?.trim() ?? '',
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

  if (summary.currentBranch && summary.previousBranch && summary.currentBranch !== summary.previousBranch) {
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

function defaultCandidatesFromSummary(summary: ResumeSummary): SurfacedItem[] {
  const candidates: Array<Partial<SurfacedItem>> = [];

  if (summary.recommendedFirstAction) {
    candidates.push({
      id: 'candidate:recommended-first-action',
      kind: 'recommended-action',
      title: 'Recommended first action',
      detail: summary.recommendedFirstAction,
      actionId: 'runNextStepAction',
      confidence: summary.lowConfidence ? 0.35 : 0.8,
      urgency: 0.7,
      novelty: 0.4,
      interruptCost: 0.45,
      evidenceIds: summary.nextStepEvidenceIds?.[0] ?? [],
      meta: {
        source: summary.source,
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
      novelty: 0.4,
      interruptCost: 0.55,
      evidenceIds: summary.lastActionEvidenceId ? [summary.lastActionEvidenceId] : [],
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
      novelty: 0.4,
      interruptCost: 0.35,
      evidenceIds: summary.nextStepEvidenceIds?.[0] ?? [],
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
      novelty: 0.25,
      interruptCost: 0.15,
      evidenceIds: summary.evidenceCatalog.map((item) => item.id),
      meta: {
        hasExternalLinks: summary.links.some((link) => link.kind === 'url'),
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
  const candidates =
    options.candidates && options.candidates.length > 0
      ? options.candidates.map((candidate) => normalizeSurfacedItem(candidate))
      : defaultCandidatesFromSummary(summary);

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
