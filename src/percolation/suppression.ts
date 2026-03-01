import { isInQuietHours } from '../quietHours';
import type { PercolationPolicyMode } from './types';

export type PercolationSuppressionReason =
  | 'disabled'
  | 'inactive-mode'
  | 'quiet-hours'
  | 'cooldown'
  | 'no-change'
  | 'noise-budget';

export interface PercolationSuppressionInput {
  enabled: boolean;
  mode: PercolationPolicyMode;
  now: number;
  quietHours?: string;
  cooldownMinutes?: number;
  lastShownAt?: number;
  contextUnchanged?: boolean;
  noiseBudgetAllowed?: boolean;
  noiseBudgetNextEligibleAt?: number;
}

export interface PercolationSuppressionDecision {
  suppressed: boolean;
  reason?: PercolationSuppressionReason;
  nextEligibleAt?: number;
}

export function evaluatePercolationSuppression(
  input: PercolationSuppressionInput,
): PercolationSuppressionDecision {
  if (!input.enabled) {
    return {
      suppressed: true,
      reason: 'disabled',
    };
  }

  if (input.mode !== 'active') {
    return {
      suppressed: true,
      reason: 'inactive-mode',
    };
  }

  const quietHours = (input.quietHours ?? '').trim();
  if (quietHours && isInQuietHours(input.now, quietHours)) {
    return {
      suppressed: true,
      reason: 'quiet-hours',
    };
  }

  if (
    typeof input.cooldownMinutes === 'number' &&
    input.cooldownMinutes > 0 &&
    typeof input.lastShownAt === 'number' &&
    input.lastShownAt > 0
  ) {
    const cooldownMs = Math.max(1, input.cooldownMinutes) * 60_000;
    if (input.now - input.lastShownAt < cooldownMs) {
      return {
        suppressed: true,
        reason: 'cooldown',
        nextEligibleAt: input.lastShownAt + cooldownMs,
      };
    }
  }

  if (input.contextUnchanged) {
    return {
      suppressed: true,
      reason: 'no-change',
    };
  }

  if (input.noiseBudgetAllowed === false) {
    return {
      suppressed: true,
      reason: 'noise-budget',
      nextEligibleAt:
        typeof input.noiseBudgetNextEligibleAt === 'number' &&
        Number.isFinite(input.noiseBudgetNextEligibleAt) &&
        input.noiseBudgetNextEligibleAt > 0
          ? input.noiseBudgetNextEligibleAt
          : undefined,
    };
  }

  return {
    suppressed: false,
  };
}
