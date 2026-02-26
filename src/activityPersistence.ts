import { redactList, redactText } from './redaction';

export interface PersistedActivityState {
  recentFiles: string[];
  recentTerminal: string[];
  recentDebug: string[];
  recentUrls: string[];
  doneItems: string[];
  lastFailingCommand?: string;
}

export function sanitizeActivityForPersistence(
  activity: PersistedActivityState,
  workspaceRoot: string,
  customPatterns: string[] = []
): PersistedActivityState {
  return {
    recentFiles: redactList(activity.recentFiles, workspaceRoot, customPatterns),
    recentTerminal: redactList(activity.recentTerminal, workspaceRoot, customPatterns),
    recentDebug: redactList(activity.recentDebug, workspaceRoot, customPatterns),
    recentUrls: redactList(activity.recentUrls, workspaceRoot, customPatterns),
    doneItems: redactList(activity.doneItems, workspaceRoot, customPatterns),
    lastFailingCommand: activity.lastFailingCommand
      ? redactText(activity.lastFailingCommand, workspaceRoot, customPatterns)
      : undefined,
  };
}
