import * as path from 'node:path';
import { URL } from 'node:url';

type PathApi = Pick<typeof path, 'resolve' | 'relative' | 'isAbsolute'>;

interface PathSafetyOptions {
  pathApi?: PathApi;
  platform?: NodeJS.Platform;
}

const URI_SCHEME_PREFIX = /^[A-Za-z][A-Za-z\d+.-]*:/;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:[\\/]/;

function normalizeComparablePath(value: string, platform: NodeJS.Platform): string {
  if (platform !== 'win32') {
    return value;
  }

  const normalizedSeparators = value.replace(/\//g, '\\');
  return normalizedSeparators.replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
}

function hasUriScheme(value: string): boolean {
  return URI_SCHEME_PREFIX.test(value) && !WINDOWS_DRIVE_PREFIX.test(value);
}

export function normalizeHttpUrl(rawTarget: string): string | undefined {
  try {
    const parsed = new URL(rawTarget);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isPathWithinWorkspaceRoot(
  workspaceRoot: string,
  candidatePath: string,
  options: PathSafetyOptions = {}
): boolean {
  if (!workspaceRoot) {
    return false;
  }

  const pathApi = options.pathApi ?? path;
  const platform = options.platform ?? process.platform;
  const root = normalizeComparablePath(pathApi.resolve(workspaceRoot), platform);
  const candidate = normalizeComparablePath(pathApi.resolve(candidatePath), platform);
  const relative = normalizeComparablePath(pathApi.relative(root, candidate), platform);

  if (!relative || relative === '.') {
    return true;
  }

  if (relative === '..' || relative.startsWith('..\\') || relative.startsWith('../')) {
    return false;
  }

  return !pathApi.isAbsolute(relative);
}

export function resolveFileTargetInWorkspace(
  rawTarget: string,
  workspaceRoot: string,
  options: PathSafetyOptions = {}
): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const trimmed = rawTarget.trim();
  if (!trimmed || hasUriScheme(trimmed)) {
    return undefined;
  }

  const pathApi = options.pathApi ?? path;
  const candidate = pathApi.isAbsolute(trimmed)
    ? pathApi.resolve(trimmed)
    : pathApi.resolve(workspaceRoot, trimmed);

  if (!isPathWithinWorkspaceRoot(workspaceRoot, candidate, options)) {
    return undefined;
  }

  return candidate;
}

export function inferUntrustedLinkKind(target: string): 'file' | 'url' {
  return hasUriScheme(target) ? 'url' : 'file';
}
