import { isRefinementActiveForSummary } from '../src/refinement';

describe('isRefinementActiveForSummary', () => {
  it('returns true only when context hashes match', () => {
    expect(isRefinementActiveForSummary('abc123', 'abc123')).toBe(true);
    expect(isRefinementActiveForSummary('abc123', 'def456')).toBe(false);
  });

  it('ignores empty hashes', () => {
    expect(isRefinementActiveForSummary('', 'abc123')).toBe(false);
    expect(isRefinementActiveForSummary('abc123', '')).toBe(false);
    expect(isRefinementActiveForSummary('   ', 'abc123')).toBe(false);
  });

  it('trims whitespace before comparison', () => {
    expect(isRefinementActiveForSummary('  abc123  ', 'abc123')).toBe(true);
  });
});
