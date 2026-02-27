import {
  scratchpadFileNameForScope,
  scratchpadScopeHash,
  workspaceScratchpadRootSegments,
  workspaceScratchpadStorageHash,
} from '../src/scratchpadStorage';

describe('scratchpad storage helpers', () => {
  it('produces stable per-workspace storage hashes', () => {
    const first = workspaceScratchpadStorageHash('/workspace/repo-a');
    const second = workspaceScratchpadStorageHash('/workspace/repo-a');
    const other = workspaceScratchpadStorageHash('/workspace/repo-b');

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toHaveLength(16);
  });

  it('builds root segments without leaking workspace path text', () => {
    const workspaceRoot = '/Users/example/private/project';
    const segments = workspaceScratchpadRootSegments(workspaceRoot);

    expect(segments[0]).toBe('workspaces');
    expect(segments[1]).toHaveLength(16);
    expect(segments.join('/')).not.toContain(workspaceRoot);
  });

  it('derives deterministic scope hashes and filenames', () => {
    const scope = '/workspace/repo::feature/x::ABC-123';
    const hash = scratchpadScopeHash(scope);
    const filename = scratchpadFileNameForScope(scope);

    expect(hash).toHaveLength(24);
    expect(filename).toBe(`${hash}.md`);
    expect(filename).not.toContain('/workspace/repo');
  });
});
