import * as os from 'node:os';

const DEFAULT_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g,
  /([?&](?:api[_-]?key|token|access[_-]?token|key)=)[^&\s]+/gi,
  /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/gi,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9._\-+/=]{8,}['"]?/gi,
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileUserPatterns(patterns: string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const raw of patterns) {
    try {
      compiled.push(new RegExp(raw, 'gi'));
    } catch {
      // Ignore invalid custom regex patterns.
    }
  }
  return compiled;
}

export function redactText(
  input: string,
  workspaceRoot: string,
  customPatterns: string[] = [],
): string {
  if (!input) {
    return input;
  }

  let result = input;

  for (const pattern of DEFAULT_PATTERNS) {
    result = result.replace(pattern, '<redacted>');
  }

  for (const pattern of compileUserPatterns(customPatterns)) {
    result = result.replace(pattern, '<redacted>');
  }

  const home = os.homedir();
  if (home) {
    result = result.replace(new RegExp(escapeRegex(home), 'g'), '<home>');
  }

  if (workspaceRoot) {
    result = result.replace(new RegExp(escapeRegex(workspaceRoot), 'g'), '<workspace>');
  }

  // Collapse accidentally leaked long path-like fragments to keep summaries tidy.
  result = result.replace(/\b(?:\/[A-Za-z0-9._-]+){4,}\b/g, '<path>');

  return result;
}

export function redactList(
  values: string[],
  workspaceRoot: string,
  customPatterns: string[] = [],
): string[] {
  return values.map((value) => redactText(value, workspaceRoot, customPatterns));
}
