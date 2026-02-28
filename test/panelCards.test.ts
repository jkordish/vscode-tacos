import {
  renderChangesSinceCard,
  renderDetailsCard,
  renderEvidenceCard,
  renderQuickActionsCard,
  renderRecapCard,
  renderRestorePackCard,
  renderStatusCard,
  renderTimelineCard,
  renderTitledListCard,
  renderTrustCenterCard,
} from '../src/webview/panelCards';

describe('panelCards', () => {
  it('renders status and trust cards with expected controls', () => {
    const status = renderStatusCard({
      sourceLabel: 'Local summary (instant)',
      generatedAtLabel: '10:12',
      statusHint: 'Running local-only summary.',
      autoSummaryStatusLabel: 'Auto summaries active',
      autoSummaryStatusDetail: 'Runs on focus after idle and cooldown checks.',
      autoSummaryToggleDisabledAttr: '',
      autoSummaryToggleLabel: 'Pause auto summaries',
    });
    const trust = renderTrustCenterCard({
      trustTrackingLabel: 'on',
      storedLocallyLabel: 'Redacted local data only',
      sentToAiLabel: 'Nothing (local-only mode).',
      trustBasedOn: 'Evidence from local signals',
      trustCueDetailsTrustedHtml: '<li>Recent files: 2</li>',
      autoSummaryToggleDisabledAttr: '',
      autoSummaryToggleLabel: 'Pause auto summaries',
    });

    expect(status).toContain('<h3>Status</h3>');
    expect(status).toContain('data-action="refreshSummary"');
    expect(trust).toContain('<h3>Trust Center</h3>');
    expect(trust).toContain('data-action="openPrivacySafety"');
    expect(trust).toContain('<li>Recent files: 2</li>');
  });

  it('renders timeline/list/evidence/details sections with expected fallbacks', () => {
    const timeline = renderTimelineCard({
      showTimeline: true,
      timelineGroupsTrustedHtml: '',
    });
    const list = renderTitledListCard({
      title: 'Top Files',
      listItemsTrustedHtml: '',
      emptyMessage: 'None captured',
    });
    const evidence = renderEvidenceCard({
      evidenceItemsTrustedHtml: '',
      hasExtraEvidence: true,
    });
    const details = renderDetailsCard('<p>Summary</p>');

    expect(timeline).toContain('data-action="toggleTimeline"');
    expect(timeline).toContain('No timeline entries captured yet.');
    expect(list).toContain('<h3>Top Files</h3>');
    expect(list).toContain('<li>None captured</li>');
    expect(evidence).toContain('data-action="toggleEvidenceMore"');
    expect(details).toContain('<div class="details-markdown"><p>Summary</p></div>');
  });

  it('renders recap, quick actions, restore pack, and changes cards', () => {
    const recap = renderRecapCard({
      recapDoneListTrustedHtml: '<li>Ran verify</li>',
      recapPendingListTrustedHtml: '<li>Fix blocker</li>',
      recapFirstAction: 'Open src/extension.ts',
      recapPrimaryNextActionButtonTrustedHtml:
        '<button type="button" data-primary-next-safe-action="recap" data-action="runNextStepAction" data-step-index="0">Open file</button>',
    });
    const quickActions = renderQuickActionsCard(
      '<div class="quick-actions"><button>Copy summary</button></div>',
    );
    const restore = renderRestorePackCard('<section>restore buttons</section>', false);
    const changes = renderChangesSinceCard('<li>Diffstat: 1 file changed</li>');

    expect(recap).toContain('<h3>Session Recap</h3>');
    expect(recap).toContain('data-action="copyNextSteps"');
    expect(quickActions).toContain('<h3>Quick Actions</h3>');
    expect(restore).toContain('Restricted Mode: task/debug/branch execution actions are disabled.');
    expect(changes).toContain('<h3>Changes Since Last Time</h3>');
  });
});
