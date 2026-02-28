import type { ResumeSummary, SummaryEvidenceItem } from './types';

export type NextStepActionKind =
  | 'openFile'
  | 'openUrl'
  | 'copyFailingCommand'
  | 'rerunTask'
  | 'rerunDebug';

export interface NextStepAction {
  stepIndex: number;
  kind: NextStepActionKind;
  label: string;
  evidenceId: string;
}

export function describeNextStepActionRationale(
  action: NextStepAction,
  evidence?: SummaryEvidenceItem,
): string {
  const evidenceLabel = evidence?.label?.trim() || 'recent captured evidence';

  if (action.kind === 'openFile') {
    return `Based on file evidence: ${evidenceLabel}.`;
  }

  if (action.kind === 'openUrl') {
    return `Based on linked context: ${evidenceLabel}.`;
  }

  if (action.kind === 'copyFailingCommand') {
    return `Based on failing terminal activity: ${evidenceLabel}.`;
  }

  if (action.kind === 'rerunTask') {
    return `Based on recent task/terminal activity: ${evidenceLabel}.`;
  }

  return `Based on recent debug activity: ${evidenceLabel}.`;
}

export interface BuildNextStepActionsInput {
  summary: ResumeSummary;
  canRerunTask: boolean;
  canRerunDebug: boolean;
  canCopyFailingCommand: boolean;
}

const DEFAULT_ACTION_PREFERENCE: NextStepActionKind[] = [
  'openFile',
  'openUrl',
  'copyFailingCommand',
  'rerunDebug',
  'rerunTask',
];

function hasTarget(item: SummaryEvidenceItem): boolean {
  return typeof item.target === 'string' && item.target.trim().length > 0;
}

interface StepActionPreference {
  kinds: NextStepActionKind[];
  strong: boolean;
}

function inferActionPreference(stepText: string): StepActionPreference {
  const normalized = stepText.trim().toLowerCase();

  if (!normalized) {
    return { kinds: DEFAULT_ACTION_PREFERENCE, strong: false };
  }

  if (/\b(debug|breakpoint|launch|attach|inspect)\b/.test(normalized)) {
    return {
      kinds: ['rerunDebug', 'rerunTask', 'copyFailingCommand', 'openFile', 'openUrl'],
      strong: true,
    };
  }

  if (
    /\b(re-?run|rerun|retry|failing|failed|blocker|test|build|command|validate|validation|verify)\b/.test(
      normalized,
    )
  ) {
    return {
      kinds: ['copyFailingCommand', 'rerunTask', 'rerunDebug', 'openFile', 'openUrl'],
      strong: true,
    };
  }

  if (/\b(link|url|http|https|pr\b|pull request|issue|ticket|docs?)\b/.test(normalized)) {
    return {
      kinds: ['openUrl', 'openFile', 'copyFailingCommand', 'rerunTask', 'rerunDebug'],
      strong: true,
    };
  }

  if (/\b(file|edit|code|module|open)\b/.test(normalized)) {
    return {
      kinds: ['openFile', 'openUrl', 'copyFailingCommand', 'rerunTask', 'rerunDebug'],
      strong: true,
    };
  }

  return { kinds: DEFAULT_ACTION_PREFERENCE, strong: false };
}

function toAction(
  evidence: SummaryEvidenceItem,
  evidenceId: string,
  stepIndex: number,
  input: BuildNextStepActionsInput,
): NextStepAction | undefined {
  const allowExecutionActions = !input.summary.longGap;

  if (evidence.kind === 'file' && hasTarget(evidence)) {
    return {
      stepIndex,
      kind: 'openFile',
      label: 'Open file',
      evidenceId,
    };
  }

  if (evidence.kind === 'url' && hasTarget(evidence)) {
    return {
      stepIndex,
      kind: 'openUrl',
      label: 'Open link',
      evidenceId,
    };
  }

  if (evidence.kind === 'terminal') {
    if (input.canCopyFailingCommand) {
      return {
        stepIndex,
        kind: 'copyFailingCommand',
        label: 'Copy failing command',
        evidenceId,
      };
    }
    if (allowExecutionActions && input.canRerunTask) {
      return {
        stepIndex,
        kind: 'rerunTask',
        label: 'Rerun last task',
        evidenceId,
      };
    }
    return undefined;
  }

  if (evidence.kind === 'task' && allowExecutionActions && input.canRerunTask) {
    return {
      stepIndex,
      kind: 'rerunTask',
      label: 'Rerun last task',
      evidenceId,
    };
  }

  if (evidence.kind === 'debug' && allowExecutionActions && input.canRerunDebug) {
    return {
      stepIndex,
      kind: 'rerunDebug',
      label: 'Start debug',
      evidenceId,
    };
  }

  return undefined;
}

export function buildNextStepActions(
  input: BuildNextStepActionsInput,
): Array<NextStepAction | undefined> {
  if (input.summary.lowConfidence) {
    return input.summary.nextSteps.map(() => undefined);
  }

  const evidenceById = new Map(
    (input.summary.evidenceCatalog ?? []).map((item) => [item.id, item] as const),
  );
  const catalogEvidence = input.summary.evidenceCatalog ?? [];

  return input.summary.nextSteps.map((step, index) => {
    const mappedEvidenceIds = input.summary.nextStepEvidenceIds?.[index] ?? [];
    const preference = inferActionPreference(step);

    if (!Array.isArray(mappedEvidenceIds) || mappedEvidenceIds.length === 0) {
      return undefined;
    }

    const mappedActionCandidates: NextStepAction[] = [];
    for (const evidenceId of mappedEvidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        continue;
      }
      const action = toAction(evidence, evidenceId, index, input);
      if (action) {
        mappedActionCandidates.push(action);
      }
    }

    if (mappedActionCandidates.length === 0) {
      return undefined;
    }

    if (!preference.strong) {
      return mappedActionCandidates[0];
    }

    const orderedCandidateIds: string[] = [];

    for (const evidenceId of mappedEvidenceIds) {
      if (!orderedCandidateIds.includes(evidenceId)) {
        orderedCandidateIds.push(evidenceId);
      }
    }
    for (const evidence of catalogEvidence) {
      if (!orderedCandidateIds.includes(evidence.id)) {
        orderedCandidateIds.push(evidence.id);
      }
    }

    const actionCandidates: NextStepAction[] = [];
    for (const evidenceId of orderedCandidateIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        continue;
      }
      const action = toAction(evidence, evidenceId, index, input);
      if (action) {
        actionCandidates.push(action);
      }
    }

    if (actionCandidates.length === 0) {
      return undefined;
    }

    for (const preferredKind of preference.kinds) {
      const match = actionCandidates.find((candidate) => candidate.kind === preferredKind);
      if (match) {
        return match;
      }
    }

    return mappedActionCandidates[0];
  });
}
