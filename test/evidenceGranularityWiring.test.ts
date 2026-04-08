/**
 * Unit tests for the evidenceGranularityWindowMs mapping contract.
 *
 * The mapping is applied inline in renderWebview() in src/extension.ts:
 *
 *   coarse → 10 * 60_000  (600_000 ms)
 *   medium → 5  * 60_000  (300_000 ms)  — default
 *   fine   → 2  * 60_000  (120_000 ms)
 *
 * These tests verify that the three window sizes produce the correct
 * inclusion/exclusion behaviour when passed to the pure functions that
 * consume them (selectRecentAnchors, groupTimelineByFile,
 * groupTimelineByTimeBucket, groupTimelineByAction).
 */
import {
  groupTimelineByAction,
  groupTimelineByFile,
  groupTimelineByTimeBucket,
  selectRecentAnchors,
} from '../src/timeline';
import type { SummaryEvidenceItem } from '../src/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const COARSE_WINDOW_MS = 10 * 60_000; // 600_000
const MEDIUM_WINDOW_MS = 5 * 60_000; // 300_000
const FINE_WINDOW_MS = 2 * 60_000; // 120_000

function mkFile(id: string, label: string, capturedAt: number): SummaryEvidenceItem {
  return { id, kind: 'file', label, target: `/${label}`, capturedAt };
}

// ---------------------------------------------------------------------------
// selectRecentAnchors — window size mapping
// ---------------------------------------------------------------------------

describe('evidenceGranularityWindowMs — selectRecentAnchors', () => {
  const now = 10_000_000;

  // An item 7 minutes ago — inside coarse (10 min), outside medium (5 min) and fine (2 min).
  const at7min = now - 7 * 60_000;
  // An item 3 minutes ago — inside coarse and medium, outside fine.
  const at3min = now - 3 * 60_000;
  // An item 1 minute ago — inside all three windows.
  const at1min = now - 1 * 60_000;

  const entries: SummaryEvidenceItem[] = [
    mkFile('f7', 'seven.ts', at7min),
    mkFile('f3', 'three.ts', at3min),
    mkFile('f1', 'one.ts', at1min),
  ];

  it('coarse (10 min) includes items up to 10 minutes ago', () => {
    const rows = selectRecentAnchors(entries, 10, COARSE_WINDOW_MS, now);
    const ids = rows.map((r) => r.evidenceId);
    expect(ids).toContain('f7');
    expect(ids).toContain('f3');
    expect(ids).toContain('f1');
  });

  it('medium (5 min) excludes items older than 5 minutes', () => {
    const rows = selectRecentAnchors(entries, 10, MEDIUM_WINDOW_MS, now);
    const ids = rows.map((r) => r.evidenceId);
    expect(ids).not.toContain('f7');
    expect(ids).toContain('f3');
    expect(ids).toContain('f1');
  });

  it('fine (2 min) excludes items older than 2 minutes', () => {
    const rows = selectRecentAnchors(entries, 10, FINE_WINDOW_MS, now);
    const ids = rows.map((r) => r.evidenceId);
    expect(ids).not.toContain('f7');
    expect(ids).not.toContain('f3');
    expect(ids).toContain('f1');
  });

  it('results are always sorted newest-first regardless of window', () => {
    for (const window of [COARSE_WINDOW_MS, MEDIUM_WINDOW_MS, FINE_WINDOW_MS]) {
      const rows = selectRecentAnchors(entries, 10, window, now);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i - 1]!.timestamp).toBeGreaterThanOrEqual(rows[i]!.timestamp);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// groupTimelineByFile — window size mapping
// ---------------------------------------------------------------------------

describe('evidenceGranularityWindowMs — groupTimelineByFile', () => {
  const now = 20_000_000;

  it('coarse includes files up to 10 minutes ago', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f8', 'old.ts', now - 8 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByFile(entries, COARSE_WINDOW_MS, now);
    const paths = groups.map((g) => g.filePath);
    expect(paths).toContain('old.ts');
    expect(paths).toContain('new.ts');
  });

  it('medium excludes files older than 5 minutes', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f8', 'old.ts', now - 8 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByFile(entries, MEDIUM_WINDOW_MS, now);
    const paths = groups.map((g) => g.filePath);
    expect(paths).not.toContain('old.ts');
    expect(paths).toContain('new.ts');
  });

  it('fine excludes files older than 2 minutes', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f3', 'mid.ts', now - 3 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByFile(entries, FINE_WINDOW_MS, now);
    const paths = groups.map((g) => g.filePath);
    expect(paths).not.toContain('mid.ts');
    expect(paths).toContain('new.ts');
  });
});

// ---------------------------------------------------------------------------
// groupTimelineByTimeBucket — bucket size reflects granularity window
// ---------------------------------------------------------------------------

describe('evidenceGranularityWindowMs — groupTimelineByTimeBucket', () => {
  const now = 30_000_000;

  it('coarse bucket (10 min) labels first bucket as "Last 10 min"', () => {
    const entries: SummaryEvidenceItem[] = [mkFile('f1', 'a.ts', now - 60_000)];
    const buckets = groupTimelineByTimeBucket(entries, COARSE_WINDOW_MS, 4, now);
    expect(buckets[0]?.label).toBe('Last 10 min');
  });

  it('medium bucket (5 min) labels first bucket as "Last 5 min"', () => {
    const entries: SummaryEvidenceItem[] = [mkFile('f1', 'a.ts', now - 60_000)];
    const buckets = groupTimelineByTimeBucket(entries, MEDIUM_WINDOW_MS, 4, now);
    expect(buckets[0]?.label).toBe('Last 5 min');
  });

  it('fine bucket (2 min) labels first bucket as "Last 2 min"', () => {
    const entries: SummaryEvidenceItem[] = [mkFile('f1', 'a.ts', now - 30_000)];
    const buckets = groupTimelineByTimeBucket(entries, FINE_WINDOW_MS, 4, now);
    expect(buckets[0]?.label).toBe('Last 2 min');
  });
});

// ---------------------------------------------------------------------------
// groupTimelineByAction — window size mapping
// ---------------------------------------------------------------------------

describe('evidenceGranularityWindowMs — groupTimelineByAction', () => {
  const now = 40_000_000;

  it('coarse includes actions up to 10 minutes ago', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f9', 'old.ts', now - 9 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByAction(entries, COARSE_WINDOW_MS, now);
    const allIds = groups.flatMap((g) => g.rows.map((r) => r.evidenceId));
    expect(allIds).toContain('f9');
    expect(allIds).toContain('f1');
  });

  it('medium excludes actions older than 5 minutes', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f9', 'old.ts', now - 9 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByAction(entries, MEDIUM_WINDOW_MS, now);
    const allIds = groups.flatMap((g) => g.rows.map((r) => r.evidenceId));
    expect(allIds).not.toContain('f9');
    expect(allIds).toContain('f1');
  });

  it('fine excludes actions older than 2 minutes', () => {
    const entries: SummaryEvidenceItem[] = [
      mkFile('f3', 'mid.ts', now - 3 * 60_000),
      mkFile('f1', 'new.ts', now - 60_000),
    ];
    const groups = groupTimelineByAction(entries, FINE_WINDOW_MS, now);
    const allIds = groups.flatMap((g) => g.rows.map((r) => r.evidenceId));
    expect(allIds).not.toContain('f3');
    expect(allIds).toContain('f1');
  });
});
