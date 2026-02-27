import { buildResumeSummary } from '../src/summary';
import type { ResumeSignals } from '../src/types';

function sampleSignals(): ResumeSignals {
  return {
    workspaceRoot: '/workspace/repo',
    workspaceName: 'repo',
    branch: 'feature/tacos',
    gitStatus: ' M src/extension.ts',
    gitDiffStat: 'src/extension.ts | 14 ++++++++++----',
    gitDiff: '',
    gitLog: 'abc123 feat: add resume summary',
    changedFiles: ['src/extension.ts'],
    openFiles: ['src/extension.ts', 'README.md'],
    recentFiles: ['src/summary.ts'],
    recentTerminal: ['npm test'],
    recentDebug: ['node: Launch Extension'],
    recentUrls: ['https://github.com/org/repo/pull/1'],
    failingCommand: 'npm test',
    doneItems: ['npm run build'],
  };
}

describe('buildResumeSummary', () => {
  it('produces stable hash for unchanged input', () => {
    const a = buildResumeSummary(sampleSignals());
    const b = buildResumeSummary(sampleSignals());

    expect(a.contextHash).toEqual(b.contextHash);
  });

  it('returns concise structure with max 3 links and 2-3 next steps', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.nextSteps.length).toBeGreaterThanOrEqual(2);
    expect(summary.nextSteps.length).toBeLessThanOrEqual(3);
    expect(summary.links.length).toBeLessThanOrEqual(3);
    expect(summary.evidenceCatalog?.length ?? 0).toBeGreaterThan(0);
    expect(summary.nextStepEvidenceIds?.length).toBe(summary.nextSteps.length);
    expect(summary.recommendedFirstAction).toBe(summary.nextSteps[0]);
    expect(summary.pendingBlocked?.length ?? 0).toBeGreaterThan(0);
    expect(summary.mode).toBe('debugging');
    expect(summary.intent.length).toBeGreaterThan(0);
  });

  it('builds file/url evidence IDs from trusted extension-generated data', () => {
    const summary = buildResumeSummary(sampleSignals());
    const evidence = summary.evidenceCatalog ?? [];

    expect(evidence.some((item) => item.id === 'file:src/extension.ts')).toBe(true);
    expect(evidence.some((item) => item.id === 'url:https://github.com/org/repo/pull/1')).toBe(
      true,
    );
  });

  it('marks mode as coding when no debug/failing signals exist', () => {
    const signals = sampleSignals();
    signals.failingCommand = undefined;
    signals.recentDebug = [];
    signals.recentTerminal = ['pnpm lint'];

    const summary = buildResumeSummary(signals);
    expect(summary.mode).toBe('coding');
  });

  it('marks mode as debugging when terminal tokens indicate test/build/debug activity', () => {
    const signals = sampleSignals();
    signals.failingCommand = undefined;
    signals.recentDebug = [];
    signals.recentTerminal = ['terminal:npm_run_test#abcdef1234'];

    const summary = buildResumeSummary(signals);
    expect(summary.mode).toBe('debugging');
  });

  it('does not include absolute file targets in details markdown evidence lines', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.detailsMarkdown).not.toContain('/workspace/repo/src/extension.ts');
    expect(summary.detailsMarkdown).toContain('url:https://github.com/org/repo/pull/1');
    expect(summary.detailsMarkdown).toContain('-> https://github.com/org/repo/pull/1');
  });

  it('includes session recap fields for done and pending work', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.doneSinceLastResume).toEqual(['npm run build']);
    expect(summary.pendingBlocked?.[0]).toContain('Failing command still unresolved');
    expect(summary.detailsMarkdown).toContain('## Session recap');
    expect(summary.detailsMarkdown).toContain('Recommended first action');
  });

  it('marks low-confidence summaries explicitly when evidence is sparse', () => {
    const signals = sampleSignals();
    signals.changedFiles = [];
    signals.openFiles = [];
    signals.recentFiles = [];
    signals.recentTerminal = [];
    signals.recentDebug = [];
    signals.doneItems = [];
    signals.failingCommand = undefined;
    signals.recentUrls = [];

    const summary = buildResumeSummary(signals);
    expect(summary.lowConfidence).toBe(true);
    expect(summary.intent).toBe('Unclear intent (low evidence).');
    expect(summary.candidateIntents?.length ?? 0).toBeGreaterThan(0);
    expect(summary.nextSteps[0]).toContain('Unclear intent');
    expect(summary.links.length).toBe(0);
  });
});
