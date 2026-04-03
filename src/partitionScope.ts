const DEFAULT_SCOPE_BRANCH = 'default';
const DEFAULT_TASK_PARTITION = 'default';

function normalizeToken(value: string | undefined, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

export function inferTaskPartitionKey(branch: string): string | undefined {
  const normalized = branch.trim();
  if (!normalized) {
    return undefined;
  }

  const ticketMatch = normalized.match(/([A-Z]{2,}-\d+)/);
  if (ticketMatch?.[1]) {
    return ticketMatch[1];
  }

  const issueMatch = normalized.match(/#(\d{1,6})/);
  if (issueMatch?.[1]) {
    return `issue-${issueMatch[1]}`;
  }

  return undefined;
}

export function resolveTaskPartitionKey(input: {
  manualTaskPartition?: string;
  scopeBranch?: string;
}): string {
  const manual = input.manualTaskPartition?.trim();
  if (manual) {
    return manual;
  }

  const inferred = inferTaskPartitionKey(input.scopeBranch ?? '');
  return inferred ?? DEFAULT_TASK_PARTITION;
}

export function buildPartitionScope(
  workspaceRoot: string,
  scopeBranch: string,
  taskPartition: string,
): string {
  const root = workspaceRoot.trim();
  const branch = normalizeToken(scopeBranch, DEFAULT_SCOPE_BRANCH);
  const partition = normalizeToken(taskPartition, DEFAULT_TASK_PARTITION);
  return `${root}::${branch}::${partition}`;
}
