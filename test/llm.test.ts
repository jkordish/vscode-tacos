import * as path from 'node:path';
import { validateOpenAiSummaryPayload } from '../src/llm';

describe('validateOpenAiSummaryPayload', () => {
  it('accepts valid payload and keeps only safe links', () => {
    const workspaceRoot = '/workspace/repo';
    const payload = {
      intent: 'You were finishing resume-brief generation and wiring UI actions.',
      next_steps: ['Run tests', 'Validate command wiring'],
      links: [
        { label: 'src/extension.ts', target: 'src/extension.ts', kind: 'file' },
        { label: 'PR', target: 'https://github.com/org/repo/pull/1', kind: 'url' },
        { label: 'Unsafe command', target: 'command:workbench.action.openSettings', kind: 'url' },
      ],
    };

    const parsed = validateOpenAiSummaryPayload(payload, workspaceRoot);

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
  });

  it('drops non-http(s) URL schemes', () => {
    const payload = {
      intent: 'intent',
      next_steps: ['a', 'b'],
      links: [
        { label: 'file URI', target: 'file:///etc/passwd', kind: 'url' },
        { label: 'command', target: 'command:workbench.action.files.openFile', kind: 'url' },
        { label: 'vscode', target: 'vscode://file/c:/temp/a.ts', kind: 'url' },
        { label: 'javascript', target: 'javascript:alert(1)', kind: 'url' },
        { label: 'data', target: 'data:text/plain,hello', kind: 'url' },
      ],
    };

    const parsed = validateOpenAiSummaryPayload(payload, '/workspace/repo');
    expect(parsed.links).toEqual([]);
  });

  it('treats scheme-based targets as URLs when kind is missing', () => {
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: ['a', 'b'],
        links: [{ label: 'command', target: 'command:workbench.action.tasks.runTask' }],
      },
      '/workspace/repo'
    );

    expect(parsed.links).toEqual([]);
  });

  it('drops file links that escape root via traversal', () => {
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: ['a', 'b'],
        links: [{ label: 'outside', target: '../secrets.txt', kind: 'file' }],
      },
      '/workspace/repo'
    );

    expect(parsed.links).toEqual([]);
  });

  it('drops absolute file paths outside workspace root', () => {
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: ['a', 'b'],
        links: [{ label: 'outside', target: '/etc/passwd', kind: 'file' }],
      },
      '/workspace/repo'
    );

    expect(parsed.links).toEqual([]);
  });

  it('drops file links when workspace root is unavailable', () => {
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: ['a', 'b'],
        links: [{ label: 'inside', target: 'src/index.ts', kind: 'file' }],
      },
      ''
    );

    expect(parsed.links).toEqual([]);
  });

  it('keeps valid http/https URLs and in-root relative file paths', () => {
    const workspaceRoot = '/workspace/repo';
    const parsed = validateOpenAiSummaryPayload(
      {
        intent: 'intent',
        next_steps: ['a', 'b'],
        links: [
          { label: 'docs', target: 'http://example.com/docs', kind: 'url' },
          { label: 'pr', target: 'https://example.com/pr/1', kind: 'url' },
          { label: 'inside', target: './src/feature.ts', kind: 'file' },
        ],
      },
      workspaceRoot
    );

    expect(parsed.links).toEqual([
      { label: 'docs', target: 'http://example.com/docs', kind: 'url' },
      { label: 'pr', target: 'https://example.com/pr/1', kind: 'url' },
      { label: 'inside', target: path.resolve(workspaceRoot, './src/feature.ts'), kind: 'file' },
    ]);
  });

  it('throws when required structure is missing', () => {
    expect(() => validateOpenAiSummaryPayload({ intent: '', next_steps: [], links: [] }, '/workspace')).toThrow();
  });
});
