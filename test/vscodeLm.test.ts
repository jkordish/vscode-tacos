import { extractJsonPayloadFromLmText, tryGenerateVscodeLmSummary } from '../src/vscodeLm';

describe('extractJsonPayloadFromLmText', () => {
  it('parses direct JSON payloads', () => {
    const parsed = extractJsonPayloadFromLmText('{"intent":"x","next_steps":[],"top_links":[]}') as
      | Record<string, unknown>
      | undefined;

    expect(parsed?.intent).toBe('x');
  });

  it('parses fenced JSON payloads', () => {
    const parsed = extractJsonPayloadFromLmText(
      [
        'Here is the summary:',
        '```json',
        '{"intent":"x","next_steps":[{"text":"a","evidence_ids":[]}],"top_links":[]}',
        '```',
      ].join('\n'),
    ) as Record<string, unknown> | undefined;

    expect(parsed?.intent).toBe('x');
  });

  it('parses the first JSON object embedded in plain text', () => {
    const parsed = extractJsonPayloadFromLmText(
      'Result follows {"intent":"x","next_steps":[{"text":"a","evidence_ids":[]}],"top_links":[]} trailing',
    ) as Record<string, unknown> | undefined;

    expect(parsed?.intent).toBe('x');
  });

  it('returns undefined when no JSON object exists', () => {
    expect(extractJsonPayloadFromLmText('not-json')).toBeUndefined();
  });
});

describe('tryGenerateVscodeLmSummary', () => {
  it('blocks model send when strict sanitizer detects high-risk content', async () => {
    const sendRequest = jest.fn(async () => ({
      text: '{"intent":"x","next_steps":[{"text":"a","evidence_ids":[]},{"text":"b","evidence_ids":[]}],"top_links":[]}',
    }));
    const model = {
      sendRequest,
    };
    const logs: string[] = [];

    const result = await tryGenerateVscodeLmSummary(
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
      },
      {
        intent: 'intent',
        nextSteps: ['a', 'b'],
        topFiles: [],
        links: [],
        detailsMarkdown: 'token=super-secret-token-value',
        codexPrompt: 'prompt',
        contextHash: 'hash',
        generatedAt: 1,
        source: 'local',
      },
      model,
      [],
      (message) => logs.push(message),
    );

    expect(result).toBeUndefined();
    expect(sendRequest).not.toHaveBeenCalled();
    expect(logs.some((message) => message.includes('blocked by strict sanitizer'))).toBe(true);
  });
});
