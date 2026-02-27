import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readBranchFromGitHead, resolveScopeBranch } from '../src/scopeBranch';

function withTempWorkspace(run: (workspaceRoot: string) => void): void {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'tacos-scope-'));
  try {
    run(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

describe('readBranchFromGitHead', () => {
  it('reads branch from .git/HEAD when .git is a directory', () => {
    withTempWorkspace((workspaceRoot) => {
      const gitDir = path.join(workspaceRoot, '.git');
      mkdirSync(gitDir, { recursive: true });
      writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feature/ABC-123-test\n');

      expect(readBranchFromGitHead(workspaceRoot)).toBe('feature/ABC-123-test');
    });
  });

  it('reads branch from gitdir pointers when .git is a file', () => {
    withTempWorkspace((workspaceRoot) => {
      writeFileSync(path.join(workspaceRoot, '.git'), 'gitdir: .git-data\n');
      const gitDataDir = path.join(workspaceRoot, '.git-data');
      mkdirSync(gitDataDir, { recursive: true });
      writeFileSync(path.join(gitDataDir, 'HEAD'), 'ref: refs/heads/fix/#72-scope\n');

      expect(readBranchFromGitHead(workspaceRoot)).toBe('fix/#72-scope');
    });
  });

  it('returns undefined for detached HEAD values', () => {
    withTempWorkspace((workspaceRoot) => {
      const gitDir = path.join(workspaceRoot, '.git');
      mkdirSync(gitDir, { recursive: true });
      writeFileSync(path.join(gitDir, 'HEAD'), 'd34db33fd34db33fd34db33fd34db33fd34db33f\n');

      expect(readBranchFromGitHead(workspaceRoot)).toBeUndefined();
    });
  });

  it('returns undefined for malformed gitdir pointers', () => {
    withTempWorkspace((workspaceRoot) => {
      writeFileSync(path.join(workspaceRoot, '.git'), 'not-a-git-pointer');

      expect(readBranchFromGitHead(workspaceRoot)).toBeUndefined();
    });
  });
});

describe('resolveScopeBranch', () => {
  it('uses persisted branch when no live git branch can be resolved', () => {
    withTempWorkspace((workspaceRoot) => {
      expect(
        resolveScopeBranch({
          workspaceRoot,
          persistedBranch: ' feature/persisted ',
        }),
      ).toBe('feature/persisted');
    });
  });

  it('falls back to default when live and persisted branches are unavailable', () => {
    withTempWorkspace((workspaceRoot) => {
      expect(
        resolveScopeBranch({
          workspaceRoot,
          persistedBranch: '   ',
        }),
      ).toBe('default');
    });
  });
});
