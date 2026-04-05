import type { CompanionNudge } from '../companionNudges';
import type { CheckpointNote } from '../checkpoint';
import type { NextStepAction } from '../nextStepActions';
import type { TaskStateFreshness } from '../taskState';
import type { EvidenceRelevanceGroup, TimelineGroup } from '../timeline';
import type { SummaryEvidenceItem, SummaryLink } from '../types';
import { escapeHtml } from '../webviewSecurity';

/**
 * Trusted HTML fragments are pre-rendered by extension-owned helpers.
 * Callers must escape or sanitize any dynamic values before passing them here.
 */
export type TrustedHtml = string;

interface CheckpointNoteView {
  text: string;
  file?: CheckpointNote['file'];
  line?: CheckpointNote['line'];
  branch?: CheckpointNote['branch'];
  partition?: CheckpointNote['partition'];
  pinned?: CheckpointNote['pinned'];
}

export interface CheckpointCardInput {
  openCheckpointCount: number;
  currentCheckpointNote?: CheckpointNoteView;
}

export function renderCheckpointCard(input: CheckpointCardInput): string {
  if (!input.currentCheckpointNote || input.openCheckpointCount <= 0) {
    return '';
  }

  const checkpointContextLine = [
    input.currentCheckpointNote.file
      ? `${input.currentCheckpointNote.file}${
          typeof input.currentCheckpointNote.line === 'number'
            ? `:${input.currentCheckpointNote.line}`
            : ''
        }`
      : '',
    input.currentCheckpointNote.branch ? `branch ${input.currentCheckpointNote.branch}` : '',
    input.currentCheckpointNote.partition
      ? `partition ${input.currentCheckpointNote.partition}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const notesCountLabel =
    input.openCheckpointCount === 1 ? '1 open note' : `${input.openCheckpointCount} open notes`;
  return `<div class="card">
      <h3>Notes <span class="${input.currentCheckpointNote.pinned ? 'badge badge-attention' : 'badge'}">${escapeHtml(notesCountLabel)}</span></h3>
      <p class="companion-primary">${escapeHtml(input.currentCheckpointNote.text)}</p>
      ${checkpointContextLine ? `<p class="card-meta">${escapeHtml(checkpointContextLine)}</p>` : ''}
      <div class="note-actions">
        <button type="button" data-action="checkpointMarkDone">Mark done</button>
        <button type="button" class="secondary" data-action="checkpointPinToggle">${
          input.currentCheckpointNote.pinned ? 'Unpin' : 'Pin'
        }</button>
        <button type="button" class="secondary" data-action="checkpointOpenList">All notes</button>
      </div>
    </div>`;
}

export interface TaskStateCardInput {
  objective: string;
  nextLikelySafeMove?: string;
  confidence: string;
  blockers: string[];
  assumptions: string[];
  workingSet: string[];
  freshness: TaskStateFreshness;
  staleLabel?: string;
  safeBreakpoint?: string;
  switchCount: number;
}

export function renderTaskStateCard(input: TaskStateCardInput | undefined): string {
  if (!input || !input.objective.trim()) {
    return '';
  }

  const freshnessLabel =
    input.freshness === 'stale'
      ? 'Stale'
      : input.freshness === 'fresh'
        ? 'Fresh'
        : 'No freshness signal';
  const freshnessBadgeClass =
    input.freshness === 'fresh'
      ? 'badge badge-freshness'
      : input.freshness === 'stale'
        ? 'badge badge-attention'
        : 'badge';
  const workingSetHtml =
    input.workingSet.length > 0
      ? `<ul class="compact-list">${input.workingSet
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      : '<p class="muted">No working set captured yet.</p>';
  const blockersHtml =
    input.blockers.length > 0
      ? `<ul class="compact-list">${input.blockers
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      : '<p class="muted">No blockers captured.</p>';
  const assumptionsHtml =
    input.assumptions.length > 0
      ? `<ul class="compact-list">${input.assumptions
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      : '<p class="muted">No open assumptions captured.</p>';

  return `<div class="card">
      <h3>Task State</h3>
      <p class="companion-primary">${escapeHtml(input.objective)}</p>
      ${
        input.nextLikelySafeMove
          ? `<p class="muted"><strong>Next likely safe move:</strong> ${escapeHtml(
              input.nextLikelySafeMove,
            )}</p>`
          : ''
      }
      <div class="step-evidence">
        <span class="badge badge-confidence">${escapeHtml(input.confidence)} confidence</span>
        <span class="${freshnessBadgeClass}">${escapeHtml(freshnessLabel)}</span>
        ${input.switchCount > 0 ? `<span class="badge">${escapeHtml(String(input.switchCount))} switch${input.switchCount === 1 ? '' : 'es'}</span>` : ''}
      </div>
      ${
        input.safeBreakpoint
          ? `<p class="card-meta muted"><span class="card-meta-label">Safe breakpoint:</span> ${escapeHtml(
              input.safeBreakpoint,
            )}</p>`
          : ''
      }
      ${input.staleLabel ? `<p class="muted card-stale-label">${escapeHtml(input.staleLabel)}</p>` : ''}
        <details>
         <summary class="panel-disclosure-summary"><strong>Working set</strong></summary>
         ${workingSetHtml}
        </details>
        <details>
         <summary class="panel-disclosure-summary"><strong>Blockers${input.blockers.length > 0 ? ` (${input.blockers.length})` : ''}</strong></summary>
         ${blockersHtml}
        </details>
        <details>
         <summary class="panel-disclosure-summary"><strong>Assumptions${input.assumptions.length > 0 ? ` (${input.assumptions.length})` : ''}</strong></summary>
         ${assumptionsHtml}
        </details>
      <div class="note-actions">
        <button type="button" data-action="captureStructuredCheckpoint">Update task state</button>
        <button type="button" class="secondary" data-action="taskStateResolve">Mark resolved</button>
        <button type="button" class="secondary" data-action="confirmTaskSwitch">Switch task</button>
      </div>
    </div>`;
}

export interface CognitiveDebriefCardInput {
  abandonedThreadCount: number;
  unresolvedBlockerCount: number;
  repeatedSwitchCount: number;
  staleTaskStateCount: number;
  openAssumptionCount: number;
}

export function renderCognitiveDebriefCard(input: CognitiveDebriefCardInput | undefined): string {
  if (!input) {
    return '';
  }

  const total =
    input.abandonedThreadCount +
    input.unresolvedBlockerCount +
    input.repeatedSwitchCount +
    input.staleTaskStateCount +
    input.openAssumptionCount;
  if (total <= 0) {
    return '';
  }

  return `<div class="card card-mental-load">
      <h3>Mental Load <span class="badge badge-attention">${total} item${total === 1 ? '' : 's'}</span></h3>
      <p class="muted">Open threads competing for attention.</p>
      <ul class="compact-list debrief-list">
        ${input.abandonedThreadCount > 0 ? `<li><span class="debrief-count">${escapeHtml(String(input.abandonedThreadCount))}</span> abandoned thread${input.abandonedThreadCount === 1 ? '' : 's'}</li>` : ''}
        ${input.unresolvedBlockerCount > 0 ? `<li><span class="debrief-count">${escapeHtml(String(input.unresolvedBlockerCount))}</span> unresolved blocker${input.unresolvedBlockerCount === 1 ? '' : 's'}</li>` : ''}
        ${input.repeatedSwitchCount > 0 ? `<li><span class="debrief-count">${escapeHtml(String(input.repeatedSwitchCount))}</span> repeated-switch task${input.repeatedSwitchCount === 1 ? '' : 's'}</li>` : ''}
        ${input.staleTaskStateCount > 0 ? `<li><span class="debrief-count">${escapeHtml(String(input.staleTaskStateCount))}</span> stale task state${input.staleTaskStateCount === 1 ? '' : 's'}</li>` : ''}
        ${input.openAssumptionCount > 0 ? `<li><span class="debrief-count">${escapeHtml(String(input.openAssumptionCount))}</span> open assumption${input.openAssumptionCount === 1 ? '' : 's'}</li>` : ''}
      </ul>
      <div class="status-actions">
        <button type="button" data-action="showCognitiveDebrief">Review open threads</button>
      </div>
    </div>`;
}

export interface ScratchpadCardInput {
  showScratchpadCard: boolean;
  scratchpadScopeLabel?: string;
  scratchpadPreviewLines: string[];
  scratchpadHasContent: boolean;
}

export function renderScratchpadCard(input: ScratchpadCardInput): string {
  if (!input.showScratchpadCard) {
    return '';
  }

  const scratchpadPreviewHtml =
    input.scratchpadPreviewLines.length > 0
      ? `<ul class="compact-list">${input.scratchpadPreviewLines
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')}</ul>`
      : `<p class="muted">${
          input.scratchpadHasContent ? 'Scratchpad has content.' : 'No scratchpad content yet.'
        }</p>`;

  return `<div class="card">
      <h3>Scratchpad</h3>
      ${
        input.scratchpadScopeLabel
          ? `<p class="muted">${escapeHtml(input.scratchpadScopeLabel)}</p>`
          : ''
      }
      ${scratchpadPreviewHtml}
      <div class="status-actions">
        <button type="button" class="secondary" data-action="openScratchpad">Open</button>
        <button type="button" class="secondary" data-action="appendScratchpad">Append</button>
        <button type="button" class="secondary" data-action="setScratchpadScope">Scope</button>
      </div>
    </div>`;
}

export interface ConfidenceCardInput {
  longGap: boolean;
  lowConfidence: boolean;
  hasCurrentCheckpointNote: boolean;
  resumeGapMinutes?: number;
  lastActionLabel?: string;
  recommendedFirstAction?: string;
  firstNextStep?: string;
  candidateIntents?: string[];
}

export function renderConfidenceCard(input: ConfidenceCardInput): string {
  const showCard = input.longGap || (input.lowConfidence && !input.hasCurrentCheckpointNote);
  if (!showCard) {
    return '';
  }

  const reorientationGapLine =
    typeof input.resumeGapMinutes === 'number'
      ? `<li>Last captured activity was about ${input.resumeGapMinutes} minute${
          input.resumeGapMinutes === 1 ? '' : 's'
        } ago.</li>`
      : '';
  const candidateIntentItems = (input.candidateIntents ?? [])
    .map((candidate) => `<li>${escapeHtml(candidate)}</li>`)
    .join('');
  const reorientationCardItems = input.longGap
    ? [
        reorientationGapLine,
        `<li><strong>Retrieval cue:</strong> ${escapeHtml(
          input.lastActionLabel?.trim() || 'No last action captured yet.',
        )}</li>`,
        `<li><strong>Next step:</strong> ${escapeHtml(
          input.recommendedFirstAction?.trim() ||
            input.firstNextStep ||
            'Open a recent file and reorient context.',
        )}</li>`,
      ]
        .filter(Boolean)
        .join('')
    : candidateIntentItems || '<li>No strong candidates captured.</li>';
  const reorientationCardTitle = input.longGap ? 'Welcome back' : 'What are we doing?';
  const reorientationCardDescription = input.longGap
    ? "You've been away a while. Take a moment to reorient before acting."
    : 'Intent is unclear. A quick one-liner will help.';
  const reorientationCardAction = !input.hasCurrentCheckpointNote
    ? '<button type="button" class="secondary" data-action="sessionAddCheckpoint">Add one-line checkpoint</button>'
    : '';

  return `<div class="card card-attention">
      <h3>${reorientationCardTitle}</h3>
      <p class="muted">${reorientationCardDescription}</p>
      <ul class="compact-list">${reorientationCardItems}</ul>
      ${reorientationCardAction}
    </div>`;
}

export interface IntentEditorInput {
  intentInputId: string;
  intent: string;
  intentOverridden?: boolean;
  readOnly?: boolean;
}

export function renderIntentEditor(input: IntentEditorInput): string {
  const intentInputId = escapeHtml(input.intentInputId);
  const readOnly = Boolean(input.readOnly);
  const intentLabel = readOnly ? 'Intent (read-only in sample mode)' : 'Intent';
  const disabledAttr = readOnly ? 'disabled aria-disabled="true"' : '';
  const resetDisabledAttr =
    readOnly || !input.intentOverridden ? 'disabled aria-disabled="true"' : '';
  const readOnlyHint = readOnly
    ? '<p class="muted">Sample mode is read-only. Switch to a real resume to edit intent.</p>'
    : '';
  const modeAttr = readOnly
    ? ' data-intent-editor-readonly="true"'
    : ' data-intent-editor-readonly="false"';
  return `<div class="intent-editor"${modeAttr}>
      <label class="companion-kicker" for="${intentInputId}" data-intent-source-label="true">${intentLabel}</label>
      <div class="intent-editor-row">
        <input id="${intentInputId}" type="text" maxlength="280" value="${escapeHtml(
          input.intent,
        )}" ${disabledAttr} />
      </div>
      ${readOnlyHint}
      <div class="intent-editor-actions">
        <button type="button" class="secondary" data-action="setIntentOverride" ${disabledAttr}>Save</button>
        <button type="button" class="secondary" data-action="clearIntentOverride" ${resetDisabledAttr}>Reset to inferred</button>
      </div>
    </div>`;
}

export interface CompanionNextStepsInput {
  nextSteps: string[];
  nextStepEvidenceIds?: string[][];
  nextStepActions: (NextStepAction | undefined)[];
  primaryNextActionStepIndex: number;
  lowConfidence: boolean;
  evidenceById: Map<string, SummaryEvidenceItem>;
}

export function renderCompanionNextSteps(input: CompanionNextStepsInput): string {
  return input.nextSteps
    .slice(0, 3)
    .map((step, index) => {
      const evidenceIds = input.nextStepEvidenceIds?.[index] ?? [];
      const badges = evidenceIds
        .map((evidenceId) =>
          renderStepEvidenceBadge(evidenceId, input.evidenceById.get(evidenceId)),
        )
        .join('');
      const action = input.nextStepActions[index];
      const actionButton =
        action && input.primaryNextActionStepIndex !== index
          ? `<button type="button" class="secondary step-action" data-action="runNextStepAction" data-step-index="${index}">${escapeHtml(action.label)}</button>`
          : '';
      const advisoryReason = !action
        ? evidenceIds.length === 0
          ? 'No captured evidence for this step yet.'
          : input.lowConfidence
            ? 'Low confidence — verify before acting.'
            : 'No safe one-click action available for this step.'
        : '';
      const badgeRow = badges ? `<div class="step-evidence">${badges}</div>` : '';
      const actionRow = actionButton ? `<div class="step-actions">${actionButton}</div>` : '';
      const advisoryRow = advisoryReason
        ? `<div class="step-advisory" role="note">${escapeHtml(advisoryReason)}</div>`
        : '';
      return `<li>${escapeHtml(step)}${badgeRow}${actionRow}${advisoryRow}</li>`;
    })
    .join('');
}

export function renderStepEvidenceBadge(
  evidenceId: string,
  evidence?: SummaryEvidenceItem,
): string {
  if (!evidence) {
    return `<span class="badge">${escapeHtml(evidenceId)}</span>`;
  }

  const label = `[${evidence.kind}] ${evidence.label}`;
  if (evidence.kind === 'file' || evidence.kind === 'url') {
    return `<button type="button" class="badge clickable kind-${escapeHtml(
      evidence.kind,
    )}" data-action="openEvidence" data-evidence-id="${escapeHtml(evidenceId)}">${escapeHtml(
      label,
    )}</button>`;
  }

  return `<span class="badge">${escapeHtml(label)}</span>`;
}

export function renderTopLinksListItems(links: SummaryLink[]): string {
  return links
    .map(
      (link, index) =>
        `<li><button type="button" class="text-link-button" data-action="openLink" data-link-index="${index}">${escapeHtml(link.label)}</button> <span class="kind">(${escapeHtml(link.kind)})</span></li>`,
    )
    .join('');
}

export function renderTopFilesListItems(topFiles: string[]): string {
  return topFiles
    .map(
      (file, index) =>
        `<li><button type="button" class="text-link-button" data-action="openTopFile" data-top-file-index="${index}">${escapeHtml(file)}</button></li>`,
    )
    .join('');
}

const EVIDENCE_OPEN_HINT_TEXT = 'Opens validated file or URL evidence';
const EVIDENCE_STATIC_HINT_TEXT = 'Informational evidence only; this item is not directly openable';
const TIMELINE_OPEN_HINT_TEXT = 'Opens validated evidence target';
const TIMELINE_STATIC_HINT_TEXT = 'Informational timeline event only';

function renderEvidenceListItem(item: SummaryEvidenceItem, hiddenClass = ''): string {
  const clickable = item.kind === 'file' || item.kind === 'url';
  const target = item.target
    ? ` <span class="evidence-target">${escapeHtml(item.target)}</span>`
    : '';
  const affordanceClass = clickable
    ? 'evidence-affordance evidence-affordance-clickable'
    : 'evidence-affordance evidence-affordance-static';
  const affordance = `<span class="${affordanceClass}" data-evidence-affordance="${
    clickable ? 'open' : 'static'
  }" aria-hidden="true">${clickable ? 'Open' : 'Context only'}</span>`;
  const label = clickable
    ? `<button type="button" class="text-link-button evidence-link-button" data-action="openEvidence" data-evidence-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.label)} - ${escapeHtml(EVIDENCE_OPEN_HINT_TEXT)}" title="${escapeHtml(EVIDENCE_OPEN_HINT_TEXT)}">${escapeHtml(item.label)}</button>`
    : `<span class="evidence-label" aria-label="${escapeHtml(item.label)} - ${escapeHtml(EVIDENCE_STATIC_HINT_TEXT)}">${escapeHtml(item.label)}</span>`;
  return `<li class="evidence-item ${hiddenClass}"><div class="evidence-row">${label}${affordance}</div><div class="evidence-meta"><span class="evidence-kind">[${escapeHtml(item.kind)}]</span>${target}</div></li>`;
}

export function renderEvidenceListItems(evidenceCatalog: SummaryEvidenceItem[]): string {
  return evidenceCatalog
    .map((item, index) => renderEvidenceListItem(item, index >= 5 ? 'extra-evidence' : ''))
    .join('');
}

export function renderGroupedEvidenceListItems(groups: EvidenceRelevanceGroup[]): string {
  let evidenceIndex = 0;
  return groups
    .map((group) => {
      let visibleRowCount = 0;
      const rows = group.items
        .map((item) => {
          const isHidden = evidenceIndex >= 5;
          const hiddenClass = isHidden ? 'extra-evidence' : '';
          if (!isHidden) {
            visibleRowCount += 1;
          }
          evidenceIndex += 1;
          return renderEvidenceListItem(item, hiddenClass);
        })
        .join('');
      if (!rows) {
        return '';
      }
      const hiddenGroupClass = visibleRowCount === 0 ? ' extra-evidence-group' : '';
      return `<li class="evidence-group${hiddenGroupClass}" data-evidence-group="${escapeHtml(group.key)}"><h4 class="section-heading-inline evidence-group-heading">${escapeHtml(group.label)}</h4><ul class="evidence-sublist">${rows}</ul></li>`;
    })
    .filter(Boolean)
    .join('');
}

interface GroupedActionSection {
  label: string;
  buttonsTrustedHtml: TrustedHtml[];
}

export interface GroupedActionSectionsInput {
  groups: GroupedActionSection[];
  headingTag: 'h4' | 'h5';
  sectionClassName: string;
  buttonContainerClassName: string;
}

export function renderGroupedActionSections(input: GroupedActionSectionsInput): string {
  return input.groups
    .map(
      (group) =>
        `<section class="${escapeHtml(input.sectionClassName)}"><${input.headingTag}>${escapeHtml(
          group.label,
        )}</${input.headingTag}><div class="${escapeHtml(input.buttonContainerClassName)}">${group.buttonsTrustedHtml.join('')}</div></section>`,
    )
    .join('');
}

export interface TimelineGroupsHtmlInput {
  timelineGroups: TimelineGroup[];
}

export function renderTimelineGroupsHtml(input: TimelineGroupsHtmlInput): string {
  return input.timelineGroups
    .map((group) => {
      const items = group.rows
        .map((row) => {
          const labelControl = row.clickable
            ? `<button type="button" class="text-link-button timeline-link-button" data-action="openEvidence" data-evidence-id="${escapeHtml(row.evidenceId)}" aria-label="${escapeHtml(row.label)} - ${escapeHtml(TIMELINE_OPEN_HINT_TEXT)}" title="${escapeHtml(TIMELINE_OPEN_HINT_TEXT)}">${escapeHtml(row.label)}</button>`
            : `<span class="timeline-label" aria-label="${escapeHtml(row.label)} - ${escapeHtml(TIMELINE_STATIC_HINT_TEXT)}">${escapeHtml(row.label)}</span>`;
          const affordanceClass = row.clickable
            ? 'evidence-affordance evidence-affordance-clickable'
            : 'evidence-affordance evidence-affordance-static';
          const heading = `<div class="timeline-row-heading">${labelControl}<span class="${affordanceClass}" data-timeline-affordance="${
            row.clickable ? 'open' : 'static'
          }" aria-hidden="true">${escapeHtml(row.interactionHint)}</span></div>`;
          const detail = row.detail
            ? `<span class="timeline-detail">${escapeHtml(row.detail)}</span>`
            : '';
          return `<li><span class="timeline-time">${escapeHtml(
            row.relativeTime,
          )}</span><div class="timeline-row">${heading}${detail}</div></li>`;
        })
        .join('');
      return `<section class="timeline-group"><h4>${escapeHtml(group.label)}</h4><ul>${items}</ul></section>`;
    })
    .join('');
}

export interface ResumePathCardInput {
  completed: boolean;
  collapsed: boolean;
  readOnly?: boolean;
  steps: Array<{
    id: string;
    label: string;
    detail: string;
    checked: boolean;
  }>;
}

export function renderResumePathCard(input: ResumePathCardInput): string {
  const readOnly = Boolean(input.readOnly);
  const disabledAttr = readOnly ? 'disabled aria-disabled="true"' : '';
  const readOnlyHint = readOnly
    ? '<p class="muted">Sample mode is read-only. Resume Path toggles are disabled.</p>'
    : '';
  const readOnlyAttr = readOnly
    ? ' data-resume-path-readonly="true"'
    : ' data-resume-path-readonly="false"';
  const completedStepCount = input.steps.filter((s) => s.checked).length;
  const totalStepCount = input.steps.length;
  const resumePathItems = input.steps
    .map(
      (step) => `<li class="resume-path-item${step.checked ? ' resume-path-item-done' : ''}">
        <label class="resume-path-toggle">
          <input type="checkbox" data-resume-path-toggle="true" data-resume-path-step-id="${escapeHtml(step.id)}" ${
            step.checked ? 'checked' : ''
          } ${disabledAttr} />
          <span>${escapeHtml(step.label)}</span>
        </label>
        <p class="muted resume-path-detail">${escapeHtml(step.detail)}</p>
      </li>`,
    )
    .join('');
  const progressLabel = input.completed
    ? 'All steps complete ✓'
    : `${completedStepCount} of ${totalStepCount} steps done`;
  return `<div class="card" data-resume-path-card="true"${readOnlyAttr}>
      <h3>Resume Path <span class="${input.completed ? 'badge badge-done' : 'badge'}">${escapeHtml(progressLabel)}</span></h3>
      <details data-resume-path-details="true" ${input.completed && input.collapsed ? '' : 'open'}>
        <summary class="panel-disclosure-summary"><span class="section-heading-inline">${
          input.completed ? 'Re-entry complete — review steps' : 'Re-enter the task'
        }</span></summary>
        ${readOnlyHint}
        <ul class="compact-list resume-path-list">${resumePathItems}</ul>
      </details>
    </div>`;
}

export interface CompanionNudgeCardInput {
  primaryNudge?: CompanionNudge;
  secondaryNudge?: CompanionNudge;
  nudgeSuppressionLabel: string;
  nudgeExplainabilityTrustedHtml: TrustedHtml;
  actionLabelForId: (actionId: string) => string;
}

export function renderCompanionNudgeCard(input: CompanionNudgeCardInput): string {
  const hasContent =
    Boolean(input.primaryNudge) ||
    Boolean(input.nudgeSuppressionLabel) ||
    Boolean(input.nudgeExplainabilityTrustedHtml);
  if (!hasContent) {
    return '';
  }

  return `<div class="card">
      <h3>Suggestion</h3>
      ${
        input.primaryNudge
          ? `<p class="companion-primary">${escapeHtml(input.primaryNudge.title)}</p>
      <p class="muted">${escapeHtml(input.primaryNudge.detail)}</p>
      <div class="status-actions">
        <button type="button" data-action="${escapeHtml(input.primaryNudge.action)}">${escapeHtml(
          input.actionLabelForId(input.primaryNudge.action),
        )}</button>
      ${
        input.secondaryNudge
          ? `<button type="button" class="secondary" data-action="${escapeHtml(
              input.secondaryNudge.action,
            )}">${escapeHtml(input.actionLabelForId(input.secondaryNudge.action))}</button>`
          : ''
      }
        <button type="button" class="secondary" data-action="acknowledgeNudge">Got it</button>
        <button type="button" class="secondary" data-action="dismissNudge">Not now</button>
      </div>`
          : ''
      }
      ${
        !input.primaryNudge && input.nudgeSuppressionLabel
          ? `<p class="muted">${escapeHtml(input.nudgeSuppressionLabel)}</p>`
          : ''
      }
      ${input.nudgeExplainabilityTrustedHtml}
    </div>`;
}

export interface WebviewDocumentInput {
  cspMetaTag: TrustedHtml;
  nonce: string;
  panelStyle: string;
  bodyCardsTrustedHtml: TrustedHtml;
  clientScript: string;
}

export function renderWebviewDocument(input: WebviewDocumentInput): string {
  const escapedNonce = escapeHtml(input.nonce);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TaCoS Resume Brief</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    ${input.cspMetaTag}
    <style nonce="${escapedNonce}">${input.panelStyle}</style>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>
    <div id="panel-status-live" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    <main id="main" tabindex="-1">
      ${input.bodyCardsTrustedHtml}
    </main>

    <script nonce="${escapedNonce}">
${input.clientScript}
    </script>
  </body>
</html>`;
}
