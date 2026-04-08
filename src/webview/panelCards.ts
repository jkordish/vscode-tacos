import { escapeHtml } from '../webviewSecurity';

export type PanelSectionEmphasisLevel = 'elevated' | 'critical';

export interface PanelSectionEmphasis {
  level: PanelSectionEmphasisLevel;
  sourceClass: string;
  badgeLabel: string;
}

export function renderPanelSectionEmphasisAttrs(emphasis?: PanelSectionEmphasis): string {
  if (!emphasis) {
    return '';
  }

  return `data-panel-emphasis-level="${escapeHtml(emphasis.level)}" data-panel-emphasis-source="${escapeHtml(emphasis.sourceClass)}"`;
}

export function renderPanelSectionEmphasisBadge(emphasis?: PanelSectionEmphasis): string {
  if (!emphasis) {
    return '';
  }

  return `<span class="badge panel-emphasis-badge panel-emphasis-${escapeHtml(
    emphasis.level,
  )}" data-panel-emphasis-badge="true">${escapeHtml(emphasis.badgeLabel)}</span>`;
}

export interface StatusCardInput {
  sourceLabel: string;
  generatedAtLabel: string;
  statusHint: string;
  autoSummaryStatusLabel: string;
  autoSummaryStatusDetail: string;
  autoSummaryToggleDisabledAttr: string;
  autoSummaryToggleLabel: string;
}

export function renderStatusCard(input: StatusCardInput): string {
  return `<div class="card">
      <h3>Status</h3>
      <div class="status-label">${escapeHtml(input.sourceLabel)}<span class="muted"> · ${escapeHtml(input.generatedAtLabel)}</span></div>
      ${input.statusHint ? `<div class="status-detail muted">${escapeHtml(input.statusHint)}</div>` : ''}
      ${input.autoSummaryStatusDetail ? `<div class="status-autosummary-row"><span class="status-label">${escapeHtml(input.autoSummaryStatusLabel)}</span><span class="muted status-autosummary-detail">${escapeHtml(input.autoSummaryStatusDetail)}</span></div>` : ''}
      <div class="status-actions">
        <button type="button" data-action="refreshSummary">Refresh</button>
        <button type="button" class="secondary" data-action="toggleAutoSummaries" ${
          input.autoSummaryToggleDisabledAttr
        }>${escapeHtml(input.autoSummaryToggleLabel)}</button>
      </div>
    </div>`;
}

export interface TrustCenterCardInput {
  trustTrackingLabel: string;
  storedLocallyLabel: string;
  sentToAiLabel: string;
  collectionPolicyLabel: string;
  privacyPresetLabel: string;
  retentionPolicyLabel: string;
  aiProviderModeLabel: string;
  aiConsentStatusLabel: string;
  trustBasedOn: string;
  trustCueDetailsTrustedHtml: string;
  percolationExplainabilityTrustedHtml: string;
  autoSummaryToggleDisabledAttr: string;
  autoSummaryToggleLabel: string;
  aiPayloadPreviewDisabledAttr: string;
  revokeAiConsentDisabledAttr: string;
  showWhySurfacedDetails?: boolean;
  expanded: boolean;
  emphasis?: PanelSectionEmphasis;
}

export function renderTrustCenterCard(input: TrustCenterCardInput): string {
  const emphasisAttrs = renderPanelSectionEmphasisAttrs(input.emphasis);
  const emphasisBadge = renderPanelSectionEmphasisBadge(input.emphasis);
  const showWhySurfacedDetails = input.showWhySurfacedDetails !== false;
  return `<div class="card">
      <details data-panel-section="trustCenter" ${emphasisAttrs ? `${emphasisAttrs} ` : ''}${input.expanded ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Trust Center</span>${emphasisBadge}</summary>
        <div class="panel-section-body">
          <div class="trust-row"><span class="trust-key">Tracking:</span> ${escapeHtml(input.trustTrackingLabel)}</div>
          <div class="trust-row"><span class="trust-key">Sent to AI:</span> ${escapeHtml(input.sentToAiLabel)}</div>
          <div class="trust-row"><span class="trust-key">Consent:</span> ${escapeHtml(input.aiConsentStatusLabel)}</div>
          <details class="trust-details-more">
            <summary class="panel-disclosure-summary trust-details-summary">More details</summary>
            <div class="trust-row"><span class="trust-key">Stored locally:</span> ${escapeHtml(input.storedLocallyLabel)}</div>
            <div class="trust-row"><span class="trust-key">Collection changes:</span> ${escapeHtml(input.collectionPolicyLabel)}</div>
            <div class="trust-row"><span class="trust-key">Privacy preset:</span> ${escapeHtml(input.privacyPresetLabel)}</div>
            <div class="trust-row"><span class="trust-key">Retention:</span> ${escapeHtml(input.retentionPolicyLabel)}</div>
            <div class="trust-row"><span class="trust-key">AI provider:</span> ${escapeHtml(input.aiProviderModeLabel)}</div>
            <div class="trust-row"><span class="trust-key">Based on:</span> ${escapeHtml(input.trustBasedOn)}</div>
          </details>
          ${
            showWhySurfacedDetails
              ? `<details data-why-surfaced-details="true">
            <summary><strong>Why am I seeing this?</strong></summary>
            <ul class="compact-list">${input.trustCueDetailsTrustedHtml || '<li>No evidence counts yet.</li>'}</ul>
            ${
              input.percolationExplainabilityTrustedHtml
                ? `<ul class="compact-list" data-why-surfaced-list="true">${input.percolationExplainabilityTrustedHtml}</ul>`
                : ''
            }
            <div class="status-actions">
              <button type="button" class="secondary" data-action="openAiPayloadPreview" data-ai-payload-entrypoint="why-surfaced" ${
                input.aiPayloadPreviewDisabledAttr
              }>Review AI payload for this decision</button>
            </div>
          </details>`
              : ''
          }
          <div class="status-actions">
            <button type="button" class="secondary" data-action="toggleAutoSummaries" ${
              input.autoSummaryToggleDisabledAttr
            }>${escapeHtml(input.autoSummaryToggleLabel)}</button>
            <button type="button" class="secondary" data-action="openAiPayloadPreview" data-ai-payload-entrypoint="trust-center" ${
              input.aiPayloadPreviewDisabledAttr
            }>Review AI payload preview</button>
            <button type="button" class="secondary" data-action="revokeAiPayloadConsent" ${
              input.revokeAiConsentDisabledAttr
            }>Revoke AI payload consent</button>
            <button type="button" class="secondary" data-action="openPrivacySafety">Open Privacy & Safety</button>
          </div>
        </div>
      </details>
    </div>`;
}

export interface RecapCardInput {
  recapDoneListTrustedHtml: string;
  recapPendingListTrustedHtml: string;
}

export function renderRecapCard(input: RecapCardInput): string {
  return `<div class="card recap-card">
      <h3>Session Recap</h3>
      <div class="recap-grid">
        <section>
          <h4 class="recap-section-heading recap-section-done"><span aria-hidden="true">✓</span> Done</h4>
          <ul class="compact-list">${input.recapDoneListTrustedHtml || '<li class="muted">Nothing captured yet.</li>'}</ul>
        </section>
        <section>
          <h4 class="recap-section-heading recap-section-pending"><span aria-hidden="true">●</span> Pending / Blocked</h4>
          <ul class="compact-list">${input.recapPendingListTrustedHtml || '<li class="muted">No blockers captured.</li>'}</ul>
        </section>
      </div>
    </div>`;
}

export function renderChangesSinceCard(changesSinceItemsTrustedHtml: string): string {
  return `<div class="card">
      <h3>What Changed</h3>
      <ul class="compact-list">${changesSinceItemsTrustedHtml || '<li class="muted">No changes captured yet.</li>'}</ul>
    </div>`;
}

export interface TimelineCardInput {
  showTimeline: boolean;
  timelineGroupsTrustedHtml: string;
  expanded: boolean;
  emphasis?: PanelSectionEmphasis;
}

export function renderTimelineCard(input: TimelineCardInput): string {
  if (!input.showTimeline) {
    return '';
  }

  const emphasisAttrs = renderPanelSectionEmphasisAttrs(input.emphasis);
  const emphasisBadge = renderPanelSectionEmphasisBadge(input.emphasis);
  return `<div class="card">
      <details data-panel-section="timeline" ${emphasisAttrs ? `${emphasisAttrs} ` : ''}${input.expanded ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Timeline</span>${emphasisBadge}</summary>
        <div class="panel-section-body">
          ${input.timelineGroupsTrustedHtml || '<p class="muted">No timeline entries captured yet.</p>'}
        </div>
      </details>
    </div>`;
}

export interface TitledListCardInput {
  title: string;
  listItemsTrustedHtml: string;
  emptyMessage: string;
  listClassName?: string;
}

export function renderTitledListCard(input: TitledListCardInput): string {
  const listClass = input.listClassName ? ` class="${escapeHtml(input.listClassName)}"` : '';
  return `<div class="card">
      <h3>${escapeHtml(input.title)}</h3>
      <ul${listClass}>${input.listItemsTrustedHtml || `<li class="muted">${escapeHtml(input.emptyMessage)}</li>`}</ul>
    </div>`;
}

export function renderQuickActionsCard(quickActionGroupsTrustedHtml: string): string {
  return `<div class="card">
      <h3>Quick Actions</h3>
      ${quickActionGroupsTrustedHtml}
      <details class="shortcut-help">
        <summary class="muted shortcut-help-summary">Keyboard shortcuts</summary>
        <ul class="compact-list">
          <li><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>: Refresh</li>
          <li><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd>: Copy next steps</li>
          <li><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd>: Focus intent</li>
        </ul>
      </details>
    </div>`;
}

export function renderRestorePackCard(
  restorePackGroupsTrustedHtml: string,
  trustedWorkspace: boolean,
): string {
  return `<div class="card">
      <h3>Restore Pack</h3>
      ${trustedWorkspace ? '' : '<div class="restore-note restricted-mode-note"><span aria-hidden="true">⚠</span> Restricted Mode — execution actions disabled.</div>'}
      ${restorePackGroupsTrustedHtml}
    </div>`;
}

export interface EvidenceCardInput {
  evidenceItemsTrustedHtml: string;
  hiddenEvidenceCount: number;
  expanded: boolean;
  emphasis?: PanelSectionEmphasis;
}

export function renderEvidenceCard(input: EvidenceCardInput): string {
  const hasExtraEvidence = input.hiddenEvidenceCount > 0;
  const showMoreLabel = hasExtraEvidence ? `Show ${input.hiddenEvidenceCount} more` : 'Show more';
  const emphasisAttrs = renderPanelSectionEmphasisAttrs(input.emphasis);
  const emphasisBadge = renderPanelSectionEmphasisBadge(input.emphasis);
  return `<div class="card">
      <details data-panel-section="evidence" ${emphasisAttrs ? `${emphasisAttrs} ` : ''}${input.expanded ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Evidence</span>${emphasisBadge}</summary>
        <div class="panel-section-body">
          <ul class="evidence-list" id="evidence-list">${
            input.evidenceItemsTrustedHtml || '<li class="muted">No evidence captured yet.</li>'
          }</ul>
          ${
            hasExtraEvidence
              ? `<button type="button" class="show-more-btn" data-action="toggleEvidenceMore" data-hidden-count="${input.hiddenEvidenceCount}" aria-controls="evidence-list" aria-expanded="false">${escapeHtml(showMoreLabel)}</button>`
              : ''
          }
        </div>
      </details>
    </div>`;
}

export type EvidenceGroupModeLabel = 'Recent' | 'By file' | 'By time' | 'By action';

const EVIDENCE_GROUP_MODE_LABELS: Record<string, EvidenceGroupModeLabel> = {
  recent: 'Recent',
  'by-file': 'By file',
  'by-time': 'By time',
  'by-action': 'By action',
};

export interface GroupedEvidenceTabInput {
  /** Current active group mode. */
  activeMode: string;
  /** Pre-rendered content for the active mode. */
  contentTrustedHtml: string;
  /** Total evidence items (for the "expand full timeline" affordance). */
  totalCount: number;
  /** Whether the full timeline expand affordance should be shown. */
  showExpandTimeline: boolean;
  expanded: boolean;
  emphasis?: PanelSectionEmphasis;
}

export function renderGroupedEvidenceTab(input: GroupedEvidenceTabInput): string {
  const emphasisAttrs = renderPanelSectionEmphasisAttrs(input.emphasis);
  const emphasisBadge = renderPanelSectionEmphasisBadge(input.emphasis);

  const toggleButtons = Object.entries(EVIDENCE_GROUP_MODE_LABELS)
    .map(([mode, label]) => {
      const isActive = mode === input.activeMode;
      return `<button type="button" class="evidence-group-btn${isActive ? ' evidence-group-btn-active' : ''}" data-action="setEvidenceGroupMode" data-evidence-mode="${escapeHtml(mode)}" aria-pressed="${isActive ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');

  const expandTimeline = input.showExpandTimeline
    ? `<div class="evidence-expand-full"><button type="button" class="text-link-button evidence-expand-btn" data-action="setPanelSectionExpanded" data-section-id="timeline" data-section-expanded="true">Expand full timeline ↗</button></div>`
    : '';

  return `<div class="card">
      <details data-panel-section="evidence" ${emphasisAttrs ? `${emphasisAttrs} ` : ''}${input.expanded ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Evidence</span>${emphasisBadge}</summary>
        <div class="panel-section-body">
          <div class="evidence-group-mode-bar" role="group" aria-label="Evidence view mode">${toggleButtons}</div>
          <ul class="evidence-list evidence-grouped-list" id="evidence-list">${
            input.contentTrustedHtml || '<li class="muted">No evidence captured yet.</li>'
          }</ul>
          ${expandTimeline}
        </div>
      </details>
    </div>`;
}

export type ResumeCockpitAnchorKind = 'file' | 'url';

export interface ResumeCockpitAnchor {
  label: string;
  kind: ResumeCockpitAnchorKind;
  id: string;
  clickable: boolean;
}

export interface ResumeCockpitCardInput {
  verifyFirst: string;
  nextStep: string;
  blocker?: string;
  anchors: ResumeCockpitAnchor[];
  actionButtonsTrustedHtml: string;
}

export function renderResumeCockpitCard(input: ResumeCockpitCardInput): string {
  const topAnchors = input.anchors.slice(0, 3);
  const blockerHtml = input.blocker
    ? `<details class="cockpit-blocker-details">
        <summary class="panel-disclosure-summary cockpit-blocker-summary"><span class="cockpit-field-label cockpit-blocker-label">Blocker</span></summary>
        <div class="cockpit-blocker-body">${escapeHtml(input.blocker)}</div>
      </details>`
    : '';
  const anchorsHtml =
    topAnchors.length > 0
      ? `<div class="cockpit-anchors">
        <span class="cockpit-field-label">Recent anchors</span>
        <ul class="cockpit-anchor-list">${topAnchors
          .map((a) =>
            a.clickable
              ? `<li><button type="button" class="text-link-button cockpit-anchor-btn badge kind-${escapeHtml(a.kind)}" data-action="openEvidence" data-evidence-id="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button></li>`
              : `<li><span class="badge kind-${escapeHtml(a.kind)}">${escapeHtml(a.label)}</span></li>`,
          )
          .join('')}</ul>
      </div>`
      : '';
  return `<div class="card cockpit-card">
    <div class="cockpit-field-row">
      <label class="cockpit-field-label" for="cockpit-verify-first">Verify first</label>
      <input
        id="cockpit-verify-first"
        class="cockpit-input"
        type="text"
        maxlength="280"
        autocomplete="off"
        spellcheck="false"
        value="${escapeHtml(input.verifyFirst)}"
        placeholder="What to confirm before diving in…"
        aria-label="Verify first — what to check before starting"
      />
    </div>
    <div class="cockpit-field-row">
      <label class="cockpit-field-label" for="cockpit-next-step">Next step</label>
      <input
        id="cockpit-next-step"
        class="cockpit-input"
        type="text"
        maxlength="280"
        autocomplete="off"
        spellcheck="false"
        value="${escapeHtml(input.nextStep)}"
        placeholder="Immediate next action…"
        aria-label="Next step — immediate next action"
      />
    </div>
    ${blockerHtml}
    ${anchorsHtml}
    <div class="cockpit-save-state sr-only" id="cockpit-save-state" aria-live="polite" aria-atomic="true"></div>
    ${input.actionButtonsTrustedHtml ? `<div class="cockpit-action-row status-actions">${input.actionButtonsTrustedHtml}</div>` : ''}
  </div>`;
}

export function renderDetailsCard(
  detailsTrustedHtml: string,
  expanded: boolean,
  emphasis?: PanelSectionEmphasis,
): string {
  const emphasisAttrs = renderPanelSectionEmphasisAttrs(emphasis);
  const emphasisBadge = renderPanelSectionEmphasisBadge(emphasis);
  return `<div class="card">
      <details data-panel-section="details" ${
        emphasisAttrs ? `${emphasisAttrs} ` : ''
      }${expanded ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">Details</span>${emphasisBadge}</summary>
        <div class="panel-section-body">
          <div class="details-markdown">${detailsTrustedHtml}</div>
        </div>
      </details>
    </div>`;
}
