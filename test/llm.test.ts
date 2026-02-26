import * as path from 'node:path';
import { buildSummaryContextPrompt, validateOpenAiSummaryPayload } from '../src/llm';
import type { SummaryEvidenceItem } from '../src/types';

describe('validateOpenAiSummaryPayload', () => {
  function sampleEvidence(workspaceRoot: string): SummaryEvidenceItem[] {
    return [
      {
        id: 'file:src/extension.ts',
        kind: 'file',
        label: 'src/extension.ts',
        target: path.resolve(workspaceRoot, 'src/extension.ts'),
      },
      {
        id: 'url:https://github.com/org/repo/pull/1',
        kind: 'url',
        label: 'PR',
        target: 'https://github.com/org/repo/pull/1',
      },
      {
        id: 'terminal:abc123',
        kind: 'terminal',
        label: 'npm test',
      },
    ];
  }

  it('accepts valid payload and keeps only catalog-backed safe links', () => {
    const workspaceRoot = '/workspace/repo';
    const evidenceCatalog = sampleEvidence(workspaceRoot);
    const payload = {
      intent: 'You were finishing resume-brief generation and wiring UI actions.',
      next_steps: [
        { text: 'Run tests', evidence_ids: ['terminal:abc123'] },
        { text: 'Validate command wiring', evidence_ids: ['file:src/extension.ts'] },
      ],
      top_links: ['file:src/extension.ts', 'url:https://github.com/org/repo/pull/1', 'terminal:abc123'],
    };

    const parsed = validateOpenAiSummaryPayload(payload, evidenceCatalog, workspaceRoot);

    expect(parsed.intent).toContain('resume-brief');
    expect(parsed.nextSteps).toHaveLength(2);
    expect(parsed.links).toEqual([
      {
        label: 'src/extension.ts',
        target: path.resolve(workspaceRoot, 'src/extension.ts'),
        kind: 'file',
      },
      {
        label: 'PR',
        target: 'https://github.com/org/repo/pull/1',
        kind: 'url',
      },
    ]);
    expect(parsed.nextStepEvidenceIds).toEqual([['terminal:abc123'], ['file:src/extension.ts']]);
  });

  it('drops unknown IDs and non-file/url IDs from top_links', () => {
    const workspaceRoot = '/workspace/repo';
    const payload = {
      intent: 'intent',
      next_steps: [
        { text: 'a', evidence_ids: ['unknown:id'] },
        { text: 'b', evidence_ids: [] },
      ],
      top_links: ['terminal:abc123', 'unknown:id', 'file:src/extension.ts'],
    };

    const parsed = validateOpenAiSummaryPayload(payload, sampleEvidence(workspaceRoot), workspaceRoot);
    expect(parsed.links).toEqual([
      {
        label: 'src/extension.ts',
        target: path.resolve(workspaceRoot, 'src/extension.ts'),
        kind: 'file',
      },
    ]);
    expect(parsed.nextStepEvidenceIds[0]).toEqual(['file:src/extension.ts']);
  });

  it('drops evidence-backed top links that resolve to unsafe protocols/paths', () => {
    const workspaceRoot = '/workspace/repo';
    const evidenceCatalog: SummaryEvidenceItem[] = [
      {
        id: 'url:bad',
        kind: 'url',
        label: 'bad',
        target: 'command:workbench.action.files.openFile',
      },
      {
        id: 'file:outside',
        kind: 'file',
        label: '/etc/passwd',
        target: '/etc/passwd',
      },
      {
        id: 'url:good',
        kind: 'url',
        label: 'good',
        target: 'https://example.com',
      },
    ];
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: [
          { text: 'a', evidence_ids: [] },
          { text: 'b', evidence_ids: [] },
        ],
        top_links: ['url:bad', 'file:outside', 'url:good'],
      },
      evidenceCatalog,
      workspaceRoot
    );

    expect(parsed.links).toEqual([
      { label: 'good', target: 'https://example.com/', kind: 'url' },
    ]);
  });

  it('throws when required structure is missing', () => {
    expect(() =>
      validateOpenAiSummaryPayload(
        { intent: '', next_steps: [], top_links: [] },
        sampleEvidence('/workspace'),
        '/workspace'
      )
    ).toThrow();
  });
});

describe('buildSummaryContextPrompt', () => {
  it('includes user corrections when present', () => {
    const prompt = buildSummaryContextPrompt(
      {
        workspaceRoot: '/workspace/repo',
        workspaceName: 'repo',
        branch: 'main',
        gitStatus: '',
        gitDiffStat: '',
        gitDiff: '',
        gitLog: '',
        changedFiles: [],
        openFiles: [],
        recentFiles: [],
        recentTerminal: [],
        recentDebug: [],
        recentUrls: [],
        doneItems: [],
        failingCommand: undefined,
      },
      {
        intent: 'intent',
        nextSteps: ['step 1', 'step 2'],
        topFiles: [],
        links: [],
        detailsMarkdown: 'details',
        codexPrompt: 'prompt',
        contextHash: 'hash',
        generatedAt: 1,
        source: 'local',
        userCorrections: ['wrong intent: focus is parser fix'],
      }
    );

    expect(prompt).toContain('User corrections (must respect)');
    expect(prompt).toContain('wrong intent: focus is parser fix');
  });
});
