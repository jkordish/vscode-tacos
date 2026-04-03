import type { ResumeSummary, SummaryEvidenceItem } from './types';

export interface TrustCue {
  headline: string;
  details: string[];
}

function countEvidence(
  evidence: SummaryEvidenceItem[],
  kinds: SummaryEvidenceItem['kind'][],
): number {
  return evidence.filter((item) => kinds.includes(item.kind)).length;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function buildTrustCue(summary: ResumeSummary | undefined): TrustCue {
  if (!summary) {
    return {
      headline: 'Based on: no summary evidence yet.',
      details: [],
    };
  }

  const evidence = summary.evidenceCatalog ?? [];
  const fileCount = countEvidence(evidence, ['file']);
  const runCount = countEvidence(evidence, ['terminal', 'task', 'debug']);
  const urlCount = countEvidence(evidence, ['url']);
  const gitCount = countEvidence(evidence, ['git', 'commit', 'branch']);
  const branchEvidence = evidence.find((item) => item.kind === 'branch')?.label?.trim();
  const branch = summary.currentBranch?.trim() || branchEvidence || 'unknown';

  return {
    headline: `Based on: ${fileCount} files • ${runCount} runs • branch ${branch}`,
    details: [
      `${pluralize(fileCount, 'file')} evidence ${fileCount === 1 ? 'item' : 'items'}`,
      `${pluralize(runCount, 'run/debug')} evidence ${runCount === 1 ? 'item' : 'items'}`,
      `${pluralize(urlCount, 'URL')} evidence ${urlCount === 1 ? 'item' : 'items'}`,
      `${pluralize(gitCount, 'git/branch')} evidence ${gitCount === 1 ? 'item' : 'items'}`,
    ],
  };
}
