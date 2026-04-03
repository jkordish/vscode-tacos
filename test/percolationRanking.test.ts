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
         "score": 0.595,
         "scoreBreakdown": {
           "actionability": 0.176,
           "confidence": 0.038,
           "continuity": 0.126,
           "interruptCost": 0.05,
           "novelty": 0.053,
           "total": 0.595,
           "urgency": 0.252,
           "userPrior": 0,
         },
       },
       {
         "id": "candidate:recommended-first-action",
         "score": 0.562,
         "scoreBreakdown": {
           "actionability": 0.176,
           "confidence": 0.04,
           "continuity": 0.144,
           "interruptCost": 0.041,
           "novelty": 0.047,
           "total": 0.562,
           "urgency": 0.196,
           "userPrior": 0,
         },
       },
       {
         "id": "candidate:next-step",
         "score": 0.549,
         "scoreBreakdown": {
           "actionability": 0.176,
           "confidence": 0.036,
           "continuity": 0.144,
           "interruptCost": 0.032,
           "novelty": 0.043,
           "total": 0.549,
           "urgency": 0.182,
           "userPrior": 0,
         },
       },
       {
         "id": "candidate:evidence",
         "score": 0.429,
         "scoreBreakdown": {
           "actionability": 0.176,
           "confidence": 0.04,
           "continuity": 0.09,
           "interruptCost": 0.014,
           "novelty": 0.025,
           "total": 0.429,
           "urgency": 0.112,
           "userPrior": 0,
         },
       },
     ]
    `);
  });

  it('prioritizes clarification fallback when summary confidence is low', () => {
    const summary = buildSummary({
      lowConfidence: true,
      lastFailingCommand: 'npm test -- checkout',
      nextStepEvidenceIds: [['ev-1']],
      evidenceCatalog: [
        {
          id: 'ev-1',
          kind: 'file',
          label: 'src/checkout.ts',
        },
      ],
    });
    const input = createPercolationPolicyInput(summary, { now: summary.generatedAt });

    const ranked = rankCandidates(input);

    expect(ranked.primary?.id).toBe('candidate:clarification');
    expect(ranked.primary?.kind).toBe('clarification');
  });

  it('promotes candidates that match an open checkpoint note prior', () => {
    const summary = buildSummary({
      pendingBlocked: undefined,
      recommendedFirstAction: undefined,
      nextSteps: [],
      evidenceCatalog: undefined,
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        checkpointNoteText: 'Run checkout tests before shipping',
      },
      candidates: [
        {
          id: 'candidate:checkpoint-match',
          kind: 'next-step',
          title: 'Run checkout tests',
          detail: 'Validate checkout flows before release',
          confidence: 0.6,
          urgency: 0.62,
          novelty: 0.4,
          interruptCost: 0.3,
        },
        {
          id: 'candidate:other',
          kind: 'next-step',
          title: 'Update docs',
          detail: 'Refresh release checklist docs',
          confidence: 0.6,
          urgency: 0.62,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    const ranked = rankCandidates(input);
    expect(ranked.primary?.id).toBe('candidate:checkpoint-match');
    expect(ranked.primary?.meta.priorPromotionCheckpoint).toBe(true);
    expect((ranked.primary?.meta.priorPromotion as number) ?? 0).toBeGreaterThan(0);
  });

  it('applies correction precedence when checkpoint and correction priors conflict', () => {
    const summary = buildSummary({
      pendingBlocked: undefined,
      recommendedFirstAction: undefined,
      nextSteps: [],
      evidenceCatalog: undefined,
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        checkpointNoteText: 'Ship release immediately',
        correctionHints: ['intent is parser stabilization and test failures'],
      },
      candidates: [
        {
          id: 'candidate:ship-release',
          kind: 'recommended-action',
          title: 'Ship release immediately',
          detail: 'Tag and publish release artifacts',
          confidence: 0.72,
          urgency: 0.65,
          novelty: 0.35,
          interruptCost: 0.35,
        },
        {
          id: 'candidate:parser-fix',
          kind: 'next-step',
          title: 'Stabilize parser tests',
          detail: 'Fix parser test failures before release',
          confidence: 0.72,
          urgency: 0.65,
          novelty: 0.35,
          interruptCost: 0.35,
        },
      ],
    });

    const ranked = rankCandidates(input);
    expect(ranked.primary?.id).toBe('candidate:parser-fix');
    const shipRelease = ranked.ranked.find((item) => item.id === 'candidate:ship-release');
    expect(shipRelease?.meta.priorConflictResolution).toBe('corrections-precedence');
    expect(shipRelease?.meta.priorSuppressionCorrections).toBe(true);
    expect(((shipRelease?.meta.priorSuppression as number) ?? 0) > 0).toBe(true);
  });
});
