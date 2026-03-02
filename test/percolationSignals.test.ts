import { buildPercolationSignalBundle } from '../src/percolation/signals';
import type { ResumeSignals, ResumeSummary } from '../src/types';

function buildSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'finish percolation adapter',
    nextSteps: ['Add checkpoint note for follow-up verification'],
    recommendedFirstAction: 'Add checkpoint note for follow-up verification',
    pendingBlocked: ['Failing command still unresolved: npm test'],
    topFiles: ['src/extension.ts'],
    links: [],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'ctx-248',
    generatedAt: 1_700_000_000_000,
    source: 'local',
    ...overrides,
  };
}

function buildRuntimeSignals(overrides: Partial<ResumeSignals> = {}): ResumeSignals {
  return {
    workspaceRoot: '/workspace',
    workspaceName: 'workspace',
    branch: 'feature/percolation',
    gitStatus: ' M src/extension.ts',
    gitDiffStat: ' 1 file changed, 10 insertions(+)',
    gitDiff: '',
    gitLog: '',
    changedFiles: ['src/extension.ts'],
    openFiles: ['src/extension.ts'],
    recentFiles: ['src/extension.ts'],
    recentTerminal: ['npm test'],
    recentDebug: ['Error: assertion failed in percolation'],
    recentUrls: [],
    failingCommand: 'npm test',
    doneItems: [],
    ...overrides,
  };
}

describe('buildPercolationSignalBundle', () => {
  it('adapts trusted runtime signals into deterministic normalized percolation signals', () => {
    const summary = buildSummary({
      currentBranch: 'feature/percolation',
      previousBranch: 'main',
      lastFailingCommand: 'npm test',
      resumeGapMinutes: 42,
    });
    const runtime = buildRuntimeSignals();
    const first = buildPercolationSignalBundle({
      summary,
      runtimeSignals: runtime,
      mode: 'active',
      trusted: true,
      triggerReason: 'focus',
      now: 1_700_000_500_000,
      hasCheckpointNote: true,
    });
    const second = buildPercolationSignalBundle({
      summary,
      runtimeSignals: runtime,
      mode: 'active',
      trusted: true,
      triggerReason: 'focus',
      now: 1_700_000_500_000,
      hasCheckpointNote: true,
    });

    expect(first).toEqual(second);
    expect(first.map((signal) => signal.kind)).toEqual([
      'checkpoint-note',
      'context-change',
      'debug-failure',
      'task-failure',
      'branch-switch',
      'resume',
    ]);
    expect(first.find((signal) => signal.kind === 'task-failure')?.meta).toMatchObject({
      command: 'npm test',
    });
  });

  it('filters trust-sensitive branch and task-failure adapters in restricted mode', () => {
    const signals = buildPercolationSignalBundle({
      summary: buildSummary({
        currentBranch: 'feature/percolation',
        previousBranch: 'main',
        lastFailingCommand: 'npm test',
      }),
      runtimeSignals: buildRuntimeSignals(),
      mode: 'restricted',
      trusted: false,
      triggerReason: 'manual',
      now: 1_700_000_500_000,
      hasCheckpointNote: true,
    });

    expect(signals.map((signal) => signal.kind)).toEqual([
      'checkpoint-note',
      'context-change',
      'debug-failure',
      'trust-change',
      'resume',
    ]);
    expect(signals.some((signal) => signal.kind === 'branch-switch')).toBe(false);
    expect(signals.some((signal) => signal.kind === 'task-failure')).toBe(false);
    expect(signals.find((signal) => signal.kind === 'trust-change')?.meta).toMatchObject({
      restricted: true,
    });
  });

  it('emits privacy-change signal when summaries come from AI-backed providers', () => {
    const signals = buildPercolationSignalBundle({
      summary: buildSummary({
        source: 'openai',
        nextSteps: ['Run focused validation'],
        recommendedFirstAction: 'Run focused validation',
      }),
      runtimeSignals: buildRuntimeSignals({
        changedFiles: [],
        recentFiles: [],
        recentDebug: [],
        failingCommand: undefined,
      }),
      mode: 'active',
      trusted: true,
      triggerReason: 'cached',
      now: 1_700_000_500_000,
    });

    expect(signals.map((signal) => signal.kind)).toEqual(['privacy-change', 'resume']);
    expect(signals.find((signal) => signal.kind === 'privacy-change')?.meta).toMatchObject({
      provider: 'openai',
    });
  });

  it('stamps runtime-derived signals with trigger-time now when provided', () => {
    const triggerNow = 1_700_000_777_000;
    const summary = buildSummary({
      generatedAt: 1_700_000_000_000,
      resumeGapMinutes: 12,
    });

    const signals = buildPercolationSignalBundle({
      summary,
      runtimeSignals: buildRuntimeSignals(),
      mode: 'active',
      trusted: true,
      triggerReason: 'cached',
      now: triggerNow,
      hasCheckpointNote: true,
    });

    const contextChange = signals.find((signal) => signal.kind === 'context-change');
    const checkpointNote = signals.find((signal) => signal.kind === 'checkpoint-note');
    expect(contextChange?.observedAt).toBe(triggerNow);
    expect(checkpointNote?.observedAt).toBe(triggerNow);

    const resume = signals.find((signal) => signal.kind === 'resume');
    expect(resume?.observedAt).toBe(summary.generatedAt);
  });
});
