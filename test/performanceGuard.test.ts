import {
  createPerformanceCounter,
  recordPerformanceSample,
  summarizePerformanceCounter,
} from '../src/performanceGuard';

describe('recordPerformanceSample', () => {
  it('tracks averages, max, and slow samples', () => {
    const counter = createPerformanceCounter();

    const first = recordPerformanceSample(
      counter,
      12,
      { slowThresholdMs: 25, warnCooldownMs: 60_000 },
      1_000,
    );
    const second = recordPerformanceSample(
      counter,
      60,
      { slowThresholdMs: 25, warnCooldownMs: 60_000 },
      2_000,
    );

    expect(first.isSlow).toBe(false);
    expect(first.shouldWarn).toBe(false);
    expect(second.isSlow).toBe(true);
    expect(second.shouldWarn).toBe(true);
    expect(counter.samples).toBe(2);
    expect(counter.slowSamples).toBe(1);
    expect(counter.maxDurationMs).toBe(60);
    expect(counter.totalDurationMs).toBe(72);
  });

  it('throttles slow warnings by cooldown window', () => {
    const counter = createPerformanceCounter();
    const budget = { slowThresholdMs: 20, warnCooldownMs: 5_000 };

    const first = recordPerformanceSample(counter, 30, budget, 10_000);
    const second = recordPerformanceSample(counter, 35, budget, 12_000);
    const third = recordPerformanceSample(counter, 40, budget, 16_500);

    expect(first.shouldWarn).toBe(true);
    expect(second.shouldWarn).toBe(false);
    expect(third.shouldWarn).toBe(true);
  });

  it('normalizes invalid durations to zero', () => {
    const counter = createPerformanceCounter();
    const budget = { slowThresholdMs: 10, warnCooldownMs: 1_000 };

    const nanSample = recordPerformanceSample(counter, Number.NaN, budget, 100);
    const negativeSample = recordPerformanceSample(counter, -5, budget, 200);

    expect(nanSample.durationMs).toBe(0);
    expect(negativeSample.durationMs).toBe(0);
    expect(counter.maxDurationMs).toBe(0);
    expect(counter.slowSamples).toBe(0);
  });
});

describe('summarizePerformanceCounter', () => {
  it('returns undefined summary fields when no samples are recorded', () => {
    const summary = summarizePerformanceCounter(createPerformanceCounter());

    expect(summary).toEqual({
      samples: 0,
      slowSamples: 0,
      slowRate: undefined,
      averageDurationMs: undefined,
      maxDurationMs: undefined,
      lastDurationMs: undefined,
    });
  });

  it('returns aggregate summary for populated counters', () => {
    const counter = createPerformanceCounter();
    recordPerformanceSample(counter, 25, { slowThresholdMs: 30, warnCooldownMs: 1_000 }, 1_000);
    recordPerformanceSample(counter, 45, { slowThresholdMs: 30, warnCooldownMs: 1_000 }, 2_000);

    const summary = summarizePerformanceCounter(counter);
    expect(summary.samples).toBe(2);
    expect(summary.slowSamples).toBe(1);
    expect(summary.slowRate).toBe(0.5);
    expect(summary.averageDurationMs).toBe(35);
    expect(summary.maxDurationMs).toBe(45);
    expect(summary.lastDurationMs).toBe(45);
  });
});
