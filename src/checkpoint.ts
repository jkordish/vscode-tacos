import { redactText } from './redaction';

export function checkpointStorageKey(workspaceRoot: string): string {
  return `tacos.checkpointNote.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

export function sanitizeCheckpointNote(
  rawNote: string,
  workspaceRoot: string,
  redactionPatterns: string[] = []
): string | undefined {
  const trimmed = rawNote.trim();
  if (!trimmed) {
    return undefined;
  }

  const redacted = redactText(trimmed, workspaceRoot, redactionPatterns).trim();
  return redacted || undefined;
}
