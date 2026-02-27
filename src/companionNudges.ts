import type { CompanionNudgeAggressiveness, ResumeSummary, SummaryProvider } from './types';
import { isInQuietHours, parseQuietHoursWindow } from './quietHours';

export interface CompanionNudge {
  id: 'fix-failing-command' | 'branch-switch' | 'resume-next-step' | 'refresh-guidance';
  title: string;
  detail: string;
  action: string;
  score: number;
}

export type CompanionNudgeSuppressedReason =
  | 'disabled'
  | 'inactive-mode'
  | 'cooldown'
  | 'quiet-hours'
  | 'no-candidate';

export interface CompanionNudgeDecision {
  primary?: CompanionNudge;
  secondary?: CompanionNudge;
  suppressedReason?: CompanionNudgeSuppressedReason;
  nextEligibleAt?: number;
}

interface SuppressionTextOptions {
  formatTimestamp?: (value: number) => string;
}

interface CompanionNudgeInput {
  summary: ResumeSummary;
  provider: SummaryProvider;
  mode: 'active' | 'paused' | 'restricted' | 'disabled';
  now: number;
  enabled: boolean;
  aggressiveness: CompanionNudgeAggressiveness;
  quietHours: string;
  cooldownMinutes: number;
  lastShownAt: number;
}

function minScoreForAggressiveness(value: CompanionNudgeAggressiveness): number {
  if (value === 'low') {
    return 80;
  }

  if (value === 'high') {
    return 40;
  }

  return 60;
}

function buildCandidates(summary: ResumeSummary): CompanionNudge[] {
  const candidates: CompanionNudge[] = [];
  if (summary.lastFailingCommand) {
    candidates.push({
      id: 'fix-failing-command',
      title: 'Fix the failing command first',
      detail: summary.lastFailingCommand,
      action: 'restoreCopyFailingCommand',
      score: 95,
    });
  }

  if (
    summary.currentBranch &&
    summary.previousBranch &&
    summary.currentBranch !== summary.previousBranch
  ) {
    candidates.push({
      id: 'branch-switch',
      title: 'You switched branches',
      detail: `Moved from ${summary.previousBranch} to ${summary.currentBranch}.`,
      action: 'restoreCheckoutPreviousBranch',
      score: 82,
    });
  }

  if (summary.nextSteps[0]) {
    candidates.push({
      id: 'resume-next-step',
      title: 'Resume the next planned step',
      detail: summary.nextSteps[0],
      action: 'copyNextSteps',
      score: 66,
    });
  }

  if (summary.nextSteps.length === 0) {
    candidates.push({
      id: 'refresh-guidance',
      title: 'Refresh task guidance',
      detail: 'No next steps were captured for this context.',
      action: 'refreshSummary',
      score: 58,
    });
  }

  return candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return a.id.localeCompare(b.id);
  });
}

export function chooseCompanionNudges(input: CompanionNudgeInput): CompanionNudgeDecision {
  if (!input.enabled) {
    return { suppressedReason: 'disabled' };
  }

  if (input.mode !== 'active') {
    return { suppressedReason: 'inactive-mode' };
  }

  if (isInQuietHours(input.now, input.quietHours)) {
    return { suppressedReason: 'quiet-hours' };
  }

  const cooldownMs = Math.max(1, input.cooldownMinutes) * 60_000;
  if (input.lastShownAt > 0 && input.now - input.lastShownAt < cooldownMs) {
    return {
      suppressedReason: 'cooldown',
      nextEligibleAt: input.lastShownAt + cooldownMs,
    };
  }

  const minScore = minScoreForAggressiveness(input.aggressiveness);
  const scored = buildCandidates(input.summary).filter((item) => item.score >= minScore);
  if (scored.length === 0) {
    return { suppressedReason: 'no-candidate' };
  }

  const [primary, secondary] = scored;
  return { primary, secondary };
}

export function describeCompanionNudgeReason(nudge: CompanionNudge): string {
  if (nudge.id === 'fix-failing-command') {
    return 'A recent failing command was detected for this context, so TaCoS prioritizes remediation.';
  }

  if (nudge.id === 'branch-switch') {
    return 'TaCoS detected a branch switch between your last and current context.';
  }

  if (nudge.id === 'resume-next-step') {
    return 'TaCoS found a saved next step and surfaced it as the fastest way to resume.';
  }

  if (nudge.id === 'refresh-guidance') {
    return 'No concrete next step was available, so TaCoS suggests regenerating guidance.';
  }

  return 'TaCoS selected this nudge from local context signals.';
}

export function describeCompanionNudgeSuppression(
  decision: CompanionNudgeDecision | undefined,
  options: SuppressionTextOptions = {},
): string {
  if (!decision?.suppressedReason) {
    return '';
  }

  if (decision.suppressedReason === 'disabled') {
    return 'Companion nudges are disabled in settings.';
  }

  if (decision.suppressedReason === 'inactive-mode') {
    return 'Nudges are hidden while companion mode is paused or restricted.';
  }

  if (decision.suppressedReason === 'quiet-hours') {
    return 'Nudges are currently in your configured quiet hours window.';
  }

  if (decision.suppressedReason === 'cooldown') {
    if (!decision.nextEligibleAt) {
      return 'Nudges are cooling down before the next reminder.';
    }

    const formatter = options.formatTimestamp ?? ((value: number) => new Date(value).toISOString());
    return `Nudges are cooling down until ${formatter(decision.nextEligibleAt)}.`;
  }

  if (decision.suppressedReason === 'no-candidate') {
    return 'No high-confidence nudge is available for this context yet.';
  }

  return '';
}

export const __test__ = {
  parseQuietHoursWindow,
  isInQuietHours,
};
