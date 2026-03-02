import {
  PERCOLATION_SCHEMA_VERSION,
  createPercolationPolicyInput,
  normalizePercolationDecision,
  normalizeSignal,
  normalizeSurfacedItem,
} from '../src/percolation/types';
import type { ResumeSummary } from '../src/types';

function buildSummary(overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return {
    intent: 'continue auth fix',
    nextSteps: ['Run auth tests', 'Fix failing assertion'],
    recommendedFirstAction: 'Run auth tests',
    pendingBlocked: ['Failing command still unresolved: npm test -- auth'],
    topFiles: ['src/auth.ts'],
    links: [],
    evidenceCatalog: [
      {
        id: 'ev-1',
        kind: 'file',
        label: 'src/auth.ts',
      },
    ],
    detailsMarkdown: 'details',
    codexPrompt: 'prompt',
    contextHash: 'ctx-123',
    generatedAt: 1_700_000_000_000,
    source: 'local',
    ...overrides,
  };
}

describe('percolation type normalization', () => {
  it('normalizes signal defaults and clamps scoring fields', () => {
    const normalized = normalizeSignal(
      {
        kind: 'task-failure',
        confidence: 2,
        actionability: -2,
        interruptCost: 0.75,
        meta: {
          ok: true,
          nope: { nested: 'value' },
          text: 'x',
        },
      },
      100,
    );

    expect(normalized).toEqual({
      id: 'signal:task-failure',
      kind: 'task-failure',
      observedAt: 100,
      confidence: 1,
      actionability: 0,
      interruptCost: 0.75,
      meta: {
        ok: true,
        text: 'x',
      },
    });
  });

  it('falls back safely when signal and surfaced identifiers are non-string at runtime', () => {
    const signal = normalizeSignal(
      {
        id: 42 as unknown as string,
        kind: 'context-change',
      },
      100,
    );

    const surfaced = normalizeSurfacedItem({
      id: { bad: true } as unknown as string,
      kind: 'status',
      title: ['not-a-string'] as unknown as string,
      detail: 7 as unknown as string,
      actionId: false as unknown as string,
    });

    expect(signal.id).toBe('signal:context-change');
    expect(surfaced.id).toBe('item:status:item');
    expect(surfaced.title).toBe('Untitled surfaced item');
    expect(surfaced.detail).toBe('');
    expect(surfaced.actionId).toBeUndefined();
  });

  it('normalizes surfaced item defaults, ids, and evidence ids', () => {
    const normalized = normalizeSurfacedItem({
      kind: 'next-step',
      title: '  Resume build  ',
      detail: '  run npm test  ',
      confidence: 0.88,
      urgency: 5,
      novelty: -1,
      interruptCost: Number.NaN,
      evidenceIds: ['ev-2', 'ev-1', 'ev-1', ' ', 10 as unknown as string],
      meta: {
        rank: 1,
        ignore: { deep: true },
      },
    });

    expect(normalized).toEqual({
      id: 'item:next-step:resume-build',
      kind: 'next-step',
      title: 'Resume build',
      detail: 'run npm test',
      actionId: undefined,
      confidence: 0.88,
      urgency: 1,
      novelty: 0,
      interruptCost: 0.5,
      evidenceIds: ['ev-1', 'ev-2'],
      meta: {
        rank: 1,
      },
    });
  });

  it('falls back to a stable item token when title is blank or punctuation-only', () => {
    const normalized = normalizeSurfacedItem({
      kind: 'status',
      title: '   ---   ',
      detail: '',
    });

    expect(normalized.id).toBe('item:status:item');
  });

  it('normalizes decision payload with explainability defaults', () => {
    const decision = normalizePercolationDecision({
      primary: {
        kind: 'status',
        title: 'Overview',
      },
      explain: {
        summary: '  ranked by urgency  ',
        reasons: ['  blocker detected  ', '', 12 as unknown as string],
        evidenceIds: ['ev-2', 'ev-1', 'ev-1'],
      },
      nextEligibleAt: -10,
    });

    expect(decision.primary?.title).toBe('Overview');
    expect(decision.nextEligibleAt).toBe(0);
    expect(decision.explain).toEqual({
      summary: 'ranked by urgency',
      reasons: ['blocker detected'],
      evidenceIds: ['ev-1', 'ev-2'],
    });
  });

  it('treats non-string explain summary values as empty', () => {
    const decision = normalizePercolationDecision({
      explain: {
        summary: 123 as unknown as string,
      },
    });

    expect(decision.explain.summary).toBe('');
  });
});

describe('createPercolationPolicyInput', () => {
  it('adapts an existing resume summary with deterministic defaults', () => {
    const summary = buildSummary({
      currentBranch: 'feature/auth',
      previousBranch: 'main',
      lastFailingCommand: 'npm test -- auth',
    });
    const now = 1_700_100_000_000;

    const first = createPercolationPolicyInput(summary, { now });
    const second = createPercolationPolicyInput(summary, { now });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(PERCOLATION_SCHEMA_VERSION);
    expect(first.contextHash).toBe('ctx-123');
    expect(first.mode).toBe('active');
    expect(first.signals.map((signal) => signal.kind)).toEqual([
      'resume',
      'branch-switch',
      'task-failure',
    ]);
    expect(first.candidates.map((candidate) => candidate.kind)).toEqual([
      'recommended-action',
      'blocked',
      'next-step',
      'evidence',
    ]);
  });

  it('adds a clarification fallback candidate when summary confidence is low', () => {
    const summary = buildSummary({
      lowConfidence: true,
      nextSteps: ['Add a checkpoint note before risky reruns'],
      nextStepEvidenceIds: [['ev-1']],
    });

    const input = createPercolationPolicyInput(summary, { now: summary.generatedAt });

    expect(input.candidates[0]).toMatchObject({
      id: 'candidate:clarification',
      kind: 'clarification',
      title: 'Clarify next safe step',
      actionId: 'sessionAddCheckpoint',
      evidenceIds: ['ev-1'],
    });
  });

  it('feeds summary novelty profile into default candidate novelty scores', () => {
    const highNoveltySummary = buildSummary({
      noveltyProfile: {
        score: 0.9,
        bucket: 'high',
        changedFilesCount: 6,
        runCount: 3,
        blockerCount: 1,
        keyFileCount: 3,
        linkCount: 1,
        gitContextCount: 2,
      },
    });
    const lowNoveltySummary = buildSummary({
      noveltyProfile: {
        score: 0.1,
        bucket: 'low',
        changedFilesCount: 0,
        runCount: 0,
        blockerCount: 0,
        keyFileCount: 0,
        linkCount: 0,
        gitContextCount: 0,
      },
      lastFailingCommand: undefined,
    });

    const highInput = createPercolationPolicyInput(highNoveltySummary, {
      now: highNoveltySummary.generatedAt,
    });
    const lowInput = createPercolationPolicyInput(lowNoveltySummary, {
      now: lowNoveltySummary.generatedAt,
    });
    const highRecommended = highInput.candidates.find(
      (candidate) => candidate.kind === 'recommended-action',
    );
    const lowRecommended = lowInput.candidates.find(
      (candidate) => candidate.kind === 'recommended-action',
    );

    expect((highRecommended?.novelty ?? 0) > (lowRecommended?.novelty ?? 1)).toBe(true);
    expect(highRecommended?.meta.noveltyBucket).toBe('high');
    expect(lowRecommended?.meta.noveltyBucket).toBe('low');
  });

  it('uses explicit signals and candidates when provided', () => {
    const summary = buildSummary();
    const input = createPercolationPolicyInput(summary, {
      now: 42,
      mode: 'restricted',
      signals: [
        {
          id: 'custom-signal',
          kind: 'privacy-change',
          confidence: 0.9,
          actionability: 0.2,
          interruptCost: 0.1,
          observedAt: 12,
        },
      ],
      candidates: [
        {
          id: 'custom-item',
          kind: 'trust-privacy',
          title: 'Review privacy posture',
          detail: 'restricted mode active',
          confidence: 0.7,
          urgency: 0.8,
          novelty: 0.2,
          interruptCost: 0.1,
        },
      ],
    });

    expect(input.now).toBe(42);
    expect(input.mode).toBe('restricted');
    expect(input.signals).toHaveLength(1);
    expect(input.signals[0]).toEqual({
      id: 'custom-signal',
      kind: 'privacy-change',
      observedAt: 12,
      confidence: 0.9,
      actionability: 0.2,
      interruptCost: 0.1,
      meta: {},
    });
    expect(input.candidates).toHaveLength(1);
    expect(input.candidates[0]).toMatchObject({
      id: 'custom-item',
      kind: 'trust-privacy',
      title: 'Review privacy posture',
    });
  });

  it('annotates candidates with deterministic user-authored prior metadata', () => {
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        checkpointNoteText: 'Run auth tests before release',
        correctionHints: ['run auth tests stabilize token refresh'],
        scratchpadExcerpt: 'Auth tests are flaky around token refresh',
        scratchpadHasContent: true,
      },
      candidates: [
        {
          id: 'candidate:auth-tests',
          kind: 'next-step',
          title: 'Run auth tests',
          detail: 'Stabilize token refresh before release',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    expect(input.candidates[0]?.meta).toMatchObject({
      userPriorApplied: true,
      priorPromotionCheckpoint: true,
      priorPromotionCorrections: true,
      priorPromotionScratchpad: true,
    });
    expect(((input.candidates[0]?.meta.priorPromotion as number) ?? 0) > 0).toBe(true);
  });

  it('does not attribute suppression to corrections when only stale checkpoint suppression applies', () => {
    const now = Date.UTC(2026, 2, 2, 12, 0, 0);
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
      userCorrections: [],
    });
    const input = createPercolationPolicyInput(summary, {
      now,
      priors: {
        checkpointNoteText: 'legacy release handoff',
        checkpointUpdatedAt: now - 10 * 24 * 60 * 60 * 1000,
      },
      candidates: [
        {
          id: 'candidate:parser-stabilization',
          kind: 'next-step',
          title: 'Stabilize parser tests',
          detail: 'Fix parser regression failures',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    expect(input.candidates[0]?.meta.priorSuppression).toBeDefined();
    expect(input.candidates[0]?.meta.priorSuppressionCheckpointStale).toBe(true);
    expect(input.candidates[0]?.meta.priorSuppressionCorrections).toBeUndefined();
  });

  it('ignores synthetic large-scratchpad preview placeholder text as prior excerpt', () => {
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
    });
    const placeholderInput = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        scratchpadExcerpt:
          'Preview unavailable for large scratchpad (120 KB). Open Scratchpad to view.',
        scratchpadHasContent: true,
      },
      candidates: [
        {
          id: 'candidate:auth-tests',
          kind: 'next-step',
          title: 'Run auth tests',
          detail: 'Stabilize token refresh before release',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });
    const baselineInput = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        scratchpadHasContent: true,
      },
      candidates: [
        {
          id: 'candidate:auth-tests',
          kind: 'next-step',
          title: 'Run auth tests',
          detail: 'Stabilize token refresh before release',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    expect(placeholderInput.candidates[0]?.meta).toMatchObject({
      priorPromotionScratchpad: true,
    });
    expect(placeholderInput.candidates[0]?.meta.priorPromotion).toEqual(
      baselineInput.candidates[0]?.meta.priorPromotion,
    );
  });

  it('does not promote candidates based on negated user corrections', () => {
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        correctionHints: ['do not ship release to production'],
      },
      candidates: [
        {
          id: 'candidate:ship-release',
          kind: 'next-step',
          title: 'Ship release to production',
          detail: 'Ship the new release',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    const meta = input.candidates[0]?.meta ?? {};
    expect(meta.priorPromotionCorrections).toBeUndefined();
    expect(meta.priorSuppressionCorrections).toBe(true);
    expect(meta.priorSuppressionCorrectionNegation).toBe(true);
  });

  it("treats contracted negation corrections like can't as suppression cues", () => {
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        correctionHints: ["can't ship release to production"],
      },
      candidates: [
        {
          id: 'candidate:ship-release',
          kind: 'next-step',
          title: 'Ship release to production',
          detail: 'Ship the new release',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    const meta = input.candidates[0]?.meta ?? {};
    expect(meta.priorPromotionCorrections).toBeUndefined();
    expect(meta.priorSuppressionCorrections).toBe(true);
    expect(meta.priorSuppressionCorrectionNegation).toBe(true);
  });

  it('treats explicit empty correction hints as an override (no fallback merge)', () => {
    const summary = buildSummary({
      nextSteps: [],
      recommendedFirstAction: undefined,
      pendingBlocked: undefined,
      evidenceCatalog: undefined,
      userCorrections: ['stabilize parser tests before shipping'],
    });
    const input = createPercolationPolicyInput(summary, {
      now: summary.generatedAt,
      priors: {
        correctionHints: [],
      },
      candidates: [
        {
          id: 'candidate:parser-tests',
          kind: 'next-step',
          title: 'Stabilize parser tests',
          detail: 'Fix parser regressions',
          confidence: 0.7,
          urgency: 0.7,
          novelty: 0.4,
          interruptCost: 0.3,
        },
      ],
    });

    expect(input.candidates[0]?.meta.userPriorApplied).toBeUndefined();
    expect(input.candidates[0]?.meta.priorPromotionCorrections).toBeUndefined();
    expect(input.candidates[0]?.meta.priorSuppressionCorrections).toBeUndefined();
  });
});
