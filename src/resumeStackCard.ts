import { escapeHtml } from './webviewSecurity';

/**
 * Trusted HTML fragments are pre-rendered by extension-owned helpers.
 * Callers must escape or sanitize any dynamic values before passing them here.
 */
export type TrustedHtml = string;
export type CompanionSlotToken = 'primary' | 'advisory' | 'suppressed';

// Token labels are aria-hidden — CSS drives the visual treatment via data attributes.
// Keeping them short avoids cluttering the visual scan path.
const SLOT_TOKEN_LABELS: Record<CompanionSlotToken, string> = {
  primary: '✓',
  advisory: '~',
  suppressed: '–',
};

function normalizeCompanionSlotToken(token: CompanionSlotToken | undefined): CompanionSlotToken {
  if (token === 'primary' || token === 'advisory' || token === 'suppressed') {
    return token;
  }

  return 'advisory';
}

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
  nextPrimaryCtaSourceClass?: string;
  nextEmphasisToken?: CompanionSlotToken;
  primaryNextActionTrustedHtml?: TrustedHtml;
  whySurfacedActionTrustedHtml?: TrustedHtml;
  aiPayloadPreviewActionTrustedHtml?: TrustedHtml;
  evidenceTrayActionTrustedHtml?: TrustedHtml;
  nextStepRationaleTrustedHtml?: TrustedHtml;
  nextStepsListTrustedHtml: TrustedHtml;
  hasBlocker: boolean;
  blockedSlotSourceClass?: string;
  hasPrimaryBlockedAction?: boolean;
  blockedPrimaryCtaSourceClass?: string;
  blockedEmphasisToken?: CompanionSlotToken;
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
  const nextToken = normalizeCompanionSlotToken(input.nextEmphasisToken);
  const blockedToken = normalizeCompanionSlotToken(input.blockedEmphasisToken);
  const nextPrimaryCtaSourceAttr = input.nextPrimaryCtaSourceClass
    ? ` data-primary-cta-source-class="${escapeHtml(input.nextPrimaryCtaSourceClass)}"`
    : '';
  const blockedPrimaryCtaSourceAttr = input.blockedPrimaryCtaSourceClass
    ? ` data-primary-cta-source-class="${escapeHtml(input.blockedPrimaryCtaSourceClass)}"`
    : '';
  const nextEvidenceTrayActionTrustedHtml = input.hasBlocker
    ? ''
    : (input.evidenceTrayActionTrustedHtml ?? '');
  const blockedEvidenceTrayActionTrustedHtml = input.hasBlocker
    ? (input.evidenceTrayActionTrustedHtml ?? '')
    : '';

  return `<div class="card">
      <h3>Resume Brief</h3>
      <div class="companion-grid">
         <section class="companion-block" data-companion-section="now" data-companion-slot-source="${escapeHtml(
           nowSlotSourceClass,
         )}">
          <h4>Now</h4>
          <p class="companion-kicker">Intent</p>
          <p class="companion-primary">${escapeHtml(input.intent)}</p>
          <p class="companion-meta">${
            input.intentOverridden ? 'Edited by you' : 'Inferred from context'
          }</p>${input.intentEditorTrustedHtml ?? ''}
          <p class="companion-meta">Mode: ${escapeHtml(input.mode)}</p>
          ${input.nowCheckpointLineTrustedHtml ?? ''}
          <p class="companion-kicker">Retrieval cue</p>
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
          <p class="companion-kicker">Next step</p>
          <p class="companion-primary">${escapeHtml(input.nextSafeActionSummary)}</p>
          <p class="state-caption ${
            input.hasPrimaryNextAction ? 'state-safe' : 'state-advisory'
          }" data-next-safe-status="${input.hasPrimaryNextAction ? 'safe' : 'advisory'}" data-next-emphasis-token="${escapeHtml(nextToken)}"${nextPrimaryCtaSourceAttr}><span class="slot-token slot-token-${escapeHtml(nextToken)}" data-emphasis-token="${escapeHtml(nextToken)}">${SLOT_TOKEN_LABELS[nextToken]}</span> Status: ${
            input.hasPrimaryNextAction ? 'Safe action available' : 'Advisory only'
          }</p>
          ${input.nextStepRationaleTrustedHtml ?? ''}
          <ul class="compact-list">${
            input.nextStepsListTrustedHtml || '<li>No next steps captured yet.</li>'
          }</ul>
          <div class="status-actions">
            ${input.primaryNextActionTrustedHtml ?? ''}
            ${input.whySurfacedActionTrustedHtml ?? ''}
            ${input.aiPayloadPreviewActionTrustedHtml ?? ''}
            ${nextEvidenceTrayActionTrustedHtml}
            <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
            <button type="button" class="secondary" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
          </div>
        </section>
        <section class="companion-block" data-companion-section="blocked" data-companion-slot-source="${escapeHtml(
          blockedSlotSourceClass,
        )}" data-blocked-card="${input.hasBlocker ? 'active' : 'none'}">
          <h4>Blocked</h4>
          <p class="state-caption ${
            input.hasPrimaryBlockedAction
              ? 'state-blocked'
              : input.hasBlocker
                ? 'state-advisory'
                : 'state-clear'
          }" data-blocked-status="${
            input.hasPrimaryBlockedAction ? 'primary' : input.hasBlocker ? 'advisory' : 'clear'
          }" data-blocked-emphasis-token="${escapeHtml(blockedToken)}"${blockedPrimaryCtaSourceAttr}><span class="slot-token slot-token-${escapeHtml(blockedToken)}" data-emphasis-token="${escapeHtml(blockedToken)}">${SLOT_TOKEN_LABELS[blockedToken]}</span> Status: ${
            input.hasBlocker ? 'Blocked' : 'No blocker'
          }</p>
          <p class="companion-primary">${escapeHtml(input.blockerTitle)}</p>
          <p class="muted">${escapeHtml(input.blockerDetail)}</p>
          ${input.blockerMetaTrustedHtml ?? ''}
          ${input.blockerDisabledReasonTrustedHtml ?? ''}
          ${
            input.blockerActionTrustedHtml || blockedEvidenceTrayActionTrustedHtml
              ? `<div class="status-actions">${input.blockerActionTrustedHtml ?? ''}${blockedEvidenceTrayActionTrustedHtml}</div>`
              : ''
          }
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
