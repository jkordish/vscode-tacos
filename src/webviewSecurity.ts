export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildWebviewCsp(cspSource: string, nonce: string): string {
  // Escape both dynamic values so that a stray `"` or `>` cannot break the
  // surrounding `content="…"` HTML attribute or terminate the meta tag early.
  const safeCspSource = escapeHtml(cspSource);
  const safeNonce = escapeHtml(nonce);
  return [
    "default-src 'none'",
    `script-src 'nonce-${safeNonce}'`,
    `style-src 'nonce-${safeNonce}'`,
    `img-src ${safeCspSource} https:`,
    "connect-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function buildWebviewCspMetaTag(cspSource: string, nonce: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(cspSource, nonce)}" />`;
}
