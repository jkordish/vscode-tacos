import { validateOpenAiSummaryPayload } from '../src/llm';

describe('validateOpenAiSummaryPayload', () => {
  it('accepts valid payload and normalizes links', () => {
    const payload = {
      intent: 'You were finishing resume-brief generation and wiring UI actions.',
      next_steps: ['Run tests', 'Validate command wiring'],
      links: [
        { label: 'src/extension.ts', target: 'src/extension.ts', kind: 'file' },
        { label: 'PR', target: 'https://github.com/org/repo/pull/1', kind: 'url' },
      ],
    };

    const parsed = validateOpenAiSummaryPayload(payload, '/workspace/repo');

    expect(parsed.intent).toContain('resume-brief');
    expect(parsed.nextSteps).toHaveLength(2);
    expect(parsed.links[0].kind).toBe('file');
    expect(parsed.links[0].target).toBe('/workspace/repo/src/extension.ts');
  });

  it('throws when required structure is missing', () => {
    expect(() => validateOpenAiSummaryPayload({ intent: '', next_steps: [], links: [] }, '/workspace')).toThrow();
  });
});
