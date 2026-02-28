export const RESUME_PATH_STORAGE_KEY_PREFIX = 'tacos.resumePath';

export const RESUME_PATH_STEP_IDS = ['confirmIntent', 'runNextSafeAction', 'clearBlocker'] as const;
export type ResumePathStepId = (typeof RESUME_PATH_STEP_IDS)[number];

export interface ResumePathStep {
  id: ResumePathStepId;
  label: string;
  detail: string;
}

export interface ResumePathState {
  contextHash: string;
  completedStepIds: ResumePathStepId[];
  collapsed: boolean;
}

export function buildResumePathStorageKey(scope: string): string {
  return `${RESUME_PATH_STORAGE_KEY_PREFIX}.${Buffer.from(scope.trim() || '__no_scope__').toString(
    'base64url',
  )}`;
}

export function createResumePathState(contextHash: string): ResumePathState {
  return {
    contextHash,
    completedStepIds: [],
    collapsed: false,
  };
}

function toValidStepId(value: unknown): ResumePathStepId | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (
    normalized === 'confirmIntent' ||
    normalized === 'runNextSafeAction' ||
    normalized === 'clearBlocker'
  ) {
    return normalized;
  }

  return undefined;
}

export function normalizeResumePathState(raw: unknown, contextHash: string): ResumePathState {
  if (!raw || typeof raw !== 'object') {
    return createResumePathState(contextHash);
  }

  const record = raw as Record<string, unknown>;
  const storedHash = typeof record.contextHash === 'string' ? record.contextHash.trim() : '';
  if (!storedHash || storedHash !== contextHash) {
    return createResumePathState(contextHash);
  }

  const completed = Array.isArray(record.completedStepIds)
    ? record.completedStepIds
        .map((value) => toValidStepId(value))
        .filter((value): value is ResumePathStepId => Boolean(value))
    : [];
  const completedDeduped = [...new Set(completed)];
  const collapsed =
    record.collapsed === true && completedDeduped.length === RESUME_PATH_STEP_IDS.length;

  return {
    contextHash,
    completedStepIds: completedDeduped,
    collapsed,
  };
}

export function isResumePathComplete(state: ResumePathState): boolean {
  return RESUME_PATH_STEP_IDS.every((stepId) => state.completedStepIds.includes(stepId));
}

export function toggleResumePathStep(
  state: ResumePathState,
  stepId: ResumePathStepId,
  completed: boolean,
): ResumePathState {
  const nextSet = new Set(state.completedStepIds);
  if (completed) {
    nextSet.add(stepId);
  } else {
    nextSet.delete(stepId);
  }

  const completedStepIds = RESUME_PATH_STEP_IDS.filter((id) => nextSet.has(id));
  const complete = completedStepIds.length === RESUME_PATH_STEP_IDS.length;
  return {
    contextHash: state.contextHash,
    completedStepIds,
    collapsed: complete,
  };
}

export function buildResumePathSteps(hasBlocker: boolean): ResumePathStep[] {
  return [
    {
      id: 'confirmIntent',
      label: 'Confirm intent',
      detail: 'Re-read your intent and last action before making changes.',
    },
    {
      id: 'runNextSafeAction',
      label: 'Run next safe action',
      detail: 'Take the recommended safe action to restore momentum.',
    },
    {
      id: 'clearBlocker',
      label: hasBlocker ? 'Clear blocker' : 'Capture fallback checkpoint',
      detail: hasBlocker
        ? 'Resolve or acknowledge the top blocker before moving on.'
        : 'Add a one-line checkpoint if no blocker is currently active.',
    },
  ];
}
