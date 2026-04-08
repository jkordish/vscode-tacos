import {
  buildEvidenceRelevanceGroups,
  buildTimelineGroups,
  selectRecentAnchors,
  groupTimelineByFile,
  groupTimelineByTimeBucket,
} from '../src/timeline';
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

// ---------------------------------------------------------------------------
// P21: selectRecentAnchors
// ---------------------------------------------------------------------------
describe('selectRecentAnchors', () => {
  const now = 1_000_000;

  const mkItem = (
    id: string,
    kind: SummaryEvidenceItem['kind'],
    label: string,
    capturedAt: number,
  ): SummaryEvidenceItem => ({
    id,
    kind,
    label,
    capturedAt,
  });

  it('returns items within the window sorted newest first', () => {
    const entries: SummaryEvidenceItem[] = [
      mkItem('file:a', 'file', 'src/a.ts', now - 60_000), // 1 min ago — inside 5 min window
      mkItem('file:b', 'file', 'src/b.ts', now - 120_000), // 2 min ago — inside
      mkItem('file:c', 'file', 'src/c.ts', now - 400_000), // ~6.7 min ago — outside
    ];
    const rows = selectRecentAnchors(entries, 10, 5 * 60_000, now);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.evidenceId).toBe('file:a');
    expect(rows[1]!.evidenceId).toBe('file:b');
  });

  it('caps results at the requested count', () => {
    const entries: SummaryEvidenceItem[] = [
      mkItem('a', 'file', 'a', now - 10_000),
      mkItem('b', 'file', 'b', now - 20_000),
      mkItem('c', 'file', 'c', now - 30_000),
      mkItem('d', 'file', 'd', now - 40_000),
    ];
    const rows = selectRecentAnchors(entries, 2, 5 * 60_000, now);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.evidenceId).toBe('a');
  });

  it('returns empty array when no items fall within the window', () => {
    const entries: SummaryEvidenceItem[] = [
      mkItem('old', 'file', 'src/old.ts', now - 10 * 60_000), // 10 min ago
    ];
    const rows = selectRecentAnchors(entries, 10, 5 * 60_000, now);
    expect(rows).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(selectRecentAnchors([], 10, 5 * 60_000, now)).toHaveLength(0);
  });

  it('includes clickable flag on file and url rows', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'file:x', kind: 'file', label: 'x.ts', target: '/x.ts', capturedAt: now - 1_000 },
      { id: 'url:y', kind: 'url', label: 'Y', target: 'https://y.com', capturedAt: now - 2_000 },
      mkItem('term:z', 'terminal', 'npm test', now - 3_000),
    ];
    const rows = selectRecentAnchors(entries, 10, 5 * 60_000, now);
    const byId = new Map(rows.map((r) => [r.evidenceId, r]));
    expect(byId.get('file:x')?.clickable).toBe(true);
    expect(byId.get('url:y')?.clickable).toBe(true);
    expect(byId.get('term:z')?.clickable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P21: groupTimelineByFile
// ---------------------------------------------------------------------------
describe('groupTimelineByFile', () => {
  const now = 2_000_000;

  it('groups file items under their label key', () => {
    const entries: SummaryEvidenceItem[] = [
      {
        id: 'file:a',
        kind: 'file',
        label: 'src/a.ts',
        target: '/src/a.ts',
        capturedAt: now - 30_000,
      },
      {
        id: 'file:a2',
        kind: 'file',
        label: 'src/a.ts',
        target: '/src/a.ts',
        capturedAt: now - 60_000,
      },
      {
        id: 'file:b',
        kind: 'file',
        label: 'src/b.ts',
        target: '/src/b.ts',
        capturedAt: now - 45_000,
      },
    ];
    const groups = groupTimelineByFile(entries, 5 * 60_000, now);
    expect(groups).toHaveLength(2);
    const aGroup = groups.find((g) => g.filePath === 'src/a.ts');
    expect(aGroup?.rows).toHaveLength(2);
  });

  it('places non-file items under a bracketed kind key', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'term:1', kind: 'terminal', label: 'npm test', capturedAt: now - 10_000 },
      { id: 'term:2', kind: 'terminal', label: 'npm build', capturedAt: now - 20_000 },
    ];
    const groups = groupTimelineByFile(entries, 5 * 60_000, now);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.filePath).toBe('[terminal]');
    expect(groups[0]!.rows).toHaveLength(2);
  });

  it('excludes items older than the window', () => {
    const entries: SummaryEvidenceItem[] = [
      {
        id: 'file:new',
        kind: 'file',
        label: 'new.ts',
        target: '/new.ts',
        capturedAt: now - 60_000,
      },
      {
        id: 'file:old',
        kind: 'file',
        label: 'old.ts',
        target: '/old.ts',
        capturedAt: now - 700_000,
      },
    ];
    const groups = groupTimelineByFile(entries, 5 * 60_000, now);
    const paths = groups.map((g) => g.filePath);
    expect(paths).toContain('new.ts');
    expect(paths).not.toContain('old.ts');
  });

  it('sorts groups by most recent row descending', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'file:b', kind: 'file', label: 'b.ts', target: '/b.ts', capturedAt: now - 120_000 },
      { id: 'file:a', kind: 'file', label: 'a.ts', target: '/a.ts', capturedAt: now - 30_000 },
    ];
    const groups = groupTimelineByFile(entries, 5 * 60_000, now);
    expect(groups[0]!.filePath).toBe('a.ts');
    expect(groups[1]!.filePath).toBe('b.ts');
  });

  it('returns empty array for empty input', () => {
    expect(groupTimelineByFile([], 5 * 60_000, now)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P21: groupTimelineByTimeBucket
// ---------------------------------------------------------------------------
describe('groupTimelineByTimeBucket', () => {
  const now = 3_000_000;
  const bucket = 5 * 60_000; // 5 min

  it('places items into the correct bucket', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'a', kind: 'file', label: 'a.ts', target: '/a.ts', capturedAt: now - 60_000 }, // 1 min ago → bucket 0
      { id: 'b', kind: 'file', label: 'b.ts', target: '/b.ts', capturedAt: now - 360_000 }, // 6 min ago → bucket 1
    ];
    const buckets = groupTimelineByTimeBucket(entries, bucket, 4, now);
    const b0 = buckets.find((bkt) => bkt.label === 'Last 5 min');
    const b1 = buckets.find((bkt) => bkt.label === '5–10 min ago');
    expect(b0?.rows.map((r) => r.evidenceId)).toContain('a');
    expect(b1?.rows.map((r) => r.evidenceId)).toContain('b');
  });

  it('omits empty buckets', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'a', kind: 'file', label: 'a.ts', target: '/a.ts', capturedAt: now - 60_000 },
    ];
    const buckets = groupTimelineByTimeBucket(entries, bucket, 4, now);
    // Only one item, so only one bucket should be non-empty
    expect(buckets).toHaveLength(1);
  });

  it('sorts rows within a bucket newest first', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'old', kind: 'file', label: 'old.ts', target: '/old.ts', capturedAt: now - 240_000 },
      { id: 'new', kind: 'file', label: 'new.ts', target: '/new.ts', capturedAt: now - 60_000 },
    ];
    const buckets = groupTimelineByTimeBucket(entries, bucket, 4, now);
    const b0 = buckets.find((bkt) => bkt.label === 'Last 5 min');
    expect(b0?.rows[0]?.evidenceId).toBe('new');
  });

  it('returns empty array when no items fall in any bucket', () => {
    const entries: SummaryEvidenceItem[] = [
      {
        id: 'ancient',
        kind: 'file',
        label: 'x.ts',
        target: '/x.ts',
        capturedAt: now - 9999 * 60_000,
      },
    ];
    const buckets = groupTimelineByTimeBucket(entries, bucket, 4, now);
    expect(buckets).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(groupTimelineByTimeBucket([], bucket, 4, now)).toHaveLength(0);
  });

  it('labels first bucket as "Last N min" and subsequent buckets as ranges', () => {
    const entries: SummaryEvidenceItem[] = [
      { id: 'a', kind: 'file', label: 'a.ts', target: '/a.ts', capturedAt: now - 60_000 },
      { id: 'b', kind: 'file', label: 'b.ts', target: '/b.ts', capturedAt: now - 360_000 },
      { id: 'c', kind: 'file', label: 'c.ts', target: '/c.ts', capturedAt: now - 660_000 },
    ];
    const buckets = groupTimelineByTimeBucket(entries, bucket, 4, now);
    const labels = buckets.map((bkt) => bkt.label);
    expect(labels[0]).toBe('Last 5 min');
    expect(labels[1]).toBe('5–10 min ago');
    expect(labels[2]).toBe('10–15 min ago');
  });
});
