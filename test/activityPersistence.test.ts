import { sanitizeActivityForPersistence } from '../src/activityPersistence';

describe('sanitizeActivityForPersistence', () => {
  it('redacts activity fields before persistence', () => {
    const sanitized = sanitizeActivityForPersistence(
      {
        recentFiles: ['/workspace/repo/src/extension.ts'],
        recentTerminal: ['npm run deploy --token=super-secret-token-value'],
        recentDebug: ['node: Launch Extension'],
        recentUrls: ['https://example.com/docs'],
        doneItems: ['npm test --apiKey=super-secret-token-value'],
        lastFailingCommand: 'curl -H "Authorization: Bearer abcdefghijklmnop" https://example.com',
      },
      '/workspace/repo'
    );

    expect(sanitized.recentFiles[0]).toContain('<workspace>');
    expect(sanitized.recentTerminal[0]).toContain('<redacted>');
    expect(sanitized.doneItems[0]).toContain('<redacted>');
    expect(sanitized.lastFailingCommand).toContain('<redacted>');
    expect(sanitized.lastFailingCommand).not.toContain('abcdefghijklmnop');
    expect(sanitized.lastFailingCommand).not.toContain('super-secret-token-value');
  });
});
