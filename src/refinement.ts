export function isRefinementActiveForSummary(
  activeRefinementContextHash: string | undefined,
  summaryContextHash: string,
): boolean {
  const active = activeRefinementContextHash?.trim() ?? '';
  const summary = summaryContextHash.trim();
  if (!active || !summary) {
    return false;
  }

  return active === summary;
}
