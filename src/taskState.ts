import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

export const TASK_STATE_SCHEMA_VERSION = 1;
const TASK_STATE_STORAGE_KEY_PREFIX = 'tacos.taskStateStore';
const MAX_TASKS_PER_WORKSPACE = 48;
const MAX_WORKING_SET_ENTRIES = 12;
const MAX_LIST_ENTRIES = 8;
const MAX_TEXT_CHARS = 280;

export type TaskStateConfidence = 'low' | 'medium' | 'high';
export type TaskResolutionState = 'active' | 'resolved' | 'dismissed';
export type TaskWorkingSetKind = 'file' | 'url' | 'task' | 'debug';
export type TaskStateFreshness = 'fresh' | 'stale' | 'none';
export type TaskSwitchSessionClass = 'stable' | 'repeated-switch' | 'none';

export interface TaskWorkingSetEntry {
  kind: TaskWorkingSetKind;
  label: string;
  target?: string;
  capturedAt?: number;
}

export interface LastKnownSafeBreakpoint {
  file?: string;
  line?: number;
  branch?: string;
  taskPartition?: string;
  label?: string;
  capturedAt: number;
}

export interface StructuredTaskState {
  taskId: string;
  workspaceRoot: string;
  repo: string;
  branch: string;
  taskPartition: string;
  objective: string;
  workingSet: TaskWorkingSetEntry[];
  currentHypothesis?: string;
  assumptions: string[];
  blockers: string[];
  nextAction: string;
  /**
   * Prospective intent: the single next verification action the user intends to
   * perform. Captured at likely task-switch moments so it survives context decay.
   * Max 280 chars. Source: ICSE'26 TaCoS study — generated summaries often lacked
   * this "prospective information" which was present in manual notes.
   */
  prospectiveNextVerification?: string;
  confidence: TaskStateConfidence;
  lastKnownSafeBreakpoint: LastKnownSafeBreakpoint;
  staleAfter?: number;
  createdAt: number;
  updatedAt: number;
  lastResumedAt?: number;
  switchCount: number;
  resolvedAt?: number;
  resolutionState: TaskResolutionState;
}

export interface StructuredTaskStateStore {
  schemaVersion: number;
  tasks: StructuredTaskState[];
}

export interface CreateStructuredTaskStateInput {
  workspaceRoot: string;
  repo: string;
  branch: string;
  taskPartition: string;
  objective: string;
  workingSet?: TaskWorkingSetEntry[];
  currentHypothesis?: string;
  assumptions?: string[];
  blockers?: string[];
  nextAction: string;
  prospectiveNextVerification?: string;
  confidence?: TaskStateConfidence;
  lastKnownSafeBreakpoint: LastKnownSafeBreakpoint;
  staleAfter?: number;
  createdAt?: number;
  updatedAt?: number;
  lastResumedAt?: number;
  switchCount?: number;
  resolvedAt?: number;
  resolutionState?: TaskResolutionState;
  taskId?: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function normalizeFiniteTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function patchHasOwn<T extends object>(patch: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

function normalizeText(value: unknown, maxChars = MAX_TEXT_CHARS): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\r?\n/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, maxChars);
  return normalized || undefined;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = normalizeText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
    if (items.length >= MAX_LIST_ENTRIES) {
      break;
    }
  }
  return items;
}

function normalizeConfidence(value: unknown): TaskStateConfidence {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function normalizeResolutionState(value: unknown): TaskResolutionState {
  if (value === 'resolved' || value === 'dismissed') {
    return value;
  }
  return 'active';
}

function normalizeWorkingSetKind(value: unknown): TaskWorkingSetKind | undefined {
  return value === 'file' || value === 'url' || value === 'task' || value === 'debug'
    ? value
    : undefined;
}

function normalizeWorkingSetEntry(raw: unknown): TaskWorkingSetEntry | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const kind = normalizeWorkingSetKind(value.kind);
  const label = normalizeText(value.label, 200);
  if (!kind || !label) {
    return undefined;
  }

  return {
    kind,
    label,
    target: normalizeText(value.target, 300),
    capturedAt: normalizeFiniteTimestamp(value.capturedAt),
  };
}

function normalizeWorkingSet(value: unknown): TaskWorkingSetEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: TaskWorkingSetEntry[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeWorkingSetEntry(entry);
    if (!normalized) {
      continue;
    }
    const key = `${normalized.kind}:${normalized.target ?? normalized.label}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push(normalized);
    if (entries.length >= MAX_WORKING_SET_ENTRIES) {
      break;
    }
  }
  return entries;
}

function normalizeSafeBreakpoint(raw: unknown): LastKnownSafeBreakpoint | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const capturedAt = normalizeFiniteTimestamp(value.capturedAt) ?? Date.now();
  const line = normalizePositiveInteger(value.line);
  return {
    file: normalizeText(value.file, 300),
    line,
    branch: normalizeText(value.branch, 120),
    taskPartition: normalizeText(value.taskPartition, 120),
    label: normalizeText(value.label, 200),
    capturedAt,
  };
}

function normalizeTask(raw: unknown): StructuredTaskState | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const workspaceRoot = normalizeText(value.workspaceRoot, 400);
  const repo = normalizeText(value.repo, 200);
  const branch = normalizeText(value.branch, 120);
  const taskPartition = normalizeText(value.taskPartition, 120);
  const objective = normalizeText(value.objective);
  const nextAction = normalizeText(value.nextAction);
  const lastKnownSafeBreakpoint = normalizeSafeBreakpoint(value.lastKnownSafeBreakpoint);
  if (
    !workspaceRoot ||
    !repo ||
    !branch ||
    !taskPartition ||
    !objective ||
    !nextAction ||
    !lastKnownSafeBreakpoint
  ) {
    return undefined;
  }

  const createdAt = normalizeFiniteTimestamp(value.createdAt) ?? Date.now();
  const updatedAt = normalizeFiniteTimestamp(value.updatedAt) ?? createdAt;
  const taskId = normalizeText(value.taskId, 80) ?? randomUUID();
  return {
    taskId,
    workspaceRoot,
    repo,
    branch,
    taskPartition,
    objective,
    workingSet: normalizeWorkingSet(value.workingSet),
    currentHypothesis: normalizeText(value.currentHypothesis),
    assumptions: normalizeList(value.assumptions),
    blockers: normalizeList(value.blockers),
    nextAction,
    prospectiveNextVerification: normalizeText(value.prospectiveNextVerification),
    confidence: normalizeConfidence(value.confidence),
    lastKnownSafeBreakpoint,
    staleAfter: normalizeFiniteTimestamp(value.staleAfter),
    createdAt,
    updatedAt,
    lastResumedAt: normalizeFiniteTimestamp(value.lastResumedAt),
    switchCount:
      typeof value.switchCount === 'number' &&
      Number.isFinite(value.switchCount) &&
      value.switchCount >= 0
        ? Math.floor(value.switchCount)
        : 0,
    resolvedAt: normalizeFiniteTimestamp(value.resolvedAt),
    resolutionState: normalizeResolutionState(value.resolutionState),
  };
}

export function taskStateStorageKey(workspaceRoot: string): string {
  return `${TASK_STATE_STORAGE_KEY_PREFIX}.${toBase64Url(workspaceRoot.trim())}`;
}

export function createEmptyStructuredTaskStateStore(): StructuredTaskStateStore {
  return {
    schemaVersion: TASK_STATE_SCHEMA_VERSION,
    tasks: [],
  };
}

export function parseStructuredTaskStateStore(raw: unknown): StructuredTaskStateStore {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStructuredTaskStateStore();
  }

  const value = raw as Record<string, unknown>;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks
        .map((entry) => normalizeTask(entry))
        .filter((entry): entry is StructuredTaskState => Boolean(entry))
    : [];
  const deduped = new Map<string, StructuredTaskState>();
  for (const task of tasks) {
    deduped.set(task.taskId, task);
  }

  return {
    schemaVersion: TASK_STATE_SCHEMA_VERSION,
    tasks: [...deduped.values()]
      .sort((left, right) => {
        if (left.updatedAt !== right.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }
        return left.taskId.localeCompare(right.taskId);
      })
      .slice(0, MAX_TASKS_PER_WORKSPACE),
  };
}

export function createStructuredTaskState(
  input: CreateStructuredTaskStateInput,
): StructuredTaskState {
  // Derive timestamps independently so a provided `updatedAt` does not
  // silently backdate `createdAt` on newly-created tasks.
  const wallNow = Date.now();
  const updatedAt = normalizeFiniteTimestamp(input.updatedAt) ?? wallNow;
  const createdAt = normalizeFiniteTimestamp(input.createdAt) ?? wallNow;
  return {
    taskId: normalizeText(input.taskId, 80) ?? randomUUID(),
    workspaceRoot: normalizeText(input.workspaceRoot, 400) ?? '',
    repo: normalizeText(input.repo, 200) ?? path.basename(input.workspaceRoot),
    branch: normalizeText(input.branch, 120) ?? 'default',
    taskPartition: normalizeText(input.taskPartition, 120) ?? 'default',
    objective: normalizeText(input.objective) ?? '',
    workingSet: normalizeWorkingSet(input.workingSet ?? []),
    currentHypothesis: normalizeText(input.currentHypothesis),
    assumptions: normalizeList(input.assumptions ?? []),
    blockers: normalizeList(input.blockers ?? []),
    nextAction: normalizeText(input.nextAction) ?? '',
    prospectiveNextVerification: normalizeText(input.prospectiveNextVerification),
    confidence: normalizeConfidence(input.confidence),
    lastKnownSafeBreakpoint: normalizeSafeBreakpoint(input.lastKnownSafeBreakpoint) ?? {
      capturedAt: updatedAt,
    },
    staleAfter: normalizeFiniteTimestamp(input.staleAfter),
    createdAt,
    updatedAt,
    lastResumedAt: normalizeFiniteTimestamp(input.lastResumedAt),
    switchCount:
      typeof input.switchCount === 'number' &&
      Number.isFinite(input.switchCount) &&
      input.switchCount >= 0
        ? Math.floor(input.switchCount)
        : 0,
    resolvedAt: normalizeFiniteTimestamp(input.resolvedAt),
    resolutionState: normalizeResolutionState(input.resolutionState),
  };
}

export function upsertStructuredTaskState(
  store: StructuredTaskStateStore,
  task: StructuredTaskState,
): StructuredTaskStateStore {
  const next = parseStructuredTaskStateStore(store);
  const tasks = next.tasks.filter((entry) => entry.taskId !== task.taskId);
  tasks.unshift(task);
  return parseStructuredTaskStateStore({
    schemaVersion: TASK_STATE_SCHEMA_VERSION,
    tasks,
  });
}

export function removeStructuredTaskState(
  store: StructuredTaskStateStore,
  taskId: string,
): StructuredTaskStateStore {
  return parseStructuredTaskStateStore({
    schemaVersion: TASK_STATE_SCHEMA_VERSION,
    tasks: parseStructuredTaskStateStore(store).tasks.filter((task) => task.taskId !== taskId),
  });
}

export function findStructuredTaskStateById(
  store: StructuredTaskStateStore,
  taskId: string,
): StructuredTaskState | undefined {
  return parseStructuredTaskStateStore(store).tasks.find((task) => task.taskId === taskId);
}

export function findActiveStructuredTaskForScope(
  store: StructuredTaskStateStore,
  workspaceRoot: string,
  branch: string,
  taskPartition: string,
): StructuredTaskState | undefined {
  return parseStructuredTaskStateStore(store).tasks.find(
    (task) =>
      task.workspaceRoot === workspaceRoot &&
      task.branch === branch &&
      task.taskPartition === taskPartition &&
      task.resolutionState === 'active',
  );
}

export function listStructuredTasksForWorkspace(
  store: StructuredTaskStateStore,
  workspaceRoot: string,
): StructuredTaskState[] {
  return parseStructuredTaskStateStore(store).tasks.filter(
    (task) => task.workspaceRoot === workspaceRoot,
  );
}

export function updateStructuredTaskState(
  task: StructuredTaskState,
  patch: Partial<StructuredTaskState>,
  updatedAt = Date.now(),
): StructuredTaskState {
  const currentHypothesis = patchHasOwn(patch, 'currentHypothesis')
    ? patch.currentHypothesis
    : task.currentHypothesis;
  const staleAfter = patchHasOwn(patch, 'staleAfter') ? patch.staleAfter : task.staleAfter;
  const lastResumedAt = patchHasOwn(patch, 'lastResumedAt')
    ? patch.lastResumedAt
    : task.lastResumedAt;
  const resolvedAt = patchHasOwn(patch, 'resolvedAt') ? patch.resolvedAt : task.resolvedAt;

  return createStructuredTaskState({
    ...task,
    ...patch,
    taskId: task.taskId,
    workspaceRoot: patch.workspaceRoot ?? task.workspaceRoot,
    repo: patch.repo ?? task.repo,
    branch: patch.branch ?? task.branch,
    taskPartition: patch.taskPartition ?? task.taskPartition,
    objective: patch.objective ?? task.objective,
    workingSet: patch.workingSet ?? task.workingSet,
    currentHypothesis,
    assumptions: patch.assumptions ?? task.assumptions,
    blockers: patch.blockers ?? task.blockers,
    nextAction: patch.nextAction ?? task.nextAction,
    prospectiveNextVerification: patchHasOwn(patch, 'prospectiveNextVerification')
      ? patch.prospectiveNextVerification
      : task.prospectiveNextVerification,
    confidence: patch.confidence ?? task.confidence,
    lastKnownSafeBreakpoint: patch.lastKnownSafeBreakpoint ?? task.lastKnownSafeBreakpoint,
    staleAfter,
    createdAt: task.createdAt,
    updatedAt,
    lastResumedAt,
    switchCount: patch.switchCount ?? task.switchCount,
    resolvedAt,
    resolutionState: patch.resolutionState ?? task.resolutionState,
  });
}

export function markStructuredTaskStateResolved(
  task: StructuredTaskState,
  resolutionState: Exclude<TaskResolutionState, 'active'> = 'resolved',
  resolvedAt = Date.now(),
): StructuredTaskState {
  return updateStructuredTaskState(
    task,
    {
      resolutionState,
      resolvedAt,
    },
    resolvedAt,
  );
}

export function markStructuredTaskStateResumed(
  task: StructuredTaskState,
  resumedAt = Date.now(),
): StructuredTaskState {
  return updateStructuredTaskState(
    task,
    {
      lastResumedAt: resumedAt,
    },
    resumedAt,
  );
}

export function incrementStructuredTaskStateSwitchCount(
  task: StructuredTaskState,
  updatedAt = Date.now(),
): StructuredTaskState {
  return updateStructuredTaskState(
    task,
    {
      switchCount: task.switchCount + 1,
    },
    updatedAt,
  );
}

export function isStructuredTaskStateStale(
  task: StructuredTaskState | undefined,
  now = Date.now(),
): boolean {
  return Boolean(task?.staleAfter && task.staleAfter <= now);
}

export function describeStructuredTaskStateFreshness(
  task: StructuredTaskState | undefined,
  now = Date.now(),
): TaskStateFreshness {
  if (!task) {
    return 'none';
  }
  return isStructuredTaskStateStale(task, now) ? 'stale' : 'fresh';
}

export function describeStructuredTaskSwitchClass(
  task: StructuredTaskState | undefined,
): TaskSwitchSessionClass {
  if (!task) {
    return 'none';
  }
  return task.switchCount >= 2 ? 'repeated-switch' : 'stable';
}

export function computeCheckpointFieldCompleteness(task: StructuredTaskState): number {
  const fields = [
    Boolean(task.objective.trim()),
    task.workingSet.length > 0,
    task.assumptions.length > 0,
    task.blockers.length > 0,
    Boolean(task.nextAction.trim()),
    // prospectiveNextVerification is the "future intent" field — the single next
    // check the user intends to do. Its presence is a strong completeness signal.
    Boolean(task.prospectiveNextVerification?.trim()),
    // confidence is always non-empty ('low'|'medium'|'high'), so reward anything
    // other than the default 'medium' as an explicit user choice.
    task.confidence !== 'medium',
    Boolean(task.staleAfter),
    Boolean(
      task.lastKnownSafeBreakpoint.file ||
      task.lastKnownSafeBreakpoint.label ||
      task.lastKnownSafeBreakpoint.line,
    ),
  ];
  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

export function formatStructuredTaskStateForPrompt(task: StructuredTaskState): string[] {
  const lines = [
    `Objective: ${task.objective}`,
    `Next action: ${task.nextAction}`,
    `Confidence: ${task.confidence}`,
  ];
  if (task.prospectiveNextVerification) {
    // Surface prospective intent first — it is the most decay-resistant signal
    // for re-entry (ICSE'26: generated summaries lacked this; manual notes had it).
    lines.push(`Next verification: ${task.prospectiveNextVerification}`);
  }
  if (task.currentHypothesis) {
    lines.push(`Current hypothesis: ${task.currentHypothesis}`);
  }
  if (task.assumptions.length > 0) {
    lines.push(`Assumptions: ${task.assumptions.join('; ')}`);
  }
  if (task.blockers.length > 0) {
    lines.push(`Blockers: ${task.blockers.join('; ')}`);
  }
  if (task.workingSet.length > 0) {
    lines.push(
      `Working set: ${task.workingSet
        .slice(0, 4)
        .map((entry) => entry.label)
        .join(', ')}`,
    );
  }
  return lines;
}

export function createTaskWorkingSetEntry(
  kind: TaskWorkingSetKind,
  label: string,
  target?: string,
  capturedAt = Date.now(),
): TaskWorkingSetEntry | undefined {
  const normalized = normalizeWorkingSetEntry({
    kind,
    label,
    target,
    capturedAt,
  });
  return normalized;
}
