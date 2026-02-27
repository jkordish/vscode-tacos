import { buildAiPayloadPreviewMarkdown } from '../src/aiPayloadPreview';
import type { ResumeSignals } from '../src/types';

function sampleSignals(): ResumeSignals {
  return {
    workspaceRoot: '/workspace',
    workspaceName: 'workspace',
    branch: 'main',
    gitStatus: 'M src/extension.ts',
    gitDiffStat: '1 file changed',
    gitDiff: '',
    gitLog: 'abc123 message',
    changedFiles: ['src/extension.ts'],
    openFiles: ['src/extension.ts'],
    recentFiles: ['src/extension.ts'],
    recentTerminal: ['terminal:npm_test#abc123def456'],
    recentDebug: [],
    recentUrls: [],
    doneItems: [],
  };
}

describe('buildAiPayloadPreviewMarkdown', () => {
  it('renders a human-readable markdown payload preview', () => {
    const markdown = buildAiPayloadPreviewMarkdown({
      provider: 'openai',
      workspaceName: 'workspace',
      generatedAt: 123,
      signals: sampleSignals(),
      summary: {
        intent: 'Fix tests',
        nextSteps: ['Run tests'],
        topFiles: ['src/extension.ts'],
        links: [],
        evidenceCatalog: [],
      },
    });

    expect(markdown).toContain('# TaCoS AI Payload Preview');
    expect(markdown).toContain('```json');
    expect(markdown).toContain('"provider": "openai"');
    expect(markdown).toContain('"intent": "Fix tests"');
    expect(markdown).toContain('Includes your checkpoint notes: no');
    expect(markdown).toContain('Scratchpad content: excluded by default');
  });

  it('marks large payload previews as truncated', () => {
    const markdown = buildAiPayloadPreviewMarkdown({
      provider: 'vscode-lm',
      workspaceName: 'workspace',
      generatedAt: 123,
      signals: {
        ...sampleSignals(),
        gitDiff: 'x'.repeat(20_000),
      },
      summary: {
        intent: 'Review changes',
        nextSteps: ['Inspect diff'],
        topFiles: ['src/extension.ts'],
        links: [],
        evidenceCatalog: [],
      },
      maxJsonChars: 400,
    });

    expect(markdown).toContain('Preview JSON is truncated');
    expect(markdown).toContain('...truncated...');
  });
});
