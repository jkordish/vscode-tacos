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
    expect(summary.intent.length).toBeGreaterThan(0);
  });
});
