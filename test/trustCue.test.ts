import { buildTrustCue } from '../src/trustCue';
import type { ResumeSummary } from '../src/types';

function summaryWithEvidence(): ResumeSummary {
  return {
    intent: 'intent',
    nextSteps: ['step'],
    topFiles: ['src/extension.ts'],
    links: [],
    detailsMarkdown: '',
    codexPrompt: '',
    contextHash: 'hash',
    generatedAt: 1,
    source: 'local',
    currentBranch: 'feature/test',
    evidenceCatalog: [
      { id: 'file:a', kind: 'file', label: 'a.ts' },
      { id: 'file:b', kind: 'file', label: 'b.ts' },
      { id: 'terminal:a', kind: 'terminal', label: 'npm test' },
      { id: 'debug:a', kind: 'debug', label: 'Launch' },
      { id: 'url:a', kind: 'url', label: 'https://example.com' },
      { id: 'branch:a', kind: 'branch', label: 'feature/test' },
      { id: 'commit:a', kind: 'commit', label: 'abc123' },
    ],
  };
}

describe('buildTrustCue', () => {
  it('builds headline and details from evidence counts', () => {
    const cue = buildTrustCue(summaryWithEvidence());
    expect(cue.headline).toContain('Based on: 2 files');
    expect(cue.headline).toContain('2 runs');
    expect(cue.headline).toContain('branch feature/test');
    expect(cue.details[0]).toContain('2 files');
    expect(cue.details[2]).toContain('1 URL');
  });

  it('handles missing summary safely', () => {
    const cue = buildTrustCue(undefined);
    expect(cue.headline).toContain('no summary evidence yet');
    expect(cue.details).toEqual([]);
  });
});
