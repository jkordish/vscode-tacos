import { buildNextStepActions } from '../src/nextStepActions';
import type { ResumeSummary, SummaryEvidenceItem } from '../src/types';

function baseSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'intent',
    nextSteps: ['step 1', 'step 2'],
    topFiles: [],
    links: [],
    detailsMarkdown: '',
    codexPrompt: '',
    contextHash: 'hash',
    generatedAt: 123,
    source: 'local',
    ...overrides,
  };
}

describe('buildNextStepActions', () => {
  it('maps file evidence to open-file actions', () => {
    const evidence: SummaryEvidenceItem[] = [
      {
        id: 'file:src/extension.ts',
        kind: 'file',
        label: 'src/extension.ts',
        target: '/workspace/src/extension.ts',
      },
    ];
    const summary = baseSummary({
      nextStepEvidenceIds: [['file:src/extension.ts'], []],
      evidenceCatalog: evidence,
    });

    const actions = buildNextStepActions({
      summary,
      canRerunTask: false,
      canRerunDebug: false,
      canCopyFailingCommand: false,
    });

    expect(actions[0]).toEqual({
      stepIndex: 0,
      kind: 'openFile',
      label: 'Open file',
      evidenceId: 'file:src/extension.ts',
    });
    expect(actions[1]).toBeUndefined();
  });

  it('maps terminal evidence to copy-failing-command when available', () => {
    const evidence: SummaryEvidenceItem[] = [
      {
        id: 'terminal:abc',
        kind: 'terminal',
        label: 'npm test',
      },
    ];
    const summary = baseSummary({
      nextStepEvidenceIds: [['terminal:abc']],
      evidenceCatalog: evidence,
    });

    const actions = buildNextStepActions({
      summary,
      canRerunTask: true,
      canRerunDebug: true,
      canCopyFailingCommand: true,
    });

    expect(actions[0]).toEqual({
      stepIndex: 0,
      kind: 'copyFailingCommand',
      label: 'Copy failing command',
      evidenceId: 'terminal:abc',
    });
  });

  it('falls back to rerun task/debug actions by evidence kind and capability', () => {
    const evidence: SummaryEvidenceItem[] = [
      {
        id: 'task:a',
        kind: 'task',
        label: 'test task',
      },
      {
        id: 'debug:b',
        kind: 'debug',
        label: 'Launch API',
      },
    ];
    const summary = baseSummary({
      nextStepEvidenceIds: [['task:a'], ['debug:b']],
      evidenceCatalog: evidence,
    });

    const actions = buildNextStepActions({
      summary,
      canRerunTask: true,
      canRerunDebug: true,
      canCopyFailingCommand: false,
    });

    expect(actions[0]?.kind).toBe('rerunTask');
    expect(actions[1]?.kind).toBe('rerunDebug');
  });

  it('returns no action when evidence is missing or unsupported', () => {
    const evidence: SummaryEvidenceItem[] = [
      {
        id: 'branch:main',
        kind: 'branch',
        label: 'main',
      },
    ];
    const summary = baseSummary({
      nextStepEvidenceIds: [['missing:id'], ['branch:main']],
      evidenceCatalog: evidence,
    });

    const actions = buildNextStepActions({
      summary,
      canRerunTask: false,
      canRerunDebug: false,
      canCopyFailingCommand: false,
    });

    expect(actions[0]).toBeUndefined();
    expect(actions[1]).toBeUndefined();
  });

  it('gates all step actions when summary confidence is low', () => {
    const summary = baseSummary({
      lowConfidence: true,
      nextStepEvidenceIds: [['file:src/extension.ts']],
      evidenceCatalog: [
        {
          id: 'file:src/extension.ts',
          kind: 'file',
          label: 'src/extension.ts',
          target: '/workspace/src/extension.ts',
        },
      ],
    });

    const actions = buildNextStepActions({
      summary,
      canRerunTask: true,
      canRerunDebug: true,
      canCopyFailingCommand: true,
    });

    expect(actions).toEqual([undefined, undefined]);
  });
});
