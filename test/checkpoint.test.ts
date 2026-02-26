import { checkpointStorageKey, sanitizeCheckpointNote } from '../src/checkpoint';

describe('checkpoint helpers', () => {
  it('builds a workspace-scoped storage key', () => {
    const key = checkpointStorageKey('/workspace/repo');
    expect(key.startsWith('tacos.checkpointNote.')).toBe(true);
    expect(key).not.toContain('/workspace/repo');
  });

  it('produces different keys for different workspace roots', () => {
    const first = checkpointStorageKey('/workspace/repo-a');
    const second = checkpointStorageKey('/workspace/repo-b');

    expect(first).not.toEqual(second);
  });

  it('redacts secrets in checkpoint notes before persistence', () => {
    const sanitized = sanitizeCheckpointNote(
      'Deploy with token=super-secret-token-value from /workspace/repo',
      '/workspace/repo',
    );

    expect(sanitized).toContain('<redacted>');
    expect(sanitized).toContain('<workspace>');
    expect(sanitized).not.toContain('super-secret-token-value');
  });
});
