import {
  buildResumeSafetyCheck,
  createPersistedResumeSafetyContext,
  evaluateResumeSafetyStrictWarning,
  isResumeSafetyEligible,
  normalizePersistedResumeSafetyContext,
} from '../src/resumeSafety';

describe('isResumeSafetyEligible', () => {
  it('always allows the manual trigger', () => {
    expect(
      isResumeSafetyEligible({
        trigger: 'manual',
        idleMinutes: 10,
        resumeGapMinutes: 0,
      }),
    ).toBe(true);
  });

  it('requires the idle threshold for focus and startup triggers', () => {
    expect(
      isResumeSafetyEligible({
        trigger: 'focus',
        idleMinutes: 10,
        resumeGapMinutes: 9,
      }),
    ).toBe(false);
    expect(
      isResumeSafetyEligible({
        trigger: 'startup',
        idleMinutes: 10,
        resumeGapMinutes: 10,
      }),
    ).toBe(true);
  });
});

describe('buildResumeSafetyCheck', () => {
  it('prefers a strong branch mismatch when branches diverge', () => {
    const check = buildResumeSafetyCheck({
      summaryContextHash: 'ctx-1',
      workspaceName: 'vscode-tacos',
      currentBranch: 'feature/resume-safety',
      summaryBranch: 'main',
      summaryIntent: 'Finish the resume safety check work.',
      activeEditorPath: 'src/extension.ts',
      summaryFocusFile: 'src/summary.ts',
    });

    expect(check.mismatch).toMatchObject({
      detected: true,
      strong: true,
      code: 'branch-changed',
    });
    expect(check.staleAssumption).toContain('main');
    expect(check.staleAssumption).toContain('feature/resume-safety');
    expect(check.nextVerificationAction).toMatchObject({
      kind: 'refreshSummary',
      label: 'Refresh summary',
      reason: 'branch-mismatch',
    });
  });

  it('flags package drift when current focus moves to a different service area', () => {
    const check = buildResumeSafetyCheck({
      summaryContextHash: 'ctx-2',
      workspaceName: 'monorepo',
      currentBranch: 'feature/payments',
      summaryBranch: 'feature/payments',
      activeEditorPath: 'services/billing/src/index.ts',
      summaryFocusFile: 'services/auth/src/login.ts',
    });

    expect(check.mismatch).toMatchObject({
      detected: true,
      strong: true,
      code: 'package-drift',
    });
    expect(check.nextVerificationAction).toMatchObject({
      kind: 'openFile',
      target: 'services/auth/src/login.ts',
      reason: 'package-drift',
    });
  });

  it('falls back to the captured focus file when no mismatch is obvious', () => {
    const check = buildResumeSafetyCheck({
      summaryContextHash: 'ctx-3',
      workspaceName: 'vscode-tacos',
      currentBranch: 'feature/resume-safety',
      summaryBranch: 'feature/resume-safety',
      summaryIntent: 'Keep the post-resume check subtle and useful.',
      summaryFocusFile: 'src/extension.ts',
      recentFiles: ['src/extension.ts'],
      openFiles: ['src/extension.ts'],
    });

    expect(check.mismatch.detected).toBe(false);
    expect(check.staleAssumption).toBe('No obvious mismatch detected.');
    expect(check.nextVerificationAction).toMatchObject({
      kind: 'openFile',
      target: 'src/extension.ts',
      reason: 'summary-focus',
    });
  });
});

describe('resume safety persistence', () => {
  it('round-trips the persisted context shape', () => {
    const check = buildResumeSafetyCheck({
      summaryContextHash: 'ctx-4',
      workspaceName: 'vscode-tacos',
      currentBranch: 'feature/resume-safety',
      summaryBranch: 'feature/resume-safety',
      summaryFocusFile: 'src/extension.ts',
      lastEditPath: 'src/extension.ts',
      now: 1_700_000_000_000,
    });
    const persisted = createPersistedResumeSafetyContext(check, 'focus', 1_700_000_000_123);

    expect(normalizePersistedResumeSafetyContext(persisted)).toEqual(persisted);
  });
});

describe('evaluateResumeSafetyStrictWarning', () => {
  const strongCheck = buildResumeSafetyCheck({
    summaryContextHash: 'ctx-5',
    workspaceName: 'monorepo',
    currentBranch: 'feature/payments',
    summaryBranch: 'feature/payments',
    activeEditorPath: 'services/billing/src/index.ts',
    summaryFocusFile: 'services/auth/src/login.ts',
  });

  it('warns on the first mismatched risky action in strict mode', () => {
    expect(
      evaluateResumeSafetyStrictWarning({
        enabled: true,
        isFirstAction: true,
        check: strongCheck,
        actionKind: 'rerunTask',
      }),
    ).toMatchObject({
      shouldWarn: true,
    });
  });

  it('does not warn when the user takes the suggested verification action', () => {
    expect(
      evaluateResumeSafetyStrictWarning({
        enabled: true,
        isFirstAction: true,
        check: strongCheck,
        actionKind: 'openFile',
        actionTarget: 'services/auth/src/login.ts',
      }),
    ).toEqual({
      shouldWarn: false,
    });
  });

  it('does not warn when strict mode is off or the first-action window has passed', () => {
    expect(
      evaluateResumeSafetyStrictWarning({
        enabled: false,
        isFirstAction: true,
        check: strongCheck,
        actionKind: 'rerunTask',
      }),
    ).toEqual({
      shouldWarn: false,
    });
    expect(
      evaluateResumeSafetyStrictWarning({
        enabled: true,
        isFirstAction: false,
        check: strongCheck,
        actionKind: 'rerunTask',
      }),
    ).toEqual({
      shouldWarn: false,
    });
  });
});
