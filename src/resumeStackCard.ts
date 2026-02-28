import { escapeHtml } from './webviewSecurity';

export interface RenderResumeStackCardInput {
  intent: string;
  mode: string;
  nowCheckpointLineHtml?: string;
  nextStepsListHtml: string;
  blockerTitle: string;
  blockerDetail: string;
  blockerActionHtml?: string;
  restoreSectionsHtml: string;
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
          ${input.nowCheckpointLineHtml ?? ''}
        </section>
        <section class="companion-block">
          <h4>Next</h4>
          <ul class="compact-list">${
            input.nextStepsListHtml || '<li>No next steps captured yet.</li>'
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
          ${input.blockerActionHtml ?? ''}
        </section>
        <section class="companion-block">
          <h4>Restore</h4>
          ${input.restoreSectionsHtml}
        </section>
      </div>
    </div>`;
}
