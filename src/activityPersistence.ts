import { createHash } from 'node:crypto';
import { redactList, redactText } from './redaction';

export interface PersistedActivityState {
  recentFiles: string[];
  recentTerminal: string[];
  recentDebug: string[];
  recentUrls: string[];
  doneItems: string[];
  lastFailingCommand?: string;
}

function compactCommandLabel(redactedCommand: string): string {
  const cleaned = redactedCommand
    .toLowerCase()
    .replace(/<redacted>/g, 'redacted')
    .replace(/[^a-z0-9._:/-]+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'command';
  }

  const tokens = cleaned.split(/\s+/).slice(0, 3);
  return tokens.join('_').slice(0, 48) || 'command';
}

export function persistTerminalCommandForStorage(
  command: string,
  workspaceRoot: string,
  customPatterns: string[] = [],
): string {
  const redacted = redactText(command, workspaceRoot, customPatterns).trim();
  if (!redacted) {
    return 'terminal:empty';
  }

  const digest = createHash('sha256').update(redacted).digest('hex').slice(0, 12);
  return `terminal:${compactCommandLabel(redacted)}#${digest}`;
}

export function sanitizeActivityForPersistence(
  activity: PersistedActivityState,
  workspaceRoot: string,
  customPatterns: string[] = [],
): PersistedActivityState {
  return {
    recentFiles: redactList(activity.recentFiles, workspaceRoot, customPatterns),
    recentTerminal: activity.recentTerminal.map((command) =>
      persistTerminalCommandForStorage(command, workspaceRoot, customPatterns),
    ),
    recentDebug: redactList(activity.recentDebug, workspaceRoot, customPatterns),
    recentUrls: redactList(activity.recentUrls, workspaceRoot, customPatterns),
    doneItems: activity.doneItems.map((item) =>
      persistTerminalCommandForStorage(item, workspaceRoot, customPatterns),
    ),
    lastFailingCommand: activity.lastFailingCommand
      ? persistTerminalCommandForStorage(activity.lastFailingCommand, workspaceRoot, customPatterns)
      : undefined,
  };
}
