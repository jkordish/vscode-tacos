import * as os from 'node:os';

export type RedactionMode = 'storage' | 'ai-send';

export interface RedactionReport {
  categoryCounts: Record<string, number>;
  totalReplacements: number;
  totalCharsReplaced: number;
  highRiskDetected: boolean;
  customPatternValidation: CustomPatternValidation;
}

export interface RedactTextOptions {
  mode?: RedactionMode;
  replacement?: string;
}

export interface RedactionResult {
  text: string;
  report: RedactionReport;
}

export interface CustomPatternValidation {
  provided: number;
  accepted: number;
  invalid: number;
  tooLong: number;
  overLimit: number;
}

interface RedactionDetector {
  category: string;
  pattern: RegExp;
  highRisk?: boolean;
  aiSendReplacement?: string;
}

const DEFAULT_REPLACEMENT = '<redacted>';
const HOME_TOKEN = '<home>';
const WORKSPACE_TOKEN = '<workspace>';
const PATH_TOKEN = '<path>';
export const MAX_CUSTOM_REDACTION_PATTERNS = 50;
export const MAX_CUSTOM_REDACTION_PATTERN_LENGTH = 500;

const SECRET_DETECTORS: RedactionDetector[] = [
  {
    category: 'private_key_block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    highRisk: true,
    aiSendReplacement: '',
  },
  { category: 'aws_access_key_id', pattern: /\bAKIA[0-9A-Z]{16}\b/g, highRisk: true },
  { category: 'aws_session_key_id', pattern: /\bASIA[0-9A-Z]{16}\b/g, highRisk: true },
  { category: 'openai_secret_key', pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, highRisk: true },
  {
    category: 'stripe_key',
    pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    highRisk: true,
  },
  {
    category: 'github_pat',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi,
    highRisk: true,
  },
  {
    category: 'github_token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gi,
    highRisk: true,
  },
  {
    category: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g,
    highRisk: true,
  },
  {
    category: 'url_token_param',
    // Use a named group to preserve the parameter prefix (e.g. `?token=`) in the
    // output and only replace the sensitive value portion. Without this the
    // replacement would swallow the `?key=` prefix, breaking URL structure and
    // over-counting chars replaced.
    pattern: /(?<prefix>[?&](?:api[_-]?key|token|access[_-]?token|key)=)[^&\s]+/gi,
    highRisk: true,
  },
  {
    category: 'bearer_header',
    pattern: /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/gi,
    highRisk: true,
  },
  {
    category: 'generic_secret_assignment',
    pattern: /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9._\-+/=]{8,}['"]?/gi,
    highRisk: true,
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withGlobalFlags(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

interface CompiledUserPatterns {
  detectors: RedactionDetector[];
  validation: CustomPatternValidation;
}

function createCustomPatternValidation(provided: number): CustomPatternValidation {
  return {
    provided,
    accepted: 0,
    invalid: 0,
    tooLong: 0,
    overLimit: 0,
  };
}

function compileUserPatterns(patterns: string[]): CompiledUserPatterns {
  const compiled: RedactionDetector[] = [];
  const validation = createCustomPatternValidation(patterns.length);
  for (const raw of patterns) {
    if (validation.accepted >= MAX_CUSTOM_REDACTION_PATTERNS) {
      validation.overLimit += 1;
      continue;
    }

    const normalized = raw.trim();
    if (!normalized) {
      validation.invalid += 1;
      continue;
    }

    if (normalized.length > MAX_CUSTOM_REDACTION_PATTERN_LENGTH) {
      validation.tooLong += 1;
      continue;
    }

    try {
      compiled.push({
        category: 'custom_pattern',
        pattern: new RegExp(normalized, 'gi'),
        highRisk: true,
      });
      validation.accepted += 1;
    } catch {
      validation.invalid += 1;
    }
  }
  return {
    detectors: compiled,
    validation,
  };
}

export function validateCustomRedactionPatterns(patterns: string[]): CustomPatternValidation {
  return compileUserPatterns(patterns).validation;
}

function createBaseReport(): RedactionReport {
  return {
    categoryCounts: {},
    totalReplacements: 0,
    totalCharsReplaced: 0,
    highRiskDetected: false,
    customPatternValidation: createCustomPatternValidation(0),
  };
}

export function createEmptyRedactionReport(): RedactionReport {
  return createBaseReport();
}

function trackMatch(report: RedactionReport, category: string, matchedChars: number): void {
  report.categoryCounts[category] = (report.categoryCounts[category] ?? 0) + 1;
  report.totalReplacements += 1;
  report.totalCharsReplaced += matchedChars;
}

function applyDetector(
  input: string,
  detector: RedactionDetector,
  replacement: string,
  mode: RedactionMode,
  report: RedactionReport,
): string {
  const effectiveReplacement =
    mode === 'ai-send' && detector.aiSendReplacement !== undefined
      ? detector.aiSendReplacement
      : replacement;

  const pattern = withGlobalFlags(detector.pattern);
  return input.replace(pattern, (matched: string, ...args: unknown[]) => {
    // If the pattern uses a named capture group `prefix`, preserve it and only
    // count/replace the non-prefix portion so that URL structure is maintained
    // and `totalCharsReplaced` reflects only the sensitive value chars.
    const groups = args[args.length - 1] as Record<string, string> | null | undefined;
    const prefix = groups?.prefix ?? '';
    const sensitiveChars = matched.length - prefix.length;
    trackMatch(report, detector.category, Math.max(0, sensitiveChars));
    if (detector.highRisk) {
      report.highRiskDetected = true;
    }
    return `${prefix}${effectiveReplacement}`;
  });
}

function applyLiteralReplacement(
  input: string,
  literal: string,
  token: string,
  category: string,
  report: RedactionReport,
): string {
  if (!literal) {
    return input;
  }

  return input.replace(new RegExp(escapeRegex(literal), 'g'), (matched) => {
    trackMatch(report, category, matched.length);
    return token;
  });
}

function applyPathCollapse(input: string, report: RedactionReport): string {
  return input.replace(/\b(?:\/[A-Za-z0-9._-]+){4,}\b/g, (matched) => {
    trackMatch(report, 'long_path_fragment', matched.length);
    return PATH_TOKEN;
  });
}

export function redactTextWithReport(
  input: string,
  workspaceRoot: string,
  customPatterns: string[] = [],
  options: RedactTextOptions = {},
): RedactionResult {
  if (!input) {
    return { text: input, report: createBaseReport() };
  }

  const mode = options.mode ?? 'storage';
  const replacement = options.replacement ?? DEFAULT_REPLACEMENT;
  const report = createBaseReport();
  let result = input;

  for (const detector of SECRET_DETECTORS) {
    result = applyDetector(result, detector, replacement, mode, report);
  }

  const compiledUserPatterns = compileUserPatterns(customPatterns);
  report.customPatternValidation = compiledUserPatterns.validation;
  for (const detector of compiledUserPatterns.detectors) {
    result = applyDetector(result, detector, replacement, mode, report);
  }

  const home = os.homedir();
  result = applyLiteralReplacement(result, home, HOME_TOKEN, 'home_path', report);
  result = applyLiteralReplacement(
    result,
    workspaceRoot,
    WORKSPACE_TOKEN,
    'workspace_path',
    report,
  );
  result = applyPathCollapse(result, report);

  return { text: result, report };
}

export function redactText(
  input: string,
  workspaceRoot: string,
  customPatterns: string[] = [],
): string {
  return redactTextWithReport(input, workspaceRoot, customPatterns).text;
}

export function redactList(
  values: string[],
  workspaceRoot: string,
  customPatterns: string[] = [],
): string[] {
  return values.map((value) => redactText(value, workspaceRoot, customPatterns));
}
