import { escapeHtml } from './webviewSecurity';

/**
 * Trusted HTML fragments are pre-rendered by extension-owned helpers.
 * Callers must escape or sanitize any dynamic values before passing them here.
 */
export type TrustedHtml = string;

export interface RenderResumeStackCardInput {
  intent: string;
  mode: string;
  nowCheckpointLineTrustedHtml?: TrustedHtml;
  nextStepsListTrustedHtml: TrustedHtml;
  blockerTitle: string;
  blockerDetail: string;
  blockerActionTrustedHtml?: TrustedHtml;
  restoreSectionsTrustedHtml: TrustedHtml;
}

export function renderResumeStackCard(input: RenderResumeStackCardInput): string {
  return `<div class="card">
      <h3>Companion Home</h3>
      <div class="companion-grid">
        <section class="companion-block">
          <h4>Now</h4>
          <p class="companion-kicker">Current focus</p>
          <p class="companion-primary">${escapeHtml(input.intent)}</p>
          <p class="companion-meta">Mode: ${escapeHtml(input.mode)}</p>
          ${input.nowCheckpointLineTrustedHtml ?? ''}
        </section>
        <section class="companion-block">
          <h4>Next</h4>
          <ul class="compact-list">${
            input.nextStepsListTrustedHtml || '<li>No next steps captured yet.</li>'
          }</ul>
          <div class="status-actions">
            <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
            <button type="button" class="secondary" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
          </div>
        </section>
        <section class="companion-block">
          <h4>Blocked</h4>
          <p class="companion-primary">${escapeHtml(input.blockerTitle)}</p>
          <p class="muted">${escapeHtml(input.blockerDetail)}</p>
          ${input.blockerActionTrustedHtml ?? ''}
        </section>
        <section class="companion-block">
          <h4>Restore</h4>
          ${input.restoreSectionsTrustedHtml}
        </section>
      </div>
    </div>`;
}
