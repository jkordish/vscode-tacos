import { createHash } from 'node:crypto';

export const SCRATCHPAD_WORKSPACES_SEGMENT = 'workspaces';
export const SCRATCHPAD_FILES_SEGMENT = 'scratchpads';

export function workspaceScratchpadStorageHash(workspaceRoot: string): string {
  return createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 16);
}

export function workspaceScratchpadRootSegments(workspaceRoot: string): string[] {
  return [SCRATCHPAD_WORKSPACES_SEGMENT, workspaceScratchpadStorageHash(workspaceRoot)];
}

export function scratchpadScopeHash(scope: string): string {
  return createHash('sha256').update(scope).digest('hex').slice(0, 24);
}

export function scratchpadFileNameForScope(scope: string): string {
  return `${scratchpadScopeHash(scope)}.md`;
}
