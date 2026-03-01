import { createPercolationPolicyInput } from '../src/percolation/types';
import { rankCandidates } from '../src/percolation/ranking';
import {
  buildPercolationExplainabilityPayload,
  formatPercolationExplainabilityLines,
} from '../src/percolation/explainability';
import type { ResumeSummary } from '../src/types';

function buildSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'resume checkout',
    nextSteps: ['Run checkout tests'],
    nextStepEvidenceIds: [['ev-1']],
    recommendedFirstAction: 'Run checkout tests',
    topFiles: ['src/checkout.ts'],
    links: [],
    evidenceCatalog: [{ id: 'ev-1', kind: 'file', label: 'src/checkout.ts' }],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'ctx-explainability',
    generatedAt: 1_700_000_000_000,
    source: 'local',
    ...overrides,
  };
}

describe('percolation explainability payload', () => {
  it('includes surfaced item score, evidence, and reasons when ranking succeeds', () => {
    const summary = buildSummary();
    const ranking = rankCandidates(
      createPercolationPolicyInput(summary, { now: summary.generatedAt }),
    );
    const payload = buildPercolationExplainabilityPayload({
      summary,
      primary: ranking.primary,
    });

    expect(payload.surfacedItemId).toBeDefined();
    expect(payload.reasons.length).toBeGreaterThan(0);
    expect(payload.evidenceIds).toContain('ev-1');
  });

  it('includes suppression reason and missing signal lines', () => {
    const summary = buildSummary({
      nextSteps: [],
      evidenceCatalog: [],
      lowConfidence: true,
      lastFailingCommand: undefined,
    });
    const payload = buildPercolationExplainabilityPayload({
      summary,
      suppressionReason: 'no-change',
    });

    expect(payload.suppressionReason).toBe('no-change');
    expect(payload.missingSignals).toEqual([
      'Summary is marked low-confidence.',
      'No evidence items were attached to this summary.',
      'No concrete next-step signals were available.',
      'No recent failing command signal was detected.',
    ]);
  });

  it('formats stable human-readable explainability lines', () => {
    const summary = buildSummary();
    const ranking = rankCandidates(
      createPercolationPolicyInput(summary, { now: summary.generatedAt }),
    );
    const payload = buildPercolationExplainabilityPayload({
      summary,
      primary: ranking.primary,
      suppressionReason: 'cooldown',
    });

    expect(formatPercolationExplainabilityLines(payload)).toMatchInlineSnapshot(`
[
  "Surfaced item: Recommended first action",
  "Kind: recommended-action",
  "Score: 0.605",
  "Confidence: 80%",
  "Evidence IDs: ev-1",
  "Suppression: cooldown",
  "Reason: A deterministic ranking policy selected the highest-scoring candidate.",
  "Reason: Top weighted factors: urgency=0.210, actionability=0.200, continuity=0.160.",
  "Reason: Surfacing is currently suppressed by cooldown.",
  "Missing signal: No recent failing command signal was detected.",
]
`);
  });
});
