const SIMPLE_MESSAGE_TYPES = [
  'fixSummary',
  'checkpointKeep',
  'checkpointClear',
  'copyNextSteps',
  'copySummary',
  'copyPromptAndOpenCodex',
  'refreshSummary',
  'toggleAutoSummaries',
  'openPrivacySafety',
  'sessionAddCheckpoint',
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
] as const;

type SimpleWebviewMessageType = (typeof SIMPLE_MESSAGE_TYPES)[number];
type RestoreWebviewMessageType = (typeof RESTORE_MESSAGE_TYPES)[number];

export type WebviewMessage =
  | { type: SimpleWebviewMessageType }
  | { type: RestoreWebviewMessageType }
  | { type: 'runNextStepAction'; stepIndex: number }
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

    return { type: 'runNextStepAction', stepIndex: raw.stepIndex };
  }

  return undefined;
}
