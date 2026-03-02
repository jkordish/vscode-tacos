import {
  parseDiffStatFiles,
  parseCommitHashToken,
  parseLatestCommitOutput,
  parsePorcelainPaths,
  parseTrackingDivergence,
} from '../src/git';

describe('parseDiffStatFiles', () => {
  it('returns only file entries and ignores summary footer lines', () => {
    const diffStat = [
      'src/extension.ts | 14 ++++++++++----',
      'README.md        |  2 ++',
      '2 files changed, 12 insertions(+), 4 deletions(-)',
    ].join('\n');

    expect(parseDiffStatFiles(diffStat)).toEqual(['src/extension.ts', 'README.md']);
  });
});

describe('parsePorcelainPaths', () => {
  it('keeps unstaged file paths intact when status has a leading space', () => {
    const status = [
      ' M src/extension.ts',
      'A  src/new-file.ts',
      '?? README.md',
      'R  src/old-name.ts -> src/new-name.ts',
    ].join('\n');

    expect(parsePorcelainPaths(status)).toEqual([
      'src/extension.ts',
      'src/new-file.ts',
      'README.md',
      'src/new-name.ts',
    ]);
  });
});

describe('parseLatestCommitOutput', () => {
  it('parses latest commit hash and authored timestamp from git output', () => {
    const parsed = parseLatestCommitOutput('abc123def4567890\t1710000000');

    expect(parsed).toEqual({
      hash: 'abc123def4567890',
      authoredAt: 1_710_000_000_000,
    });
  });

  it('accepts SHA-256 commit hashes from git log output', () => {
    const sha256Hash = '0123456789abcdef'.repeat(4);
    const parsed = parseLatestCommitOutput(`${sha256Hash}\t1710000000`);

    expect(parsed).toEqual({
      hash: sha256Hash,
      authoredAt: 1_710_000_000_000,
    });
  });

  it('returns undefined for malformed commit output', () => {
    expect(parseLatestCommitOutput('not-a-commit value')).toBeUndefined();
  });
});

describe('parseCommitHashToken', () => {
  it('extracts and normalizes a hash token from decorated commit lines', () => {
    expect(parseCommitHashToken('AbCdEf123 feat: parse summary')).toBe('abcdef123');
  });

  it('accepts full SHA-256 hashes', () => {
    const sha256Hash = '0123456789abcdef'.repeat(4);
    expect(parseCommitHashToken(sha256Hash)).toBe(sha256Hash);
  });

  it('returns undefined for invalid hash tokens', () => {
    expect(parseCommitHashToken(undefined)).toBeUndefined();
    expect(parseCommitHashToken('abc12')).toBeUndefined();
    expect(parseCommitHashToken('not-a-hash value')).toBeUndefined();
  });
});

describe('parseTrackingDivergence', () => {
  it('parses behind/ahead counts from rev-list output', () => {
    expect(parseTrackingDivergence('2\t5')).toEqual({
      ahead: 5,
      behind: 2,
    });
  });

  it('returns undefined when output is empty or malformed', () => {
    expect(parseTrackingDivergence('')).toBeUndefined();
    expect(parseTrackingDivergence('missing counts')).toBeUndefined();
  });
});
