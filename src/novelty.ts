import type { SummaryNoveltyBucket } from './types';

export const SUMMARY_NOVELTY_MEDIUM_THRESHOLD = 0.34;
export const SUMMARY_NOVELTY_HIGH_THRESHOLD = 0.67;

export function isSummaryNoveltyBucket(value: unknown): value is SummaryNoveltyBucket {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function bucketForNoveltyScore(score: number): SummaryNoveltyBucket {
  if (score >= SUMMARY_NOVELTY_HIGH_THRESHOLD) {
    return 'high';
  }
  if (score >= SUMMARY_NOVELTY_MEDIUM_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}
