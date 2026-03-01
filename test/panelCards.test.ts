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
      expanded: false,
    });

    expect(status).toContain('<h3>Status</h3>');
    expect(status).toContain('data-action="refreshSummary"');
    expect(trust).toContain('class="section-heading" role="heading" aria-level="3">Trust Center</span>');
    expect(trust).toContain('data-panel-section="trustCenter"');
    expect(trust).toContain('data-action="openPrivacySafety"');
    expect(trust).toContain('<li>Recent files: 2</li>');
  });

  it('renders timeline/list/evidence/details sections with expected fallbacks', () => {
    const timeline = renderTimelineCard({
      showTimeline: true,
      timelineGroupsTrustedHtml: '',
      expanded: false,
    });
    const list = renderTitledListCard({
      title: 'Top Files',
      listItemsTrustedHtml: '',
      emptyMessage: 'None captured',
    });
    const evidence = renderEvidenceCard({
      evidenceItemsTrustedHtml: '',
      hiddenEvidenceCount: 3,
      expanded: false,
    });
    const details = renderDetailsCard('<p>Summary</p>', false);

    expect(timeline).toContain('data-panel-section="timeline"');
    expect(timeline).toContain(
      'class="section-heading" role="heading" aria-level="3">Timeline</span>',
    );
    expect(timeline).toContain('No timeline entries captured yet.');
    expect(list).toContain('<h3>Top Files</h3>');
    expect(list).toContain('<li>None captured</li>');
    expect(evidence).toContain('data-action="toggleEvidenceMore"');
    expect(evidence).toContain('data-hidden-count="3"');
    expect(evidence).toContain('aria-controls="evidence-list"');
    expect(evidence).toContain('Show 3 more');
    expect(evidence).toContain('data-panel-section="evidence"');
    expect(details).toContain('data-panel-section="details"');
    expect(details).toContain('<div class="details-markdown"><p>Summary</p></div>');
  });

  it('renders recap, quick actions, restore pack, and changes cards', () => {
    const recap = renderRecapCard({
      recapDoneListTrustedHtml: '<li>Ran verify</li>',
      recapPendingListTrustedHtml: '<li>Fix blocker</li>',
    });
    const quickActions = renderQuickActionsCard(
      '<div class="quick-actions"><button>Copy summary</button></div>',
    );
    const restore = renderRestorePackCard('<section>restore buttons</section>', false);
    const changes = renderChangesSinceCard('<li>Diffstat: 1 file changed</li>');

    expect(recap).toContain('<h3>Session Recap</h3>');
    expect(recap).not.toContain('data-primary-next-safe-action=');
    expect(recap).not.toContain('data-action="copyNextSteps"');
    expect(quickActions).toContain('<h3>Quick Actions</h3>');
    expect(restore).toContain('Restricted Mode: task/debug/branch execution actions are disabled.');
    expect(changes).toContain('<h3>Changes Since Last Time</h3>');
  });

  it('renders evidence card show-more control with stable hidden-count metadata', () => {
    const evidence = renderEvidenceCard({
      evidenceItemsTrustedHtml:
        '<li class="evidence-item"><div class="evidence-row"><button type="button" class="text-link-button evidence-link-button" data-action="openEvidence" data-evidence-id="file:src/extension.ts">src/extension.ts</button><span class="evidence-affordance evidence-affordance-clickable" data-evidence-affordance="open">Open</span></div><div class="evidence-meta"><span class="evidence-kind">[file]</span> <code>file:src/extension.ts</code></div></li>',
      hiddenEvidenceCount: 2,
      expanded: false,
    });

    expect(evidence).toMatchInlineSnapshot(`
      "<div class="card">
            <details data-panel-section="evidence" >
              <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Evidence</span></summary>
              <div class="panel-section-body">
                <ul class="evidence-list" id="evidence-list"><li class="evidence-item"><div class="evidence-row"><button type="button" class="text-link-button evidence-link-button" data-action="openEvidence" data-evidence-id="file:src/extension.ts">src/extension.ts</button><span class="evidence-affordance evidence-affordance-clickable" data-evidence-affordance="open">Open</span></div><div class="evidence-meta"><span class="evidence-kind">[file]</span> <code>file:src/extension.ts</code></div></li></ul>
                <button type="button" class="show-more-btn" data-action="toggleEvidenceMore" data-hidden-count="2" aria-controls="evidence-list" aria-expanded="false">Show 2 more</button>
              </div>
            </details>
          </div>"
    `);
  });
});
