import {
  persistTerminalCommandForStorage,
  sanitizeActivityForPersistence,
} from '../src/activityPersistence';

describe('sanitizeActivityForPersistence', () => {
  it('redacts activity fields before persistence', () => {
    const rawTerminalCommand = 'npm run deploy --token=super-secret-token-value';
    const sanitized = sanitizeActivityForPersistence(
      {
        recentFiles: ['/workspace/repo/src/extension.ts'],
        recentTerminal: [rawTerminalCommand],
        recentDebug: ['node: Launch Extension'],
        recentUrls: ['https://example.com/docs'],
        doneItems: ['npm test --apiKey=super-secret-token-value'],
        lastFailingCommand: 'curl -H "Authorization: Bearer abcdefghijklmnop" https://example.com',
      },
      '/workspace/repo',
    );

    expect(sanitized.recentFiles[0]).toContain('<workspace>');
    expect(sanitized.recentTerminal[0]).toContain('terminal:');
    expect(sanitized.recentTerminal[0]).not.toContain(rawTerminalCommand);
    expect(sanitized.recentTerminal[0]).not.toContain('super-secret-token-value');
    expect(sanitized.doneItems[0]).toContain('terminal:');
    expect(sanitized.lastFailingCommand).toContain('terminal:');
    expect(sanitized.lastFailingCommand).not.toContain('abcdefghijklmnop');
    expect(sanitized.lastFailingCommand).not.toContain('super-secret-token-value');
  });

  it('keeps already-persisted terminal tokens stable (idempotent)', () => {
    const persistedTerminal = 'terminal:npm_test#1a2b3c4d5e6f';
    const persistedDone = 'terminal:pnpm_build#abcdef123456';
    const persistedFailure = 'terminal:jest#0123456789ab';

    const sanitized = sanitizeActivityForPersistence(
      {
        recentFiles: ['/workspace/repo/src/index.ts'],
        recentTerminal: [persistedTerminal],
        recentDebug: [],
        recentUrls: [],
        doneItems: [persistedDone],
        lastFailingCommand: persistedFailure,
      },
      '/workspace/repo',
    );

    expect(sanitized.recentTerminal).toEqual([persistedTerminal]);
    expect(sanitized.doneItems).toEqual([persistedDone]);
    expect(sanitized.lastFailingCommand).toBe(persistedFailure);
  });
});

describe('persistTerminalCommandForStorage', () => {
  it('returns pre-persisted tokens unchanged', () => {
    const token = 'terminal:npm_test#1a2b3c4d5e6f';
    expect(persistTerminalCommandForStorage(token, '/workspace')).toBe(token);
    expect(persistTerminalCommandForStorage('terminal:empty', '/workspace')).toBe('terminal:empty');
  });
});
