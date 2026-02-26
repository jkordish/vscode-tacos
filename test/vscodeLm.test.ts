import { extractJsonPayloadFromLmText } from '../src/vscodeLm';

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
