import { createHash } from 'node:crypto';
import { normalizeHttpUrl, resolveFileTargetInWorkspace } from './pathSafety';
import type { ResumeSignals, ResumeSummary, SummaryEvidenceItem, SummaryLink } from './types';

function dedupe(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashSignals(signals: ResumeSignals): string {
  const payload = {
    branch: signals.branch,
    changedFiles: signals.changedFiles,
    openFiles: signals.openFiles,
    recentFiles: signals.recentFiles,
    recentTerminal: signals.recentTerminal,
    recentDebug: signals.recentDebug,
    recentUrls: signals.recentUrls,
    failingCommand: signals.failingCommand,
    gitStatus: signals.gitStatus,
    gitDiffStat: signals.gitDiffStat,
    gitLog: signals.gitLog,
    gitDiff: signals.gitDiff,
    doneItems: signals.doneItems,
  };

  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function buildIntent(signals: ResumeSignals, topFiles: string[]): string {
  const parts: string[] = [];
  if (signals.branch) {
    parts.push(`You were working on branch ${signals.branch}.`);
  }

  if (topFiles.length > 0) {
    parts.push(`Most activity centered on ${topFiles.slice(0, 3).join(', ')}.`);
  }

  if (signals.failingCommand) {
    parts.push(`The last notable interruption was a failing command: ${signals.failingCommand}.`);
  } else if (signals.doneItems.length > 0) {
    parts.push(`You already completed ${signals.doneItems[0]}.`);
  } else if (signals.recentTerminal.length > 0) {
    parts.push(`Recent terminal work suggests you were mid-implementation and validation.`);
  }

  if (parts.length === 0) {
    parts.push('You were actively editing this workspace and can continue from your latest file changes.');
  }

  return parts.slice(0, 3).join(' ');
}

function buildNextSteps(signals: ResumeSignals, topFiles: string[]): string[] {
  const next: string[] = [];

  if (signals.failingCommand) {
    next.push(`Re-run and fix: ${signals.failingCommand}`);
  }

  if (signals.gitStatus.trim().length > 0) {
    next.push('Review uncommitted changes and resolve anything unexpected in `git status`.');
  } else {
    next.push('Sync branch state and confirm you are still on the intended task branch.');
  }

  if (topFiles.length > 0) {
    next.push(`Resume edits in ${topFiles[0]} and finish the pending change path.`);
  }

  if (next.length < 2) {
    next.push('Run a focused test/build command to validate your next incremental change.');
  }

  return dedupe(next, 3).slice(0, 3);
}

function hashIdFragment(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function addEvidenceItem(catalog: SummaryEvidenceItem[], item: SummaryEvidenceItem): void {
  if (!item.id || catalog.some((existing) => existing.id === item.id)) {
    return;
  }

  catalog.push(item);
}

function buildEvidenceCatalog(signals: ResumeSignals, topFiles: string[]): SummaryEvidenceItem[] {
  const catalog: SummaryEvidenceItem[] = [];

  for (const relative of dedupe([...topFiles, ...signals.changedFiles, ...signals.openFiles, ...signals.recentFiles], 8)) {
    const resolved = resolveFileTargetInWorkspace(relative, signals.workspaceRoot);
    if (!resolved) {
      continue;
    }

    addEvidenceItem(catalog, {
      id: `file:${relative}`,
      kind: 'file',
      label: relative,
      target: resolved,
      meta: { relativePath: relative },
    });
  }

  for (const rawUrl of dedupe(signals.recentUrls, 5)) {
    const safeUrl = normalizeHttpUrl(rawUrl);
    if (!safeUrl) {
      continue;
    }

    addEvidenceItem(catalog, {
      id: `url:${safeUrl}`,
      kind: 'url',
      label: rawUrl,
      target: safeUrl,
    });
  }

  if (signals.branch.trim()) {
    addEvidenceItem(catalog, {
      id: `branch:${signals.branch.trim()}`,
      kind: 'branch',
      label: signals.branch.trim(),
    });
  }

  const firstCommitLine = signals.gitLog.split(/\r?\n/).find((line) => line.trim());
  if (firstCommitLine) {
    addEvidenceItem(catalog, {
      id: `commit:${hashIdFragment(firstCommitLine)}`,
      kind: 'commit',
      label: firstCommitLine.trim(),
      meta: { preview: true },
    });
  }

  if (signals.failingCommand) {
    addEvidenceItem(catalog, {
      id: `terminal:${hashIdFragment(signals.failingCommand)}`,
      kind: 'terminal',
      label: signals.failingCommand,
      meta: { failing: true },
    });
  }

  for (const terminalEntry of dedupe(signals.recentTerminal, 4)) {
    addEvidenceItem(catalog, {
      id: `terminal:${hashIdFragment(terminalEntry)}`,
      kind: 'terminal',
      label: terminalEntry,
    });
  }

  for (const debugEntry of dedupe(signals.recentDebug, 3)) {
    addEvidenceItem(catalog, {
      id: `debug:${hashIdFragment(debugEntry)}`,
      kind: 'debug',
      label: debugEntry,
    });
  }

  for (const doneItem of dedupe(signals.doneItems, 3)) {
    addEvidenceItem(catalog, {
      id: `task:${hashIdFragment(doneItem)}`,
      kind: 'task',
      label: doneItem,
    });
  }

  return catalog;
}

function buildLinksFromEvidence(evidenceCatalog: SummaryEvidenceItem[]): SummaryLink[] {
  const links: SummaryLink[] = [];
  for (const item of evidenceCatalog) {
    if ((item.kind !== 'file' && item.kind !== 'url') || typeof item.target !== 'string' || !item.target) {
      continue;
    }

    links.push({
      label: item.label,
      target: item.target,
      kind: item.kind,
    });

    if (links.length >= 3) {
      break;
    }
  }

  return links;
}

function buildStepEvidenceIds(nextSteps: string[], evidenceCatalog: SummaryEvidenceItem[]): string[][] {
  const evidenceIds = evidenceCatalog.map((item) => item.id);
  if (evidenceIds.length === 0) {
    return nextSteps.map(() => []);
  }

  return nextSteps.map((_, index) => [evidenceIds[Math.min(index, evidenceIds.length - 1)]]);
}

export function buildResumeSummary(signals: ResumeSignals): ResumeSummary {
  const topFiles = dedupe([...signals.changedFiles, ...signals.openFiles, ...signals.recentFiles], 3);
  const nextSteps = buildNextSteps(signals, topFiles).slice(0, 3);
  const evidenceCatalog = buildEvidenceCatalog(signals, topFiles);
  const links = buildLinksFromEvidence(evidenceCatalog);
  const nextStepEvidenceIds = buildStepEvidenceIds(nextSteps, evidenceCatalog);

  const evidenceLines = evidenceCatalog.length
    ? evidenceCatalog.map((item) => {
        const target = item.target ? ` -> ${item.target}` : '';
        return `- [${item.kind}] ${item.id}: ${item.label}${target}`;
      })
    : ['- None captured'];

  const intent = buildIntent(signals, topFiles);
  const detailsSections = [
    '## Intent',
    `- ${intent}`,
    '',
    '## Next steps',
    ...nextSteps.map((step) => `- ${step}`),
    '',
    '## Top files',
    ...(topFiles.length > 0 ? topFiles.map((file) => `- ${file}`) : ['- None captured']),
    '',
    '## Top links',
    ...(signals.recentUrls.length > 0 ? dedupe(signals.recentUrls, 3).map((url) => `- ${url}`) : ['- None captured']),
    '',
    '## Evidence catalog',
    ...evidenceLines,
    '',
    '---',
    `**Workspace:** ${signals.workspaceName}`,
    signals.branch ? `**Branch:** ${signals.branch}` : '',
    signals.gitLog ? `\n**Recent commits:**\n\n\`\`\`\n${signals.gitLog}\n\`\`\`` : '',
    signals.gitStatus ? `\n**git status --porcelain:**\n\n\`\`\`\n${signals.gitStatus}\n\`\`\`` : '',
    signals.gitDiffStat ? `\n**git diff --stat:**\n\n\`\`\`\n${signals.gitDiffStat}\n\`\`\`` : '',
    signals.gitDiff ? `\n**git diff (truncated):**\n\n\`\`\`\n${signals.gitDiff}\n\`\`\`` : '',
    signals.recentTerminal.length > 0
      ? `\n**Recent terminal commands:**\n${signals.recentTerminal.map((cmd) => `- ${cmd}`).join('\n')}`
      : '',
    signals.recentDebug.length > 0
      ? `\n**Recent debug sessions:**\n${signals.recentDebug.map((entry) => `- ${entry}`).join('\n')}`
      : '',
  ].filter(Boolean);

  const detailsMarkdown = detailsSections.join('\n');

  const codexPrompt = [
    'You are a resume assistant for software development tasks.',
    'Summarize only from the evidence below. Do not speculate beyond provided facts.',
    '',
    'Return strictly in this structure:',
    '1) Intent: 2-3 concise sentences',
    '2) Next steps: 2-3 bullet points',
    '3) Top files/links: up to 3 items with one-line reason each',
    '',
    'Evidence:',
    '---',
    detailsMarkdown,
  ].join('\n');

  return {
    intent,
    nextSteps,
    nextStepEvidenceIds,
    topFiles,
    links,
    evidenceCatalog,
    detailsMarkdown,
    codexPrompt,
    contextHash: hashSignals(signals),
    generatedAt: Date.now(),
    source: 'local',
  };
}
