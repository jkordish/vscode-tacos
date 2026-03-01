import { createPercolationPolicyInput } from '../src/percolation/types';
import { DEFAULT_RANKING_WEIGHTS, rankCandidates } from '../src/percolation/ranking';
import type { ResumeSummary } from '../src/types';

function buildSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'resume checkout flow',
    nextSteps: ['Run checkout tests', 'Patch edge-case validation'],
    recommendedFirstAction: 'Run checkout tests',
    pendingBlocked: ['Failing command still unresolved: npm test -- checkout'],
    topFiles: ['src/checkout.ts'],
    links: [],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'ctx-ranking',
    generatedAt: 1_700_000_000_000,
    source: 'local',
    ...overrides,
  };
}

describe('rankCandidates', () => {
  it('is deterministic for the same input state', () => {
    const summary = buildSummary({
      evidenceCatalog: [
        {
          id: 'ev-1',
          kind: 'file',
          label: 'src/checkout.ts',
        },
      ],
      lastFailingCommand: 'npm test -- checkout',
    });
    const input = createPercolationPolicyInput(summary, { now: summary.generatedAt });

    const first = rankCandidates(input);
    const second = rankCandidates(input);

    expect(first).toEqual(second);
    expect(first.primary?.id).toBe('candidate:blocker');
  });

  it('uses stable tie-break ordering by kind and id', () => {
    const summary = buildSummary({
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      nextSteps: [],
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      candidates: [
        {
          id: 'b-item',
          kind: 'status',
          title: 'B',
          detail: '',
          confidence: 0.5,
          urgency: 0.5,
          novelty: 0.5,
          interruptCost: 0.5,
        },
        {
          id: 'a-item',
          kind: 'status',
          title: 'A',
          detail: '',
          confidence: 0.5,
          urgency: 0.5,
          novelty: 0.5,
          interruptCost: 0.5,
        },
      ],
    });

    const ranked = rankCandidates(input);
    expect(ranked.ranked.map((item) => item.id)).toEqual(['a-item', 'b-item']);
  });

  it('returns inspectable score breakdowns with fixed weights', () => {
    const summary = buildSummary({
      evidenceCatalog: [
        {
          id: 'ev-1',
          kind: 'file',
          label: 'src/checkout.ts',
        },
      ],
      lastFailingCommand: 'npm test -- checkout',
    });
    const input = createPercolationPolicyInput(summary, { now: summary.generatedAt });
    const ranked = rankCandidates(input, { weights: DEFAULT_RANKING_WEIGHTS });

    expect(
      ranked.ranked.map((item) => ({
        id: item.id,
        score: item.score,
        scoreBreakdown: item.scoreBreakdown,
      })),
    ).toMatchInlineSnapshot(`
[
  {
    "id": "candidate:blocker",
    "score": 0.633,
    "scoreBreakdown": {
      "actionability": 0.2,
      "confidence": 0.038,
      "continuity": 0.14,
      "interruptCost": 0.055,
      "novelty": 0.04,
      "total": 0.633,
      "urgency": 0.27,
    },
  },
  {
    "id": "candidate:recommended-first-action",
    "score": 0.605,
    "scoreBreakdown": {
      "actionability": 0.2,
      "confidence": 0.04,
      "continuity": 0.16,
      "interruptCost": 0.045,
      "novelty": 0.04,
      "total": 0.605,
      "urgency": 0.21,
    },
  },
  {
    "id": "candidate:next-step",
    "score": 0.596,
    "scoreBreakdown": {
      "actionability": 0.2,
      "confidence": 0.036,
      "continuity": 0.16,
      "interruptCost": 0.035,
      "novelty": 0.04,
      "total": 0.596,
      "urgency": 0.195,
    },
  },
  {
    "id": "candidate:evidence",
    "score": 0.47,
    "scoreBreakdown": {
      "actionability": 0.2,
      "confidence": 0.04,
      "continuity": 0.1,
      "interruptCost": 0.015,
      "novelty": 0.025,
      "total": 0.47,
      "urgency": 0.12,
    },
  },
]
`);
  });
});
