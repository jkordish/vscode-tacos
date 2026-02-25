import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExtensionConfig, GitSnapshot } from './types';

const execFileAsync = promisify(execFile);

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });

  return (stdout ?? '').toString().trimEnd();
}

export function parseDiffStatFiles(diffStat: string): string[] {
  return diffStat
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('|'))
    .map((line) => line.split('|')[0]?.trim())
    .filter((path): path is string => Boolean(path));
}

export function parsePorcelainPaths(statusOutput: string): string[] {
  return statusOutput
    .split(/\r?\n/)
    .map((line) => line.match(/^.. (.+)$/)?.[1]?.trim() ?? '')
    .filter(Boolean)
    .map((pathValue) => {
      const renameSeparator = ' -> ';
      if (!pathValue.includes(renameSeparator)) {
        return pathValue;
      }

      const renamedSegments = pathValue.split(renameSeparator);
      return renamedSegments[renamedSegments.length - 1]?.trim() ?? pathValue;
    });
}

function detectConflicts(statusOutput: string): boolean {
  return statusOutput.split(/\r?\n/).some((line) => /^(UU|AA|DD|AU|UA|DU|UD)\s/.test(line));
}

export async function collectGit(root: string, config: ExtensionConfig): Promise<GitSnapshot> {
  const snapshot: GitSnapshot = {
    isRepo: false,
    branch: '',
    status: '',
    diffStat: '',
    diff: '',
    log: '',
    changedFiles: [],
    hasUncommitted: false,
    hasConflicts: false,
  };

  try {
    snapshot.branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    snapshot.isRepo = true;
  } catch {
    return snapshot;
  }

  try {
    snapshot.status = await runGit(root, ['status', '--porcelain=v1', '-uall']);
    snapshot.hasUncommitted = snapshot.status.trim().length > 0;
    snapshot.hasConflicts = detectConflicts(snapshot.status);
  } catch {
    // Ignore optional command failures.
  }

  try {
    snapshot.diffStat = await runGit(root, ['diff', '--stat']);
    snapshot.changedFiles = parseDiffStatFiles(snapshot.diffStat);
  } catch {
    // Ignore optional command failures.
  }

  try {
    snapshot.log = await runGit(root, ['log', '-n', '6', '--oneline', '--decorate']);
  } catch {
    // Ignore optional command failures.
  }

  if (config.includeDiff && config.maxDiffChars > 0) {
    try {
      const rawDiff = await runGit(root, ['diff', '--unified=0', '--no-color']);
      snapshot.diff =
        rawDiff.length > config.maxDiffChars
          ? `${rawDiff.slice(0, config.maxDiffChars)}\n…(truncated)…`
          : rawDiff;
    } catch {
      // Ignore optional command failures.
    }
  }

  return snapshot;
}
