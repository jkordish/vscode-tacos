import { parseWebviewMessage } from '../src/webviewMessages';

describe('parseWebviewMessage', () => {
  it('accepts known simple host actions', () => {
    expect(parseWebviewMessage({ type: 'fixSummary' })).toEqual({ type: 'fixSummary' });
    expect(parseWebviewMessage({ type: 'copySummary' })).toEqual({ type: 'copySummary' });
    expect(parseWebviewMessage({ type: 'refreshSummary' })).toEqual({
      type: 'refreshSummary',
    });
    expect(parseWebviewMessage({ type: 'checkpointPinToggle' })).toEqual({
      type: 'checkpointPinToggle',
    });
    expect(parseWebviewMessage({ type: 'checkpointMarkDone' })).toEqual({
      type: 'checkpointMarkDone',
    });
    expect(parseWebviewMessage({ type: 'checkpointDismiss' })).toEqual({
      type: 'checkpointDismiss',
    });
    expect(parseWebviewMessage({ type: 'checkpointOpenList' })).toEqual({
      type: 'checkpointOpenList',
    });
    expect(parseWebviewMessage({ type: 'openScratchpad' })).toEqual({
      type: 'openScratchpad',
    });
    expect(parseWebviewMessage({ type: 'toggleAutoSummaries' })).toEqual({
      type: 'toggleAutoSummaries',
    });
    expect(parseWebviewMessage({ type: 'openPrivacySafety' })).toEqual({
      type: 'openPrivacySafety',
    });
    expect(parseWebviewMessage({ type: 'rateHelpfulness' })).toEqual({
      type: 'rateHelpfulness',
    });
    expect(parseWebviewMessage({ type: 'sessionAddCheckpoint' })).toEqual({
      type: 'sessionAddCheckpoint',
    });
    expect(parseWebviewMessage({ type: 'restoreReopenFiles' })).toEqual({
      type: 'restoreReopenFiles',
    });
    expect(parseWebviewMessage({ type: 'restoreOpenProblems' })).toEqual({
      type: 'restoreOpenProblems',
    });
    expect(parseWebviewMessage({ type: 'restoreWorkingSet' })).toEqual({
      type: 'restoreWorkingSet',
    });
  });

  it('validates openLink payload shape', () => {
    expect(parseWebviewMessage({ type: 'openLink', index: 2 })).toEqual({
      type: 'openLink',
      index: 2,
    });
    expect(parseWebviewMessage({ type: 'openLink', index: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'openLink', index: 1.2 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'openLink', index: '1' })).toBeUndefined();
  });

  it('validates openTopFile payload shape', () => {
    expect(parseWebviewMessage({ type: 'openTopFile', index: 3 })).toEqual({
      type: 'openTopFile',
      index: 3,
    });
    expect(parseWebviewMessage({ type: 'openTopFile', index: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'openTopFile', index: 2.5 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'openTopFile', index: '3' })).toBeUndefined();
  });

  it('validates runNextStepAction payload shape', () => {
    expect(parseWebviewMessage({ type: 'runNextStepAction', stepIndex: 1 })).toEqual({
      type: 'runNextStepAction',
      stepIndex: 1,
    });
    expect(parseWebviewMessage({ type: 'runNextStepAction', stepIndex: -1 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'runNextStepAction', stepIndex: 2.1 })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'runNextStepAction', stepIndex: '1' })).toBeUndefined();
  });

  it('validates openEvidence payload shape', () => {
    expect(parseWebviewMessage({ type: 'openEvidence', evidenceId: 'file:src/index.ts' })).toEqual({
      type: 'openEvidence',
      evidenceId: 'file:src/index.ts',
    });

    const longEvidenceId = `url:https://example.com/${'a'.repeat(600)}`;
    expect(parseWebviewMessage({ type: 'openEvidence', evidenceId: longEvidenceId })).toEqual({
      type: 'openEvidence',
      evidenceId: longEvidenceId,
    });

    expect(parseWebviewMessage({ type: 'openEvidence', evidenceId: '' })).toBeUndefined();
    expect(parseWebviewMessage({ type: 'openEvidence', evidenceId: 123 })).toBeUndefined();
  });

  it('drops invalid payload objects', () => {
    expect(parseWebviewMessage(undefined)).toBeUndefined();
    expect(parseWebviewMessage('openLink')).toBeUndefined();
    expect(parseWebviewMessage({})).toBeUndefined();
    expect(parseWebviewMessage({ type: 'unexpected' })).toBeUndefined();
  });
});
