import { decidePrimaryBlocker } from '../src/blockerModel';
import type { RestoreAvailability } from '../src/restoreSafety';

function availability(overrides: Partial<RestoreAvailability> = {}): RestoreAvailability {
  return {
    canRerunTask: true,
    canRerunDebug: true,
    canCheckoutPreviousBranch: true,
    canCopyFailingCommand: true,
    canJumpToLastEdit: true,
    ...overrides,
  };
}

function baseInput() {
  return {
    trusted: true,
    longGap: false,
    lowConfidence: false,
    hasCheckpointNote: false,
    hasFailingTask: false,
    lastTaskName: 'npm test',
    lastTaskExitCode: 1,
    lastFailingCommand: undefined,
    diagnosticsErrorCount: 0,
    diagnosticsTopPath: undefined,
    diagnosticsTopLine: undefined,
    switchedBranches: false,
    currentBranch: 'feature/a',
    previousBranch: 'feature/b',
    hasNextSteps: true,
    canOpenProblems: true,
    canOpenDiagnosticFile: false,
    availability: availability(),
  };
}

describe('decidePrimaryBlocker', () => {
  it('prioritizes task failure over command, diagnostics, and branch blockers', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      hasFailingTask: true,
      lastFailingCommand: 'npm test',
      diagnosticsErrorCount: 3,
      switchedBranches: true,
    });

    expect(decision.kind).toBe('taskFailure');
    expect(decision.action?.type).toBe('restoreRerunTask');
    expect(decision.severityLabel).toBe('critical');
    expect(decision.severityScore).toBeGreaterThan(0.9);
    expect(decision.confidenceScore).toBeGreaterThan(0.9);
    expect(decision.actionabilityScore).toBeGreaterThan(0.8);
  });

  it('prioritizes command failure over diagnostics and branch blockers', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      lastFailingCommand: 'pnpm lint',
      diagnosticsErrorCount: 2,
      switchedBranches: true,
    });

    expect(decision.kind).toBe('commandFailure');
    expect(decision.action?.type).toBe('restoreRerunTask');
    expect(['high', 'critical']).toContain(decision.severityLabel);
    expect(decision.confidenceLabel).toBe('high');
  });

  it('prioritizes diagnostics over branch-context blockers', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      diagnosticsErrorCount: 4,
      diagnosticsTopPath: 'src/extension.ts',
      diagnosticsTopLine: 20,
      switchedBranches: true,
    });

    expect(decision.kind).toBe('diagnostics');
    expect(decision.action?.type).toBe('restoreOpenProblems');
    expect(['medium', 'high', 'critical']).toContain(decision.severityLabel);
    expect(decision.actionabilityScore).toBeGreaterThan(0.7);
  });

  it('prefers opening the diagnostic file when top diagnostic target is available', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      diagnosticsErrorCount: 2,
      diagnosticsTopPath: 'src/summary.ts',
      diagnosticsTopLine: 18,
      canOpenDiagnosticFile: true,
    });

    expect(decision.kind).toBe('diagnostics');
    expect(decision.action?.type).toBe('restoreOpenDiagnosticFile');
    expect(decision.action?.disabled).toBe(false);
  });

  it('uses exactly one primary action with clear disabled reason in restricted mode', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      trusted: false,
      hasFailingTask: true,
      availability: availability({ canRerunTask: false }),
    });

    expect(decision.kind).toBe('taskFailure');
    expect(decision.hasBlocker).toBe(true);
    expect(decision.action).toBeDefined();
    expect(decision.action?.disabled).toBe(true);
    expect(decision.action?.disabledReason).toContain('Restricted Mode');
  });

  it('returns restricted fallback when no stronger blockers are present', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      trusted: false,
      hasFailingTask: false,
      lastFailingCommand: undefined,
      diagnosticsErrorCount: 0,
      switchedBranches: false,
      lowConfidence: false,
      hasNextSteps: true,
    });

    expect(decision.kind).toBe('restricted');
    expect(decision.action?.type).toBe('restoreRerunTask');
    expect(decision.action?.disabled).toBe(true);
    expect(decision.action?.disabledReason).toContain('Restricted Mode');
  });

  it('returns low-confidence checkpoint action when confidence is low and no note exists', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      lowConfidence: true,
      hasCheckpointNote: false,
      hasFailingTask: false,
      lastFailingCommand: undefined,
      diagnosticsErrorCount: 0,
      switchedBranches: false,
    });

    expect(decision.kind).toBe('lowConfidence');
    expect(decision.action?.type).toBe('sessionAddCheckpoint');
    expect(decision.action?.disabled).toBe(false);
    expect(decision.severityLabel).toBe('low');
    expect(decision.confidenceLabel).toBe('low');
  });

  it('returns no-next-steps fallback with refresh action', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      hasNextSteps: false,
      hasFailingTask: false,
      lastFailingCommand: undefined,
      diagnosticsErrorCount: 0,
      switchedBranches: false,
      lowConfidence: false,
    });

    expect(decision.kind).toBe('noNextSteps');
    expect(decision.action?.type).toBe('refreshSummary');
    expect(decision.action?.disabled).toBe(false);
    expect(decision.severityLabel).toBe('low');
  });

  it('provides disabled branch-context action reason when checkout target is unavailable', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      switchedBranches: true,
      hasFailingTask: false,
      lastFailingCommand: undefined,
      diagnosticsErrorCount: 0,
      availability: availability({ canCheckoutPreviousBranch: false }),
    });

    expect(decision.kind).toBe('branchContext');
    expect(decision.action?.type).toBe('restoreCheckoutPreviousBranch');
    expect(decision.action?.disabled).toBe(true);
    expect(decision.action?.disabledReason).toContain('No previous branch target');
  });

  it('suppresses rerun as primary action for long-gap command recovery', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      longGap: true,
      lastFailingCommand: 'npm test',
      availability: availability({ canCopyFailingCommand: false, canRerunTask: true }),
      canOpenProblems: true,
    });

    expect(decision.kind).toBe('commandFailure');
    expect(decision.action?.type).toBe('restoreOpenProblems');
    expect(decision.action?.label).toBe('Open Problems');
  });

  it('provides disabled rerun with long-gap reason when no safe fallback action exists', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      longGap: true,
      lastFailingCommand: 'npm test',
      availability: availability({ canCopyFailingCommand: false, canRerunTask: true }),
      canOpenProblems: false,
    });

    expect(decision.kind).toBe('commandFailure');
    expect(decision.action?.type).toBe('restoreRerunTask');
    expect(decision.action?.disabled).toBe(true);
    expect(decision.action?.disabledReason).toContain('Long-gap reorientation');
    expect(decision.actionabilityScore).toBeLessThan(0.4);
  });

  it('keeps actionable command recovery above high-count diagnostics', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      lastFailingCommand: 'npm run verify:quick',
      diagnosticsErrorCount: 12,
      diagnosticsTopPath: 'src/extension.ts',
      diagnosticsTopLine: 42,
      canOpenDiagnosticFile: true,
      availability: availability({ canRerunTask: true }),
    });

    expect(decision.kind).toBe('commandFailure');
    expect(decision.action?.type).toBe('restoreRerunTask');
    expect(decision.severityScore).toBeGreaterThan(0.8);
  });

  it('returns score metadata even when no blocker exists', () => {
    const decision = decidePrimaryBlocker({
      ...baseInput(),
      hasFailingTask: false,
      lastFailingCommand: undefined,
      diagnosticsErrorCount: 0,
      switchedBranches: false,
      lowConfidence: false,
      hasNextSteps: true,
    });

    expect(decision.kind).toBe('none');
    expect(decision.hasBlocker).toBe(false);
    expect(decision.severityLabel).toBe('none');
    expect(decision.severityScore).toBe(0);
    expect(decision.actionabilityScore).toBe(0);
  });
});
