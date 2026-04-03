import {
  computeCheckpointFieldCompleteness,
  createStructuredTaskState,
  describeStructuredTaskStateFreshness,
  describeStructuredTaskSwitchClass,
  findActiveStructuredTaskForScope,
  markStructuredTaskStateResolved,
  parseStructuredTaskStateStore,
  updateStructuredTaskState,
  upsertStructuredTaskState,
} from '../src/taskState';

describe('taskState helpers', () => {
  it('normalizes and finds active task state by scope', () => {
    const now = Date.UTC(2026, 2, 10, 16, 0, 0);
    const task = createStructuredTaskState({
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-42',
      taskPartition: 'INC-42',
      objective: 'Stabilize rollback verification',
      nextAction: 'Open the failing healthcheck diff',
      confidence: 'high',
      lastKnownSafeBreakpoint: {
        file: 'src/healthcheck.ts',
        line: 48,
        capturedAt: now,
      },
      workingSet: [{ kind: 'file', label: 'src/healthcheck.ts', target: 'src/healthcheck.ts' }],
      assumptions: ['Rollback branch still points at prod SHA'],
      blockers: ['Need fresh canary logs'],
      prospectiveNextVerification: 'Confirm healthcheck returns 200 after rollback',
      staleAfter: now + 4 * 60 * 60_000,
      createdAt: now,
      updatedAt: now,
    });

    const store = upsertStructuredTaskState(parseStructuredTaskStateStore(undefined), task);
    const active = findActiveStructuredTaskForScope(
      store,
      '/workspace/repo',
      'feature/INC-42',
      'INC-42',
    );

    expect(active?.objective).toBe('Stabilize rollback verification');
    expect(computeCheckpointFieldCompleteness(task)).toBe(100);
    expect(describeStructuredTaskStateFreshness(task, now + 60_000)).toBe('fresh');
    expect(describeStructuredTaskSwitchClass(task)).toBe('stable');
  });

  it('marks resolved tasks stale/freshness and switch cohorts correctly', () => {
    const now = Date.UTC(2026, 2, 10, 16, 0, 0);
    const task = createStructuredTaskState({
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-43',
      taskPartition: 'INC-43',
      objective: 'Trace config drift',
      nextAction: 'Compare the last two deploy manifests',
      confidence: 'low',
      switchCount: 3,
      staleAfter: now - 1,
      lastKnownSafeBreakpoint: { capturedAt: now, label: 'Recent task context' },
    });

    const resolved = markStructuredTaskStateResolved(task, 'resolved', now);

    expect(describeStructuredTaskStateFreshness(task, now)).toBe('stale');
    expect(describeStructuredTaskSwitchClass(task)).toBe('repeated-switch');
    expect(resolved.resolutionState).toBe('resolved');
    expect(resolved.resolvedAt).toBe(now);
  });

  it('allows edit patches to clear optional fields', () => {
    const now = Date.UTC(2026, 2, 10, 16, 0, 0);
    const task = createStructuredTaskState({
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-44',
      taskPartition: 'INC-44',
      objective: 'Validate config rollback',
      nextAction: 'Compare the current and previous manifests',
      confidence: 'medium',
      currentHypothesis: 'The new manifest dropped a required default.',
      staleAfter: now + 4 * 60 * 60_000,
      lastKnownSafeBreakpoint: { capturedAt: now, label: 'config.ts:88' },
      lastResumedAt: now,
      resolvedAt: now + 1_000,
      resolutionState: 'dismissed',
    });

    const updated = updateStructuredTaskState(
      task,
      {
        currentHypothesis: undefined,
        staleAfter: undefined,
        lastResumedAt: undefined,
        resolvedAt: undefined,
        resolutionState: 'active',
      },
      now + 2_000,
    );

    expect(updated.currentHypothesis).toBeUndefined();
    expect(updated.staleAfter).toBeUndefined();
    expect(updated.lastResumedAt).toBeUndefined();
    expect(updated.resolvedAt).toBeUndefined();
    expect(updated.resolutionState).toBe('active');
  });
});
