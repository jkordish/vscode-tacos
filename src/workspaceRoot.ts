import * as path from 'node:path';

interface ChooseWorkspaceRootInput {
  workspaceRoots: string[];
  preferredWorkspaceRoot?: string;
  activeWorkspaceRoot?: string;
  runtimeWorkspaceHints?: Array<string | undefined>;
  pathApi?: Pick<typeof path, 'normalize'>;
}

function normalizeRoot(
  value: string | undefined,
  pathApi: Pick<typeof path, 'normalize'>,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return pathApi.normalize(trimmed);
}

function resolveKnownRoot(
  rootsByNormalized: Map<string, string>,
  candidate: string | undefined,
  pathApi: Pick<typeof path, 'normalize'>,
): string | undefined {
  const normalized = normalizeRoot(candidate, pathApi);
  if (!normalized) {
    return undefined;
  }

  return rootsByNormalized.get(normalized);
}

export function chooseWorkspaceRoot(input: ChooseWorkspaceRootInput): string | undefined {
  const pathApi = input.pathApi ?? path;
  const rootsByNormalized = new Map<string, string>();
  for (const root of input.workspaceRoots) {
    const normalized = normalizeRoot(root, pathApi);
    if (!normalized || rootsByNormalized.has(normalized)) {
      continue;
    }

    rootsByNormalized.set(normalized, root);
  }

  if (rootsByNormalized.size === 0) {
    return undefined;
  }

  const preferred = resolveKnownRoot(rootsByNormalized, input.preferredWorkspaceRoot, pathApi);
  if (preferred) {
    return preferred;
  }

  const active = resolveKnownRoot(rootsByNormalized, input.activeWorkspaceRoot, pathApi);
  if (active) {
    return active;
  }

  for (const hint of input.runtimeWorkspaceHints ?? []) {
    const runtime = resolveKnownRoot(rootsByNormalized, hint, pathApi);
    if (runtime) {
      return runtime;
    }
  }

  return rootsByNormalized.values().next().value;
}
