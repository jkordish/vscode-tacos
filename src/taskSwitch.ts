export type TaskSwitchReason =
  | 'focus-return-idle'
  | 'workspace-root-changed'
  | 'task-partition-changed'
  | 'branch-changed'
  | 'file-cluster-drift'
  | 'manual-confirm';

export interface TaskSwitchSnapshot {
  workspaceRoot: string;
  branch: string;
  taskPartition: string;
  fileCluster: string[];
  observedAt: number;
}

export interface TaskSwitchCandidate {
  previous?: TaskSwitchSnapshot;
  current: TaskSwitchSnapshot;
  reasonCodes: TaskSwitchReason[];
  summary: string;
  explainability: string[];
}

export interface DetectTaskSwitchInput {
  previous?: TaskSwitchSnapshot;
  current: TaskSwitchSnapshot;
  idleBoundaryMinutes: number;
  focusReturnIdleMinutes?: number;
  manualConfirm?: boolean;
}

const PRIMARY_REASON_PRIORITY: TaskSwitchReason[] = [
  'manual-confirm',
  'branch-changed',
  'task-partition-changed',
  'workspace-root-changed',
  'focus-return-idle',
  'file-cluster-drift',
];

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function fileClusterToken(filePath: string): string | undefined {
  const normalized = filePath.trim().replace(/\\/gu, '/');
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }

  if (segments[0] === 'packages' || segments[0] === 'apps' || segments[0] === 'services') {
    return segments[1] ? `${segments[0]}/${segments[1]}` : segments[0];
  }

  return segments[0];
}

export function deriveMeaningfulFileCluster(files: string[]): string[] {
  return Array.from(
    new Set(
      files
        .map((file) => fileClusterToken(file))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function hasMeaningfulFileClusterDrift(
  previous: TaskSwitchSnapshot | undefined,
  current: TaskSwitchSnapshot,
): boolean {
  if (!previous || previous.fileCluster.length < 2 || current.fileCluster.length < 2) {
    return false;
  }

  const previousCluster = new Set(previous.fileCluster);
  for (const token of current.fileCluster) {
    if (previousCluster.has(token)) {
      return false;
    }
  }
  return true;
}

export function createTaskSwitchCandidateHash(candidate: TaskSwitchCandidate): string {
  return [
    candidate.current.workspaceRoot,
    candidate.previous?.branch ?? '',
    candidate.current.branch,
    candidate.previous?.taskPartition ?? '',
    candidate.current.taskPartition,
    candidate.reasonCodes.join(','),
  ].join('::');
}

export function detectTaskSwitchCandidate(
  input: DetectTaskSwitchInput,
): TaskSwitchCandidate | undefined {
  const previous = input.previous;
  const current = input.current;
  const reasonCodes: TaskSwitchReason[] = [];
  const explainability: string[] = [];

  if (input.manualConfirm) {
    reasonCodes.push('manual-confirm');
    explainability.push('User explicitly confirmed that a task switch is happening.');
  }

  if (
    typeof input.focusReturnIdleMinutes === 'number' &&
    input.focusReturnIdleMinutes >= Math.max(1, input.idleBoundaryMinutes)
  ) {
    reasonCodes.push('focus-return-idle');
    explainability.push(
      `Focus returned after ${Math.floor(input.focusReturnIdleMinutes)} idle minute${Math.floor(input.focusReturnIdleMinutes) === 1 ? '' : 's'}.`,
    );
  }

  if (previous) {
    if (
      normalizeText(previous.workspaceRoot) &&
      normalizeText(previous.workspaceRoot) !== normalizeText(current.workspaceRoot)
    ) {
      reasonCodes.push('workspace-root-changed');
      explainability.push('Workspace root changed across the boundary.');
    }
    if (normalizeText(previous.taskPartition) !== normalizeText(current.taskPartition)) {
      reasonCodes.push('task-partition-changed');
      explainability.push(
        `Task partition changed from ${previous.taskPartition || 'default'} to ${current.taskPartition || 'default'}.`,
      );
    }
    if (normalizeText(previous.branch) !== normalizeText(current.branch)) {
      reasonCodes.push('branch-changed');
      explainability.push(
        `Branch changed from ${previous.branch || 'default'} to ${current.branch || 'default'}.`,
      );
    }
    if (hasMeaningfulFileClusterDrift(previous, current)) {
      reasonCodes.push('file-cluster-drift');
      explainability.push('Recent files drifted away from the prior working set cluster.');
    }
  }

  if (reasonCodes.length === 0) {
    return undefined;
  }

  if (reasonCodes.every((code) => code === 'file-cluster-drift')) {
    return undefined;
  }

  const primaryReason =
    PRIMARY_REASON_PRIORITY.find((code) => reasonCodes.includes(code)) ?? reasonCodes[0];
  const summary =
    primaryReason === 'manual-confirm'
      ? 'Manual task switch confirmation'
      : primaryReason === 'branch-changed'
        ? 'Capture a checkpoint before branch context decays.'
        : primaryReason === 'task-partition-changed'
          ? 'Capture a checkpoint before switching partitions.'
          : primaryReason === 'workspace-root-changed'
            ? 'Capture a checkpoint before switching workspace focus.'
            : 'Capture a checkpoint at this likely interruption boundary.';

  return {
    previous,
    current,
    reasonCodes,
    summary,
    explainability,
  };
}
