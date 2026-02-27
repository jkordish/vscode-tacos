import * as path from 'node:path';
import { chooseWorkspaceRoot } from '../src/workspaceRoot';

describe('chooseWorkspaceRoot', () => {
  it('returns undefined when no workspace roots are present', () => {
    expect(chooseWorkspaceRoot({ workspaceRoots: [] })).toBeUndefined();
  });

  it('prefers explicit preferred workspace root when it exists', () => {
    expect(
      chooseWorkspaceRoot({
        workspaceRoots: ['/repo/a', '/repo/b'],
        preferredWorkspaceRoot: '/repo/b',
        activeWorkspaceRoot: '/repo/a',
      }),
    ).toBe('/repo/b');
  });

  it('uses active workspace root when preferred is missing', () => {
    expect(
      chooseWorkspaceRoot({
        workspaceRoots: ['/repo/a', '/repo/b'],
        activeWorkspaceRoot: '/repo/b',
      }),
    ).toBe('/repo/b');
  });

  it('falls back to runtime hints when active workspace root is unavailable', () => {
    expect(
      chooseWorkspaceRoot({
        workspaceRoots: ['/repo/a', '/repo/b'],
        runtimeWorkspaceHints: ['/repo/b', '/repo/a'],
      }),
    ).toBe('/repo/b');
  });

  it('falls back to first workspace root when candidates do not match', () => {
    expect(
      chooseWorkspaceRoot({
        workspaceRoots: ['/repo/a', '/repo/b'],
        preferredWorkspaceRoot: '/repo/c',
        activeWorkspaceRoot: '/repo/c',
        runtimeWorkspaceHints: ['/repo/c'],
      }),
    ).toBe('/repo/a');
  });

  it('normalizes root matching for Windows-style separators', () => {
    expect(
      chooseWorkspaceRoot({
        workspaceRoots: ['C:\\Repo\\a', 'C:\\Repo\\b'],
        preferredWorkspaceRoot: 'C:/Repo/b',
        pathApi: path.win32,
      }),
    ).toBe('C:\\Repo\\b');
  });
});
