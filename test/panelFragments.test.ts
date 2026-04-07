import type { CompanionNudge } from '../src/companionNudges';
import type { NextStepAction } from '../src/nextStepActions';
import type { EvidenceRelevanceGroup, TimelineGroup } from '../src/timeline';
import {
  renderCheckpointCard,
  renderCognitiveDebriefCard,
  renderCompanionNextSteps,
  renderCompanionNudgeCard,
  renderConfidenceCard,
  renderGroupedEvidenceListItems,
  renderEvidenceListItems,
  renderGroupedActionSections,
  renderIntentEditor,
  renderPageHeader,
  renderResumePathCard,
  renderScratchpadCard,
  renderStepEvidenceBadge,
  renderTaskStateCard,
  renderTimelineGroupsHtml,
  renderTopFilesListItems,
  renderTopLinksListItems,
  renderWebviewDocument,
} from '../src/webview/panelFragments';

describe('panelFragments', () => {
  it('renders checkpoint, task-state, scratchpad, confidence, and intent editor fragments', () => {
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
    const taskState = renderTaskStateCard({
      objective: 'Stabilize rollout verification',
      nextLikelySafeMove:
        'Suggested next move: reopen the failing rollout check and verify against middleware.ts:92.',
      confidence: 'medium',
      blockers: ['Need latest canary logs'],
      assumptions: ['Rollback branch still matches prod'],
      workingSet: ['src/middleware.ts', 'docs/runbook.md'],
      freshness: 'fresh',
      staleLabel: 'Stale after tomorrow morning',
      safeBreakpoint: 'src/middleware.ts:92',
      switchCount: 2,
    });
    const debrief = renderCognitiveDebriefCard({
      abandonedThreadCount: 1,
      unresolvedBlockerCount: 1,
      repeatedSwitchCount: 1,
      staleTaskStateCount: 0,
      openAssumptionCount: 2,
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

    expect(checkpoint).toContain(
      '<h3>Notes <span class="badge badge-attention">2 open notes</span></h3>',
    );
    expect(checkpoint).toContain('data-action="checkpointMarkDone"');
    expect(checkpoint).toContain('data-action="checkpointPinToggle"');
    expect(checkpoint).toContain('data-action="checkpointDismiss"');
    expect(checkpoint).toContain('data-action="checkpointOpenList"');
    expect(taskState).toContain('<h3>Task State</h3>');
    expect(taskState).toContain('data-action="captureStructuredCheckpoint"');
    expect(taskState).toContain('data-action="taskStateResolve"');
    expect(taskState).toContain('data-action="confirmTaskSwitch"');
    expect(taskState).toContain('class="badge badge-freshness"');
    expect(debrief).toContain('<h3>Mental Load');
    expect(debrief).toContain('data-action="showCognitiveDebrief"');
    expect(scratchpad).toContain('data-action="openScratchpad"');
    expect(scratchpad).toContain('Scope: task partition ABC-148');
    expect(confidence).toContain('<h3>Welcome back</h3>');
    expect(confidence).toContain('Retrieval cue');
    expect(confidence).toContain('data-action="sessionAddCheckpoint"');
    expect(intentEditor).toContain('>Intent<');
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
    expect(intentEditor).toContain('Intent (read-only in sample mode)');
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
    expect(nextSteps).toContain('No safe one-click action available for this step.');
    expect(renderStepEvidenceBadge('unknown:evidence')).toContain(
      '<span class="badge">unknown:evidence</span>',
    );
    expect(topFiles).toContain('data-action="openTopFile"');
    expect(topLinks).toContain('data-action="openLink"');
    expect(evidence).toContain('data-evidence-affordance="open"');
    expect(evidence).toContain('data-evidence-affordance="static"');
  });

  it('renders grouped evidence tray sections with stable affordances', () => {
    const groups: EvidenceRelevanceGroup[] = [
      {
        key: 'primary',
        label: 'For this surfaced decision',
        items: [{ id: 'file:src/extension.ts', kind: 'file', label: 'src/extension.ts' }],
      },
      {
        key: 'context',
        label: 'Context-only evidence',
        items: [{ id: 'git:status', kind: 'git', label: 'git status' }],
      },
    ];

    const html = renderGroupedEvidenceListItems(groups);
    expect(html).toContain('data-evidence-group="primary"');
    expect(html).toContain('For this surfaced decision');
    expect(html).toContain('data-evidence-group="context"');
    expect(html).toContain('Context-only evidence');
    expect(html).toContain('data-action="openEvidence"');
    expect(html).toContain('data-evidence-affordance="open"');
    expect(html).toContain('data-evidence-affordance="static"');
  });

  it('marks groups with only hidden rows so headings stay hidden until expanded', () => {
    const groups: EvidenceRelevanceGroup[] = [
      {
        key: 'primary',
        label: 'For this surfaced decision',
        items: [
          { id: 'file:1', kind: 'file', label: 'file-1' },
          { id: 'file:2', kind: 'file', label: 'file-2' },
          { id: 'file:3', kind: 'file', label: 'file-3' },
          { id: 'file:4', kind: 'file', label: 'file-4' },
          { id: 'file:5', kind: 'file', label: 'file-5' },
        ],
      },
      {
        key: 'context',
        label: 'Context-only evidence',
        items: [{ id: 'git:status', kind: 'git', label: 'git status' }],
      },
    ];

    const html = renderGroupedEvidenceListItems(groups);
    expect(html).toContain('data-evidence-group="primary"');
    expect(html).toContain('data-evidence-group="context"');
    expect(html).toContain('class="evidence-group extra-evidence-group"');
  });

  it('renders correct freshness badge class for stale and unknown states', () => {
    const stale = renderTaskStateCard({
      objective: 'Investigate recovery path',
      confidence: 'low',
      blockers: [],
      assumptions: [],
      workingSet: [],
      freshness: 'stale',
      switchCount: 0,
    });
    const none = renderTaskStateCard({
      objective: 'Investigate recovery path',
      confidence: 'medium',
      blockers: [],
      assumptions: [],
      workingSet: [],
      freshness: 'none',
      switchCount: 0,
    });

    expect(stale).toContain('class="badge badge-attention"');
    expect(stale).toContain('>Stale<');
    expect(stale).not.toContain('class="badge badge-freshness"');
    expect(none).toContain('class="badge"');
    expect(none).toContain('>No freshness signal<');
    expect(none).not.toContain('class="badge badge-freshness"');
    expect(none).not.toContain('class="badge badge-attention"');
  });

  it('suppresses duplicate next-step action button when the same step is surfaced above the list', () => {
    const action: NextStepAction = {
      stepIndex: 0,
      kind: 'openFile',
      label: 'Open file',
      evidenceId: 'file:src/extension.ts',
    };
    const nextSteps = renderCompanionNextSteps({
      nextSteps: ['Open the latest extension render call'],
      nextStepEvidenceIds: [['file:src/extension.ts']],
      nextStepActions: [action],
      primaryNextActionStepIndex: 0,
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
      ]),
    });

    expect(nextSteps).not.toContain('data-action="runNextStepAction"');
    expect(nextSteps).toContain('Open the latest extension render call');
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
    expect(doc).toContain('<html lang="en">');
    expect(doc).toContain('<title>TaCoS Resume Brief</title>');
    expect(doc).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
    expect(doc).toContain('<meta name="color-scheme" content="light dark" />');
    expect(doc).toContain('<a class="skip-link" href="#main">Skip to main content</a>');
    expect(doc).toContain(
      '<div id="panel-status-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>',
    );
    expect(doc).toContain('<main id="main" tabindex="-1">');
    expect(doc).toContain('<style nonce="nonce-123">.card { color: red; }</style>');
    expect(doc).toContain('console.log("panel");');
  });

  it('renders 4-tab document shell with tab nav and panels when tabs option is used', () => {
    const doc = renderWebviewDocument({
      cspMetaTag: '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'" />',
      nonce: 'nonce-tab',
      panelStyle: '.card { color: blue; }',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          contentTrustedHtml: '<p>overview content</p>',
          default: true,
        },
        { id: 'resume', label: 'Resume', contentTrustedHtml: '<p>resume content</p>' },
        { id: 'evidence', label: 'Evidence', contentTrustedHtml: '<p>evidence content</p>' },
        { id: 'debrief', label: 'Debrief', contentTrustedHtml: '<p>debrief content</p>' },
      ],
      clientScript: 'console.log("tabs");',
    });

    expect(doc).toContain('<html lang="en">');
    expect(doc).toContain('<nav class="page-tabs"');
    expect(doc).toContain('role="tablist"');
    // Tab buttons
    expect(doc).toContain('data-tab-id="overview"');
    expect(doc).toContain('data-tab-id="resume"');
    expect(doc).toContain('data-tab-id="evidence"');
    expect(doc).toContain('data-tab-id="debrief"');
    expect(doc).toContain('aria-selected="true"');
    expect(doc).toContain('id="tab-btn-overview"');
    expect(doc).toContain('aria-controls="tab-panel-overview"');
    // Tab panels
    expect(doc).toContain('id="tab-panel-overview"');
    expect(doc).toContain('id="tab-panel-resume"');
    expect(doc).toContain('id="tab-panel-evidence"');
    expect(doc).toContain('id="tab-panel-debrief"');
    expect(doc).toContain('role="tabpanel"');
    // Non-default panels are hidden, regardless of attribute order
    expect(doc).toMatch(/<section\b[^>]*\bid="tab-panel-resume"[^>]*\bhidden\b[^>]*>/);
    // Content
    expect(doc).toContain('<p>overview content</p>');
    expect(doc).toContain('<p>debrief content</p>');
    // No bodyCardsTrustedHtml path
    expect(doc).not.toContain('undefined');
  });

  it('renderPageHeader renders intent, status chip, and no optional fields when omitted', () => {
    const html = renderPageHeader({
      intentTrustedHtml: 'Stabilize rollout verification',
      statusChipLabel: 'AI-assisted',
    });

    expect(html).toContain('<header class="page-header">');
    expect(html).toContain('Stabilize rollout verification');
    expect(html).toContain('<span class="header-chip">AI-assisted</span>');
    expect(html).not.toContain('header-chip-secondary');
    expect(html).not.toContain('header-actions');
  });

  it('renderPageHeader renders secondary chip and actions row when provided', () => {
    const html = renderPageHeader({
      intentTrustedHtml: 'Fix flaky tests',
      statusChipLabel: 'Manual',
      secondaryChipLabel: 'Auto summaries off',
      actionsTrustedHtml: '<button>Resume</button>',
    });

    expect(html).toContain('<header class="page-header">');
    expect(html).toContain('Fix flaky tests');
    expect(html).toContain('<span class="header-chip">Manual</span>');
    expect(html).toContain('header-chip-secondary');
    expect(html).toContain('Auto summaries off');
    expect(html).toContain('<div class="header-actions">');
    expect(html).toContain('<button>Resume</button>');
  });

  it('renderWebviewDocument emits page header before tab nav when pageHeaderTrustedHtml is provided', () => {
    const headerHtml =
      '<header class="page-header"><div class="header-title-row"><span class="header-intent">My Task</span></div></header>';
    const doc = renderWebviewDocument({
      cspMetaTag: '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'" />',
      nonce: 'nonce-hdr',
      panelStyle: '.card { color: green; }',
      pageHeaderTrustedHtml: headerHtml,
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          contentTrustedHtml: '<p>overview content</p>',
          default: true,
        },
      ],
      clientScript: 'console.log("header-test");',
    });

    expect(doc).toContain(headerHtml);
    // Header must appear before the tab nav
    const headerPos = doc.indexOf('page-header');
    const tabNavPos = doc.indexOf('page-tabs');
    expect(headerPos).toBeGreaterThanOrEqual(0);
    expect(tabNavPos).toBeGreaterThan(headerPos);
    expect(doc).not.toContain('undefined');
  });
});
