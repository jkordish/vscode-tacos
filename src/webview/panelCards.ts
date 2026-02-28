import { escapeHtml } from '../webviewSecurity';

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
      <div class="status-label">${escapeHtml(input.sourceLabel)} · ${escapeHtml(input.generatedAtLabel)}</div>
      <div class="status-detail muted">${escapeHtml(input.statusHint)}</div>
      <div class="status-detail"><strong>${escapeHtml(input.autoSummaryStatusLabel)}</strong></div>
      <div class="status-detail muted">${escapeHtml(input.autoSummaryStatusDetail)}</div>
      <div class="status-actions">
        <button type="button" data-action="refreshSummary">Refresh summary now</button>
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
  trustBasedOn: string;
  trustCueDetailsTrustedHtml: string;
  autoSummaryToggleDisabledAttr: string;
  autoSummaryToggleLabel: string;
  expanded: boolean;
}

export function renderTrustCenterCard(input: TrustCenterCardInput): string {
  return `<div class="card">
      <details data-panel-section="trustCenter" ${input.expanded ? 'open' : ''}>
        <summary><h3>Trust Center</h3></summary>
        <div class="panel-section-body">
          <div class="trust-row"><span class="trust-key">Tracking:</span> ${escapeHtml(input.trustTrackingLabel)}</div>
          <div class="trust-row"><span class="trust-key">Stored locally:</span> ${escapeHtml(input.storedLocallyLabel)}</div>
          <div class="trust-row"><span class="trust-key">Sent to AI:</span> ${escapeHtml(input.sentToAiLabel)}</div>
          <div class="trust-row"><span class="trust-key">Based on:</span> ${escapeHtml(input.trustBasedOn)}</div>
          <details>
            <summary><strong>Why am I seeing this?</strong></summary>
            <ul class="compact-list">${input.trustCueDetailsTrustedHtml || '<li>No evidence counts yet.</li>'}</ul>
          </details>
          <div class="status-actions">
            <button type="button" class="secondary" data-action="toggleAutoSummaries" ${
              input.autoSummaryToggleDisabledAttr
            }>${escapeHtml(input.autoSummaryToggleLabel)}</button>
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
          <h4>Done since last resume</h4>
          <ul class="compact-list">${input.recapDoneListTrustedHtml || '<li>None captured yet.</li>'}</ul>
        </section>
        <section>
          <h4>Pending / blocked</h4>
          <ul class="compact-list">${input.recapPendingListTrustedHtml || '<li>No blocker captured.</li>'}</ul>
        </section>
      </div>
    </div>`;
}

export function renderChangesSinceCard(changesSinceItemsTrustedHtml: string): string {
  return `<div class="card">
      <h3>Changes Since Last Time</h3>
      <ul class="compact-list">${changesSinceItemsTrustedHtml || '<li>No changes captured.</li>'}</ul>
    </div>`;
}

export interface TimelineCardInput {
  showTimeline: boolean;
  timelineGroupsTrustedHtml: string;
  expanded: boolean;
}

export function renderTimelineCard(input: TimelineCardInput): string {
  if (!input.showTimeline) {
    return '';
  }

  return `<div class="card">
      <details data-panel-section="timeline" ${input.expanded ? 'open' : ''}>
        <summary><h3>Timeline</h3></summary>
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
      <ul${listClass}>${input.listItemsTrustedHtml || `<li>${escapeHtml(input.emptyMessage)}</li>`}</ul>
    </div>`;
}

export function renderQuickActionsCard(quickActionGroupsTrustedHtml: string): string {
  return `<div class="card">
      <h3>Quick Actions</h3>
      ${quickActionGroupsTrustedHtml}
    </div>`;
}

export function renderRestorePackCard(
  restorePackGroupsTrustedHtml: string,
  trustedWorkspace: boolean,
): string {
  return `<div class="card">
      <h3>Restore Pack</h3>
      ${restorePackGroupsTrustedHtml}
      ${
        trustedWorkspace
          ? ''
          : '<div class="restore-note">Restricted Mode: task/debug/branch execution actions are disabled.</div>'
      }
    </div>`;
}

export interface EvidenceCardInput {
  evidenceItemsTrustedHtml: string;
  hiddenEvidenceCount: number;
  expanded: boolean;
}

export function renderEvidenceCard(input: EvidenceCardInput): string {
  const hasExtraEvidence = input.hiddenEvidenceCount > 0;
  const showMoreLabel = hasExtraEvidence ? `Show ${input.hiddenEvidenceCount} more` : 'Show more';
  return `<div class="card">
      <details data-panel-section="evidence" ${input.expanded ? 'open' : ''}>
        <summary><h3>Evidence</h3></summary>
        <div class="panel-section-body">
          <ul class="evidence-list" id="evidence-list">${
            input.evidenceItemsTrustedHtml || '<li>None captured</li>'
          }</ul>
          ${
            hasExtraEvidence
              ? `<button type="button" class="show-more-btn" data-action="toggleEvidenceMore" data-hidden-count="${input.hiddenEvidenceCount}" aria-expanded="false">${escapeHtml(showMoreLabel)}</button>`
              : ''
          }
        </div>
      </details>
    </div>`;
}

export function renderDetailsCard(detailsTrustedHtml: string, expanded: boolean): string {
  return `<div class="card">
      <details data-panel-section="details" ${expanded ? 'open' : ''}>
        <summary><h3>Details</h3></summary>
        <div class="panel-section-body">
          <div class="details-markdown">${detailsTrustedHtml}</div>
        </div>
      </details>
    </div>`;
}
