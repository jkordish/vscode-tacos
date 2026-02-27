import type { CompanionNudgeAggressiveness, ResumeSummary, SummaryProvider } from './types';

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

interface QuietHoursWindow {
  startMinute: number;
  endMinute: number;
}

function parseHourMinute(raw: string): number | undefined {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return undefined;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }
  return hour * 60 + minute;
}

function parseQuietHoursWindow(raw: string): QuietHoursWindow | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }

  const parts = value.split('-');
  if (parts.length !== 2) {
    return undefined;
  }

  const startMinute = parseHourMinute(parts[0]);
  const endMinute = parseHourMinute(parts[1]);
  if (startMinute === undefined || endMinute === undefined || startMinute === endMinute) {
    return undefined;
  }

  return { startMinute, endMinute };
}

function isInQuietHours(now: number, quietHours: string): boolean {
  const window = parseQuietHoursWindow(quietHours);
  if (!window) {
    return false;
  }

  const date = new Date(now);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  if (window.startMinute < window.endMinute) {
    return minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute;
  }

  return minuteOfDay >= window.startMinute || minuteOfDay < window.endMinute;
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

export const __test__ = {
  parseQuietHoursWindow,
  isInQuietHours,
};
