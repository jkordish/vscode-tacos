import {
  isHighValueActionableCandidate,
  resolveSummarySurfaceDecision,
} from '../src/percolation/surfaceBroker';

describe('percolation surface broker', () => {
  it('prefers manual auto-open details over other settings', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'notification',
      autoOpenDetails: true,
      suppression: {
        suppressed: true,
        reason: 'quiet-hours',
      },
    });

    expect(decision).toEqual({
      surface: 'panel',
      presentationMode: 'auto-open-details',
      reason: 'manual-auto-open-details',
    });
  });

  it('respects silent ui cap', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'silent',
      primary: {
        kind: 'blocked',
        actionId: 'restoreRerunTask',
        urgency: 0.95,
        confidence: 0.9,
        score: 0.88,
      },
    });

    expect(decision).toEqual({
      surface: 'none',
      presentationMode: 'silent',
      reason: 'ui-surface-silent',
    });
  });

  it('keeps statusbar as a hard cap even for high-value candidates', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'statusbar',
      primary: {
        kind: 'blocked',
        actionId: 'restoreRerunTask',
        urgency: 0.95,
        confidence: 0.9,
        score: 0.88,
      },
    });

    expect(decision).toEqual({
      surface: 'statusbar',
      presentationMode: 'background',
      reason: 'ui-surface-statusbar-cap',
    });
  });

  it('downgrades notification flow to panel when suppressed', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'notification',
      suppression: {
        suppressed: true,
        reason: 'quiet-hours',
      },
      primary: {
        kind: 'blocked',
        actionId: 'restoreRerunTask',
        urgency: 0.95,
        confidence: 0.9,
        score: 0.88,
      },
    });

    expect(decision).toEqual({
      surface: 'panel',
      presentationMode: 'background',
      reason: 'notification-suppressed',
      suppressionReason: 'quiet-hours',
    });
  });

  it('preserves suppression reason metadata for cooldown and no-change paths', () => {
    for (const suppressionReason of ['cooldown', 'no-change'] as const) {
      const decision = resolveSummarySurfaceDecision({
        configuredUiSurface: 'notification',
        suppression: {
          suppressed: true,
          reason: suppressionReason,
        },
        primary: {
          kind: 'blocked',
          actionId: 'restoreRerunTask',
          urgency: 0.95,
          confidence: 0.9,
          score: 0.88,
        },
      });

      expect(decision).toEqual({
        surface: 'panel',
        presentationMode: 'background',
        reason: 'notification-suppressed',
        suppressionReason,
      });
    }
  });

  it('uses advisory panel flow for non-urgent candidates', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'notification',
      primary: {
        kind: 'status',
        urgency: 0.4,
        confidence: 0.8,
        score: 0.35,
      },
    });

    expect(decision).toEqual({
      surface: 'panel',
      presentationMode: 'background',
      reason: 'notification-advisory-only',
    });
  });

  it('uses notification only for high-value actionable candidates', () => {
    const decision = resolveSummarySurfaceDecision({
      configuredUiSurface: 'notification',
      primary: {
        kind: 'blocked',
        actionId: 'restoreRerunTask',
        urgency: 0.95,
        confidence: 0.9,
        score: 0.88,
      },
    });

    expect(decision).toEqual({
      surface: 'notification',
      presentationMode: 'prompt',
      reason: 'notification-high-value-actionable',
    });
  });

  it('detects high-value thresholds deterministically', () => {
    expect(
      isHighValueActionableCandidate({
        kind: 'blocked',
        actionId: 'restoreRerunTask',
        urgency: 0.61,
        confidence: 0.71,
        score: 0.63,
      }),
    ).toBe(true);

    expect(
      isHighValueActionableCandidate({
        kind: 'next-step',
        actionId: 'openFile',
        urgency: 0.69,
        confidence: 0.71,
        score: 0.63,
      }),
    ).toBe(false);
  });
});
