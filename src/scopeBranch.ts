import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

const DEFAULT_SCOPE_BRANCH = 'default';

export function readBranchFromGitHead(workspaceRoot: string): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const gitEntry = path.join(workspaceRoot, '.git');
  if (!existsSync(gitEntry)) {
    return undefined;
  }

  try {
    let gitDir = gitEntry;
    const gitEntryStat = statSync(gitEntry);
    if (gitEntryStat.isFile()) {
      const pointer = readFileSync(gitEntry, 'utf8').trim();
      const match = pointer.match(/^gitdir:\s*(.+)$/i);
      if (!match?.[1]) {
        return undefined;
      }
      gitDir = path.resolve(workspaceRoot, match[1].trim());
    }

    const headPath = path.join(gitDir, 'HEAD');
    if (!existsSync(headPath)) {
      return undefined;
    }

    const head = readFileSync(headPath, 'utf8').trim();
    const branchRef = head.match(/^ref:\s*refs\/heads\/(.+)$/i);
    if (!branchRef?.[1]) {
      return undefined;
    }

    const branch = branchRef[1].trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

export function resolveScopeBranch(input: {
  workspaceRoot: string;
  persistedBranch?: string;
}): string {
  const liveBranch = readBranchFromGitHead(input.workspaceRoot);
  if (liveBranch) {
    return liveBranch;
  }

  const persisted = input.persistedBranch?.trim();
  return persisted || DEFAULT_SCOPE_BRANCH;
}
