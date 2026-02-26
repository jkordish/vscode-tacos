import { buildWebviewCsp, buildWebviewCspMetaTag, escapeHtml } from '../src/webviewSecurity';

describe('webviewSecurity', () => {
  it('escapes all HTML-significant characters', () => {
    const value = `& < > " '`;
    expect(escapeHtml(value)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('prevents summary content from injecting html tags', () => {
    const escaped = escapeHtml('intent <script>alert(1)</script> <b>bold</b>');
    expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaped).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<b>');
  });

  it('builds strict csp directives with nonce for scripts/styles', () => {
    const csp = buildWebviewCsp('vscode-webview://test', 'nonce123');

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-nonce123'");
    expect(csp).toContain("style-src 'nonce-nonce123'");
    expect(csp).toContain('img-src vscode-webview://test https:');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it('renders a csp meta tag string containing nonce directives', () => {
    const metaTag = buildWebviewCspMetaTag('vscode-webview://abc', 'xyz');

    expect(metaTag).toContain('<meta');
    expect(metaTag).toContain('Content-Security-Policy');
    expect(metaTag).toContain("script-src 'nonce-xyz'");
  });
});
