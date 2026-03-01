import {
  buildPercolationMemoryRecordKey,
  filterSurfacedItemsByPercolationMemory,
  parsePercolationMemoryStore,
  resolvePercolationMemoryDecision,
  trimPercolationMemoryStore,
  upsertPercolationMemoryRecord,
} from '../src/percolation/memory';
import type { SurfacedItem } from '../src/percolation/types';

describe('percolation memory helpers', () => {
  it('builds deterministic context+kind keys', () => {
    expect(buildPercolationMemoryRecordKey('  ctx-1  ', 'status')).toBe('ctx-1::status');
    expect(buildPercolationMemoryRecordKey('   ', 'status')).toBe('');
  });

  it('parses and sanitizes a raw memory store while skipping invalid records', () => {
    const store = parsePercolationMemoryStore({
      'ctx-1::status': {
        status: 'dismissed',
        at: 100,
        until: 200,
      },
      'ctx-2::recommended-action': {
        contextHash: 'ctx-2',
        itemKind: 'recommended-action',
        status: 'snoozed',
        at: 50,
        until: 40,
      },
      'ctx-3::unknown-kind': {
        status: 'dismissed',
        at: 1,
        until: 2,
      },
      broken: 42,
    });

    expect(Object.keys(store)).toEqual(['ctx-1::status', 'ctx-2::recommended-action']);
    expect(store['ctx-1::status']).toEqual({
      contextHash: 'ctx-1',
      itemKind: 'status',
      status: 'dismissed',
      at: 100,
      until: 200,
    });
    expect(store['ctx-2::recommended-action']).toEqual({
      contextHash: 'ctx-2',
      itemKind: 'recommended-action',
      status: 'snoozed',
      at: 50,
      until: 50,
    });
  });

  it('suppresses only until next eligible time for matching context and kind', () => {
    const store = parsePercolationMemoryStore({
      'ctx-1::status': {
        status: 'dismissed',
        at: 100,
        until: 250,
      },
    });

    expect(resolvePercolationMemoryDecision(store, 'ctx-1', 'status', 200)).toEqual({
      suppressed: true,
      status: 'dismissed',
      nextEligibleAt: 250,
    });
    expect(resolvePercolationMemoryDecision(store, 'ctx-1', 'status', 250)).toEqual({
      suppressed: false,
    });
    expect(resolvePercolationMemoryDecision(store, 'ctx-1', 'next-step', 200)).toEqual({
      suppressed: false,
    });
  });

  it('filters surfaced items by memory while preserving deterministic order', () => {
    const candidates: SurfacedItem[] = [
      {
        id: 'item-1',
        kind: 'status',
        title: 'status item',
        detail: '',
        confidence: 0.8,
        urgency: 0.4,
        novelty: 0.2,
        interruptCost: 0.1,
        evidenceIds: [],
        meta: {},
      },
      {
        id: 'item-2',
        kind: 'recommended-action',
        title: 'recommended item',
        detail: '',
        confidence: 0.8,
        urgency: 0.4,
        novelty: 0.2,
        interruptCost: 0.1,
        evidenceIds: [],
        meta: {},
      },
    ];
    const store = parsePercolationMemoryStore({
      'ctx-a::status': {
        status: 'dismissed',
        at: 100,
        until: 400,
      },
    });

    const filtered = filterSurfacedItemsByPercolationMemory(candidates, store, 'ctx-a', 200);
    expect(filtered.map((item) => item.id)).toEqual(['item-2']);
  });

  it('upserts and trims memory store by recency window', () => {
    let store = parsePercolationMemoryStore({});
    store = upsertPercolationMemoryRecord(
      store,
      {
        contextHash: 'ctx-1',
        itemKind: 'status',
        status: 'dismissed',
        at: 100,
        until: 200,
      },
      2,
    );
    store = upsertPercolationMemoryRecord(
      store,
      {
        contextHash: 'ctx-2',
        itemKind: 'status',
        status: 'dismissed',
        at: 150,
        until: 400,
      },
      2,
    );
    store = upsertPercolationMemoryRecord(
      store,
      {
        contextHash: 'ctx-3',
        itemKind: 'status',
        status: 'snoozed',
        at: 175,
        until: 300,
      },
      2,
    );

    expect(Object.keys(trimPercolationMemoryStore(store, 2))).toEqual([
      'ctx-2::status',
      'ctx-3::status',
    ]);
  });
});
