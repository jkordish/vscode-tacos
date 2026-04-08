import {
  renderChangesSinceCard,
  renderDetailsCard,
  renderEvidenceCard,
  renderQuickActionsCard,
  renderRecapCard,
  renderResumeCockpitCard,
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
      collectionPolicyLabel: 'Local signal collection is active.',
      privacyPresetLabel: 'Balanced',
      retentionPolicyLabel: '7 days',
      aiProviderModeLabel: 'Local-only mode.',
      aiConsentStatusLabel: 'Not required in local-only mode.',
      trustBasedOn: 'Evidence from local signals',
      trustCueDetailsTrustedHtml: '<li>Recent files: 2</li>',
      percolationExplainabilityTrustedHtml: '<li>Reason: deterministic ranking.</li>',
      autoSummaryToggleDisabledAttr: '',
      autoSummaryToggleLabel: 'Pause auto summaries',
      aiPayloadPreviewDisabledAttr: '',
      revokeAiConsentDisabledAttr: 'disabled aria-disabled="true"',
      expanded: false,
      emphasis: {
        level: 'elevated',
        sourceClass: 'policy:trust-privacy',
        badgeLabel: 'Trust & Privacy',
      },
    });

    expect(status).toContain('<h3>Status</h3>');
    expect(status).toContain('data-action="refreshSummary"');
    expect(trust).toContain(
      'class="section-heading" role="heading" aria-level="3">Trust Center</span>',
    );
    expect(trust).toContain('data-panel-section="trustCenter"');
    expect(trust).toContain('data-panel-emphasis-level="elevated"');
    expect(trust).toContain('data-panel-emphasis-source="policy:trust-privacy"');
    expect(trust).toContain('data-panel-emphasis-badge="true"');
    expect(trust).toContain('>Trust &amp; Privacy</span></summary>');
    expect(trust).toContain('class="trust-details-more"');
    expect(trust).toContain('data-action="openPrivacySafety"');
    expect(trust).toContain('data-action="openAiPayloadPreview"');
    expect(trust).toContain('data-ai-payload-entrypoint="trust-center"');
    expect(trust).toContain('Review AI payload for this decision');
    expect(trust).toContain('data-ai-payload-entrypoint="why-surfaced"');
    expect(trust).toContain('data-action="revokeAiPayloadConsent"');
    expect(trust).toContain('Collection changes:</span> Local signal collection is active.');
    expect(trust).toContain('Privacy preset:</span> Balanced');
    expect(trust).toContain('Retention:</span> 7 days');
    expect(trust).toContain('AI provider:</span> Local-only mode.');
    expect(trust).toContain('Consent:</span> Not required in local-only mode.');
    expect(trust).toContain('<li>Recent files: 2</li>');
    expect(trust).toContain('data-why-surfaced-details="true"');
    expect(trust).toContain('<li>Reason: deterministic ranking.</li>');
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
    expect(list).toContain('<li class="muted">None captured</li>');
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
    expect(quickActions).toContain('Keyboard shortcuts');
    expect(restore).toContain('Restricted Mode');
    expect(restore).toContain('execution actions disabled');
    expect(changes).toContain('<h3>What Changed</h3>');
  });

  it('renderResumeCockpitCard — renders verify-first and next-step inline inputs', () => {
    const card = renderResumeCockpitCard({
      verifyFirst: 'Check that auth tests pass',
      nextStep: 'Open PR for login module',
      anchors: [],
      actionButtonsTrustedHtml: '',
    });

    expect(card).toContain('class="card cockpit-card"');
    expect(card).toContain('id="cockpit-verify-first"');
    expect(card).toContain('id="cockpit-next-step"');
    expect(card).toContain('value="Check that auth tests pass"');
    expect(card).toContain('value="Open PR for login module"');
    expect(card).toContain('maxlength="280"');
    expect(card).toContain('aria-label="Verify first');
    expect(card).toContain('aria-label="Next step');
    expect(card).toContain('id="cockpit-save-state"');
    expect(card).toContain('aria-live="polite"');
    expect(card).toContain('aria-atomic="true"');
  });

  it('renderResumeCockpitCard — renders collapsible blocker only when non-empty', () => {
    const withBlocker = renderResumeCockpitCard({
      verifyFirst: '',
      nextStep: '',
      blocker: 'CI is red on main',
      anchors: [],
      actionButtonsTrustedHtml: '',
    });
    const withoutBlocker = renderResumeCockpitCard({
      verifyFirst: '',
      nextStep: '',
      anchors: [],
      actionButtonsTrustedHtml: '',
    });

    expect(withBlocker).toContain('class="cockpit-blocker-details"');
    expect(withBlocker).toContain('CI is red on main');
    expect(withoutBlocker).not.toContain('cockpit-blocker-details');
  });

  it('renderResumeCockpitCard — renders up to 3 anchor badges, clickable and static', () => {
    const card = renderResumeCockpitCard({
      verifyFirst: '',
      nextStep: '',
      anchors: [
        { label: 'src/extension.ts', kind: 'file', id: 'file:src/extension.ts', clickable: true },
        { label: 'https://docs.example.com', kind: 'url', id: 'url:0', clickable: true },
        { label: 'README.md', kind: 'file', id: 'file:README.md', clickable: false },
        // 4th anchor should be silently dropped
        { label: 'extra.ts', kind: 'file', id: 'file:extra.ts', clickable: true },
      ],
      actionButtonsTrustedHtml: '',
    });

    expect(card).toContain('class="cockpit-anchors"');
    expect(card).toContain('data-evidence-id="file:src/extension.ts"');
    expect(card).toContain('data-evidence-id="url:0"');
    expect(card).toContain('class="badge kind-file"');
    // 4th anchor must not appear
    expect(card).not.toContain('file:extra.ts');
  });

  it('renderResumeCockpitCard — escapes HTML in field values', () => {
    const card = renderResumeCockpitCard({
      verifyFirst: '<script>alert(1)</script>',
      nextStep: '"quoted" & \'apos\'',
      anchors: [],
      actionButtonsTrustedHtml: '',
    });

    expect(card).not.toContain('<script>');
    expect(card).toContain('&lt;script&gt;');
    expect(card).toContain('&quot;quoted&quot;');
    expect(card).toContain('&#39;apos&#39;');
  });

  it('renderResumeCockpitCard — renders action row only when actionButtonsTrustedHtml is non-empty', () => {
    const withActions = renderResumeCockpitCard({
      verifyFirst: '',
      nextStep: '',
      anchors: [],
      actionButtonsTrustedHtml:
        '<button type="button" data-action="sessionAddCheckpoint">Capture</button>',
    });
    const withoutActions = renderResumeCockpitCard({
      verifyFirst: '',
      nextStep: '',
      anchors: [],
      actionButtonsTrustedHtml: '',
    });

    expect(withActions).toContain('class="cockpit-action-row status-actions"');
    expect(withActions).toContain('data-action="sessionAddCheckpoint"');
    expect(withoutActions).not.toContain('cockpit-action-row');
  });

  it('renders evidence card show-more control with stable hidden-count metadata', () => {
    const evidence = renderEvidenceCard({
      evidenceItemsTrustedHtml:
        '<li class="evidence-item"><div class="evidence-row"><button type="button" class="text-link-button evidence-link-button" data-action="openEvidence" data-evidence-id="file:src/extension.ts">src/extension.ts</button><span class="evidence-affordance evidence-affordance-clickable" data-evidence-affordance="open">Open</span></div><div class="evidence-meta"><span class="evidence-kind">[file]</span></div></li>',
      hiddenEvidenceCount: 2,
      expanded: false,
    });

    expect(evidence).toMatchInlineSnapshot(`
      "<div class="card">
            <details data-panel-section="evidence" >
              <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Evidence</span></summary>
              <div class="panel-section-body">
                <ul class="evidence-list" id="evidence-list"><li class="evidence-item"><div class="evidence-row"><button type="button" class="text-link-button evidence-link-button" data-action="openEvidence" data-evidence-id="file:src/extension.ts">src/extension.ts</button><span class="evidence-affordance evidence-affordance-clickable" data-evidence-affordance="open">Open</span></div><div class="evidence-meta"><span class="evidence-kind">[file]</span></div></li></ul>
                <button type="button" class="show-more-btn" data-action="toggleEvidenceMore" data-hidden-count="2" aria-controls="evidence-list" aria-expanded="false">Show 2 more</button>
              </div>
            </details>
          </div>"
    `);
  });
});
