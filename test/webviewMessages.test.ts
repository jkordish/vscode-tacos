import { parseWebviewMessage } from '../src/webviewMessages';

describe('parseWebviewMessage', () => {
  it('accepts known simple host actions', () => {
    expect(parseWebviewMessage({ type: 'fixSummary' })).toEqual({ type: 'fixSummary' });
    expect(parseWebviewMessage({ type: 'copySummary' })).toEqual({ type: 'copySummary' });
    expect(parseWebviewMessage({ type: 'refreshSummary' })).toEqual({
      type: 'refreshSummary',
    });
    expect(parseWebviewMessage({ type: 'toggleAutoSummaries' })).toEqual({
      type: 'toggleAutoSummaries',
    });
    expect(parseWebviewMessage({ type: 'restoreReopenFiles' })).toEqual({
      type: 'restoreReopenFiles',
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

  it('validates openEvidence payload shape', () => {
    expect(parseWebviewMessage({ type: 'openEvidence', evidenceId: 'file:src/index.ts' })).toEqual({
      type: 'openEvidence',
      evidenceId: 'file:src/index.ts',
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
