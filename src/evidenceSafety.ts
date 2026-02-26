import { normalizeHttpUrl, resolveFileTargetInWorkspace } from './pathSafety';
import type { ResumeSummary, SummaryEvidenceItem, SummaryLink } from './types';

function matchesEvidenceUrl(link: SummaryLink, evidence: SummaryEvidenceItem): boolean {
  if (link.kind !== 'url' || evidence.kind !== 'url') {
    return false;
  }

  const safeLink = normalizeHttpUrl(link.target);
  const safeEvidence = normalizeHttpUrl(evidence.target ?? '');
  if (!safeLink || !safeEvidence) {
    return false;
  }

  return safeLink === safeEvidence;
}

function matchesEvidenceFile(
  link: SummaryLink,
  evidence: SummaryEvidenceItem,
  workspaceRoot: string,
): boolean {
  if (link.kind !== 'file' || evidence.kind !== 'file') {
    return false;
  }

  const safeLink = resolveFileTargetInWorkspace(link.target, workspaceRoot);
  const safeEvidence = resolveFileTargetInWorkspace(evidence.target ?? '', workspaceRoot);
  if (!safeLink || !safeEvidence) {
    return false;
  }

  return safeLink === safeEvidence;
}

export function isSummaryLinkEvidenceGrounded(
  summary: ResumeSummary,
  link: SummaryLink,
  workspaceRoot?: string,
): boolean {
  const evidenceCatalog = summary.evidenceCatalog ?? [];
  if (evidenceCatalog.length === 0) {
    return false;
  }

  for (const evidence of evidenceCatalog) {
    if (matchesEvidenceUrl(link, evidence)) {
      return true;
    }

    if (workspaceRoot && matchesEvidenceFile(link, evidence, workspaceRoot)) {
      return true;
    }
  }

  return false;
}
