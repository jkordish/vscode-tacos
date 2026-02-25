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
});
