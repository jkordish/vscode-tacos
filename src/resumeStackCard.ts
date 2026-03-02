import { escapeHtml } from './webviewSecurity';

/**
 * Trusted HTML fragments are pre-rendered by extension-owned helpers.
 * Callers must escape or sanitize any dynamic values before passing them here.
 */
export type TrustedHtml = string;

export interface RenderResumeStackCardInput {
  intent: string;
  intentOverridden?: boolean;
  intentEditorTrustedHtml?: TrustedHtml;
  mode: string;
  nowSlotSourceClass?: string;
  nowCheckpointLineTrustedHtml?: TrustedHtml;
  lastActionLabel: string;
  lastActionContext?: string;
  lastActionActionTrustedHtml?: TrustedHtml;
  nextSlotSourceClass?: string;
  nextSafeActionSummary: string;
  hasPrimaryNextAction: boolean;
  primaryCtaSourceClass?: string;
  primaryNextActionTrustedHtml?: TrustedHtml;
  nextStepRationaleTrustedHtml?: TrustedHtml;
  nextStepsListTrustedHtml: TrustedHtml;
  hasBlocker: boolean;
  blockedSlotSourceClass?: string;
  blockerTitle: string;
  blockerDetail: string;
  blockerMetaTrustedHtml?: TrustedHtml;
  blockerDisabledReasonTrustedHtml?: TrustedHtml;
  blockerActionTrustedHtml?: TrustedHtml;
  restoreSlotSourceClass?: string;
  restoreSectionsTrustedHtml: TrustedHtml;
  restoreUnavailableHintsTrustedHtml?: TrustedHtml;
}

export function renderResumeStackCard(input: RenderResumeStackCardInput): string {
  const nowSlotSourceClass = input.nowSlotSourceClass ?? 'summary:intent-and-retrieval-cues';
  const nextSlotSourceClass = input.nextSlotSourceClass ?? 'summary:none';
  const blockedSlotSourceClass = input.blockedSlotSourceClass ?? 'blocker:none';
  const restoreSlotSourceClass = input.restoreSlotSourceClass ?? 'restore:availability-and-trust';
  const primaryCtaSourceAttr = input.primaryCtaSourceClass
    ? ` data-primary-cta-source-class="${escapeHtml(input.primaryCtaSourceClass)}"`
    : '';

  return `<div class="card">
      <h3>Companion Home</h3>
      <div class="companion-grid">
        <section class="companion-block" data-companion-section="now" data-companion-slot-source="${escapeHtml(
          nowSlotSourceClass,
        )}">
          <h4>Now</h4>
          <p class="companion-kicker">Current focus</p>
          <p class="companion-primary">${escapeHtml(input.intent)}</p>
          <p class="companion-meta">Intent source: ${
            input.intentOverridden ? 'user-edited' : 'inferred'
          }</p>${input.intentEditorTrustedHtml ?? ''}
          <p class="companion-meta">Mode: ${escapeHtml(input.mode)}</p>
          ${input.nowCheckpointLineTrustedHtml ?? ''}
          <p class="companion-kicker">Last action</p>
          <p class="companion-primary" data-last-action-cue="true">${escapeHtml(input.lastActionLabel)}</p>
          ${
            input.lastActionContext
              ? `<p class="companion-meta">${escapeHtml(input.lastActionContext)}</p>`
              : ''
          }
          ${
            input.lastActionActionTrustedHtml
              ? `<div class="status-actions">${input.lastActionActionTrustedHtml}</div>`
              : ''
          }
        </section>
        <section class="companion-block" data-companion-section="next" data-companion-slot-source="${escapeHtml(
          nextSlotSourceClass,
        )}">
          <h4>Next</h4>
          <p class="companion-kicker">Next safe action</p>
          <p class="companion-primary">${escapeHtml(input.nextSafeActionSummary)}</p>
          <p class="state-caption ${
            input.hasPrimaryNextAction ? 'state-safe' : 'state-advisory'
          }" data-next-safe-status="${input.hasPrimaryNextAction ? 'safe' : 'advisory'}"${primaryCtaSourceAttr}>Status: ${
            input.hasPrimaryNextAction ? 'Safe action available' : 'Advisory only'
          }</p>
          ${input.nextStepRationaleTrustedHtml ?? ''}
          <ul class="compact-list">${
            input.nextStepsListTrustedHtml || '<li>No next steps captured yet.</li>'
          }</ul>
          <div class="status-actions">
            ${input.primaryNextActionTrustedHtml ?? ''}
            <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
            <button type="button" class="secondary" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
          </div>
        </section>
        <section class="companion-block" data-companion-section="blocked" data-companion-slot-source="${escapeHtml(
          blockedSlotSourceClass,
        )}" data-blocked-card="${input.hasBlocker ? 'active' : 'none'}">
          <h4>Blocked</h4>
          <p class="state-caption ${input.hasBlocker ? 'state-blocked' : 'state-clear'}">Status: ${
            input.hasBlocker ? 'Blocked' : 'No blocker'
          }</p>
          <p class="companion-primary">${escapeHtml(input.blockerTitle)}</p>
          <p class="muted">${escapeHtml(input.blockerDetail)}</p>
          ${input.blockerMetaTrustedHtml ?? ''}
          ${input.blockerDisabledReasonTrustedHtml ?? ''}
          ${input.blockerActionTrustedHtml ?? ''}
        </section>
        <section class="companion-block" data-companion-section="restore" data-companion-slot-source="${escapeHtml(
          restoreSlotSourceClass,
        )}">
          <h4>Restore</h4>
          ${input.restoreSectionsTrustedHtml}
          ${input.restoreUnavailableHintsTrustedHtml ?? ''}
        </section>
      </div>
    </div>`;
}
