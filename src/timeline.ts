import type { SummaryEvidenceItem } from './types';

export type TimelineGroupKey = 'files' | 'terminal' | 'debugTasks' | 'urls' | 'git';
export type EvidenceGroupMode = 'recent' | 'by-file' | 'by-time' | 'by-action';

export interface RecentAnchorRow {
  evidenceId: string;
  kind: SummaryEvidenceItem['kind'];
  label: string;
  detail?: string;
  timestamp: number;
  relativeTime: string;
  clickable: boolean;
}

export interface EvidenceFileGroup {
  filePath: string;
  rows: RecentAnchorRow[];
}

export interface EvidenceTimeBucket {
  label: string;
  startMs: number;
  rows: RecentAnchorRow[];
}

export type EvidenceRelevanceGroupKey = 'primary' | 'openable' | 'context';

export interface TimelineRow {
  evidenceId: string;
  kind: SummaryEvidenceItem['kind'];
  label: string;
  detail?: string;
  timestamp: number;
  relativeTime: string;
  clickable: boolean;
  interactionHint: 'Open' | 'Not clickable';
}

export interface TimelineGroup {
  key: TimelineGroupKey;
  label: string;
  rows: TimelineRow[];
}

export interface EvidenceRelevanceGroup {
  key: EvidenceRelevanceGroupKey;
  label: string;
  items: SummaryEvidenceItem[];
}

const GROUP_ORDER: TimelineGroupKey[] = ['files', 'terminal', 'debugTasks', 'urls', 'git'];

const GROUP_LABELS: Record<TimelineGroupKey, string> = {
  files: 'Files',
  terminal: 'Terminal',
  debugTasks: 'Debug / Tasks',
  urls: 'URLs',
  git: 'Git',
};

function timelineGroupForKind(kind: SummaryEvidenceItem['kind']): TimelineGroupKey {
  switch (kind) {
    case 'file':
      return 'files';
    case 'url':
      return 'urls';
    case 'terminal':
      return 'terminal';
    case 'debug':
    case 'task':
      return 'debugTasks';
    case 'branch':
    case 'commit':
    case 'git':
      return 'git';
    default:
      return 'git';
  }
}

export function isEvidenceTimelineClickable(item: SummaryEvidenceItem): boolean {
  return item.kind === 'file' || item.kind === 'url';
}

function resolveEvidenceTimestamp(item: SummaryEvidenceItem, now: number, index: number): number {
  if (
    typeof item.capturedAt === 'number' &&
    Number.isFinite(item.capturedAt) &&
    item.capturedAt > 0
  ) {
    return item.capturedAt;
  }

  const fromMeta = item.meta?.capturedAt;
  if (typeof fromMeta === 'number' && Number.isFinite(fromMeta) && fromMeta > 0) {
    return fromMeta;
  }

  return now - index * 30_000;
}

function resolveEvidenceDetail(item: SummaryEvidenceItem): string | undefined {
  if (item.kind === 'url' && typeof item.target === 'string') {
    return item.target;
  }

  const statusLine = item.meta?.statusLine;
  if (typeof statusLine === 'string' && statusLine.trim()) {
    return statusLine.trim();
  }

  return undefined;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const deltaMs = Math.max(0, now - timestamp);
  if (deltaMs < 30_000) {
    return 'just now';
  }

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function buildTimelineGroups(
  evidenceCatalog: SummaryEvidenceItem[],
  now = Date.now(),
): TimelineGroup[] {
  type PreparedTimelineRow = TimelineRow & { group: TimelineGroupKey };
  const sorted = evidenceCatalog
    .map<PreparedTimelineRow>((item, index) => {
      const timestamp = resolveEvidenceTimestamp(item, now, index);
      const clickable = isEvidenceTimelineClickable(item);
      return {
        evidenceId: item.id,
        kind: item.kind,
        label: item.label,
        detail: resolveEvidenceDetail(item),
        timestamp,
        relativeTime: formatRelativeTime(timestamp, now),
        clickable,
        interactionHint: clickable ? 'Open' : 'Not clickable',
        group: timelineGroupForKind(item.kind),
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const grouped = new Map<TimelineGroupKey, TimelineRow[]>();
  for (const item of sorted) {
    const existing = grouped.get(item.group) ?? [];
    existing.push({
      evidenceId: item.evidenceId,
      kind: item.kind,
      label: item.label,
      detail: item.detail,
      timestamp: item.timestamp,
      relativeTime: item.relativeTime,
      clickable: item.clickable,
      interactionHint: item.interactionHint,
    });
    grouped.set(item.group, existing);
  }

  return GROUP_ORDER.map((key) => {
    const rows = grouped.get(key) ?? [];
    return {
      key,
      label: GROUP_LABELS[key],
      rows,
    };
  }).filter((group) => group.rows.length > 0);
}

export function buildEvidenceRelevanceGroups(
  evidenceCatalog: SummaryEvidenceItem[],
  primaryEvidenceIds: string[] = [],
): EvidenceRelevanceGroup[] {
  if (evidenceCatalog.length === 0) {
    return [];
  }

  const primaryEvidenceIdSet = new Set(
    primaryEvidenceIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  const primary = evidenceCatalog.filter((item) => primaryEvidenceIdSet.has(item.id));
  const remaining = evidenceCatalog.filter((item) => !primaryEvidenceIdSet.has(item.id));
  const openable = remaining.filter((item) => isEvidenceTimelineClickable(item));
  const contextOnly = remaining.filter((item) => !isEvidenceTimelineClickable(item));
  const groups: EvidenceRelevanceGroup[] = [];

  if (primary.length > 0) {
    groups.push({
      key: 'primary',
      label: 'For this surfaced decision',
      items: primary,
    });
  }

  if (openable.length > 0) {
    groups.push({
      key: 'openable',
      label: primary.length > 0 ? 'Other openable evidence' : 'Openable evidence',
      items: openable,
    });
  }

  if (contextOnly.length > 0) {
    groups.push({
      key: 'context',
      label: 'Context-only evidence',
      items: contextOnly,
    });
  }

  return groups;
}

/**
 * Returns at most `count` evidence items from within the last `windowMs` milliseconds,
 * sorted by timestamp descending (most recent first).
 */
export function selectRecentAnchors(
  entries: SummaryEvidenceItem[],
  count = 10,
  windowMs = 5 * 60_000,
  now = Date.now(),
): RecentAnchorRow[] {
  const cutoff = now - windowMs;
  const result: RecentAnchorRow[] = [];

  const sorted = [...entries].sort((a, b) => {
    const ta = typeof a.capturedAt === 'number' && a.capturedAt > 0 ? a.capturedAt : 0;
    const tb = typeof b.capturedAt === 'number' && b.capturedAt > 0 ? b.capturedAt : 0;
    return tb - ta;
  });

  for (let i = 0; i < sorted.length && result.length < count; i++) {
    const item = sorted[i]!;
    const ts =
      typeof item.capturedAt === 'number' && item.capturedAt > 0
        ? item.capturedAt
        : now - i * 30_000;
    if (ts < cutoff) {
      break;
    }
    result.push({
      evidenceId: item.id,
      kind: item.kind,
      label: item.label,
      detail: resolveEvidenceDetail(item),
      timestamp: ts,
      relativeTime: formatRelativeTime(ts, now),
      clickable: isEvidenceTimelineClickable(item),
    });
  }

  return result;
}

/**
 * Groups evidence items by their base file path within a time window.
 * Non-file items appear under the label of their kind (e.g. "terminal").
 */
export function groupTimelineByFile(
  entries: SummaryEvidenceItem[],
  windowMs = 5 * 60_000,
  now = Date.now(),
): EvidenceFileGroup[] {
  const cutoff = now - windowMs;
  const fileGroupMap = new Map<string, RecentAnchorRow[]>();

  const sorted = [...entries].sort((a, b) => {
    const ta = typeof a.capturedAt === 'number' && a.capturedAt > 0 ? a.capturedAt : 0;
    const tb = typeof b.capturedAt === 'number' && b.capturedAt > 0 ? b.capturedAt : 0;
    return tb - ta;
  });

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const ts =
      typeof item.capturedAt === 'number' && item.capturedAt > 0
        ? item.capturedAt
        : now - i * 30_000;
    if (ts < cutoff) {
      continue;
    }

    const fileKey = item.kind === 'file' ? item.label : `[${item.kind}]`;
    const existing = fileGroupMap.get(fileKey) ?? [];
    existing.push({
      evidenceId: item.id,
      kind: item.kind,
      label: item.label,
      detail: resolveEvidenceDetail(item),
      timestamp: ts,
      relativeTime: formatRelativeTime(ts, now),
      clickable: isEvidenceTimelineClickable(item),
    });
    fileGroupMap.set(fileKey, existing);
  }

  const groups: EvidenceFileGroup[] = [];
  for (const [filePath, rows] of fileGroupMap) {
    groups.push({ filePath, rows });
  }
  // Sort groups by the most recent row in each group
  groups.sort((a, b) => (b.rows[0]?.timestamp ?? 0) - (a.rows[0]?.timestamp ?? 0));
  return groups;
}

/**
 * Groups evidence items into fixed time buckets (e.g. "0–5 min ago", "5–10 min ago").
 */
export function groupTimelineByTimeBucket(
  entries: SummaryEvidenceItem[],
  bucketSizeMs = 5 * 60_000,
  bucketCount = 4,
  now = Date.now(),
): EvidenceTimeBucket[] {
  const buckets: EvidenceTimeBucket[] = [];
  for (let b = 0; b < bucketCount; b++) {
    const startMs = now - (b + 1) * bucketSizeMs;
    const endMs = now - b * bucketSizeMs;
    const bucketMinStart = b * Math.floor(bucketSizeMs / 60_000);
    const bucketMinEnd = (b + 1) * Math.floor(bucketSizeMs / 60_000);
    buckets.push({
      label: b === 0 ? `Last ${bucketMinEnd} min` : `${bucketMinStart}–${bucketMinEnd} min ago`,
      startMs,
      rows: [],
    });

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i]!;
      const ts =
        typeof item.capturedAt === 'number' && item.capturedAt > 0
          ? item.capturedAt
          : now - i * 30_000;
      if (ts >= startMs && ts < endMs) {
        buckets[b]!.rows.push({
          evidenceId: item.id,
          kind: item.kind,
          label: item.label,
          detail: resolveEvidenceDetail(item),
          timestamp: ts,
          relativeTime: formatRelativeTime(ts, now),
          clickable: isEvidenceTimelineClickable(item),
        });
      }
    }
    // Sort each bucket newest-first
    buckets[b]!.rows.sort((a, b) => b.timestamp - a.timestamp);
  }
  return buckets.filter((bkt) => bkt.rows.length > 0);
}
