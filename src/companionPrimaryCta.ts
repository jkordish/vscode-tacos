import type { BlockerDecision } from './blockerModel';
import type { NextStepAction } from './nextStepActions';

export type CompanionPrimaryCtaWinner = 'next' | 'blocked' | 'none';
export type CompanionEmphasisToken = 'primary' | 'advisory' | 'suppressed';

export type CompanionPrimaryCtaReasonClass =
  | 'policy:blocked-actionable'
  | 'policy:next-actionable'
  | 'policy:blocked-disabled'
  | 'policy:no-actionable-cta';

export interface CompanionPrimaryCtaDecision {
  winner: CompanionPrimaryCtaWinner;
  reasonClass: CompanionPrimaryCtaReasonClass;
  sourceClass?: string;
  nextToken: CompanionEmphasisToken;
  blockedToken: CompanionEmphasisToken;
}

interface ResolveCompanionPrimaryCtaInput {
  primaryNextAction: NextStepAction | undefined;
  blockerDecision: BlockerDecision;
}

export function resolveCompanionPrimaryCtaDecision(
  input: ResolveCompanionPrimaryCtaInput,
): CompanionPrimaryCtaDecision {
  const hasPrimaryNextAction = Boolean(input.primaryNextAction);
  const hasBlockerAction = Boolean(input.blockerDecision.action);
  const hasEnabledBlockerAction =
    Boolean(input.blockerDecision.action) && !input.blockerDecision.action?.disabled;

  if (hasEnabledBlockerAction) {
    return {
      winner: 'blocked',
      reasonClass: 'policy:blocked-actionable',
      sourceClass: `policy:blocker:${input.blockerDecision.kind}`,
      nextToken: hasPrimaryNextAction ? 'advisory' : 'suppressed',
      blockedToken: 'primary',
    };
  }

  if (hasPrimaryNextAction) {
    return {
      winner: 'next',
      reasonClass: 'policy:next-actionable',
      sourceClass: `policy:next-step-action:${input.primaryNextAction?.kind ?? 'unknown'}`,
      nextToken: 'primary',
      blockedToken: hasBlockerAction ? 'suppressed' : 'advisory',
    };
  }

  if (hasBlockerAction) {
    return {
      winner: 'none',
      reasonClass: 'policy:blocked-disabled',
      sourceClass: `policy:blocker-disabled:${input.blockerDecision.kind}`,
      nextToken: 'advisory',
      blockedToken: 'suppressed',
    };
  }

  return {
    winner: 'none',
    reasonClass: 'policy:no-actionable-cta',
    sourceClass: 'policy:none',
    nextToken: 'advisory',
    blockedToken: 'advisory',
  };
}
