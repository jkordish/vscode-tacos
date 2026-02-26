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
  const satisfiesPrimaryGate =
    idleMs >= idleThresholdMs || input.projectSwitched || input.significantChange;
  if (!satisfiesPrimaryGate) {
    return false;
  }

  if (input.lastSummaryAt <= 0) {
    return true;
  }

  const cooldownMs = input.cooldownMinutes * 60_000;
  return input.now - input.lastSummaryAt >= cooldownMs;
}

export interface BlurCheckpointDecisionInput {
  now: number;
  lastSummaryAt: number;
  lastCheckpointPromptAt: number;
  minIdleMinutes: number;
  cooldownMinutes: number;
  promptCooldownMinutes: number;
  meaningfulChangeSinceLastPrompt: boolean;
}

export function shouldPromptCheckpointOnBlur(input: BlurCheckpointDecisionInput): boolean {
  if (!input.meaningfulChangeSinceLastPrompt) {
    return false;
  }

  if (input.lastCheckpointPromptAt > 0) {
    const promptCooldownMs = Math.max(1, input.promptCooldownMinutes) * 60_000;
    if (input.now - input.lastCheckpointPromptAt < promptCooldownMs) {
      return false;
    }
  }

  // Reuse the same trigger heuristic as auto summary, projecting forward to the next idle-focus window.
  const projectedNow = input.now + input.minIdleMinutes * 60_000;
  return shouldAutoTriggerSummary({
    now: projectedNow,
    lastBlurAt: input.now,
    lastSummaryAt: input.lastSummaryAt,
    minIdleMinutes: input.minIdleMinutes,
    cooldownMinutes: input.cooldownMinutes,
    projectSwitched: false,
    significantChange: true,
  });
}
