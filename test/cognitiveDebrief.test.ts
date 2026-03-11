import { buildCognitiveDebrief } from '../src/cognitiveDebrief';
import { createStructuredTaskState } from '../src/taskState';

describe('cognitiveDebrief', () => {
  it('surfaces abandoned, stale, blocked, repeated-switch, and assumption-heavy tasks', () => {
    const now = Date.UTC(2026, 2, 10, 18, 0, 0);
    const activeTask = createStructuredTaskState({
      taskId: 'active-task',
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-77',
      taskPartition: 'INC-77',
      objective: 'Stabilize deploy rollback',
      nextAction: 'Re-run the rollback verification command',
      confidence: 'medium',
      lastKnownSafeBreakpoint: { file: 'src/rollback.ts', line: 91, capturedAt: now },
      createdAt: now - 30 * 60_000,
      updatedAt: now - 10 * 60_000,
    });
    const staleBlockedTask = createStructuredTaskState({
      taskId: 'stale-blocked',
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-78',
      taskPartition: 'INC-78',
      objective: 'Trace config drift',
      nextAction: 'Compare deploy manifests against prod',
      blockers: ['Need fresh canary logs'],
      assumptions: ['Rollback branch still matches prod config'],
      confidence: 'low',
      switchCount: 3,
      staleAfter: now - 60_000,
      lastKnownSafeBreakpoint: { label: 'Recent branch diff', capturedAt: now - 2 * 60_000 },
      createdAt: now - 4 * 60 * 60_000,
      updatedAt: now - 2 * 60 * 60_000,
    });
    const resolvedTask = createStructuredTaskState({
      taskId: 'resolved-task',
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-79',
      taskPartition: 'INC-79',
      objective: 'Close out resolved thread',
      nextAction: 'Nothing else to do',
      confidence: 'high',
      resolutionState: 'resolved',
      resolvedAt: now - 5 * 60_000,
      lastKnownSafeBreakpoint: { capturedAt: now - 10 * 60_000, label: 'Resolved state' },
      createdAt: now - 60 * 60_000,
      updatedAt: now - 10 * 60_000,
    });

    const debrief = buildCognitiveDebrief({
      tasks: [activeTask, staleBlockedTask, resolvedTask],
      activeTaskId: activeTask.taskId,
      now,
    });

    expect(debrief.abandonedThreads.map((item) => item.task.taskId)).toEqual(['stale-blocked']);
    expect(debrief.unresolvedBlockers.map((item) => item.task.taskId)).toEqual(['stale-blocked']);
    expect(debrief.repeatedSwitchTasks.map((item) => item.task.taskId)).toEqual(['stale-blocked']);
    expect(debrief.staleTaskStates.map((item) => item.task.taskId)).toEqual(['stale-blocked']);
    expect(debrief.openAssumptions.map((item) => item.task.taskId)).toEqual(['stale-blocked']);
    expect(debrief.abandonedThreads[0]?.detail).toContain('branch feature/INC-78');
    expect(debrief.staleTaskStates[0]?.detail).toContain('Stale after');
  });
});
