import type { CompanionNudge } from '../src/companionNudges';
import type { NextStepAction } from '../src/nextStepActions';
import type { TimelineGroup } from '../src/timeline';
import {
  renderCheckpointCard,
  renderCompanionNextSteps,
  renderCompanionNudgeCard,
  renderConfidenceCard,
  renderEvidenceListItems,
  renderGroupedActionSections,
  renderIntentEditor,
  renderResumePathCard,
  renderScratchpadCard,
  renderStepEvidenceBadge,
  renderTimelineGroupsHtml,
  renderTopFilesListItems,
  renderTopLinksListItems,
  renderWebviewDocument,
} from '../src/webview/panelFragments';

describe('panelFragments', () => {
  it('renders checkpoint, scratchpad, confidence, and intent editor fragments', () => {
    const checkpoint = renderCheckpointCard({
      openCheckpointCount: 2,
      currentCheckpointNote: {
        text: 'Re-run flaky test after dependency bump',
        file: 'src/extension.ts',
        line: 128,
        branch: 'feature/ABC-148',
        partition: 'ABC-148',
        pinned: true,
      },
    });
    const scratchpad = renderScratchpadCard({
      showScratchpadCard: true,
      scratchpadScopeLabel: 'Scope: task partition ABC-148',
      scratchpadPreviewLines: ['- investigate timing gate', '- add snapshot assertions'],
      scratchpadHasContent: true,
    });
    const confidence = renderConfidenceCard({
      longGap: true,
      lowConfidence: false,
      hasCurrentCheckpointNote: false,
      resumeGapMinutes: 42,
      lastActionLabel: 'Edited src/summary.ts',
      firstNextStep: 'Run verify quick',
    });
    const intentEditor = renderIntentEditor({
      intentInputId: 'intent-override-input',
      intent: 'Stabilize resume-card render flow',
      intentOverridden: false,
    });

    expect(checkpoint).toContain('<h3>Notes (2)</h3>');
    expect(checkpoint).toContain('data-action="checkpointMarkDone"');
    expect(scratchpad).toContain('data-action="openScratchpad"');
    expect(scratchpad).toContain('Scope: task partition ABC-148');
    expect(confidence).toContain('<h3>Welcome back</h3>');
    expect(confidence).toContain('Retrieval cue');
    expect(intentEditor).toContain('Intent (editable)');
    expect(intentEditor).toContain('data-action="setIntentOverride"');
    expect(intentEditor).toContain('data-action="clearIntentOverride" disabled');
    expect(intentEditor).toContain('data-intent-editor-readonly="false"');
  });

  it('renders read-only intent and resume path fragments for demo mode', () => {
    const intentEditor = renderIntentEditor({
      intentInputId: 'intent-override-input',
      intent: 'Sample intent',
      intentOverridden: true,
      readOnly: true,
    });
    const resumePath = renderResumePathCard({
      completed: false,
      collapsed: false,
      readOnly: true,
      steps: [
        {
          id: 'confirmIntent',
          label: 'Confirm intent',
          detail: 'Read current intent',
          checked: false,
        },
      ],
    });

    expect(intentEditor).toContain('data-intent-editor-readonly="true"');
    expect(intentEditor).toContain('Sample mode is read-only');
    expect(intentEditor).toContain('data-action="setIntentOverride" disabled aria-disabled="true"');
    expect(resumePath).toContain('data-resume-path-readonly="true"');
    expect(resumePath).toContain('Resume Path toggles are disabled');
    expect(resumePath).toContain('data-resume-path-toggle="true"');
    expect(resumePath).toContain('disabled aria-disabled="true"');
  });

  it('renders next-step, list, and evidence fragments with stable affordances', () => {
    const action: NextStepAction = {
      stepIndex: 0,
      kind: 'openFile',
      label: 'Open file',
      evidenceId: 'file:src/extension.ts',
    };
    const nextSteps = renderCompanionNextSteps({
      nextSteps: ['Open the latest extension render call', 'Review timeline grouping'],
      nextStepEvidenceIds: [['file:src/extension.ts'], ['git:status']],
      nextStepActions: [action, undefined],
      primaryNextActionStepIndex: 1,
      lowConfidence: false,
      evidenceById: new Map([
        [
          'file:src/extension.ts',
          {
            id: 'file:src/extension.ts',
            kind: 'file',
            label: 'src/extension.ts',
            target: 'src/extension.ts',
          },
        ],
        [
          'git:status',
          {
            id: 'git:status',
            kind: 'git',
            label: 'git status',
          },
        ],
      ]),
    });
    const topFiles = renderTopFilesListItems(['src/extension.ts', 'src/webview/panelCards.ts']);
    const topLinks = renderTopLinksListItems([
      { label: 'Issue 148', target: 'https://example.test/148', kind: 'url' },
    ]);
    const evidence = renderEvidenceListItems([
      {
        id: 'file:src/extension.ts',
        kind: 'file',
        label: 'src/extension.ts',
        target: 'src/extension.ts',
      },
      { id: 'git:status', kind: 'git', label: 'git status' },
    ]);

    expect(nextSteps).toContain('data-step-index="0"');
    expect(nextSteps).toContain('data-action="runNextStepAction"');
    expect(nextSteps).toContain(
      'Advisory only: no safe one-click action is available for this step.',
    );
    expect(renderStepEvidenceBadge('unknown:evidence')).toContain(
      '<span class="badge">unknown:evidence</span>',
    );
    expect(topFiles).toContain('data-action="openTopFile"');
    expect(topLinks).toContain('data-action="openLink"');
    expect(evidence).toContain('data-evidence-affordance="open"');
    expect(evidence).toContain('data-evidence-affordance="static"');
  });

  it('renders grouped actions, timeline, resume path, nudge card, and document shell', () => {
    const grouped = renderGroupedActionSections({
      groups: [
        {
          label: 'Open',
          buttonsTrustedHtml: [
            '<button type="button" data-action="restoreWorkingSet">Restore working set</button>',
          ],
        },
      ],
      headingTag: 'h5',
      sectionClassName: 'action-group compact-action-group',
      buttonContainerClassName: 'companion-restore-grid',
    });
    const timelineGroups: TimelineGroup[] = [
      {
        key: 'files',
        label: 'Files',
        rows: [
          {
            evidenceId: 'file:src/extension.ts',
            kind: 'file',
            label: 'src/extension.ts',
            timestamp: Date.UTC(2026, 1, 1, 12, 0, 0),
            relativeTime: 'just now',
            clickable: true,
            interactionHint: 'Open',
          },
        ],
      },
    ];
    const timelineHtml = renderTimelineGroupsHtml({ timelineGroups });
    const resumePath = renderResumePathCard({
      completed: false,
      collapsed: false,
      steps: [
        {
          id: 'confirmIntent',
          label: 'Confirm intent',
          detail: 'Read current intent',
          checked: true,
        },
        {
          id: 'runNextSafeAction',
          label: 'Run next safe action',
          detail: 'Use the primary CTA',
          checked: false,
        },
      ],
    });
    const primaryNudge: CompanionNudge = {
      id: 'resume-next-step',
      title: 'Resume the next planned step',
      detail: 'Open the next-step file first.',
      action: 'copyNextSteps',
      score: 66,
    };
    const nudge = renderCompanionNudgeCard({
      primaryNudge,
      nudgeSuppressionLabel: '',
      nudgeExplainabilityTrustedHtml:
        '<details><summary><strong>Why this nudge?</strong></summary><ul class="compact-list"><li>Because a next step exists.</li></ul></details>',
      actionLabelForId: () => 'Copy next steps',
    });
    const doc = renderWebviewDocument({
      cspMetaTag: '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'" />',
      nonce: 'nonce-123',
      panelStyle: '.card { color: red; }',
      bodyCardsTrustedHtml: `${grouped}${timelineHtml}${resumePath}${nudge}`,
      clientScript: 'console.log("panel");',
    });

    expect(grouped).toContain('companion-restore-grid');
    expect(timelineHtml).toContain('data-timeline-affordance="open"');
    expect(resumePath).toContain('data-resume-path-step-id="confirmIntent"');
    expect(nudge).toContain('data-action="copyNextSteps"');
    expect(doc).toContain('<style nonce="nonce-123">.card { color: red; }</style>');
    expect(doc).toContain('console.log("panel");');
  });
});
