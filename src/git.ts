import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExtensionConfig, GitSnapshot } from './types';

const execFileAsync = promisify(execFile);
const GIT_CACHE_TTL_MS = 20_000;
const GIT_COMMAND_TIMEOUT_MS = 2_000;

interface GitCacheEntry {
  snapshot: GitSnapshot;
  fetchedAt: number;
  inFlight?: Promise<GitSnapshot>;
}

const gitSnapshotCache = new Map<string, GitCacheEntry>();

function emptySnapshot(): GitSnapshot {
  return {
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
}

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: GIT_COMMAND_TIMEOUT_MS,
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
  const cacheKey = `${root}|diff:${config.includeDiff ? '1' : '0'}|max:${config.maxDiffChars}`;
  const cached = gitSnapshotCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < GIT_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  if (cached?.inFlight) {
    return cached.snapshot;
  }

  if (cached) {
    cached.inFlight = collectGitUncached(root, config)
      .then((freshSnapshot) => {
        gitSnapshotCache.set(cacheKey, {
          snapshot: freshSnapshot,
          fetchedAt: Date.now(),
        });
        return freshSnapshot;
      })
      .catch(() => {
        gitSnapshotCache.set(cacheKey, {
          snapshot: cached.snapshot,
          fetchedAt: cached.fetchedAt,
        });
        return cached.snapshot;
      });
    gitSnapshotCache.set(cacheKey, cached);
    return cached.snapshot;
  }

  const initial = await collectGitUncached(root, config);
  gitSnapshotCache.set(cacheKey, {
    snapshot: initial,
    fetchedAt: Date.now(),
  });
  return initial;
}

async function collectGitUncached(root: string, config: ExtensionConfig): Promise<GitSnapshot> {
  const snapshot = emptySnapshot();

  try {
    snapshot.branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    snapshot.isRepo = true;
  } catch {
    return snapshot;
  }

  const [status, diffStat, log, diff] = await Promise.all([
    runGit(root, ['status', '--porcelain=v1', '-uall']).catch(() => ''),
    runGit(root, ['diff', '--stat']).catch(() => ''),
    runGit(root, ['log', '-n', '6', '--oneline', '--decorate']).catch(() => ''),
    config.includeDiff && config.maxDiffChars > 0
      ? runGit(root, ['diff', '--unified=0', '--no-color']).catch(() => '')
      : Promise.resolve(''),
  ]);

  snapshot.status = status;
  snapshot.hasUncommitted = snapshot.status.trim().length > 0;
  snapshot.hasConflicts = detectConflicts(snapshot.status);
  snapshot.diffStat = diffStat;
  snapshot.changedFiles = parseDiffStatFiles(snapshot.diffStat);
  snapshot.log = log;
  if (diff) {
    snapshot.diff =
      diff.length > config.maxDiffChars
        ? `${diff.slice(0, config.maxDiffChars)}\n…(truncated)…`
        : diff;
  }

  return snapshot;
}
