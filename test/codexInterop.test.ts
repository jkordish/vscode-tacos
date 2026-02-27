import { resolveCodexOpenCommandCandidates } from '../src/codexInterop';

describe('resolveCodexOpenCommandCandidates', () => {
  it('prioritizes official ChatGPT open commands before configured and legacy candidates', () => {
    const knownCommands = [
      'chatgpt.openSidebar',
      'chatgpt.newCodexPanel',
      'chatgpt.newChat',
      'custom.open.codex',
      'openai.codex.open',
      'codex.show',
    ];

    const candidates = resolveCodexOpenCommandCandidates('custom.open.codex', knownCommands);

    expect(candidates).toEqual([
      'chatgpt.newCodexPanel',
      'chatgpt.openSidebar',
      'chatgpt.newChat',
      'custom.open.codex',
      'openai.codex.open',
      'codex.show',
    ]);
  });

  it('filters out commands not installed in the current extension host', () => {
    const knownCommands = ['chatgpt.openSidebar', 'somethingElse'];

    const candidates = resolveCodexOpenCommandCandidates('unknown.command', knownCommands);

    expect(candidates).toEqual(['chatgpt.openSidebar']);
  });

  it('adds inferred codex command ids after built-ins and configured command', () => {
    const knownCommands = [
      'chatgpt.newCodexPanel',
      'my.custom.openCodexView',
      'acme.codex.focusPanel',
      'codex.viewSummary',
      'codex.helper',
    ];

    const candidates = resolveCodexOpenCommandCandidates('', knownCommands);

    expect(candidates).toEqual([
      'chatgpt.newCodexPanel',
      'my.custom.openCodexView',
      'acme.codex.focusPanel',
      'codex.viewSummary',
    ]);
  });
});
