import type { ResumeSignals, ResumeSummary, TriggerReason } from '../types';
import { parseCommitHashToken } from '../git';
import { normalizeSignal, type NormalizedSignal, type PercolationPolicyMode } from './types';

export interface PercolationSignalAdapterInput {
  summary: ResumeSummary;
  runtimeSignals: ResumeSignals;
  mode: PercolationPolicyMode;
  trusted: boolean;
  triggerReason: TriggerReason;
  now?: number;
  hasCheckpointNote?: boolean;
}

const DEBUG_FAILURE_PATTERN = /\b(fail|failing|error|exception|panic|timeout|crash)\b/i;

function hasBranchSwitch(summary: ResumeSummary): boolean {
  return Boolean(
    summary.currentBranch &&
    summary.previousBranch &&
    summary.currentBranch !== summary.previousBranch,
  );
}

function isRestrictedMode(mode: PercolationPolicyMode, trusted: boolean): boolean {
  return mode === 'restricted' || !trusted;
}

function normalizeNow(input: PercolationSignalAdapterInput): number {
  return Math.max(0, Math.floor(input.now ?? input.summary.generatedAt ?? Date.now()));
}

function normalizeSignalsForRanking(
  signals: ReadonlyArray<Partial<NormalizedSignal>>,
  now: number,
): NormalizedSignal[] {
  const byId = new Map<string, NormalizedSignal>();
  for (const signal of signals) {
    const normalized = normalizeSignal(signal, now);
    if (!byId.has(normalized.id)) {
      byId.set(normalized.id, normalized);
    }
  }

  return [...byId.values()].sort((left, right) => {
    if (left.observedAt !== right.observedAt) {
      return right.observedAt - left.observedAt;
    }

    return left.id.localeCompare(right.id);
  });
}

function parseRecentCommitHashFromGitLog(gitLog: string): string | undefined {
  const firstLine = gitLog
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return undefined;
  }

  return parseCommitHashToken(firstLine);
}

function resolveRecentCommitSemantic(
  runtime: ResumeSignals,
  now: number,
): { hash: string; observedAt: number } | undefined {
  const hash =
    parseCommitHashToken(runtime.recentCommitHash) ??
    parseRecentCommitHashFromGitLog(runtime.gitLog);
  if (!hash) {
    return undefined;
  }

  const observedAt =
    typeof runtime.recentCommitAt === 'number' &&
    Number.isFinite(runtime.recentCommitAt) &&
    runtime.recentCommitAt > 0
      ? Math.floor(runtime.recentCommitAt)
      : now;

  return {
    hash,
    observedAt,
  };
}

function resolveGitDivergenceSemantic(
  runtime: ResumeSignals,
): { ahead: number; behind: number; total: number } | undefined {
  const ahead =
    typeof runtime.divergenceAhead === 'number' &&
    Number.isFinite(runtime.divergenceAhead) &&
    runtime.divergenceAhead >= 0
      ? Math.floor(runtime.divergenceAhead)
      : 0;
  const behind =
    typeof runtime.divergenceBehind === 'number' &&
    Number.isFinite(runtime.divergenceBehind) &&
    runtime.divergenceBehind >= 0
      ? Math.floor(runtime.divergenceBehind)
      : 0;
  const total = ahead + behind;
  if (total <= 0) {
    return undefined;
  }

  return {
    ahead,
    behind,
    total,
  };
}

export function buildPercolationSignalBundle(
  input: PercolationSignalAdapterInput,
): NormalizedSignal[] {
  const now = normalizeNow(input);
  const summary = input.summary;
  const runtime = input.runtimeSignals;
  const restricted = isRestrictedMode(input.mode, input.trusted);
  const branchSwitched = !restricted && hasBranchSwitch(summary);
  const recentCommit = !restricted ? resolveRecentCommitSemantic(runtime, now) : undefined;
  const divergence = !restricted ? resolveGitDivergenceSemantic(runtime) : undefined;
  const rawSignals: Array<Partial<NormalizedSignal>> = [
    {
      id: 'signal:resume',
      kind: 'resume',
      observedAt: summary.generatedAt || now,
      confidence: summary.lowConfidence ? 0.35 : 0.78,
      actionability: summary.nextSteps.length > 0 ? 0.76 : 0.35,
      interruptCost: 0.24,
      meta: {
        trigger: input.triggerReason,
        source: summary.source,
        lowConfidence: Boolean(summary.lowConfidence),
      },
    },
  ];

  if (branchSwitched) {
    rawSignals.push({
      id: 'signal:branch-switch',
      kind: 'branch-switch',
      observedAt: summary.generatedAt || now,
      confidence: 0.82,
      actionability: 0.7,
      interruptCost: 0.38,
      meta: {
        from: summary.previousBranch ?? '',
        to: summary.currentBranch ?? '',
        branchSwitched: true,
      },
    });
  }

  if (recentCommit) {
    rawSignals.push({
      id: `signal:git-commit:${recentCommit.hash.slice(0, 12)}`,
      kind: 'git-commit',
      observedAt: recentCommit.observedAt,
      confidence: 0.78,
      actionability: 0.61,
      interruptCost: 0.24,
      meta: {
        recentCommit: true,
        hash: recentCommit.hash,
        branch: summary.currentBranch ?? runtime.branch,
      },
    });
  }

  if (divergence) {
    rawSignals.push({
      id: `signal:git-divergence:${divergence.ahead}:${divergence.behind}`,
      kind: 'git-divergence',
      observedAt: now,
      confidence: 0.81,
      actionability: 0.66,
      interruptCost: 0.31,
      meta: {
        divergence: true,
        ahead: divergence.ahead,
        behind: divergence.behind,
      },
    });
  }

  const failingCommand = runtime.failingCommand?.trim() || summary.lastFailingCommand?.trim();
  if (!restricted && failingCommand) {
    rawSignals.push({
      id: 'signal:task-failure',
      kind: 'task-failure',
      observedAt: now,
      confidence: 0.86,
      actionability: 0.9,
      interruptCost: 0.58,
      meta: {
        command: failingCommand,
      },
    });
  }

  const debugFailure = runtime.recentDebug.find((line) => DEBUG_FAILURE_PATTERN.test(line));
  if (debugFailure) {
    rawSignals.push({
      id: 'signal:debug-failure',
      kind: 'debug-failure',
      observedAt: now,
      confidence: 0.72,
      actionability: 0.68,
      interruptCost: 0.42,
      meta: {
        from: debugFailure.slice(0, 120),
        trusted: !restricted,
      },
    });
  }

  const resumeGapMinutes =
    typeof summary.resumeGapMinutes === 'number'
      ? summary.resumeGapMinutes
      : runtime.resumeGapMinutes;
  const changedFileCount = runtime.changedFiles.length;
  const contextLikelyChanged =
    changedFileCount > 0 ||
    runtime.recentFiles.length > 0 ||
    Boolean(summary.longGap) ||
    (typeof resumeGapMinutes === 'number' && resumeGapMinutes >= 5);
  if (contextLikelyChanged) {
    rawSignals.push({
      id: 'signal:context-change',
      kind: 'context-change',
      observedAt: now,
      confidence: summary.longGap ? 0.85 : 0.65,
      actionability: changedFileCount > 0 ? 0.72 : 0.52,
      interruptCost: 0.2,
      meta: {
        changedFiles: changedFileCount,
        resumeGapMinutes: resumeGapMinutes ?? -1,
        longGap: Boolean(summary.longGap),
        branchSwitched,
        recentCommit: Boolean(recentCommit),
        divergence: Boolean(divergence),
      },
    });
  }

  const hasCheckpointHint =
    input.hasCheckpointNote === true ||
    summary.nextSteps.some((step) => /checkpoint note/i.test(step)) ||
    /checkpoint note/i.test(summary.recommendedFirstAction ?? '');
  if (hasCheckpointHint) {
    rawSignals.push({
      id: 'signal:checkpoint-note',
      kind: 'checkpoint-note',
      observedAt: now,
      confidence: 0.8,
      actionability: 0.62,
      interruptCost: 0.14,
      meta: {
        source: input.hasCheckpointNote === true ? 'checkpoint-state' : 'summary-hint',
      },
    });
  }

  if (summary.source !== 'local') {
    rawSignals.push({
      id: 'signal:privacy-change',
      kind: 'privacy-change',
      observedAt: now,
      confidence: 0.74,
      actionability: 0.36,
      interruptCost: 0.16,
      meta: {
        provider: summary.source,
      },
    });
  }

  if (restricted) {
    rawSignals.push({
      id: 'signal:trust-change',
      kind: 'trust-change',
      observedAt: now,
      confidence: 0.98,
      actionability: 0.7,
      interruptCost: 0.08,
      meta: {
        restricted: true,
      },
    });
  }

  return normalizeSignalsForRanking(rawSignals, now);
}
