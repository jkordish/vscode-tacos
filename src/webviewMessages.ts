import { normalizeIntentOverrideText } from './intentOverride';

const SIMPLE_MESSAGE_TYPES = [
  'fixSummary',
  'checkpointPinToggle',
  'checkpointMarkDone',
  'checkpointDismiss',
  'checkpointOpenList',
  'openScratchpad',
  'appendScratchpad',
  'setScratchpadScope',
  'copyNextSteps',
  'copySummary',
  'copyPromptAndOpenCodex',
  'refreshSummary',
  'toggleAutoSummaries',
  'acknowledgeNudge',
  'dismissNudge',
  'openPrivacySafety',
  'rateHelpfulness',
  'sessionAddCheckpoint',
  'clearIntentOverride',
  'blockedLink',
] as const;
const RESTORE_MESSAGE_TYPES = [
  'restoreReopenFiles',
  'restoreOpenChangedFiles',
  'restoreRerunTask',
  'restoreRerunDebug',
  'restoreCheckoutPreviousBranch',
  'restoreCopyFailingCommand',
  'restoreOpenProblems',
  'restoreOpenDiagnosticFile',
  'restoreJumpToLastEdit',
  'restoreWorkingSet',
] as const;

type SimpleWebviewMessageType = (typeof SIMPLE_MESSAGE_TYPES)[number];
type RestoreWebviewMessageType = (typeof RESTORE_MESSAGE_TYPES)[number];
type PrimaryNextSafeActionSurface = 'home';
type ResumePathStepId = 'confirmIntent' | 'runNextSafeAction' | 'clearBlocker';

export type WebviewMessage =
  | { type: SimpleWebviewMessageType }
  | { type: RestoreWebviewMessageType }
  | { type: 'runNextStepAction'; stepIndex: number; primarySurface?: PrimaryNextSafeActionSurface }
  | { type: 'resumePathToggle'; stepId: ResumePathStepId; completed: boolean }
  | { type: 'setIntentOverride'; intent: string }
  | { type: 'openEvidence'; evidenceId: string }
  | { type: 'openTopFile'; index: number }
  | { type: 'openLink'; index: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function parseWebviewMessage(raw: unknown): WebviewMessage | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return undefined;
  }

  if (SIMPLE_MESSAGE_TYPES.includes(raw.type as SimpleWebviewMessageType)) {
    return { type: raw.type as SimpleWebviewMessageType };
  }

  if (RESTORE_MESSAGE_TYPES.includes(raw.type as RestoreWebviewMessageType)) {
    return { type: raw.type as RestoreWebviewMessageType };
  }

  if (raw.type === 'openEvidence') {
    if (typeof raw.evidenceId !== 'string') {
      return undefined;
    }

    const evidenceId = raw.evidenceId.trim();
    if (!evidenceId) {
      return undefined;
    }

    return { type: 'openEvidence', evidenceId };
  }

  if (raw.type === 'openLink') {
    if (typeof raw.index !== 'number' || !Number.isInteger(raw.index)) {
      return undefined;
    }

    if (raw.index < 0 || raw.index > 200) {
      return undefined;
    }

    return { type: 'openLink', index: raw.index };
  }

  if (raw.type === 'openTopFile') {
    if (typeof raw.index !== 'number' || !Number.isInteger(raw.index)) {
      return undefined;
    }

    if (raw.index < 0 || raw.index > 200) {
      return undefined;
    }

    return { type: 'openTopFile', index: raw.index };
  }

  if (raw.type === 'runNextStepAction') {
    if (typeof raw.stepIndex !== 'number' || !Number.isInteger(raw.stepIndex)) {
      return undefined;
    }

    if (raw.stepIndex < 0 || raw.stepIndex > 200) {
      return undefined;
    }

    let primarySurface: PrimaryNextSafeActionSurface | undefined;
    if (typeof raw.primarySurface !== 'undefined') {
      if (raw.primarySurface !== 'home') {
        return undefined;
      }
      primarySurface = raw.primarySurface;
    }

    return primarySurface
      ? { type: 'runNextStepAction', stepIndex: raw.stepIndex, primarySurface }
      : { type: 'runNextStepAction', stepIndex: raw.stepIndex };
  }

  if (raw.type === 'resumePathToggle') {
    const stepId = raw.stepId;
    if (stepId !== 'confirmIntent' && stepId !== 'runNextSafeAction' && stepId !== 'clearBlocker') {
      return undefined;
    }

    if (typeof raw.completed !== 'boolean') {
      return undefined;
    }

    return {
      type: 'resumePathToggle',
      stepId,
      completed: raw.completed,
    };
  }

  if (raw.type === 'setIntentOverride') {
    const intent = normalizeIntentOverrideText(raw.intent);
    if (!intent) {
      return undefined;
    }

    return {
      type: 'setIntentOverride',
      intent,
    };
  }

  return undefined;
}
