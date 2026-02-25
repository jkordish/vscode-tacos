import { parseDiffStatFiles, parsePorcelainPaths } from '../src/git';

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
