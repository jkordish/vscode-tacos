import * as os from 'node:os';
import { redactText } from '../src/redaction';

describe('redactText', () => {
  it('redacts common secrets and workspace paths', () => {
    const workspace = '/tmp/workspace';
    const input = [
      'apiKey=super-secret-token-value',
      'Authorization: Bearer abcdefghijklmnop',
      'Path: /tmp/workspace/src/index.ts',
      `Home: ${os.homedir()}/.ssh/id_rsa`,
    ].join('\n');

    const output = redactText(input, workspace);

    expect(output).toContain('<redacted>');
    expect(output).not.toContain('super-secret-token-value');
    expect(output).not.toContain('abcdefghijklmnop');
    expect(output).not.toContain('/tmp/workspace');
    expect(output).toContain('<workspace>');
    expect(output).toContain('<home>');
  });

  it('supports custom regex patterns', () => {
    const output = redactText('ticket=ABC-123', '/workspace', ['ABC-\\d+']);
    expect(output).toContain('<redacted>');
    expect(output).not.toContain('ABC-123');
  });

  it('redacts common cloud/token/private-key patterns', () => {
    const output = redactText(
      [
        'AKIA1234567890ABCDEF',
        'sk-abcdefghijklmnopqrstuvwxyz1234567890',
        'github_pat_abcdefghijklmnopqrstuvwxyz1234567890',
        'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
        'jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.signedpayloadsegment1234567890',
        'https://example.com/callback?access_token=super-secret-token&foo=bar',
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      ].join('\n'),
      '/workspace',
    );

    expect(output).toContain('<redacted>');
    expect(output).not.toContain('AKIA1234567890ABCDEF');
    expect(output).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890');
    expect(output).not.toContain('github_pat_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(output).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(output).not.toContain('access_token=super-secret-token');
    expect(output).not.toContain('BEGIN PRIVATE KEY');
  });
});
