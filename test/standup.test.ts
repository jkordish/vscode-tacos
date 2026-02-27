import { buildStandupUpdate } from '../src/standup';
import type { ResumeSummary } from '../src/types';

function sampleSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'intent',
    nextSteps: ['Implement foo', 'Run tests'],
    doneSinceLastResume: ['Refactored parser'],
    pendingBlocked: ['CI is failing'],
    topFiles: ['src/parser.ts'],
    links: [],
    detailsMarkdown: '',
    codexPrompt: '',
    contextHash: 'hash',
    generatedAt: 1,
    source: 'local',
    currentBranch: 'feature/foo',
    ...overrides,
  };
}

describe('buildStandupUpdate', () => {
  it('renders concise done/next/blockers content', () => {
    const text = buildStandupUpdate(sampleSummary(), 'repo', Date.UTC(2026, 0, 1));
    expect(text).toContain('# Standup Update (repo)');
    expect(text).toContain('## Done');
    expect(text).toContain('- Refactored parser');
    expect(text).toContain('## Next');
    expect(text).toContain('- Implement foo');
    expect(text).toContain('## Blockers');
    expect(text).toContain('- CI is failing');
    expect(text).toContain('Evidence: Branch: feature/foo');
  });

  it('falls back gracefully when sections are empty', () => {
    const text = buildStandupUpdate(
      sampleSummary({
        doneSinceLastResume: [],
        nextSteps: [],
        pendingBlocked: [],
      }),
      'repo',
      1,
    );
    expect(text).toContain('No explicit done items captured.');
    expect(text).toContain('Refresh summary to regenerate next steps.');
    expect(text).toContain('No active blockers captured.');
  });
});
