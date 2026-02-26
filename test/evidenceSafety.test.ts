import { isSummaryLinkEvidenceGrounded } from '../src/evidenceSafety';
import type { ResumeSummary, SummaryEvidenceItem, SummaryLink } from '../src/types';

function buildSummary(evidenceCatalog: SummaryEvidenceItem[]): ResumeSummary {
  return {
    source: 'local',
    generatedAt: 1000,
    intent: 'Intent',
    nextSteps: ['step 1', 'step 2'],
    topFiles: [],
    links: [],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'hash',
    evidenceCatalog,
  };
}

describe('isSummaryLinkEvidenceGrounded', () => {
  const workspaceRoot = '/workspace/repo';

  it('accepts url links only when they match catalog evidence', () => {
    const summary = buildSummary([
      {
        id: 'url:https://example.com/pr/1',
        kind: 'url',
        label: 'PR #1',
        target: 'https://example.com/pr/1',
      },
    ]);

    const allowed: SummaryLink = {
      label: 'PR #1',
      kind: 'url',
      target: 'https://example.com/pr/1',
    };
    const blocked: SummaryLink = {
      label: 'Injected',
      kind: 'url',
      target: 'https://evil.example/phish',
    };

    expect(isSummaryLinkEvidenceGrounded(summary, allowed)).toBe(true);
    expect(isSummaryLinkEvidenceGrounded(summary, blocked)).toBe(false);
  });

  it('accepts file links only when they resolve to the same in-workspace file evidence', () => {
    const summary = buildSummary([
      {
        id: 'file:src/index.ts',
        kind: 'file',
        label: 'src/index.ts',
        target: '/workspace/repo/src/index.ts',
      },
    ]);

    const allowed: SummaryLink = {
      label: 'src/index.ts',
      kind: 'file',
      target: '/workspace/repo/src/index.ts',
    };
    const blockedOutside: SummaryLink = {
      label: '../secret',
      kind: 'file',
      target: '/workspace/secret.txt',
    };
    const blockedDifferentFile: SummaryLink = {
      label: 'src/other.ts',
      kind: 'file',
      target: '/workspace/repo/src/other.ts',
    };

    expect(isSummaryLinkEvidenceGrounded(summary, allowed, workspaceRoot)).toBe(true);
    expect(isSummaryLinkEvidenceGrounded(summary, blockedOutside, workspaceRoot)).toBe(false);
    expect(isSummaryLinkEvidenceGrounded(summary, blockedDifferentFile, workspaceRoot)).toBe(false);
  });

  it('blocks links when evidence catalog is missing', () => {
    const summary = buildSummary([]);
    const link: SummaryLink = {
      label: 'PR #1',
      kind: 'url',
      target: 'https://example.com/pr/1',
    };

    expect(isSummaryLinkEvidenceGrounded(summary, link)).toBe(false);
  });

  it('blocks file links when workspace root is unavailable', () => {
    const summary = buildSummary([
      {
        id: 'file:src/index.ts',
        kind: 'file',
        label: 'src/index.ts',
        target: '/workspace/repo/src/index.ts',
      },
    ]);
    const link: SummaryLink = {
      label: 'src/index.ts',
      kind: 'file',
      target: '/workspace/repo/src/index.ts',
    };

    expect(isSummaryLinkEvidenceGrounded(summary, link)).toBe(false);
  });
});
