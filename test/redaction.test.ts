import * as os from 'node:os';
import {
  MAX_CUSTOM_REDACTION_PATTERNS,
  MAX_CUSTOM_REDACTION_PATTERN_LENGTH,
  redactText,
  redactTextWithReport,
  validateCustomRedactionPatterns,
} from '../src/redaction';

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

describe('redactTextWithReport', () => {
  it('returns category counts, totals, and high-risk detection', () => {
    const workspace = '/tmp/workspace';
    const input = [
      'apiKey=super-secret-token-value',
      'Authorization: Bearer abcdefghijklmnop',
      'Path: /tmp/workspace/src/index.ts',
      `Home: ${os.homedir()}/.ssh/id_rsa`,
      '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    ].join('\n');

    const result = redactTextWithReport(input, workspace);

    expect(result.text).toContain('<redacted>');
    expect(result.text).toContain('<workspace>');
    expect(result.text).toContain('<home>');
    expect(result.report.highRiskDetected).toBe(true);
    expect(result.report.totalReplacements).toBeGreaterThan(0);
    expect(result.report.totalCharsReplaced).toBeGreaterThan(0);
    expect(result.report.categoryCounts.generic_secret_assignment).toBeGreaterThan(0);
    expect(result.report.categoryCounts.bearer_header).toBeGreaterThan(0);
    expect(result.report.categoryCounts.private_key_block).toBeGreaterThan(0);
    expect(result.report.categoryCounts.workspace_path).toBeGreaterThan(0);
    expect(result.report.categoryCounts.home_path).toBeGreaterThan(0);
  });

  it('uses strict ai-send replacement strategy for private key blocks', () => {
    const input = [
      'before',
      '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      'after',
    ].join('\n');

    const storage = redactTextWithReport(input, '/workspace', [], { mode: 'storage' });
    const aiSend = redactTextWithReport(input, '/workspace', [], { mode: 'ai-send' });

    expect(storage.text).toContain('<redacted>');
    expect(aiSend.text).not.toContain('BEGIN PRIVATE KEY');
    expect(aiSend.text).not.toContain('<redacted>');
    expect(aiSend.report.highRiskDetected).toBe(true);
  });

  it('keeps wrapper compatibility with redactText default output', () => {
    const input = 'token=super-secret-token-value';
    const fromWrapper = redactText(input, '/workspace');
    const fromV2 = redactTextWithReport(input, '/workspace').text;
    expect(fromWrapper).toBe(fromV2);
  });

  it('applies custom pattern guardrails and reports validation stats', () => {
    const patterns = [
      'ABC-\\d+',
      '[bad',
      '   ',
      'a'.repeat(MAX_CUSTOM_REDACTION_PATTERN_LENGTH + 1),
      ...Array.from(
        { length: MAX_CUSTOM_REDACTION_PATTERNS + 1 },
        (_, index) => `\\bPATTERN_${index}\\b`,
      ),
    ];

    const result = redactTextWithReport('ABC-123 PATTERN_0 PATTERN_50', '/workspace', patterns);

    expect(result.text).toContain('<redacted>');
    expect(result.text).not.toContain('ABC-123');
    expect(result.text).not.toContain('PATTERN_0');
    expect(result.text).toContain('PATTERN_50');
    expect(result.report.customPatternValidation).toEqual({
      provided: MAX_CUSTOM_REDACTION_PATTERNS + 5,
      accepted: MAX_CUSTOM_REDACTION_PATTERNS,
      invalid: 2,
      tooLong: 1,
      overLimit: 2,
    });
  });
});

describe('validateCustomRedactionPatterns', () => {
  it('returns bounded pattern validation metadata', () => {
    const validation = validateCustomRedactionPatterns(['ok', '[invalid', '']);
    expect(validation).toEqual({
      provided: 3,
      accepted: 1,
      invalid: 2,
      tooLong: 0,
      overLimit: 0,
    });
  });
});
