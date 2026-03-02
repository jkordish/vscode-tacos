import {
  parseDiffStatFiles,
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

  it('returns undefined for malformed commit output', () => {
    expect(parseLatestCommitOutput('not-a-commit value')).toBeUndefined();
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
