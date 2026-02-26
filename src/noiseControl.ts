export interface AutoTriggerDecisionInput {
  now: number;
  lastBlurAt: number;
  lastSummaryAt: number;
  minIdleMinutes: number;
  cooldownMinutes: number;
  projectSwitched: boolean;
  significantChange: boolean;
}

export function shouldAutoTriggerSummary(input: AutoTriggerDecisionInput): boolean {
  const idleMs = input.now - input.lastBlurAt;
  const idleThresholdMs = input.minIdleMinutes * 60_000;
  const satisfiesPrimaryGate = idleMs >= idleThresholdMs || input.projectSwitched || input.significantChange;
  if (!satisfiesPrimaryGate) {
    return false;
  }

  if (input.lastSummaryAt <= 0) {
    return true;
  }

  const cooldownMs = input.cooldownMinutes * 60_000;
  return input.now - input.lastSummaryAt >= cooldownMs;
}
