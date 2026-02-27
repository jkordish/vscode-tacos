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

export interface BuildNextStepActionsInput {
  summary: ResumeSummary;
  canRerunTask: boolean;
  canRerunDebug: boolean;
  canCopyFailingCommand: boolean;
}

function hasTarget(item: SummaryEvidenceItem): boolean {
  return typeof item.target === 'string' && item.target.trim().length > 0;
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

  return input.summary.nextSteps.map((_, index) => {
    const evidenceIds = input.summary.nextStepEvidenceIds?.[index] ?? [];
    if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      return undefined;
    }

    for (const evidenceId of evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        continue;
      }

      if (evidence.kind === 'file' && hasTarget(evidence)) {
        return {
          stepIndex: index,
          kind: 'openFile',
          label: 'Open file',
          evidenceId,
        };
      }

      if (evidence.kind === 'url' && hasTarget(evidence)) {
        return {
          stepIndex: index,
          kind: 'openUrl',
          label: 'Open link',
          evidenceId,
        };
      }

      if (evidence.kind === 'terminal') {
        if (input.canCopyFailingCommand) {
          return {
            stepIndex: index,
            kind: 'copyFailingCommand',
            label: 'Copy failing command',
            evidenceId,
          };
        }
        if (input.canRerunTask) {
          return {
            stepIndex: index,
            kind: 'rerunTask',
            label: 'Rerun last task',
            evidenceId,
          };
        }
        continue;
      }

      if (evidence.kind === 'task' && input.canRerunTask) {
        return {
          stepIndex: index,
          kind: 'rerunTask',
          label: 'Rerun last task',
          evidenceId,
        };
      }

      if (evidence.kind === 'debug' && input.canRerunDebug) {
        return {
          stepIndex: index,
          kind: 'rerunDebug',
          label: 'Start debug',
          evidenceId,
        };
      }
    }

    return undefined;
  });
}
