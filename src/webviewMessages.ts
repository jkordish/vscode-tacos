import { normalizeIntentOverrideText } from './intentOverride';

const SIMPLE_MESSAGE_TYPES = [
  'fixSummary',
  'checkpointPinToggle',
  'checkpointMarkDone',
  'checkpointDismiss',
  'checkpointOpenList',
  'taskStateResolve',
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
  'whySurfacedOpened',
  'openPrivacySafety',
  'revokeAiPayloadConsent',
  'rateHelpfulness',
  'sessionAddCheckpoint',
  'confirmTaskSwitch',
  'showCognitiveDebrief',
  'clearIntentOverride',
  'blockedLink',
  'dismissDemoResume',
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
const BLOCKER_PRIMARY_MESSAGE_TYPES = [
  'sessionAddCheckpoint',
  'refreshSummary',
  'restoreRerunTask',
  'restoreCopyFailingCommand',
  'restoreOpenProblems',
  'restoreOpenDiagnosticFile',
  'restoreCheckoutPreviousBranch',
] as const;

type SimpleWebviewMessageType = (typeof SIMPLE_MESSAGE_TYPES)[number];
type RestoreWebviewMessageType = (typeof RESTORE_MESSAGE_TYPES)[number];
type BlockerPrimaryMessageType = (typeof BLOCKER_PRIMARY_MESSAGE_TYPES)[number];
type BlockedPrimaryActionSurface = 'blocked';
type PrimaryNextSafeActionSurface = 'home';
type ResumePathStepId = 'confirmIntent' | 'runNextSafeAction' | 'clearBlocker';
type PanelSectionId = 'trustCenter' | 'timeline' | 'evidence' | 'details' | 'moreContext';
export type AiPayloadPreviewEntrypoint = 'trust-center' | 'why-surfaced' | 'companion-home';

export type WebviewMessage =
  | { type: SimpleWebviewMessageType }
  | { type: 'openAiPayloadPreview'; entrypoint?: AiPayloadPreviewEntrypoint }
  | { type: RestoreWebviewMessageType }
  | { type: BlockerPrimaryMessageType; primarySurface?: BlockedPrimaryActionSurface }
  | { type: 'runNextStepAction'; stepIndex: number; primarySurface?: PrimaryNextSafeActionSurface }
  | { type: 'resumePathToggle'; stepId: ResumePathStepId; completed: boolean }
  | { type: 'setPanelSectionExpanded'; sectionId: PanelSectionId; expanded: boolean }
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

  if (raw.type === 'openAiPayloadPreview') {
    if (typeof raw.primarySurface !== 'undefined') {
      return undefined;
    }

    const entrypoint = raw.entrypoint;
    if (typeof entrypoint === 'undefined') {
      return { type: 'openAiPayloadPreview' };
    }

    if (
      entrypoint !== 'trust-center' &&
      entrypoint !== 'why-surfaced' &&
      entrypoint !== 'companion-home'
    ) {
      return undefined;
    }

    return { type: 'openAiPayloadPreview', entrypoint };
  }

  if (SIMPLE_MESSAGE_TYPES.includes(raw.type as SimpleWebviewMessageType)) {
    if (BLOCKER_PRIMARY_MESSAGE_TYPES.includes(raw.type as BlockerPrimaryMessageType)) {
      if (typeof raw.primarySurface !== 'undefined' && raw.primarySurface !== 'blocked') {
        return undefined;
      }

      return raw.primarySurface === 'blocked'
        ? { type: raw.type as BlockerPrimaryMessageType, primarySurface: 'blocked' }
        : { type: raw.type as BlockerPrimaryMessageType };
    }

    if (typeof raw.primarySurface !== 'undefined') {
      return undefined;
    }

    return { type: raw.type as SimpleWebviewMessageType };
  }

  if (RESTORE_MESSAGE_TYPES.includes(raw.type as RestoreWebviewMessageType)) {
    if (BLOCKER_PRIMARY_MESSAGE_TYPES.includes(raw.type as BlockerPrimaryMessageType)) {
      if (typeof raw.primarySurface !== 'undefined' && raw.primarySurface !== 'blocked') {
        return undefined;
      }

      return raw.primarySurface === 'blocked'
        ? { type: raw.type as BlockerPrimaryMessageType, primarySurface: 'blocked' }
        : { type: raw.type as BlockerPrimaryMessageType };
    }

    if (typeof raw.primarySurface !== 'undefined') {
      return undefined;
    }

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

  if (raw.type === 'setPanelSectionExpanded') {
    const sectionId = raw.sectionId;
    if (
      sectionId !== 'trustCenter' &&
      sectionId !== 'timeline' &&
      sectionId !== 'evidence' &&
      sectionId !== 'details' &&
      sectionId !== 'moreContext'
    ) {
      return undefined;
    }

    if (typeof raw.expanded !== 'boolean') {
      return undefined;
    }

    return {
      type: 'setPanelSectionExpanded',
      sectionId,
      expanded: raw.expanded,
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
