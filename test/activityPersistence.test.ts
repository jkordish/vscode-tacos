import { sanitizeActivityForPersistence } from '../src/activityPersistence';

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
});
