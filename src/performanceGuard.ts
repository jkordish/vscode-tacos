export interface PerformanceCounter {
  samples: number;
  slowSamples: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastDurationMs?: number;
  lastSlowAt?: number;
  lastWarnedAt?: number;
}

export interface PerformanceBudget {
  slowThresholdMs: number;
  warnCooldownMs: number;
}

export interface PerformanceSampleResult {
  durationMs: number;
  isSlow: boolean;
  shouldWarn: boolean;
  averageDurationMs: number;
}

export interface PerformanceCounterSummary {
  samples: number;
  slowSamples: number;
  slowRate?: number;
  averageDurationMs?: number;
  maxDurationMs?: number;
  lastDurationMs?: number;
}

export function createPerformanceCounter(): PerformanceCounter {
  return {
    samples: 0,
    slowSamples: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastDurationMs: undefined,
    lastSlowAt: undefined,
    lastWarnedAt: undefined,
  };
}

function toFiniteDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }

  return durationMs;
}

export function recordPerformanceSample(
  counter: PerformanceCounter,
  durationMs: number,
  budget: PerformanceBudget,
  now = Date.now(),
): PerformanceSampleResult {
  const normalizedDuration = toFiniteDuration(durationMs);
  counter.samples += 1;
  counter.totalDurationMs += normalizedDuration;
  counter.maxDurationMs = Math.max(counter.maxDurationMs, normalizedDuration);
  counter.lastDurationMs = normalizedDuration;

  const isSlow = normalizedDuration >= budget.slowThresholdMs;
  if (isSlow) {
    counter.slowSamples += 1;
    counter.lastSlowAt = now;
  }

  const canWarn =
    isSlow &&
    (counter.lastWarnedAt === undefined || now - counter.lastWarnedAt >= budget.warnCooldownMs);
  if (canWarn) {
    counter.lastWarnedAt = now;
  }

  return {
    durationMs: normalizedDuration,
    isSlow,
    shouldWarn: canWarn,
    averageDurationMs: counter.samples > 0 ? counter.totalDurationMs / counter.samples : 0,
  };
}

export function summarizePerformanceCounter(
  counter: PerformanceCounter,
): PerformanceCounterSummary {
  if (counter.samples <= 0) {
    return {
      samples: 0,
      slowSamples: 0,
      slowRate: undefined,
      averageDurationMs: undefined,
      maxDurationMs: undefined,
      lastDurationMs: undefined,
    };
  }

  return {
    samples: counter.samples,
    slowSamples: counter.slowSamples,
    slowRate: counter.slowSamples / counter.samples,
    averageDurationMs: counter.totalDurationMs / counter.samples,
    maxDurationMs: counter.maxDurationMs,
    lastDurationMs: counter.lastDurationMs,
  };
}
