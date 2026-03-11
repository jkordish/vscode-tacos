import { applyStructuredTaskStateToSummary } from '../src/structuredRecovery';
import { createStructuredTaskState } from '../src/taskState';
import type { ResumeSummary } from '../src/types';

describe('structuredRecovery', () => {
  it('upgrades a resume summary into explicit state-recovery sections', () => {
    const now = Date.UTC(2026, 2, 10, 19, 0, 0);
    const task = createStructuredTaskState({
      workspaceRoot: '/workspace/repo',
      repo: 'repo',
      branch: 'feature/INC-88',
      taskPartition: 'INC-88',
      objective: 'Stabilize incident handoff notes',
      nextAction: 'Reopen the failing handoff renderer',
      currentHypothesis: 'The markdown serializer is dropping pinned sections',
      assumptions: ['The saved branch still reflects the active incident fix'],
      blockers: ['Need a fresh failing example from the canary run'],
      workingSet: [
        { kind: 'file', label: 'src/summary.ts', target: 'src/summary.ts', capturedAt: now },
        {
          kind: 'file',
          label: 'src/webview/panelFragments.ts',
          target: 'src/webview/panelFragments.ts',
          capturedAt: now,
        },
      ],
      lastKnownSafeBreakpoint: {
        file: 'src/summary.ts',
        line: 212,
        capturedAt: now,
      },
      updatedAt: now,
      createdAt: now - 30 * 60_000,
    });
    const summary: ResumeSummary = {
      version: 2,
      generatedAt: now,
      workspaceRoot: '/workspace/repo',
      intent: 'Old intent',
      intentOverridden: false,
      currentBranch: 'main',
      topFiles: ['src/summary.ts'],
      links: [],
      commands: [],
      checks: [],
      nextSteps: ['Open the existing brief'],
      blockers: [],
      recentChanges: [],
      detailsMarkdown: '## Existing details',
      codexPrompt: 'Existing prompt',
      providerMeta: { provider: 'local', model: 'n/a' },
      riskFlags: [],
      evidenceCatalog: [],
      changesSinceLastResume: ['New diff in summary renderer'],
      pendingBlocked: ['Existing blocker'],
      recommendedFirstAction: 'Old action',
    };

    const result = applyStructuredTaskStateToSummary(summary, task, {
      currentBranch: 'main',
      currentTaskPartition: 'INC-99',
      now,
    });

    expect(result.intent).toBe('Stabilize incident handoff notes');
    expect(result.structuredTaskStateUsed).toBe(true);
    expect(result.whatYouWereDoing).toEqual([
      'Stabilize incident handoff notes',
      'Hypothesis: The markdown serializer is dropping pinned sections',
      'Working set: src/summary.ts, src/webview/panelFragments.ts',
    ]);
    expect(result.whatChangedSince).toContain('Branch changed from feature/INC-88 to main.');
    expect(result.whatChangedSince).toContain('Task partition changed from INC-88 to INC-99.');
    expect(result.nextLikelySafeMove).toContain(
      'Suggested next move: Reopen the failing handoff renderer.',
    );
    expect(result.nextLikelySafeMove).toContain('Verify against src/summary.ts:212.');
    expect(result.openQuestions).toContain(
      'Blocker: Need a fresh failing example from the canary run',
    );
    expect(result.openQuestions).toContain(
      'Assumption to verify: The saved branch still reflects the active incident fix',
    );
    expect(result.timelineCues).toContain('Last known safe breakpoint: src/summary.ts:212');
    expect(result.detailsMarkdown).toContain('## What You Were Doing');
    expect(result.codexPrompt).toContain('## Timeline / Evidence / Retrieval Cues');
  });
});
