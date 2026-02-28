import {
  applyIntentOverrideToSummary,
  buildResumeSummary,
  buildStepEvidenceIds,
} from '../src/summary';
import type { ResumeSignals, SummaryEvidenceItem } from '../src/types';

function sampleSignals(): ResumeSignals {
  return {
    workspaceRoot: '/workspace/repo',
    workspaceName: 'repo',
    branch: 'feature/tacos',
    gitStatus: ' M src/extension.ts',
    gitDiffStat: 'src/extension.ts | 14 ++++++++++----',
    gitDiff: '',
    gitLog: 'abc123 feat: add resume summary',
    changedFiles: ['src/extension.ts'],
    openFiles: ['src/extension.ts', 'README.md'],
    recentFiles: ['src/summary.ts'],
    recentTerminal: ['npm test'],
    recentDebug: ['node: Launch Extension'],
    recentUrls: ['https://github.com/org/repo/pull/1'],
    lastEditPath: 'src/extension.ts',
    lastEditLine: 41,
    lastEditCharacter: 3,
    failingCommand: 'npm test',
    doneItems: ['npm run build'],
  };
}

describe('buildResumeSummary', () => {
  it('produces stable hash for unchanged input', () => {
    const a = buildResumeSummary(sampleSignals());
    const b = buildResumeSummary(sampleSignals());

    expect(a.contextHash).toEqual(b.contextHash);
  });

  it('updates context hash when last edit location changes', () => {
    const a = sampleSignals();
    const b = sampleSignals();
    b.lastEditLine = 42;

    const summaryA = buildResumeSummary(a);
    const summaryB = buildResumeSummary(b);

    expect(summaryA.contextHash).not.toEqual(summaryB.contextHash);
  });

  it('returns concise structure with max 3 links and 2-3 next steps', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.nextSteps.length).toBeGreaterThanOrEqual(2);
    expect(summary.nextSteps.length).toBeLessThanOrEqual(3);
    expect(summary.links.length).toBeLessThanOrEqual(3);
    expect(summary.evidenceCatalog?.length ?? 0).toBeGreaterThan(0);
    expect(summary.nextStepEvidenceIds?.length).toBe(summary.nextSteps.length);
    expect(summary.recommendedFirstAction).toBe(summary.nextSteps[0]);
    expect(summary.pendingBlocked?.length ?? 0).toBeGreaterThan(0);
    expect(summary.lastActionLabel).toContain('src/extension.ts:42');
    expect(summary.lastActionContext).toBe('retrieval cue: last edit');
    expect(summary.lastActionEvidenceId).toBe('file:src/extension.ts');
    expect(summary.mode).toBe('debugging');
    expect(summary.intent.length).toBeGreaterThan(0);
  });

  it('builds file/url evidence IDs from trusted extension-generated data', () => {
    const summary = buildResumeSummary(sampleSignals());
    const evidence = summary.evidenceCatalog ?? [];

    expect(evidence.some((item) => item.id === 'file:src/extension.ts')).toBe(true);
    expect(evidence.some((item) => item.id === 'url:https://github.com/org/repo/pull/1')).toBe(
      true,
    );
  });

  it('maps rerun-style steps to terminal/task evidence before positional file evidence', () => {
    const summary = buildResumeSummary(sampleSignals());
    const firstStepEvidenceIds = summary.nextStepEvidenceIds?.[0] ?? [];
    const evidenceById = new Map((summary.evidenceCatalog ?? []).map((item) => [item.id, item]));
    const firstEvidence = firstStepEvidenceIds[0]
      ? evidenceById.get(firstStepEvidenceIds[0])
      : undefined;

    expect(summary.nextSteps[0].toLowerCase()).toContain('re-run');
    expect(firstEvidence?.kind).toBe('terminal');
  });

  it('maps steps to the best lexical match among same-kind evidence items', () => {
    const nextSteps = ['Open src/parser.ts and validate parser edge cases.'];
    const evidenceCatalog: SummaryEvidenceItem[] = [
      { id: 'file:src/main.ts', kind: 'file', label: 'src/main.ts' },
      { id: 'file:src/parser.ts', kind: 'file', label: 'src/parser.ts' },
      { id: 'file:src/parserUtils.ts', kind: 'file', label: 'src/parserUtils.ts' },
    ];

    const [evidenceIds] = buildStepEvidenceIds(nextSteps, evidenceCatalog);
    expect(evidenceIds).toEqual(['file:src/parser.ts']);
  });

  it('marks mode as coding when no debug/failing signals exist', () => {
    const signals = sampleSignals();
    signals.failingCommand = undefined;
    signals.recentDebug = [];
    signals.recentTerminal = ['pnpm lint'];

    const summary = buildResumeSummary(signals);
    expect(summary.mode).toBe('coding');
  });

  it('marks mode as debugging when terminal tokens indicate test/build/debug activity', () => {
    const signals = sampleSignals();
    signals.failingCommand = undefined;
    signals.recentDebug = [];
    signals.recentTerminal = ['terminal:npm_run_test#abcdef1234'];

    const summary = buildResumeSummary(signals);
    expect(summary.mode).toBe('debugging');
  });

  it('does not include absolute file targets in details markdown evidence lines', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.detailsMarkdown).not.toContain('/workspace/repo/src/extension.ts');
    expect(summary.detailsMarkdown).toContain('url:https://github.com/org/repo/pull/1');
    expect(summary.detailsMarkdown).toContain('-> https://github.com/org/repo/pull/1');
  });

  it('includes session recap fields for done and pending work', () => {
    const summary = buildResumeSummary(sampleSignals());

    expect(summary.doneSinceLastResume).toEqual(['npm run build']);
    expect(summary.changesSinceLastResume?.[0]).toContain('Diffstat:');
    expect(summary.pendingBlocked?.[0]).toContain('Failing command still unresolved');
    expect(summary.detailsMarkdown).toContain('## Session recap');
    expect(summary.detailsMarkdown).toContain('Changes since last resume');
    expect(summary.detailsMarkdown).toContain('Recommended first action');
  });

  it('marks low-confidence summaries explicitly when evidence is sparse', () => {
    const signals = sampleSignals();
    signals.changedFiles = [];
    signals.openFiles = [];
    signals.recentFiles = [];
    signals.recentTerminal = [];
    signals.recentDebug = [];
    signals.doneItems = [];
    signals.failingCommand = undefined;
    signals.recentUrls = [];
    signals.lastEditPath = undefined;
    signals.lastEditLine = undefined;
    signals.lastEditCharacter = undefined;

    const summary = buildResumeSummary(signals);
    expect(summary.lowConfidence).toBe(true);
    expect(summary.intent).toBe('Unclear intent (low evidence).');
    expect(summary.candidateIntents?.length ?? 0).toBeGreaterThan(0);
    expect(summary.nextSteps[0]).toContain('Unclear intent');
    expect(summary.links.length).toBe(0);
  });

  it('enters long-gap reorientation mode with safe starter copy when threshold is exceeded', () => {
    const signals = sampleSignals();
    signals.resumeGapMinutes = 45;

    const summary = buildResumeSummary(signals, { longGapMinutes: 30 });
    expect(summary.longGap).toBe(true);
    expect(summary.lowConfidence).toBe(false);
    expect(summary.resumeGapMinutes).toBe(45);
    expect(summary.intent).toBe('Welcome back — reorient before executing risky actions.');
    expect(summary.nextSteps[0]).toContain('Open');
    expect(summary.nextSteps.join(' ')).not.toContain('Re-run and fix:');
    expect(summary.detailsMarkdown).toContain('## Reorientation');
  });

  it('keeps low-confidence and long-gap states distinct and simultaneously visible', () => {
    const signals = sampleSignals();
    signals.changedFiles = [];
    signals.openFiles = [];
    signals.recentFiles = [];
    signals.recentTerminal = [];
    signals.recentDebug = [];
    signals.doneItems = [];
    signals.failingCommand = undefined;
    signals.recentUrls = [];
    signals.lastEditPath = undefined;
    signals.lastEditLine = undefined;
    signals.lastEditCharacter = undefined;
    signals.resumeGapMinutes = 80;

    const summary = buildResumeSummary(signals, { longGapMinutes: 30 });
    expect(summary.lowConfidence).toBe(true);
    expect(summary.longGap).toBe(true);
    expect(summary.intent).toBe('Welcome back — reorient before executing risky actions.');
    expect(summary.detailsMarkdown).toContain('## Reorientation');
    expect(summary.detailsMarkdown).toContain('## Confidence');
  });

  it('does not enter long-gap mode when resume gap is below threshold', () => {
    const signals = sampleSignals();
    signals.resumeGapMinutes = 20;

    const summary = buildResumeSummary(signals, { longGapMinutes: 30 });
    expect(summary.longGap).toBe(false);
    expect(summary.intent).not.toContain('Welcome back — reorient');
  });

  it('keeps context hash stable while resume gap stays below long-gap threshold', () => {
    const earlyGapSignals = sampleSignals();
    const laterGapSignals = sampleSignals();
    earlyGapSignals.resumeGapMinutes = 6;
    laterGapSignals.resumeGapMinutes = 18;

    const earlySummary = buildResumeSummary(earlyGapSignals, { longGapMinutes: 30 });
    const laterSummary = buildResumeSummary(laterGapSignals, { longGapMinutes: 30 });
    expect(earlySummary.longGap).toBe(false);
    expect(laterSummary.longGap).toBe(false);
    expect(earlySummary.contextHash).toBe(laterSummary.contextHash);
  });

  it('updates context hash when resume gap crosses long-gap threshold', () => {
    const shortGapSignals = sampleSignals();
    const longGapSignals = sampleSignals();
    shortGapSignals.resumeGapMinutes = 12;
    longGapSignals.resumeGapMinutes = 45;

    const shortGapSummary = buildResumeSummary(shortGapSignals, { longGapMinutes: 30 });
    const longGapSummary = buildResumeSummary(longGapSignals, { longGapMinutes: 30 });
    expect(shortGapSummary.longGap).toBe(false);
    expect(longGapSummary.longGap).toBe(true);
    expect(shortGapSummary.contextHash).not.toBe(longGapSummary.contextHash);
  });

  it('falls back to explicit retrieval-cue fallback when no last action is available', () => {
    const signals = sampleSignals();
    signals.lastEditPath = undefined;
    signals.lastEditLine = undefined;
    signals.lastEditCharacter = undefined;
    signals.failingCommand = undefined;
    signals.recentDebug = [];
    signals.doneItems = [];
    signals.openFiles = [];
    signals.recentFiles = [];
    signals.changedFiles = [];

    const summary = buildResumeSummary(signals);
    expect(summary.lastActionLabel).toBe('No last action captured yet.');
    expect(summary.lastActionContext).toBe('retrieval cue unavailable');
    expect(summary.lastActionEvidenceId).toBeUndefined();
  });

  it('prefers last edit retrieval cue over failing terminal/debug signals', () => {
    const summary = buildResumeSummary(sampleSignals());
    expect(summary.lastActionLabel).toContain('Edited src/extension.ts:42');
    expect(summary.lastActionLabel).not.toContain('Ran failing command');
  });

  it('applies user intent override with precedence while retaining inferred intent for reset', () => {
    const summary = buildResumeSummary(sampleSignals());
    const overridden = applyIntentOverrideToSummary(summary, 'Ship safer resume-path flow');

    expect(overridden.intent).toBe('Ship safer resume-path flow');
    expect(overridden.intentOverridden).toBe(true);
    expect(overridden.inferredIntent).toBe(summary.inferredIntent);
    expect(overridden.detailsMarkdown).toContain('- Ship safer resume-path flow (user-edited)');
    expect(overridden.codexPrompt).toContain('Ship safer resume-path flow');
  });

  it('resets back to inferred intent when override is cleared', () => {
    const summary = buildResumeSummary(sampleSignals());
    const overridden = applyIntentOverrideToSummary(summary, 'Ship safer resume-path flow');
    const reset = applyIntentOverrideToSummary(overridden, undefined);

    expect(reset.intent).toBe(summary.inferredIntent);
    expect(reset.intentOverridden).toBe(false);
    expect(reset.detailsMarkdown).toContain(`- ${summary.inferredIntent}`);
  });

  it('applies intent override during summary construction when provided in options', () => {
    const summary = buildResumeSummary(sampleSignals(), {
      intentOverride: 'Validate type narrowing around intent overrides',
    });

    expect(summary.intent).toBe('Validate type narrowing around intent overrides');
    expect(summary.intentOverridden).toBe(true);
    expect(summary.detailsMarkdown).toContain(
      '- Validate type narrowing around intent overrides (user-edited)',
    );
  });
});
