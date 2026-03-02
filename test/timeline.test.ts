import { buildEvidenceRelevanceGroups, buildTimelineGroups } from '../src/timeline';
import type { SummaryEvidenceItem } from '../src/types';

describe('buildTimelineGroups', () => {
  const now = 1_000_000;
  const evidence: SummaryEvidenceItem[] = [
    {
      id: 'file:src/a.ts',
      kind: 'file',
      label: 'src/a.ts',
      target: '/workspace/repo/src/a.ts',
      capturedAt: 990_000,
    },
    { id: 'terminal:1', kind: 'terminal', label: 'npm test', capturedAt: 980_000 },
    { id: 'debug:1', kind: 'debug', label: 'node: Launch', capturedAt: 970_000 },
    { id: 'task:1', kind: 'task', label: 'npm run build', capturedAt: 960_000 },
    {
      id: 'url:https://example.com/pr/1',
      kind: 'url',
      label: 'PR #1',
      target: 'https://example.com/pr/1',
      capturedAt: 995_000,
    },
    { id: 'branch:feature/x', kind: 'branch', label: 'feature/x', capturedAt: 950_000 },
  ];

  it('groups evidence into timeline sections in fixed order', () => {
    const groups = buildTimelineGroups(evidence, now);

    expect(groups.map((group) => group.key)).toEqual([
      'files',
      'terminal',
      'debugTasks',
      'urls',
      'git',
    ]);
    expect(groups[2]?.rows).toHaveLength(2);
    expect(groups[2]?.rows.map((row) => row.kind)).toEqual(['debug', 'task']);
  });

  it('sorts items within each group by timestamp descending', () => {
    const groups = buildTimelineGroups(evidence, now);
    const debugTaskRows = groups.find((group) => group.key === 'debugTasks')?.rows ?? [];

    expect(debugTaskRows[0]?.timestamp).toBeGreaterThan(debugTaskRows[1]?.timestamp ?? 0);
    expect(debugTaskRows[0]?.kind).toBe('debug');
    expect(debugTaskRows[1]?.kind).toBe('task');
  });

  it('marks only file/url evidence as clickable', () => {
    const groups = buildTimelineGroups(evidence, now);
    const rows = groups.flatMap((group) => group.rows);

    const clickableKinds = rows
      .filter((row) => row.clickable)
      .map((row) => row.kind)
      .sort();
    const nonClickableKinds = rows
      .filter((row) => !row.clickable)
      .map((row) => row.kind)
      .sort();

    expect(clickableKinds).toEqual(['file', 'url']);
    expect(nonClickableKinds).toEqual(['branch', 'debug', 'task', 'terminal']);
  });

  it('adds explicit interaction hints for each row', () => {
    const groups = buildTimelineGroups(evidence, now);
    const rows = groups.flatMap((group) => group.rows);

    const hintsByKind = new Map(rows.map((row) => [row.kind, row.interactionHint]));
    expect(hintsByKind.get('file')).toBe('Open');
    expect(hintsByKind.get('url')).toBe('Open');
    expect(hintsByKind.get('terminal')).toBe('Not clickable');
    expect(hintsByKind.get('debug')).toBe('Not clickable');
    expect(hintsByKind.get('task')).toBe('Not clickable');
    expect(hintsByKind.get('branch')).toBe('Not clickable');
  });

  it('builds relevance groups for surfaced evidence while preserving catalog order', () => {
    const groups = buildEvidenceRelevanceGroups(evidence, [
      'url:https://example.com/pr/1',
      'task:1',
    ]);

    expect(groups.map((group) => group.key)).toEqual(['primary', 'openable', 'context']);
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      'task:1',
      'url:https://example.com/pr/1',
    ]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['file:src/a.ts']);
    expect(groups[2]?.items.map((item) => item.id)).toEqual([
      'terminal:1',
      'debug:1',
      'branch:feature/x',
    ]);
  });

  it('falls back to openable/context grouping when no surfaced evidence ids are provided', () => {
    const groups = buildEvidenceRelevanceGroups(evidence, []);

    expect(groups.map((group) => group.key)).toEqual(['openable', 'context']);
    expect(groups[0]?.label).toBe('Openable evidence');
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      'file:src/a.ts',
      'url:https://example.com/pr/1',
    ]);
    expect(groups[1]?.label).toBe('Context-only evidence');
  });
});
