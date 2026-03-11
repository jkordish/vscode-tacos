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
        intentOverridden: false,
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
    expect(markdown).toContain('"intentSource": "inferred"');
    expect(markdown).toContain('Intent source: inferred');
    expect(markdown).toContain('Includes checkpoint context in summary: no');
    expect(markdown).toContain('Includes scratchpad content: no');
    expect(markdown).toContain('## Redaction report');
    expect(markdown).toContain('High-risk detected: no');
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
        intentOverridden: false,
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

  it('renders redaction report categories and high-risk flag', () => {
    const markdown = buildAiPayloadPreviewMarkdown({
      provider: 'openai',
      workspaceName: 'workspace',
      generatedAt: 123,
      signals: sampleSignals(),
      summary: {
        intent: 'Review redactions',
        intentOverridden: true,
        nextSteps: ['Inspect payload'],
        topFiles: ['src/extension.ts'],
        links: [],
        evidenceCatalog: [],
      },
      includeCheckpointNotes: true,
      includeScratchpad: false,
      redactionReport: {
        categoryCounts: {
          bearer_header: 2,
          private_key_block: 1,
        },
        totalReplacements: 3,
        totalCharsReplaced: 120,
        highRiskDetected: true,
        customPatternValidation: {
          provided: 2,
          accepted: 1,
          invalid: 1,
          tooLong: 0,
          overLimit: 0,
        },
      },
    });

    expect(markdown).toContain('Includes checkpoint context in summary: yes');
    expect(markdown).toContain('Includes scratchpad content: no');
    expect(markdown).toContain('Intent source: user-edited');
    expect(markdown).toContain('Total replacements: 3');
    expect(markdown).toContain('High-risk detected: yes');
    expect(markdown).toContain('bearer_header: 2');
    expect(markdown).toContain('private_key_block: 1');
    expect(markdown).not.toContain('"checkpointNotes"');
  });
});
