import * as path from 'node:path';

export type ResumeSafetyTrigger = 'focus' | 'manual' | 'startup';

export type ResumeSafetyMismatchCode =
  | 'none'
  | 'branch-changed'
  | 'package-drift'
  | 'focus-drift'
  | 'failing-command';

export type ResumeSafetyVerificationKind =
  | 'dismiss'
  | 'refreshSummary'
  | 'openFile'
  | 'jumpToLastEdit'
  | 'rerunTask'
  | 'openProblems';

export interface ResumeSafetyVerificationAction {
  kind: ResumeSafetyVerificationKind;
  label: string;
  target?: string;
  reason:
    | 'none'
    | 'branch-mismatch'
    | 'package-drift'
    | 'focus-drift'
    | 'failing-command'
    | 'summary-focus'
    | 'last-edit';
}

export interface ResumeSafetyMismatch {
  detected: boolean;
  strong: boolean;
  code: ResumeSafetyMismatchCode;
  detail?: string;
}

export interface ResumeSafetyProvenance {
  generatedAt: number;
  summaryContextHash: string;
  workspaceName?: string;
  branch?: string;
  activeEditorPath?: string;
  summaryFocusFile?: string;
  summaryFocusArea?: string;
  currentFocusArea?: string;
  recentFiles: string[];
  openFiles: string[];
  lastFailingCommand?: string;
}

export interface ResumeSafetyCheck {
  sharedState: string;
  staleAssumption: string;
  nextVerificationAction: ResumeSafetyVerificationAction;
  mismatch: ResumeSafetyMismatch;
  provenance: ResumeSafetyProvenance;
}

export interface PersistedResumeSafetyContext extends ResumeSafetyCheck {
  shownAt: number;
  trigger: ResumeSafetyTrigger;
}

export interface ResumeSafetyInput {
  summaryContextHash: string;
  workspaceName?: string;
  currentBranch?: string;
  summaryBranch?: string;
  summaryIntent?: string;
  activeEditorPath?: string;
  lastEditPath?: string;
  summaryFocusFile?: string;
  recentFiles?: string[];
  openFiles?: string[];
  lastFailingCommand?: string;
  canRerunTask?: boolean;
  canOpenProblems?: boolean;
  now?: number;
}

export interface ResumeSafetyEligibilityInput {
  trigger: ResumeSafetyTrigger;
  idleMinutes: number;
  resumeGapMinutes?: number;
}

export interface ResumeSafetyStrictWarningInput {
  enabled: boolean;
  isFirstAction: boolean;
  check?: ResumeSafetyCheck;
  actionKind: 'refreshSummary' | 'openFile' | 'rerunTask' | 'rerunDebug' | 'openProblems';
  actionTarget?: string;
}

export interface ResumeSafetyStrictWarningDecision {
  shouldWarn: boolean;
  message?: string;
}

const GENERIC_TOP_LEVEL_SEGMENTS = new Set([
  'src',
  'test',
  'tests',
  'docs',
  'dist',
  'scripts',
  'assets',
  '.github',
]);

function cleanText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function firstSentence(value: string | undefined, maxChars = 72): string {
  const cleaned = cleanText(value).replace(/\s+/gu, ' ');
  if (!cleaned) {
    return '';
  }
  const sentence = cleaned.split(/(?<=[.!?])\s+/u)[0] ?? cleaned;
  if (sentence.length <= maxChars) {
    return sentence;
  }
  return `${sentence.slice(0, maxChars - 1).trimEnd()}…`;
}

function humanizeFailingCommand(value: string | undefined): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.startsWith('terminal:')) {
    return 'A failing command was captured.';
  }
  return cleaned.length <= 72 ? cleaned : `${cleaned.slice(0, 71).trimEnd()}…`;
}

function inferFocusArea(filePath: string | undefined): string | undefined {
  const cleaned = cleanText(filePath);
  if (!cleaned) {
    return undefined;
  }
  const normalized = cleaned.replace(/\\/gu, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  if (
    (segments[0] === 'packages' ||
      segments[0] === 'apps' ||
      segments[0] === 'services' ||
      segments[0] === 'libs') &&
    segments[1]
  ) {
    return `${segments[0]}/${segments[1]}`;
  }
  if (!GENERIC_TOP_LEVEL_SEGMENTS.has(segments[0])) {
    return segments[0];
  }
  return undefined;
}

function basenameLabel(filePath: string | undefined): string | undefined {
  const cleaned = cleanText(filePath);
  if (!cleaned) {
    return undefined;
  }
  const base = path.posix.basename(cleaned.replace(/\\/gu, '/'));
  return base || cleaned;
}

function buildSharedState(input: ResumeSafetyInput): string {
  const parts: string[] = [];
  const intent = firstSentence(input.summaryIntent, 56);
  if (intent) {
    parts.push(intent);
  }
  const workspaceName = cleanText(input.workspaceName);
  const currentBranch = cleanText(input.currentBranch) || cleanText(input.summaryBranch);
  if (workspaceName && currentBranch) {
    parts.push(`${workspaceName} on ${currentBranch}`);
  } else if (currentBranch) {
    parts.push(`On ${currentBranch}`);
  } else if (workspaceName) {
    parts.push(workspaceName);
  }

  const focusPath =
    cleanText(input.activeEditorPath) ||
    cleanText(input.lastEditPath) ||
    cleanText(input.summaryFocusFile);
  if (focusPath) {
    parts.push(`Focus ${focusPath}`);
  }

  if (parts.length === 0) {
    return 'Workspace context captured.';
  }

  return parts.join('. ');
}

function buildFallbackVerificationAction(input: ResumeSafetyInput): ResumeSafetyVerificationAction {
  const summaryFocusFile = cleanText(input.summaryFocusFile);
  if (summaryFocusFile) {
    return {
      kind: 'openFile',
      label: `Open ${basenameLabel(summaryFocusFile) ?? summaryFocusFile}`,
      target: summaryFocusFile,
      reason: 'summary-focus',
    };
  }

  const lastEditPath = cleanText(input.lastEditPath);
  if (lastEditPath) {
    return {
      kind: 'jumpToLastEdit',
      label: `Jump to ${basenameLabel(lastEditPath) ?? lastEditPath}`,
      target: lastEditPath,
      reason: 'last-edit',
    };
  }

  return {
    kind: 'refreshSummary',
    label: 'Refresh summary',
    reason: 'none',
  };
}

function buildMismatchFromInput(input: ResumeSafetyInput): {
  mismatch: ResumeSafetyMismatch;
  staleAssumption: string;
  nextVerificationAction: ResumeSafetyVerificationAction;
} {
  const summaryBranch = cleanText(input.summaryBranch);
  const currentBranch = cleanText(input.currentBranch);
  const activeEditorPath = cleanText(input.activeEditorPath);
  const summaryFocusFile = cleanText(input.summaryFocusFile);
  const lastEditPath = cleanText(input.lastEditPath);
  const summaryFocusArea = inferFocusArea(summaryFocusFile);
  const currentFocusArea = inferFocusArea(activeEditorPath);

  if (summaryBranch && currentBranch && summaryBranch !== currentBranch) {
    return {
      mismatch: {
        detected: true,
        strong: true,
        code: 'branch-changed',
        detail: `Summary context was captured on ${summaryBranch}, but you are on ${currentBranch}.`,
      },
      staleAssumption: `Summary context was captured on ${summaryBranch}, but you are on ${currentBranch}.`,
      nextVerificationAction: {
        kind: 'refreshSummary',
        label: 'Refresh summary',
        reason: 'branch-mismatch',
      },
    };
  }

  if (summaryFocusArea && currentFocusArea && summaryFocusArea !== currentFocusArea) {
    return {
      mismatch: {
        detected: true,
        strong: true,
        code: 'package-drift',
        detail: `Current focus is in ${currentFocusArea}, while the resume context centered on ${summaryFocusArea}.`,
      },
      staleAssumption: `Current focus is in ${currentFocusArea}, while the resume context centered on ${summaryFocusArea}.`,
      nextVerificationAction: summaryFocusFile
        ? {
            kind: 'openFile',
            label: `Open ${basenameLabel(summaryFocusFile) ?? summaryFocusFile}`,
            target: summaryFocusFile,
            reason: 'package-drift',
          }
        : {
            kind: 'refreshSummary',
            label: 'Refresh summary',
            reason: 'package-drift',
          },
    };
  }

  if (activeEditorPath && summaryFocusFile && activeEditorPath !== summaryFocusFile) {
    return {
      mismatch: {
        detected: true,
        strong: false,
        code: 'focus-drift',
        detail: `Current editor is ${activeEditorPath}, but the last resume focus was ${summaryFocusFile}.`,
      },
      staleAssumption: `Current editor is ${activeEditorPath}, but the last resume focus was ${summaryFocusFile}.`,
      nextVerificationAction: {
        kind: 'openFile',
        label: `Open ${basenameLabel(summaryFocusFile) ?? summaryFocusFile}`,
        target: summaryFocusFile,
        reason: 'focus-drift',
      },
    };
  }

  if (cleanText(input.lastFailingCommand)) {
    if (input.canRerunTask) {
      return {
        mismatch: {
          detected: true,
          strong: false,
          code: 'failing-command',
          detail:
            'The last interruption was a failing command, so the current state may have drifted.',
        },
        staleAssumption:
          'The last interruption was a failing command, so the current state may have drifted.',
        nextVerificationAction: {
          kind: 'rerunTask',
          label: 'Rerun last task',
          reason: 'failing-command',
        },
      };
    }
    if (input.canOpenProblems) {
      return {
        mismatch: {
          detected: true,
          strong: false,
          code: 'failing-command',
          detail:
            'The last interruption was a failing command, so the current state may have drifted.',
        },
        staleAssumption:
          'The last interruption was a failing command, so the current state may have drifted.',
        nextVerificationAction: {
          kind: 'openProblems',
          label: 'Open Problems',
          reason: 'failing-command',
        },
      };
    }
  }

  return {
    mismatch: {
      detected: false,
      strong: false,
      code: 'none',
    },
    staleAssumption: 'No obvious mismatch detected.',
    nextVerificationAction: buildFallbackVerificationAction({
      ...input,
      lastEditPath,
    }),
  };
}

export function isResumeSafetyEligible(input: ResumeSafetyEligibilityInput): boolean {
  if (input.trigger === 'manual') {
    return true;
  }

  const threshold = Math.max(1, Math.floor(input.idleMinutes || 0));
  const gap = input.resumeGapMinutes;
  return typeof gap === 'number' && Number.isFinite(gap) && gap >= threshold;
}

export function buildResumeSafetyCheck(input: ResumeSafetyInput): ResumeSafetyCheck {
  const now =
    typeof input.now === 'number' && Number.isFinite(input.now) && input.now > 0
      ? Math.floor(input.now)
      : Date.now();
  const resolution = buildMismatchFromInput(input);
  return {
    sharedState: buildSharedState(input),
    staleAssumption: resolution.staleAssumption,
    nextVerificationAction: resolution.nextVerificationAction,
    mismatch: resolution.mismatch,
    provenance: {
      generatedAt: now,
      summaryContextHash: cleanText(input.summaryContextHash),
      workspaceName: cleanText(input.workspaceName) || undefined,
      branch: cleanText(input.currentBranch) || cleanText(input.summaryBranch) || undefined,
      activeEditorPath: cleanText(input.activeEditorPath) || undefined,
      summaryFocusFile: cleanText(input.summaryFocusFile) || undefined,
      summaryFocusArea: inferFocusArea(input.summaryFocusFile),
      currentFocusArea: inferFocusArea(input.activeEditorPath),
      recentFiles: (input.recentFiles ?? [])
        .map((value) => cleanText(value))
        .filter(Boolean)
        .slice(0, 5),
      openFiles: (input.openFiles ?? [])
        .map((value) => cleanText(value))
        .filter(Boolean)
        .slice(0, 5),
      lastFailingCommand: humanizeFailingCommand(input.lastFailingCommand),
    },
  };
}

export function createPersistedResumeSafetyContext(
  check: ResumeSafetyCheck,
  trigger: ResumeSafetyTrigger,
  shownAt: number,
): PersistedResumeSafetyContext {
  return {
    ...check,
    trigger,
    shownAt: Math.max(0, Math.floor(shownAt)),
  };
}

function normalizeVerificationAction(raw: unknown): ResumeSafetyVerificationAction | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const candidate = raw as Record<string, unknown>;
  const kind = candidate.kind;
  const label = cleanText(typeof candidate.label === 'string' ? candidate.label : undefined);
  const target = cleanText(typeof candidate.target === 'string' ? candidate.target : undefined);
  const reason = candidate.reason;
  if (
    (kind !== 'dismiss' &&
      kind !== 'refreshSummary' &&
      kind !== 'openFile' &&
      kind !== 'jumpToLastEdit' &&
      kind !== 'rerunTask' &&
      kind !== 'openProblems') ||
    !label ||
    (reason !== 'none' &&
      reason !== 'branch-mismatch' &&
      reason !== 'package-drift' &&
      reason !== 'focus-drift' &&
      reason !== 'failing-command' &&
      reason !== 'summary-focus' &&
      reason !== 'last-edit')
  ) {
    return undefined;
  }
  return {
    kind,
    label,
    target: target || undefined,
    reason,
  };
}

function normalizeMismatch(raw: unknown): ResumeSafetyMismatch | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const candidate = raw as Record<string, unknown>;
  const code = candidate.code;
  if (
    code !== 'none' &&
    code !== 'branch-changed' &&
    code !== 'package-drift' &&
    code !== 'focus-drift' &&
    code !== 'failing-command'
  ) {
    return undefined;
  }
  return {
    detected: candidate.detected === true,
    strong: candidate.strong === true,
    code,
    detail:
      cleanText(typeof candidate.detail === 'string' ? candidate.detail : undefined) || undefined,
  };
}

function normalizeProvenance(raw: unknown): ResumeSafetyProvenance | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const candidate = raw as Record<string, unknown>;
  const generatedAt =
    typeof candidate.generatedAt === 'number' && Number.isFinite(candidate.generatedAt)
      ? Math.floor(candidate.generatedAt)
      : 0;
  const summaryContextHash = cleanText(
    typeof candidate.summaryContextHash === 'string' ? candidate.summaryContextHash : undefined,
  );
  if (!generatedAt || !summaryContextHash) {
    return undefined;
  }
  const stringList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((entry) => cleanText(typeof entry === 'string' ? entry : undefined))
          .filter(Boolean)
      : [];
  return {
    generatedAt,
    summaryContextHash,
    workspaceName:
      cleanText(
        typeof candidate.workspaceName === 'string' ? candidate.workspaceName : undefined,
      ) || undefined,
    branch:
      cleanText(typeof candidate.branch === 'string' ? candidate.branch : undefined) || undefined,
    activeEditorPath:
      cleanText(
        typeof candidate.activeEditorPath === 'string' ? candidate.activeEditorPath : undefined,
      ) || undefined,
    summaryFocusFile:
      cleanText(
        typeof candidate.summaryFocusFile === 'string' ? candidate.summaryFocusFile : undefined,
      ) || undefined,
    summaryFocusArea:
      cleanText(
        typeof candidate.summaryFocusArea === 'string' ? candidate.summaryFocusArea : undefined,
      ) || undefined,
    currentFocusArea:
      cleanText(
        typeof candidate.currentFocusArea === 'string' ? candidate.currentFocusArea : undefined,
      ) || undefined,
    recentFiles: stringList(candidate.recentFiles).slice(0, 5),
    openFiles: stringList(candidate.openFiles).slice(0, 5),
    lastFailingCommand:
      cleanText(
        typeof candidate.lastFailingCommand === 'string' ? candidate.lastFailingCommand : undefined,
      ) || undefined,
  };
}

export function normalizePersistedResumeSafetyContext(
  raw: unknown,
): PersistedResumeSafetyContext | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const candidate = raw as Record<string, unknown>;
  const sharedState = cleanText(
    typeof candidate.sharedState === 'string' ? candidate.sharedState : undefined,
  );
  const staleAssumption = cleanText(
    typeof candidate.staleAssumption === 'string' ? candidate.staleAssumption : undefined,
  );
  const shownAt =
    typeof candidate.shownAt === 'number' && Number.isFinite(candidate.shownAt)
      ? Math.floor(candidate.shownAt)
      : 0;
  const trigger = candidate.trigger;
  const nextVerificationAction = normalizeVerificationAction(candidate.nextVerificationAction);
  const mismatch = normalizeMismatch(candidate.mismatch);
  const provenance = normalizeProvenance(candidate.provenance);
  if (
    !sharedState ||
    !staleAssumption ||
    !shownAt ||
    (trigger !== 'focus' && trigger !== 'manual' && trigger !== 'startup') ||
    !nextVerificationAction ||
    !mismatch ||
    !provenance
  ) {
    return undefined;
  }
  return {
    sharedState,
    staleAssumption,
    nextVerificationAction,
    mismatch,
    provenance,
    shownAt,
    trigger,
  };
}

function matchesVerificationAction(
  actionKind: ResumeSafetyStrictWarningInput['actionKind'],
  actionTarget: string | undefined,
  verifyAction: ResumeSafetyVerificationAction,
): boolean {
  if (actionKind === 'rerunDebug') {
    return false;
  }
  if (
    (actionKind === 'refreshSummary' && verifyAction.kind !== 'refreshSummary') ||
    (actionKind === 'openFile' && verifyAction.kind !== 'openFile') ||
    (actionKind === 'rerunTask' && verifyAction.kind !== 'rerunTask') ||
    (actionKind === 'openProblems' && verifyAction.kind !== 'openProblems')
  ) {
    return false;
  }
  if (verifyAction.kind !== 'openFile') {
    return true;
  }
  const expectedTarget = cleanText(verifyAction.target);
  const actualTarget = cleanText(actionTarget);
  if (!expectedTarget || !actualTarget) {
    return true;
  }
  return expectedTarget === actualTarget;
}

export function evaluateResumeSafetyStrictWarning(
  input: ResumeSafetyStrictWarningInput,
): ResumeSafetyStrictWarningDecision {
  if (!input.enabled || !input.isFirstAction || !input.check) {
    return { shouldWarn: false };
  }

  const { check } = input;
  if (!check.mismatch.detected || !check.mismatch.strong) {
    return { shouldWarn: false };
  }

  if (
    matchesVerificationAction(input.actionKind, input.actionTarget, check.nextVerificationAction)
  ) {
    return { shouldWarn: false };
  }

  if (input.actionKind === 'refreshSummary') {
    return { shouldWarn: false };
  }

  return {
    shouldWarn: true,
    message:
      check.mismatch.detail ??
      'Strong resume mismatch detected. Verify the current context before taking the first risky action.',
  };
}
