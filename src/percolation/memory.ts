import type { SurfacedItem, SurfacedItemKind } from './types';

export type PercolationMemoryStatus = 'dismissed' | 'snoozed';

export interface PercolationMemoryRecord {
  contextHash: string;
  itemKind: SurfacedItemKind;
  status: PercolationMemoryStatus;
  at: number;
  until: number;
}

export type PercolationMemoryStore = Record<string, PercolationMemoryRecord>;

export interface PercolationMemoryDecision {
  suppressed: boolean;
  status?: PercolationMemoryStatus;
  nextEligibleAt?: number;
}

const VALID_SURFACED_ITEM_KINDS = new Set<SurfacedItemKind>([
  'clarification',
  'recommended-action',
  'next-step',
  'blocked',
  'restore',
  'evidence',
  'trust-privacy',
  'status',
]);

function isSurfacedItemKind(value: unknown): value is SurfacedItemKind {
  return typeof value === 'string' && VALID_SURFACED_ITEM_KINDS.has(value as SurfacedItemKind);
}

function isPercolationMemoryStatus(value: unknown): value is PercolationMemoryStatus {
  return value === 'dismissed' || value === 'snoozed';
}

function toPositiveFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

interface ParsedPercolationMemoryKey {
  contextHash: string;
  itemKind: SurfacedItemKind;
}

function parsePercolationMemoryRecordKey(value: string): ParsedPercolationMemoryKey | undefined {
  const delimiterIndex = value.indexOf('::');
  if (delimiterIndex <= 0 || delimiterIndex >= value.length - 2) {
    return undefined;
  }

  const contextHash = value.slice(0, delimiterIndex).trim();
  const kindCandidate = value.slice(delimiterIndex + 2).trim();
  if (!contextHash || !isSurfacedItemKind(kindCandidate)) {
    return undefined;
  }

  return {
    contextHash,
    itemKind: kindCandidate,
  };
}

export function buildPercolationMemoryRecordKey(
  contextHash: string,
  itemKind: SurfacedItemKind,
): string {
  const trimmedContextHash = contextHash.trim();
  if (!trimmedContextHash) {
    return '';
  }

  return `${trimmedContextHash}::${itemKind}`;
}

export function parsePercolationMemoryRecord(
  value: unknown,
  fallbackContextHash?: string,
  fallbackItemKind?: SurfacedItemKind,
): PercolationMemoryRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const contextHashCandidate =
    typeof record.contextHash === 'string' ? record.contextHash.trim() : '';
  const fallbackContext = (fallbackContextHash ?? '').trim();
  const contextHash = contextHashCandidate || fallbackContext;

  const itemKindCandidate = isSurfacedItemKind(record.itemKind) ? record.itemKind : undefined;
  const itemKind = itemKindCandidate ?? fallbackItemKind;
  const status = record.status;
  const at = toPositiveFiniteNumber(record.at);
  const until = toPositiveFiniteNumber(record.until);

  if (!contextHash || !itemKind || !isPercolationMemoryStatus(status) || !at || !until) {
    return undefined;
  }

  return {
    contextHash,
    itemKind,
    status,
    at,
    until: Math.max(until, at),
  };
}

export function parsePercolationMemoryStore(value: unknown): PercolationMemoryStore {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const singleRecord = parsePercolationMemoryRecord(value);
  if (singleRecord) {
    const key = buildPercolationMemoryRecordKey(singleRecord.contextHash, singleRecord.itemKind);
    if (!key) {
      return {};
    }

    return {
      [key]: singleRecord,
    };
  }

  const store: PercolationMemoryStore = {};
  for (const [rawKey, rawRecord] of Object.entries(value)) {
    const parsedKey = parsePercolationMemoryRecordKey(rawKey);
    const parsedRecord = parsePercolationMemoryRecord(
      rawRecord,
      parsedKey?.contextHash ?? rawKey,
      parsedKey?.itemKind,
    );
    if (!parsedRecord) {
      continue;
    }

    const canonicalKey = buildPercolationMemoryRecordKey(
      parsedRecord.contextHash,
      parsedRecord.itemKind,
    );
    if (!canonicalKey) {
      continue;
    }
    store[canonicalKey] = parsedRecord;
  }

  return store;
}

export function trimPercolationMemoryStore(
  store: PercolationMemoryStore,
  maxEntries: number,
): PercolationMemoryStore {
  if (maxEntries <= 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(store)
      .sort(([leftKey, left], [rightKey, right]) => {
        if (left.until !== right.until) {
          return right.until - left.until;
        }
        if (left.at !== right.at) {
          return right.at - left.at;
        }
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, maxEntries),
  );
}

export function upsertPercolationMemoryRecord(
  store: PercolationMemoryStore,
  record: PercolationMemoryRecord,
  maxEntries: number,
): PercolationMemoryStore {
  const key = buildPercolationMemoryRecordKey(record.contextHash, record.itemKind);
  if (!key) {
    return trimPercolationMemoryStore(store, maxEntries);
  }

  return trimPercolationMemoryStore(
    {
      ...store,
      [key]: {
        ...record,
        contextHash: record.contextHash.trim(),
      },
    },
    maxEntries,
  );
}

export function resolvePercolationMemoryDecision(
  store: PercolationMemoryStore,
  contextHash: string,
  itemKind: SurfacedItemKind,
  now: number,
): PercolationMemoryDecision {
  const key = buildPercolationMemoryRecordKey(contextHash, itemKind);
  if (!key) {
    return { suppressed: false };
  }

  const record = store[key];
  if (!record || record.until <= now) {
    return { suppressed: false };
  }

  return {
    suppressed: true,
    status: record.status,
    nextEligibleAt: record.until,
  };
}

export function filterSurfacedItemsByPercolationMemory(
  items: SurfacedItem[],
  store: PercolationMemoryStore,
  contextHash: string,
  now: number,
): SurfacedItem[] {
  if (!contextHash.trim() || items.length === 0) {
    return items;
  }

  return items.filter(
    (item) => !resolvePercolationMemoryDecision(store, contextHash, item.kind, now).suppressed,
  );
}
