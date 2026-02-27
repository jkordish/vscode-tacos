import * as path from 'node:path';
import {
  buildSummaryContextPrompt,
  shouldRetryWithJsonObjectFallback,
  validateOpenAiSummaryPayload,
} from '../src/llm';
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
      top_links: [
        'file:src/extension.ts',
        'url:https://github.com/org/repo/pull/1',
        'terminal:abc123',
      ],
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

    const parsed = validateOpenAiSummaryPayload(
      payload,
      sampleEvidence(workspaceRoot),
      workspaceRoot,
    );
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
      workspaceRoot,
    );

    expect(parsed.links).toEqual([{ label: 'good', target: 'https://example.com/', kind: 'url' }]);
  });

  it('caps top links to max 3 even when more grounded links are provided', () => {
    const workspaceRoot = '/workspace/repo';
    const evidenceCatalog: SummaryEvidenceItem[] = [
      {
        id: 'file:src/a.ts',
        kind: 'file',
        label: 'src/a.ts',
        target: path.resolve(workspaceRoot, 'src/a.ts'),
      },
      {
        id: 'file:src/b.ts',
        kind: 'file',
        label: 'src/b.ts',
        target: path.resolve(workspaceRoot, 'src/b.ts'),
      },
      {
        id: 'url:https://example.com/1',
        kind: 'url',
        label: 'Doc 1',
        target: 'https://example.com/1',
      },
      {
        id: 'url:https://example.com/2',
        kind: 'url',
        label: 'Doc 2',
        target: 'https://example.com/2',
      },
    ];

    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: [
          { text: 'a', evidence_ids: [] },
          { text: 'b', evidence_ids: [] },
        ],
        top_links: [
          'file:src/a.ts',
          'file:src/b.ts',
          'url:https://example.com/1',
          'url:https://example.com/2',
        ],
      },
      evidenceCatalog,
      workspaceRoot,
    );

    expect(parsed.links).toHaveLength(3);
    expect(parsed.links.map((link) => `${link.kind}:${link.target}`)).toEqual([
      `file:${path.resolve(workspaceRoot, 'src/a.ts')}`,
      `file:${path.resolve(workspaceRoot, 'src/b.ts')}`,
      'url:https://example.com/1',
    ]);
  });

  it('throws when required structure is missing', () => {
    expect(() =>
      validateOpenAiSummaryPayload(
        { intent: '', next_steps: [], top_links: [] },
        sampleEvidence('/workspace'),
        '/workspace',
      ),
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
      },
    );

    expect(prompt).toContain('User corrections (must respect)');
    expect(prompt).toContain('wrong intent: focus is parser fix');
  });

  it('does not include absolute local file targets in evidence lines', () => {
    const workspaceRoot = '/workspace/repo';
    const prompt = buildSummaryContextPrompt(
      {
        workspaceRoot,
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
        evidenceCatalog: [
          {
            id: 'file:src/index.ts',
            kind: 'file',
            label: 'src/index.ts',
            target: path.resolve(workspaceRoot, 'src/index.ts'),
          },
          {
            id: 'url:https://example.com/docs',
            kind: 'url',
            label: 'Docs',
            target: 'https://example.com/docs',
          },
        ],
        detailsMarkdown: 'details',
        codexPrompt: 'prompt',
        contextHash: 'hash',
        generatedAt: 1,
        source: 'local',
      },
    );

    expect(prompt).toContain('id=file:src/index.ts | kind=file | label=src/index.ts');
    expect(prompt).not.toContain(path.resolve(workspaceRoot, 'src/index.ts'));
    expect(prompt).toContain(
      'id=url:https://example.com/docs | kind=url | label=Docs | target=https://example.com/docs',
    );
  });
});

describe('shouldRetryWithJsonObjectFallback', () => {
  it('returns true for response_format/json_schema compatibility errors', () => {
    expect(
      shouldRetryWithJsonObjectFallback(
        new Error('OpenAI request failed (400): unsupported response_format: json_schema'),
      ),
    ).toBe(true);
    expect(
      shouldRetryWithJsonObjectFallback(
        new Error('invalid parameter: response_format must be one of json_object or text'),
      ),
    ).toBe(true);
  });

  it('returns false for timeout and refusal errors', () => {
    expect(
      shouldRetryWithJsonObjectFallback(new Error('OpenAI request timed out after 15000ms')),
    ).toBe(false);
    expect(
      shouldRetryWithJsonObjectFallback(
        new Error('OpenAI model refused summary request: policy restriction'),
      ),
    ).toBe(false);
  });
});
