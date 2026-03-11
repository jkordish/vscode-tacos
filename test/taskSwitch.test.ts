import {
  createTaskSwitchCandidateHash,
  detectTaskSwitchCandidate,
  deriveMeaningfulFileCluster,
} from '../src/taskSwitch';

describe('taskSwitch detection', () => {
  it('detects manual and partition switch reasons with explainability', () => {
    const candidate = detectTaskSwitchCandidate({
      previous: {
        workspaceRoot: '/workspace/repo',
        branch: 'feature/INC-1',
        taskPartition: 'INC-1',
        fileCluster: ['src', 'docs'],
        observedAt: Date.UTC(2026, 2, 10, 10, 0, 0),
      },
      current: {
        workspaceRoot: '/workspace/repo',
        branch: 'feature/INC-1',
        taskPartition: 'HOTFIX-2',
        fileCluster: ['ops', 'runbooks'],
        observedAt: Date.UTC(2026, 2, 10, 10, 5, 0),
      },
      idleBoundaryMinutes: 10,
      manualConfirm: true,
    });

    expect(candidate?.reasonCodes).toEqual([
      'manual-confirm',
      'task-partition-changed',
      'file-cluster-drift',
    ]);
    expect(candidate?.summary).toBe('Manual task switch confirmation');
    expect(candidate?.explainability[0]).toContain('User explicitly confirmed');
    expect(createTaskSwitchCandidateHash(candidate!)).toContain('manual-confirm');
  });

  it('detects idle boundary and branch changes conservatively', () => {
    const candidate = detectTaskSwitchCandidate({
      previous: {
        workspaceRoot: '/workspace/repo',
        branch: 'feature/INC-2',
        taskPartition: 'INC-2',
        fileCluster: ['src', 'tests'],
        observedAt: Date.UTC(2026, 2, 10, 9, 0, 0),
      },
      current: {
        workspaceRoot: '/workspace/repo',
        branch: 'main',
        taskPartition: 'INC-2',
        fileCluster: ['src', 'tests'],
        observedAt: Date.UTC(2026, 2, 10, 9, 30, 0),
      },
      idleBoundaryMinutes: 10,
      focusReturnIdleMinutes: 30,
    });

    expect(candidate?.reasonCodes).toEqual(['focus-return-idle', 'branch-changed']);
    expect(candidate?.summary).toBe('Capture a checkpoint before branch context decays.');
  });

  it('derives stable file clusters from recent paths', () => {
    expect(
      deriveMeaningfulFileCluster([
        'src/extension.ts',
        'packages/agent/src/index.ts',
        'docs/runbook.md',
      ]),
    ).toEqual(['src', 'packages/agent', 'docs']);
  });

  it('does not surface file-cluster drift as a standalone switch trigger', () => {
    const candidate = detectTaskSwitchCandidate({
      previous: {
        workspaceRoot: '/workspace/repo',
        branch: 'feature/INC-3',
        taskPartition: 'INC-3',
        fileCluster: ['src', 'docs'],
        observedAt: Date.UTC(2026, 2, 10, 11, 0, 0),
      },
      current: {
        workspaceRoot: '/workspace/repo',
        branch: 'feature/INC-3',
        taskPartition: 'INC-3',
        fileCluster: ['ops', 'runbooks'],
        observedAt: Date.UTC(2026, 2, 10, 11, 5, 0),
      },
      idleBoundaryMinutes: 10,
    });

    expect(candidate).toBeUndefined();
  });
});
