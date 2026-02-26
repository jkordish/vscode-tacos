import * as path from 'node:path';
import { isPathWithinWorkspaceRoot, normalizeHttpUrl, resolveFileTargetInWorkspace } from '../src/pathSafety';

describe('pathSafety', () => {
  it('allows only http/https URLs', () => {
    expect(normalizeHttpUrl('https://example.com/pr/1')).toBe('https://example.com/pr/1');
    expect(normalizeHttpUrl('http://example.com/docs')).toBe('http://example.com/docs');
    expect(normalizeHttpUrl('command:workbench.action.openSettings')).toBeUndefined();
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeHttpUrl('file:///tmp/secret')).toBeUndefined();
    expect(normalizeHttpUrl('vscode://file/c:/repo')).toBeUndefined();
    expect(normalizeHttpUrl('data:text/plain,hello')).toBeUndefined();
  });

  it('resolves file targets only when they stay in the workspace root', () => {
    const root = '/workspace/repo';
    expect(resolveFileTargetInWorkspace('src/extension.ts', root)).toBe(path.resolve(root, 'src/extension.ts'));
    expect(resolveFileTargetInWorkspace('../secret.env', root)).toBeUndefined();
    expect(resolveFileTargetInWorkspace('/etc/passwd', root)).toBeUndefined();
  });

  it('allows absolute paths only when they remain in the workspace root', () => {
    const root = '/workspace/repo';
    expect(resolveFileTargetInWorkspace('/workspace/repo/src/index.ts', root)).toBe('/workspace/repo/src/index.ts');
    expect(resolveFileTargetInWorkspace('/workspace/other/index.ts', root)).toBeUndefined();
  });

  it('handles Windows-style case-insensitive workspace containment', () => {
    const root = 'C:\\Repo';
    const inside = 'c:\\repo\\src\\file.ts';
    const outside = 'c:\\other\\file.ts';

    expect(
      isPathWithinWorkspaceRoot(root, inside, {
        pathApi: path.win32,
        platform: 'win32',
      })
    ).toBe(true);
    expect(
      isPathWithinWorkspaceRoot(root, outside, {
        pathApi: path.win32,
        platform: 'win32',
      })
    ).toBe(false);
  });
});
