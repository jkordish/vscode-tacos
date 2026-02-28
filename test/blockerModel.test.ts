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
  });
});
