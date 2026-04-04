export interface AutoTriggerDecisionInput {
  now: number;
  lastBlurAt: number;
  lastSummaryAt: number;
  minIdleMinutes: number;
  cooldownMinutes: number;
  projectSwitched: boolean;
  significantChange: boolean;
  lastBoundarySignalAt?: number;
  boundaryWindowMs?: number;
  maxDeferralWithoutBoundaryMs?: number;
}

export function shouldAutoTriggerSummary(input: AutoTriggerDecisionInput): boolean {
  const idleMs = input.now - input.lastBlurAt;
  const idleThresholdMs = input.minIdleMinutes * 60_000;
  const satisfiesPrimaryGate =
    idleMs >= idleThresholdMs || input.projectSwitched || input.significantChange;
  if (!satisfiesPrimaryGate) {
    return false;
  }

  if (input.lastSummaryAt <= 0) {
    return true;
  }

  const cooldownMs = input.cooldownMinutes * 60_000;
  if (input.now - input.lastSummaryAt < cooldownMs) {
    return false;
  }

  const boundaryWindowMs = input.boundaryWindowMs ?? 0;
  if (boundaryWindowMs <= 0) {
    return true;
  }

  const hasRecentBoundary =
    typeof input.lastBoundarySignalAt === 'number' &&
    Number.isFinite(input.lastBoundarySignalAt) &&
    input.lastBoundarySignalAt > 0 &&
    input.now - input.lastBoundarySignalAt <= boundaryWindowMs;
  if (hasRecentBoundary) {
    return true;
  }

  if (input.projectSwitched || idleMs >= idleThresholdMs) {
    return true;
  }

  const maxDeferralMs = Math.max(0, input.maxDeferralWithoutBoundaryMs ?? 0);
  if (maxDeferralMs <= 0) {
    return true;
  }

  return idleMs >= maxDeferralMs;
}

export interface BlurCheckpointDecisionInput {
  now: number;
  lastSummaryAt: number;
  lastCheckpointPromptAt: number;
  minIdleMinutes: number;
  cooldownMinutes: number;
  promptCooldownMinutes: number;
  meaningfulChangeSinceLastPrompt: boolean;
}

export interface FocusPromptDeferralInput {
  focusGainedAt: number;
  observedAt: number;
  lastMeaningfulActivityAt: number;
  graceWindowMs: number;
}

export function shouldDeferPromptAfterFocusRegain(input: FocusPromptDeferralInput): boolean {
  if (input.graceWindowMs <= 0) {
    return false;
  }

  if (input.observedAt < input.focusGainedAt + input.graceWindowMs) {
    return false;
  }

  if (!Number.isFinite(input.lastMeaningfulActivityAt) || input.lastMeaningfulActivityAt <= 0) {
    return false;
  }

  return (
    input.lastMeaningfulActivityAt >= input.focusGainedAt &&
    input.lastMeaningfulActivityAt <= input.focusGainedAt + input.graceWindowMs
  );
}

export type NoiseBudgetSignalKind = 'summary-prompt' | 'checkpoint-prompt' | 'nudge';

export interface NoiseBudgetEvent {
  kind: NoiseBudgetSignalKind;
  at: number;
}

export type NoiseBudgetSuppressionReason = 'window-full' | 'recent-summary' | 'recent-checkpoint';

export interface NoiseBudgetPolicy {
  windowMs: number;
  maxSignalsPerWindow: number;
  blockNudgesAfterSummaryMs: number;
  blockNudgesAfterCheckpointMs: number;
  blockCheckpointAfterSummaryMs: number;
}

export interface NoiseBudgetDecision {
  allowed: boolean;
  reason?: NoiseBudgetSuppressionReason;
  nextEligibleAt?: number;
  recentEvents: NoiseBudgetEvent[];
}

function normalizeNoiseEvents(
  events: NoiseBudgetEvent[],
  now: number,
  windowMs: number,
): NoiseBudgetEvent[] {
  const safeWindowMs = Math.max(1, windowMs);
  return events
    .filter((event) => Number.isFinite(event.at) && event.at > 0 && now - event.at <= safeWindowMs)
    .sort((a, b) => a.at - b.at);
}

function latestEventAt(
  events: NoiseBudgetEvent[],
  kind: NoiseBudgetSignalKind,
): number | undefined {
  const matching = events.filter((event) => event.kind === kind);
  if (matching.length === 0) {
    return undefined;
  }

  return matching[matching.length - 1]?.at;
}

export interface EvaluateNoiseBudgetInput {
  now: number;
  signalKind: NoiseBudgetSignalKind;
  events: NoiseBudgetEvent[];
  policy: NoiseBudgetPolicy;
}

export function evaluateNoiseBudget(input: EvaluateNoiseBudgetInput): NoiseBudgetDecision {
  const recentEvents = normalizeNoiseEvents(input.events, input.now, input.policy.windowMs);

  if (input.signalKind === 'summary-prompt') {
    return {
      allowed: true,
      recentEvents,
    };
  }

  const latestSummaryAt = latestEventAt(recentEvents, 'summary-prompt');
  if (typeof latestSummaryAt === 'number') {
    const thresholdMs =
      input.signalKind === 'checkpoint-prompt'
        ? input.policy.blockCheckpointAfterSummaryMs
        : input.policy.blockNudgesAfterSummaryMs;
    if (thresholdMs > 0 && input.now - latestSummaryAt < thresholdMs) {
      return {
        allowed: false,
        reason: 'recent-summary',
        nextEligibleAt: latestSummaryAt + thresholdMs,
        recentEvents,
      };
    }
  }

  if (input.signalKind === 'nudge') {
    const latestCheckpointAt = latestEventAt(recentEvents, 'checkpoint-prompt');
    if (
      typeof latestCheckpointAt === 'number' &&
      input.policy.blockNudgesAfterCheckpointMs > 0 &&
      input.now - latestCheckpointAt < input.policy.blockNudgesAfterCheckpointMs
    ) {
      return {
        allowed: false,
        reason: 'recent-checkpoint',
        nextEligibleAt: latestCheckpointAt + input.policy.blockNudgesAfterCheckpointMs,
        recentEvents,
      };
    }
  }

  if (recentEvents.length >= Math.max(1, input.policy.maxSignalsPerWindow)) {
    const oldest = recentEvents[0];
    return {
      allowed: false,
      reason: 'window-full',
      nextEligibleAt: oldest ? oldest.at + Math.max(1, input.policy.windowMs) : undefined,
      recentEvents,
    };
  }

  return {
    allowed: true,
    recentEvents,
  };
}

export function shouldPromptCheckpointOnBlur(input: BlurCheckpointDecisionInput): boolean {
  if (!input.meaningfulChangeSinceLastPrompt) {
    return false;
  }

  if (input.lastCheckpointPromptAt > 0) {
    const promptCooldownMs = Math.max(1, input.promptCooldownMinutes) * 60_000;
    if (input.now - input.lastCheckpointPromptAt < promptCooldownMs) {
      return false;
    }
  }

  // Reuse the same trigger heuristic as auto summary, projecting forward to the next idle-focus window.
  const projectedNow = input.now + input.minIdleMinutes * 60_000;
  return shouldAutoTriggerSummary({
    now: projectedNow,
    lastBlurAt: input.now,
    lastSummaryAt: input.lastSummaryAt,
    minIdleMinutes: input.minIdleMinutes,
    cooldownMinutes: input.cooldownMinutes,
    projectSwitched: false,
    significantChange: true,
  });
}

export interface CheckpointHighLoadDeferralInput {
  now: number;
  lastMeaningfulActivityAt: number;
  /**
   * Window (ms) within which recent meaningful activity is considered "high load".
   * Checkpoint prompts are suppressed when `now - lastMeaningfulActivityAt <= highLoadWindowMs`.
   * A value ≤ 0 disables high-load deferral entirely.
   * Recommended default: align with the configured cooldown window (`cooldownMinutes * 60_000`),
   * which is typically 300_000 (5 minutes) with the current wiring.
   */
  highLoadWindowMs: number;
}

/**
 * Returns `true` when the user has had recent meaningful activity within the
 * high-load window, signalling that a checkpoint prompt would self-interrupt an
 * active work session. Callers should suppress the auto-triggered checkpoint
 * prompt and record `checkpointPromptSuppressedHighLoad` in local metrics when
 * this returns `true`.
 *
 * This implements P16's "tighten breakpoint-aware checkpoint prompt policy"
 * requirement: suppress mid-activity checkpoint prompts based on high-load
 * signal proxies (recent edit activity within the configured window).
 */
export function shouldDeferCheckpointPromptHighLoad(
  input: CheckpointHighLoadDeferralInput,
): boolean {
  if (input.highLoadWindowMs <= 0) {
    return false;
  }

  if (!Number.isFinite(input.lastMeaningfulActivityAt) || input.lastMeaningfulActivityAt <= 0) {
    return false;
  }

  const activityAgeMs = input.now - input.lastMeaningfulActivityAt;
  return activityAgeMs >= 0 && activityAgeMs <= input.highLoadWindowMs;
}
