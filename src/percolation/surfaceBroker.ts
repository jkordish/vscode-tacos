import type { UiSurface } from '../types';
import type { RankedSurfacedItem } from './ranking';
import type { PercolationSuppressionDecision } from './suppression';
import type { PercolationSuppressionReason } from './types';

export type SummaryPresentationMode = 'auto-open-details' | 'background' | 'prompt' | 'silent';
export type SummaryPresentationSurface = 'none' | 'statusbar' | 'panel' | 'notification';

export type SummaryPresentationReason =
  | 'manual-auto-open-details'
  | 'prefer-background'
  | 'ui-surface-silent'
  | 'ui-surface-notification'
  | 'ui-surface-statusbar-cap'
  | 'notification-suppressed'
  | 'notification-no-primary'
  | 'notification-advisory-only'
  | 'notification-high-value-actionable';

type RankedSurfaceCandidate = Pick<
  RankedSurfacedItem,
  'kind' | 'actionId' | 'urgency' | 'confidence' | 'score'
>;

export interface SummarySurfaceDecisionInput {
  configuredUiSurface: UiSurface;
  autoOpenDetails?: boolean;
  preferBackgroundPresentation?: boolean;
  suppression?: PercolationSuppressionDecision;
  primary?: RankedSurfaceCandidate;
}

export interface SummarySurfaceDecision {
  surface: SummaryPresentationSurface;
  presentationMode: SummaryPresentationMode;
  reason: SummaryPresentationReason;
  suppressionReason?: PercolationSuppressionReason;
}

const HIGH_URGENCY_THRESHOLD = 0.7;
const HIGH_BLOCKED_URGENCY_THRESHOLD = 0.6;
const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const HIGH_SCORE_THRESHOLD = 0.62;

const ACTIONABLE_KINDS = new Set<RankedSurfacedItem['kind']>([
  'recommended-action',
  'next-step',
  'blocked',
  'restore',
  'clarification',
]);

function hasActionablePath(primary: RankedSurfaceCandidate): boolean {
  if (typeof primary.actionId === 'string' && primary.actionId.trim().length > 0) {
    return true;
  }

  return ACTIONABLE_KINDS.has(primary.kind);
}

export function isHighValueActionableCandidate(
  primary: RankedSurfaceCandidate | undefined,
): boolean {
  if (!primary || !hasActionablePath(primary)) {
    return false;
  }

  const urgencyThreshold =
    primary.kind === 'blocked' ? HIGH_BLOCKED_URGENCY_THRESHOLD : HIGH_URGENCY_THRESHOLD;

  return (
    primary.urgency >= urgencyThreshold &&
    primary.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
    primary.score >= HIGH_SCORE_THRESHOLD
  );
}

export function resolveSummarySurfaceDecision(
  input: SummarySurfaceDecisionInput,
): SummarySurfaceDecision {
  if (input.autoOpenDetails) {
    return {
      surface: 'panel',
      presentationMode: 'auto-open-details',
      reason: 'manual-auto-open-details',
    };
  }

  if (input.preferBackgroundPresentation) {
    if (input.configuredUiSurface === 'notification') {
      return {
        surface: 'panel',
        presentationMode: 'background',
        reason: 'prefer-background',
      };
    }

    if (input.configuredUiSurface === 'silent') {
      return {
        surface: 'none',
        presentationMode: 'silent',
        reason: 'ui-surface-silent',
      };
    }

    return {
      surface: 'statusbar',
      presentationMode: 'background',
      reason: 'prefer-background',
    };
  }

  if (input.configuredUiSurface === 'silent') {
    return {
      surface: 'none',
      presentationMode: 'silent',
      reason: 'ui-surface-silent',
    };
  }

  if (input.configuredUiSurface === 'statusbar') {
    return {
      surface: 'statusbar',
      presentationMode: 'background',
      reason: 'ui-surface-statusbar-cap',
    };
  }

  if (input.suppression?.suppressed) {
    return {
      surface: 'panel',
      presentationMode: 'background',
      reason: 'notification-suppressed',
      suppressionReason: input.suppression.reason,
    };
  }

  if (!input.primary) {
    return {
      surface: 'panel',
      presentationMode: 'background',
      reason: 'notification-no-primary',
    };
  }

  if (!isHighValueActionableCandidate(input.primary)) {
    return {
      surface: 'panel',
      presentationMode: 'background',
      reason: 'notification-advisory-only',
    };
  }

  return {
    surface: 'notification',
    presentationMode: 'prompt',
    reason: 'notification-high-value-actionable',
  };
}
