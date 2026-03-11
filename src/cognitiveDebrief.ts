import {
  describeStructuredTaskStateFreshness,
  isStructuredTaskStateStale,
  type StructuredTaskState,
} from './taskState';

export interface CognitiveDebriefItem {
  title: string;
  detail: string;
  task: StructuredTaskState;
}

export interface CognitiveDebrief {
  abandonedThreads: CognitiveDebriefItem[];
  unresolvedBlockers: CognitiveDebriefItem[];
  repeatedSwitchTasks: CognitiveDebriefItem[];
  staleTaskStates: CognitiveDebriefItem[];
  openAssumptions: CognitiveDebriefItem[];
}

export interface BuildCognitiveDebriefInput {
  tasks: StructuredTaskState[];
  activeTaskId?: string;
  now?: number;
}

function buildTitle(task: StructuredTaskState): string {
  return task.objective.trim() || 'Untitled task checkpoint';
}

function buildContextDetail(task: StructuredTaskState, now: number): string {
  const parts = [
    task.branch ? `branch ${task.branch}` : '',
    task.taskPartition ? `partition ${task.taskPartition}` : '',
    task.nextAction ? `next: ${task.nextAction}` : '',
    describeStructuredTaskStateFreshness(task, now) === 'stale' ? 'stale' : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'No extra context captured.';
}

function unresolvedTasks(tasks: StructuredTaskState[]): StructuredTaskState[] {
  return tasks.filter((task) => task.resolutionState === 'active');
}

function createItem(task: StructuredTaskState, detail: string): CognitiveDebriefItem {
  return {
    title: buildTitle(task),
    detail,
    task,
  };
}

export function buildCognitiveDebrief(input: BuildCognitiveDebriefInput): CognitiveDebrief {
  const now = input.now ?? Date.now();
  const unresolved = unresolvedTasks(input.tasks);

  return {
    abandonedThreads: unresolved
      .filter(
        (task) =>
          task.taskId !== input.activeTaskId &&
          (task.switchCount > 0 || isStructuredTaskStateStale(task, now)),
      )
      .map((task) => createItem(task, buildContextDetail(task, now))),
    unresolvedBlockers: unresolved
      .filter((task) => task.blockers.length > 0)
      .map((task) => createItem(task, `Blockers: ${task.blockers.join('; ')}`)),
    repeatedSwitchTasks: unresolved
      .filter((task) => task.switchCount >= 2)
      .map((task) => createItem(task, `Switched away ${task.switchCount} times.`)),
    staleTaskStates: unresolved
      .filter((task) => isStructuredTaskStateStale(task, now))
      .map((task) =>
        createItem(task, `Stale after ${new Date(task.staleAfter ?? now).toLocaleString()}.`),
      ),
    openAssumptions: unresolved
      .filter((task) => task.assumptions.length > 0)
      .map((task) => createItem(task, `Assumptions: ${task.assumptions.join('; ')}`)),
  };
}
