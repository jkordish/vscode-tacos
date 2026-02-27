import { createHash, randomUUID } from 'node:crypto';
import { redactText } from './redaction';

export type CheckpointNoteStatus = 'open' | 'done' | 'dismissed';
export type CheckpointNoteScope = 'partition' | 'workspace';

export interface CheckpointNote {
  id: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  branch?: string;
  partition?: string;
  file?: string;
  line?: number;
  status: CheckpointNoteStatus;
  pinned?: boolean;
  scope?: CheckpointNoteScope;
}

const LEGACY_KEY_PREFIX = 'tacos.checkpointNote.';
const NOTES_KEY_PREFIX = 'tacos.checkpointNotes.';
const DEFAULT_NOTE_STATUS: CheckpointNoteStatus = 'open';
const DEFAULT_NOTE_SCOPE: CheckpointNoteScope = 'partition';

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string): string | undefined {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return undefined;
  }
}

function sanitizeStatus(value: unknown): CheckpointNoteStatus {
  if (value === 'open' || value === 'done' || value === 'dismissed') {
    return value;
  }

  return DEFAULT_NOTE_STATUS;
}

function sanitizeScope(value: unknown): CheckpointNoteScope {
  return value === 'workspace' ? 'workspace' : DEFAULT_NOTE_SCOPE;
}

function normalizeNote(raw: unknown): CheckpointNote | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!text) {
    return undefined;
  }

  const createdAt =
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now();
  const updatedAt =
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : createdAt;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : randomUUID();
  const branch = typeof value.branch === 'string' ? value.branch.trim() : '';
  const partition = typeof value.partition === 'string' ? value.partition.trim() : '';
  const file = typeof value.file === 'string' ? value.file.trim() : '';
  const line =
    typeof value.line === 'number' && Number.isInteger(value.line) && value.line > 0
      ? value.line
      : undefined;

  return {
    id,
    createdAt,
    updatedAt,
    text,
    branch: branch || undefined,
    partition: partition || undefined,
    file: file || undefined,
    line,
    status: sanitizeStatus(value.status),
    pinned: value.pinned === true ? true : undefined,
    scope: sanitizeScope(value.scope),
  };
}

export function checkpointStorageKey(workspaceRoot: string): string {
  return `${LEGACY_KEY_PREFIX}${toBase64Url(workspaceRoot)}`;
}

export function checkpointNotesStorageKey(scope: string): string {
  return `${NOTES_KEY_PREFIX}${toBase64Url(scope)}`;
}

export function decodeCheckpointScopeFromStorageKey(key: string): string | undefined {
  if (!key.startsWith(NOTES_KEY_PREFIX)) {
    return undefined;
  }

  return decodeBase64Url(key.slice(NOTES_KEY_PREFIX.length));
}

export function sanitizeCheckpointNote(
  rawNote: string,
  workspaceRoot: string,
  redactionPatterns: string[] = [],
): string | undefined {
  const trimmed = rawNote.trim();
  if (!trimmed) {
    return undefined;
  }

  const redacted = redactText(trimmed, workspaceRoot, redactionPatterns)
    .replace(/\s+/g, ' ')
    .trim();
  return redacted || undefined;
}

export function createCheckpointNote(
  text: string,
  options: Omit<CheckpointNote, 'id' | 'createdAt' | 'updatedAt' | 'text' | 'status'> & {
    status?: CheckpointNoteStatus;
    createdAt?: number;
    updatedAt?: number;
  } = {},
): CheckpointNote {
  const createdAt =
    typeof options.createdAt === 'number' && Number.isFinite(options.createdAt)
      ? options.createdAt
      : Date.now();
  return {
    id: randomUUID(),
    createdAt,
    updatedAt:
      typeof options.updatedAt === 'number' && Number.isFinite(options.updatedAt)
        ? options.updatedAt
        : createdAt,
    text,
    branch: options.branch,
    partition: options.partition,
    file: options.file,
    line: options.line,
    pinned: options.pinned ? true : undefined,
    scope: options.scope ?? DEFAULT_NOTE_SCOPE,
    status: options.status ?? DEFAULT_NOTE_STATUS,
  };
}

export function parseCheckpointNotes(raw: unknown): CheckpointNote[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const notes = raw
    .map((entry) => normalizeNote(entry))
    .filter((note): note is CheckpointNote => Boolean(note));

  const deduped = new Map<string, CheckpointNote>();
  for (const note of notes) {
    deduped.set(note.id, note);
  }

  return [...deduped.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function sortCheckpointNotes(notes: CheckpointNote[]): CheckpointNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }

    return b.createdAt - a.createdAt;
  });
}

export function pruneCheckpointNotesForCutoff(
  notes: CheckpointNote[],
  cutoffAt: number,
): CheckpointNote[] {
  const normalized = sortCheckpointNotes(parseCheckpointNotes(notes));
  if (!Number.isFinite(cutoffAt)) {
    return normalized;
  }

  return normalized.filter((note) => note.status === 'open' || note.updatedAt >= cutoffAt);
}

export function createLegacyMigrationNote(
  rawLegacyNote: string,
  workspaceRoot: string,
  redactionPatterns: string[] = [],
): CheckpointNote | undefined {
  const sanitized = sanitizeCheckpointNote(rawLegacyNote, workspaceRoot, redactionPatterns);
  if (!sanitized) {
    return undefined;
  }

  const id = createHash('sha1').update(`${workspaceRoot}:${sanitized}`).digest('hex').slice(0, 12);
  return {
    id: `legacy-${id}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    text: sanitized,
    status: 'open',
    pinned: true,
    scope: 'workspace',
  };
}
