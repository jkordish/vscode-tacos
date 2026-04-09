import {
  TASK_STATE_SCHEMA_VERSION,
  TASK_STATE_SCHEMA_VERSION_V1,
  computeCheckpointFieldCompleteness,
  createStructuredTaskState,
  describeStructuredTaskStateFreshness,
  describeStructuredTaskSwitchClass,
  findActiveStructuredTaskForScope,
  markStructuredTaskStateResolved,
  migrateV1toV2,
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

  it('schema version is 2', () => {
    expect(TASK_STATE_SCHEMA_VERSION).toBe(2);
    expect(TASK_STATE_SCHEMA_VERSION_V1).toBe(1);
  });

  it('parseStructuredTaskStateStore stamps schemaVersion 2 on fresh stores', () => {
    const store = parseStructuredTaskStateStore(undefined);
    expect(store.schemaVersion).toBe(2);
    expect(store.tasks).toHaveLength(0);
  });

  describe('migrateV1toV2', () => {
    it('returns raw unchanged when raw is nullish', () => {
      expect(migrateV1toV2(null)).toBeNull();
      expect(migrateV1toV2(undefined)).toBeUndefined();
    });

    it('returns raw unchanged when schemaVersion >= 2', () => {
      const raw = { schemaVersion: 2, tasks: [] };
      expect(migrateV1toV2(raw)).toBe(raw);
    });

    it('is idempotent — running twice produces the same result', () => {
      const raw = { schemaVersion: 1, tasks: [] };
      const once = migrateV1toV2(raw) as Record<string, unknown>;
      const twice = migrateV1toV2(once) as Record<string, unknown>;
      expect(twice.schemaVersion).toBe(2);
    });

    it('promotes legacy checkpoints key to tasks when tasks is empty', () => {
      const legacyTask = {
        taskId: 'abc123',
        workspaceRoot: '/workspace/repo',
        repo: 'repo',
        branch: 'main',
        taskPartition: 'default',
        objective: 'Fix the thing',
        nextAction: 'Open the file',
        confidence: 'medium',
        workingSet: [],
        assumptions: [],
        blockers: [],
        switchCount: 0,
        resolutionState: 'active',
        lastKnownSafeBreakpoint: { capturedAt: 1_000_000 },
        createdAt: 1_000_000,
        updatedAt: 1_000_000,
      };
      const raw = { schemaVersion: 1, checkpoints: [legacyTask], tasks: [] };
      const migrated = migrateV1toV2(raw) as Record<string, unknown>;
      expect(migrated.schemaVersion).toBe(2);
      expect(Array.isArray(migrated.tasks)).toBe(true);
      expect((migrated.tasks as unknown[]).length).toBe(1);
      expect(migrated.checkpoints).toBeUndefined();
    });

    it('preserves existing tasks and ignores checkpoints when tasks is non-empty', () => {
      const task = {
        taskId: 'xyz',
        workspaceRoot: '/workspace/repo',
        repo: 'repo',
        branch: 'main',
        taskPartition: 'default',
        objective: 'Existing task',
        nextAction: 'Do something',
        confidence: 'medium',
        workingSet: [],
        assumptions: [],
        blockers: [],
        switchCount: 0,
        resolutionState: 'active',
        lastKnownSafeBreakpoint: { capturedAt: 1_000_000 },
        createdAt: 1_000_000,
        updatedAt: 1_000_000,
      };
      const legacyTask = { ...task, taskId: 'legacy', objective: 'Legacy task' };
      const raw = { schemaVersion: 1, checkpoints: [legacyTask], tasks: [task] };
      const migrated = migrateV1toV2(raw) as Record<string, unknown>;
      expect(migrated.schemaVersion).toBe(2);
      expect((migrated.tasks as unknown[]).length).toBe(1);
      expect((migrated.tasks as Array<Record<string, unknown>>)[0].taskId).toBe('xyz');
    });

    it('handles missing schemaVersion (defaults to v1) and migrates', () => {
      const raw = { tasks: [] };
      const migrated = migrateV1toV2(raw) as Record<string, unknown>;
      expect(migrated.schemaVersion).toBe(2);
    });
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
