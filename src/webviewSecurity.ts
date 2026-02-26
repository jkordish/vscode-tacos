export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildWebviewCsp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    `img-src ${cspSource} https:`,
    "connect-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function buildWebviewCspMetaTag(cspSource: string, nonce: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(cspSource, nonce)}" />`;
}
