import { resolveCompanionPrimaryCtaDecision } from '../src/companionPrimaryCta';
import type { BlockerDecision } from '../src/blockerModel';

function blockerDecision(overrides: Partial<BlockerDecision> = {}): BlockerDecision {
  return {
    kind: 'none',
    hasBlocker: false,
    title: 'No active blocker',
    detail: 'Continue with the first suggested next step.',
    confidenceLabel: 'high',
    severityLabel: 'none',
    severityScore: 0,
    confidenceScore: 1,
    actionabilityScore: 0,
    ...overrides,
  };
}

describe('resolveCompanionPrimaryCtaDecision', () => {
  it('prioritizes enabled blocker action over next action', () => {
    const decision = resolveCompanionPrimaryCtaDecision({
      primaryNextAction: {
        stepIndex: 0,
        kind: 'openFile',
        label: 'Open file',
        evidenceId: 'file:src/extension.ts',
      },
      blockerDecision: blockerDecision({
        kind: 'taskFailure',
        hasBlocker: true,
        action: {
          label: 'Rerun last task',
          type: 'restoreRerunTask',
          disabled: false,
        },
      }),
    });

    expect(decision).toEqual({
      winner: 'blocked',
      reasonClass: 'policy:blocked-actionable',
      sourceClass: 'policy:blocker:taskFailure',
      nextToken: 'advisory',
      blockedToken: 'primary',
    });
  });

  it('uses next action when blocker action is disabled', () => {
    const decision = resolveCompanionPrimaryCtaDecision({
      primaryNextAction: {
        stepIndex: 0,
        kind: 'openFile',
        label: 'Open file',
        evidenceId: 'file:src/extension.ts',
      },
      blockerDecision: blockerDecision({
        kind: 'restricted',
        hasBlocker: true,
        action: {
          label: 'Rerun last task',
          type: 'restoreRerunTask',
          disabled: true,
          disabledReason: 'Restricted Mode',
        },
      }),
    });

    expect(decision).toEqual({
      winner: 'next',
      reasonClass: 'policy:next-actionable',
      sourceClass: 'policy:next-step-action:openFile',
      nextToken: 'primary',
      blockedToken: 'suppressed',
    });
  });

  it('returns no-primary decision when only disabled blocker action exists', () => {
    const decision = resolveCompanionPrimaryCtaDecision({
      primaryNextAction: undefined,
      blockerDecision: blockerDecision({
        kind: 'restricted',
        hasBlocker: true,
        action: {
          label: 'Rerun last task',
          type: 'restoreRerunTask',
          disabled: true,
          disabledReason: 'Restricted Mode',
        },
      }),
    });

    expect(decision).toEqual({
      winner: 'none',
      reasonClass: 'policy:blocked-disabled',
      sourceClass: 'policy:blocker-disabled:restricted',
      nextToken: 'advisory',
      blockedToken: 'suppressed',
    });
  });

  it('returns advisory-only decision when no actionable candidate exists', () => {
    const decision = resolveCompanionPrimaryCtaDecision({
      primaryNextAction: undefined,
      blockerDecision: blockerDecision(),
    });

    expect(decision).toEqual({
      winner: 'none',
      reasonClass: 'policy:no-actionable-cta',
      sourceClass: 'policy:none',
      nextToken: 'advisory',
      blockedToken: 'advisory',
    });
  });
});
