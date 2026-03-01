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
  nowCheckpointLineTrustedHtml?: TrustedHtml;
  lastActionLabel: string;
  lastActionContext?: string;
  lastActionActionTrustedHtml?: TrustedHtml;
  nextSafeActionSummary: string;
  hasPrimaryNextAction: boolean;
  primaryNextActionTrustedHtml?: TrustedHtml;
  nextStepRationaleTrustedHtml?: TrustedHtml;
  nextStepsListTrustedHtml: TrustedHtml;
  hasBlocker: boolean;
  blockerTitle: string;
  blockerDetail: string;
  blockerMetaTrustedHtml?: TrustedHtml;
  blockerDisabledReasonTrustedHtml?: TrustedHtml;
  blockerActionTrustedHtml?: TrustedHtml;
  restoreSectionsTrustedHtml: TrustedHtml;
}

export function renderResumeStackCard(input: RenderResumeStackCardInput): string {
  return `<div class="card">
      <h3>Companion Home</h3>
      <div class="companion-grid">
        <section class="companion-block" data-companion-section="now">
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
        <section class="companion-block" data-companion-section="next">
          <h4>Next</h4>
          <p class="companion-kicker">Next safe action</p>
          <p class="companion-primary">${escapeHtml(input.nextSafeActionSummary)}</p>
          <p class="state-caption ${
            input.hasPrimaryNextAction ? 'state-safe' : 'state-advisory'
          }">Status: ${input.hasPrimaryNextAction ? 'Safe action available' : 'Advisory only'}</p>
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
        <section class="companion-block" data-companion-section="blocked" data-blocked-card="${
          input.hasBlocker ? 'active' : 'none'
        }">
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
        <section class="companion-block" data-companion-section="restore">
          <h4>Restore</h4>
          ${input.restoreSectionsTrustedHtml}
        </section>
      </div>
    </div>`;
}
