import {
  checkpointNotesStorageKey,
  checkpointStorageKey,
  createLegacyMigrationNote,
  parseCheckpointNotes,
  pruneCheckpointNotesForCutoff,
  sanitizeCheckpointNote,
  sanitizeCheckpointNoteWithReport,
  sortCheckpointNotes,
} from '../src/checkpoint';

describe('checkpoint helpers', () => {
  it('builds a workspace-scoped storage key', () => {
    const key = checkpointStorageKey('/workspace/repo');
    expect(key.startsWith('tacos.checkpointNote.')).toBe(true);
    expect(key).not.toContain('/workspace/repo');
  });

  it('produces different keys for different workspace roots', () => {
    const first = checkpointStorageKey('/workspace/repo-a');
    const second = checkpointStorageKey('/workspace/repo-b');

    expect(first).not.toEqual(second);
  });

  it('redacts secrets in checkpoint notes before persistence', () => {
    const sanitized = sanitizeCheckpointNote(
      'Deploy with token=super-secret-token-value from /workspace/repo',
      '/workspace/repo',
    );

    expect(sanitized).toContain('<redacted>');
    expect(sanitized).toContain('<workspace>');
    expect(sanitized).not.toContain('super-secret-token-value');
  });

  it('normalizes checkpoint notes to a single line', () => {
    const sanitized = sanitizeCheckpointNote(
      'Fix parser edge case\nand rerun tests\tbefore merge',
      '/workspace/repo',
    );

    expect(sanitized).toBe('Fix parser edge case and rerun tests before merge');
  });

  it('returns checkpoint sanitization report metadata', () => {
    const result = sanitizeCheckpointNoteWithReport(
      'token=super-secret-token-value from /workspace/repo',
      '/workspace/repo',
    );

    expect(result.text).toContain('<redacted>');
    expect(result.text).toContain('<workspace>');
    expect(result.report.totalReplacements).toBeGreaterThan(0);
    expect(result.report.totalCharsReplaced).toBeGreaterThan(0);
    expect(result.report.highRiskDetected).toBe(true);
    expect(result.report.categoryCounts.generic_secret_assignment).toBeGreaterThan(0);
    expect(result.report.categoryCounts.workspace_path).toBeGreaterThan(0);
  });

  it('builds scoped storage keys for checkpoint note arrays', () => {
    const key = checkpointNotesStorageKey('/workspace/repo::feature/x::ABC-123');
    expect(key.startsWith('tacos.checkpointNotes.')).toBe(true);
    expect(key).not.toContain('/workspace/repo');
  });

  it('normalizes and sorts parsed checkpoint notes', () => {
    const parsed = parseCheckpointNotes([
      {
        id: 'b',
        createdAt: 2,
        updatedAt: 2,
        text: 'Newest',
        status: 'open',
      },
      {
        id: 'a',
        createdAt: 1,
        updatedAt: 1,
        text: 'Older',
        status: 'done',
      },
      {
        id: 'x',
        text: '',
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('b');
    expect(parsed[1].id).toBe('a');
  });

  it('sorts pinned notes before recency', () => {
    const sorted = sortCheckpointNotes([
      {
        id: 'n1',
        createdAt: 10,
        updatedAt: 10,
        text: 'recent open',
        status: 'open',
      },
      {
        id: 'n2',
        createdAt: 5,
        updatedAt: 5,
        text: 'pinned old',
        status: 'open',
        pinned: true,
      },
    ]);

    expect(sorted[0].id).toBe('n2');
    expect(sorted[1].id).toBe('n1');
  });

  it('creates pinned legacy migration note', () => {
    const migrated = createLegacyMigrationNote('resume from /workspace/repo', '/workspace/repo');
    expect(migrated).toBeDefined();
    expect(migrated?.pinned).toBe(true);
    expect(migrated?.status).toBe('open');
    expect(migrated?.scope).toBe('workspace');
    expect(typeof migrated?.updatedAt).toBe('number');
  });

  it('prunes closed notes older than cutoff while keeping open notes', () => {
    const pruned = pruneCheckpointNotesForCutoff(
      [
        {
          id: 'open-old',
          createdAt: 1,
          updatedAt: 1,
          text: 'still relevant',
          status: 'open',
        },
        {
          id: 'done-old',
          createdAt: 2,
          updatedAt: 2,
          text: 'already done',
          status: 'done',
        },
        {
          id: 'dismissed-new',
          createdAt: 200,
          updatedAt: 200,
          text: 'dismissed but recent',
          status: 'dismissed',
        },
      ],
      100,
    );

    expect(pruned.map((note) => note.id)).toEqual(['dismissed-new', 'open-old']);
  });
});
