import type { SummaryEvidenceItem } from './types';

export type TimelineGroupKey = 'files' | 'terminal' | 'debugTasks' | 'urls' | 'git';

export interface TimelineRow {
  evidenceId: string;
  kind: SummaryEvidenceItem['kind'];
  label: string;
  detail?: string;
  timestamp: number;
  relativeTime: string;
  clickable: boolean;
}

export interface TimelineGroup {
  key: TimelineGroupKey;
  label: string;
  rows: TimelineRow[];
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
  const sorted = evidenceCatalog
    .map((item, index) => {
      const timestamp = resolveEvidenceTimestamp(item, now, index);
      return {
        evidenceId: item.id,
        kind: item.kind,
        label: item.label,
        detail: resolveEvidenceDetail(item),
        timestamp,
        relativeTime: formatRelativeTime(timestamp, now),
        clickable: isEvidenceTimelineClickable(item),
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
