import { createHash } from 'node:crypto';
import { normalizeHttpUrl, resolveFileTargetInWorkspace } from './pathSafety';
import type {
  ResumeMode,
  ResumeSignals,
  ResumeSummary,
  SummaryEvidenceItem,
  SummaryEvidenceKind,
  SummaryLink,
} from './types';

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
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
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
    lastEditPath: signals.lastEditPath,
    lastEditLine: signals.lastEditLine,
    lastEditCharacter: signals.lastEditCharacter,
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
    parts.push(
      'You were actively editing this workspace and can continue from your latest file changes.',
    );
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

function buildDoneSinceLastResume(signals: ResumeSignals): string[] {
  return dedupe(signals.doneItems, 3).slice(0, 3);
}

function buildPendingBlocked(signals: ResumeSignals, topFiles: string[]): string[] {
  const pending: string[] = [];

  if (signals.failingCommand) {
    pending.push(`Failing command still unresolved: ${signals.failingCommand}`);
  }

  if (signals.changedFiles.length > 0) {
    pending.push(
      `${signals.changedFiles.length} changed file${signals.changedFiles.length === 1 ? '' : 's'} pending review or commit.`,
    );
  }

  if (signals.recentDebug.length > 0 && !signals.failingCommand) {
    pending.push(`Recent debug context: ${signals.recentDebug[0]}.`);
  }

  if (pending.length === 0 && topFiles[0]) {
    pending.push(`Continue pending edits in ${topFiles[0]}.`);
  }

  return dedupe(pending, 3).slice(0, 3);
}

function buildChangesSinceLastResume(signals: ResumeSignals, topFiles: string[]): string[] {
  const changes: string[] = [];
  const diffStatLine = signals.gitDiffStat
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (diffStatLine) {
    changes.push(`Diffstat: ${diffStatLine}`);
  }

  const runs = dedupe(signals.recentTerminal, 2);
  if (runs.length > 0) {
    changes.push(`Runs: ${runs.join(' | ')}`);
  }

  if (signals.failingCommand) {
    changes.push(`Blocker: ${signals.failingCommand}`);
  }

  if (topFiles.length > 0) {
    changes.push(`Key files: ${topFiles.slice(0, 2).join(', ')}`);
  }

  const links = dedupe(signals.recentUrls, 2);
  if (links.length > 0) {
    changes.push(`Key links: ${links.join(', ')}`);
  }

  if (changes.length === 0) {
    changes.push('No recent changes captured.');
  }

  return changes.slice(0, 5);
}

function normalizeTerminalEntryForMode(rawEntry: string): string {
  const entry = rawEntry.trim();
  if (!entry) {
    return '';
  }

  // Persisted terminal entries may be stored as
  // `terminal:<safe_label>#<hash>`, where safe_label uses underscores.
  if (entry.startsWith('terminal:')) {
    const [, token = ''] = entry.split(':', 2);
    const [label] = token.split('#', 1);
    return label.replaceAll('_', ' ');
  }

  return entry;
}

function detectResumeMode(signals: ResumeSignals): ResumeMode {
  if (signals.failingCommand || signals.recentDebug.length > 0) {
    return 'debugging';
  }

  if (
    signals.recentTerminal.some((command) =>
      /\b(test|build|debug)\b/i.test(normalizeTerminalEntryForMode(command)),
    )
  ) {
    return 'debugging';
  }

  return 'coding';
}

function hashIdFragment(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function addEvidenceItem(catalog: SummaryEvidenceItem[], item: SummaryEvidenceItem): void {
  if (!item.id || catalog.some((existing) => existing.id === item.id)) {
    return;
  }

  catalog.push({
    ...item,
    capturedAt: item.capturedAt ?? Date.now() - catalog.length * 30_000,
  });
}

function buildEvidenceCatalog(signals: ResumeSignals, topFiles: string[]): SummaryEvidenceItem[] {
  const catalog: SummaryEvidenceItem[] = [];
  const now = Date.now();

  for (const [index, relative] of dedupe(
    [...topFiles, ...signals.changedFiles, ...signals.openFiles, ...signals.recentFiles],
    8,
  ).entries()) {
    const resolved = resolveFileTargetInWorkspace(relative, signals.workspaceRoot);
    if (!resolved) {
      continue;
    }

    addEvidenceItem(catalog, {
      id: `file:${relative}`,
      kind: 'file',
      label: relative,
      capturedAt: now - index * 45_000,
      target: resolved,
      meta: { relativePath: relative },
    });
  }

  for (const [index, rawUrl] of dedupe(signals.recentUrls, 5).entries()) {
    const safeUrl = normalizeHttpUrl(rawUrl);
    if (!safeUrl) {
      continue;
    }

    addEvidenceItem(catalog, {
      id: `url:${safeUrl}`,
      kind: 'url',
      label: rawUrl,
      capturedAt: now - index * 60_000,
      target: safeUrl,
    });
  }

  if (signals.branch.trim()) {
    addEvidenceItem(catalog, {
      id: `branch:${signals.branch.trim()}`,
      kind: 'branch',
      label: signals.branch.trim(),
      capturedAt: now,
    });
  }

  const firstStatusLine = signals.gitStatus
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (firstStatusLine) {
    addEvidenceItem(catalog, {
      id: `git:${hashIdFragment(firstStatusLine)}`,
      kind: 'git',
      label: 'git status snapshot',
      capturedAt: now,
      meta: { statusLine: firstStatusLine },
    });
  }

  const firstCommitLine = signals.gitLog.split(/\r?\n/).find((line) => line.trim());
  if (firstCommitLine) {
    addEvidenceItem(catalog, {
      id: `commit:${hashIdFragment(firstCommitLine)}`,
      kind: 'commit',
      label: firstCommitLine.trim(),
      capturedAt: now - 15_000,
      meta: { preview: true },
    });
  }

  if (signals.failingCommand) {
    addEvidenceItem(catalog, {
      id: `terminal:${hashIdFragment(signals.failingCommand)}`,
      kind: 'terminal',
      label: signals.failingCommand,
      capturedAt: now,
      meta: { failing: true },
    });
  }

  for (const [index, terminalEntry] of dedupe(signals.recentTerminal, 4).entries()) {
    addEvidenceItem(catalog, {
      id: `terminal:${hashIdFragment(terminalEntry)}`,
      kind: 'terminal',
      label: terminalEntry,
      capturedAt: now - index * 45_000,
    });
  }

  for (const [index, debugEntry] of dedupe(signals.recentDebug, 3).entries()) {
    addEvidenceItem(catalog, {
      id: `debug:${hashIdFragment(debugEntry)}`,
      kind: 'debug',
      label: debugEntry,
      capturedAt: now - index * 60_000,
    });
  }

  for (const [index, doneItem] of dedupe(signals.doneItems, 3).entries()) {
    addEvidenceItem(catalog, {
      id: `task:${hashIdFragment(doneItem)}`,
      kind: 'task',
      label: doneItem,
      capturedAt: now - index * 60_000,
    });
  }

  return catalog;
}

function buildLinksFromEvidence(evidenceCatalog: SummaryEvidenceItem[]): SummaryLink[] {
  const links: SummaryLink[] = [];
  for (const item of evidenceCatalog) {
    if (
      (item.kind !== 'file' && item.kind !== 'url') ||
      typeof item.target !== 'string' ||
      !item.target
    ) {
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

export function buildStepEvidenceIds(
  nextSteps: string[],
  evidenceCatalog: SummaryEvidenceItem[],
): string[][] {
  const evidenceIds = evidenceCatalog.map((item) => item.id);
  if (evidenceIds.length === 0) {
    return nextSteps.map(() => []);
  }

  const usedIds = new Set<string>();
  const defaultEvidenceId = evidenceCatalog[0].id;

  return nextSteps.map((stepText, index) => {
    const kindPreference = inferEvidenceKindPreference(stepText);
    const stepTokens = extractStepTokens(stepText);

    for (const kind of kindPreference) {
      const unusedMatch = pickBestEvidenceCandidate(
        evidenceCatalog.filter((item) => item.kind === kind && !usedIds.has(item.id)),
        stepTokens,
      );
      if (unusedMatch) {
        usedIds.add(unusedMatch.id);
        return [unusedMatch.id];
      }
    }

    for (const kind of kindPreference) {
      const fallbackMatch = pickBestEvidenceCandidate(
        evidenceCatalog.filter((item) => item.kind === kind),
        stepTokens,
      );
      if (fallbackMatch) {
        return [fallbackMatch.id];
      }
    }

    const positional = evidenceIds[Math.min(index, evidenceIds.length - 1)] ?? defaultEvidenceId;
    return positional ? [positional] : [];
  });
}

const STEP_TOKEN_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'after',
  'before',
  'then',
  'your',
  'next',
  'step',
  'safe',
  'action',
  'resume',
  'open',
  'run',
  'fix',
  'review',
  'continue',
]);

function extractStepTokens(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9/_\-.]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STEP_TOKEN_STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

function normalizeEvidenceText(item: SummaryEvidenceItem): string {
  const segments: string[] = [item.id, item.label];
  if (typeof item.target === 'string') {
    segments.push(item.target);
  }
  if (item.meta && typeof item.meta === 'object') {
    for (const value of Object.values(item.meta)) {
      if (typeof value === 'string') {
        segments.push(value);
      }
    }
  }
  return segments.join(' ').toLowerCase();
}

function scoreEvidenceCandidate(item: SummaryEvidenceItem, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }
  const haystack = normalizeEvidenceText(item);
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function pickBestEvidenceCandidate(
  candidates: SummaryEvidenceItem[],
  tokens: string[],
): SummaryEvidenceItem | undefined {
  let best: SummaryEvidenceItem | undefined;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreEvidenceCandidate(candidate, tokens);
    if (!best || score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function inferEvidenceKindPreference(stepText: string): SummaryEvidenceKind[] {
  const normalized = stepText.trim().toLowerCase();

  if (!normalized) {
    return ['file', 'url', 'terminal', 'task', 'debug', 'git', 'branch', 'commit'];
  }

  if (/\b(debug|breakpoint|launch|attach|inspect)\b/.test(normalized)) {
    return ['debug', 'terminal', 'task', 'file', 'url', 'git', 'branch', 'commit'];
  }

  if (
    /\b(re-?run|rerun|retry|failing|failed|blocker|test|build|command|validate|validation|verify)\b/.test(
      normalized,
    )
  ) {
    return ['terminal', 'task', 'debug', 'file', 'url', 'git', 'branch', 'commit'];
  }

  if (/\b(link|url|http|https|pr\b|pull request|issue|ticket|docs?)\b/.test(normalized)) {
    return ['url', 'file', 'terminal', 'task', 'debug', 'git', 'branch', 'commit'];
  }

  if (/\b(file|edit|code|module|open)\b/.test(normalized)) {
    return ['file', 'url', 'terminal', 'task', 'debug', 'git', 'branch', 'commit'];
  }

  return ['file', 'url', 'terminal', 'task', 'debug', 'git', 'branch', 'commit'];
}

function buildCandidateIntents(signals: ResumeSignals, topFiles: string[]): string[] {
  const candidates = dedupe(
    [
      topFiles[0] ? `Continue edits around ${topFiles[0]}.` : '',
      signals.branch ? `Continue work on branch ${signals.branch}.` : '',
      signals.recentDebug[0] ? `Resume debugging flow from ${signals.recentDebug[0]}.` : '',
      signals.recentTerminal[0] ? 'Resume validation by rerunning your latest command flow.' : '',
      'Open your latest file and capture a one-line checkpoint for intent.',
    ],
    2,
  );
  return candidates.slice(0, 2);
}

function isLowConfidenceSummary(signals: ResumeSignals, topFiles: string[]): boolean {
  const signalStrength =
    (topFiles.length > 0 ? 1 : 0) +
    (signals.changedFiles.length > 0 ? 1 : 0) +
    (signals.recentTerminal.length > 0 ? 1 : 0) +
    (signals.recentDebug.length > 0 ? 1 : 0) +
    (signals.doneItems.length > 0 ? 1 : 0) +
    (signals.failingCommand ? 1 : 0);
  return signalStrength < 2;
}

function buildLowConfidenceNextSteps(topFiles: string[]): string[] {
  const focusTarget = topFiles[0]
    ? `Open ${topFiles[0]} and confirm the intended change path.`
    : 'Open your latest edited file and identify the next safe change.';
  return [
    'Unclear intent (low evidence). Add a one-line checkpoint note before proceeding.',
    focusTarget,
    'Run one focused test/build step to rebuild context and confidence.',
  ];
}

interface LastActionCue {
  label: string;
  context: string;
  evidenceId?: string;
}

function findFileEvidenceId(
  evidenceCatalog: SummaryEvidenceItem[],
  relativePath: string,
): string | undefined {
  if (!relativePath.trim()) {
    return undefined;
  }

  const directId = `file:${relativePath}`;
  if (evidenceCatalog.some((item) => item.id === directId)) {
    return directId;
  }

  const looseMatch = evidenceCatalog.find(
    (item) =>
      item.kind === 'file' &&
      ((typeof item.meta?.relativePath === 'string' && item.meta.relativePath === relativePath) ||
        item.label === relativePath),
  );
  return looseMatch?.id;
}

function buildLastActionCue(
  signals: ResumeSignals,
  topFiles: string[],
  evidenceCatalog: SummaryEvidenceItem[],
): LastActionCue {
  const lastEditPath = signals.lastEditPath?.trim() ?? '';
  const lastEditLine =
    typeof signals.lastEditLine === 'number' && Number.isInteger(signals.lastEditLine)
      ? signals.lastEditLine
      : undefined;
  if (lastEditPath) {
    const lineLabel =
      typeof lastEditLine === 'number' && lastEditLine >= 0 ? `:${lastEditLine + 1}` : '';
    return {
      label: `Edited ${lastEditPath}${lineLabel}`,
      context: 'retrieval cue: last edit',
      evidenceId: findFileEvidenceId(evidenceCatalog, lastEditPath),
    };
  }

  const failingCommand = signals.failingCommand?.trim();
  if (failingCommand) {
    return {
      label: `Ran failing command: ${failingCommand}`,
      context: 'retrieval cue: terminal',
    };
  }

  const latestDebug = signals.recentDebug[0]?.trim();
  if (latestDebug) {
    return {
      label: `Ran debug session: ${latestDebug}`,
      context: 'retrieval cue: debug',
    };
  }

  const latestTask = signals.doneItems[0]?.trim();
  if (latestTask) {
    return {
      label: `Completed task: ${latestTask}`,
      context: 'retrieval cue: task',
    };
  }

  const latestFile =
    signals.openFiles[0]?.trim() || signals.recentFiles[0]?.trim() || topFiles[0]?.trim();
  if (latestFile) {
    return {
      label: `Opened ${latestFile}`,
      context: 'retrieval cue: file',
      evidenceId: findFileEvidenceId(evidenceCatalog, latestFile),
    };
  }

  return {
    label: 'No last action captured yet.',
    context: 'retrieval cue unavailable',
  };
}

export function buildResumeSummary(signals: ResumeSignals): ResumeSummary {
  const topFiles = dedupe(
    [...signals.changedFiles, ...signals.openFiles, ...signals.recentFiles],
    3,
  );
  const recentFilesSnapshot = dedupe([...signals.openFiles, ...signals.recentFiles], 10);
  const lowConfidence = isLowConfidenceSummary(signals, topFiles);
  const candidateIntents = buildCandidateIntents(signals, topFiles);
  const nextSteps = lowConfidence
    ? buildLowConfidenceNextSteps(topFiles)
    : buildNextSteps(signals, topFiles).slice(0, 3);
  const doneSinceLastResume = buildDoneSinceLastResume(signals);
  const changesSinceLastResume = buildChangesSinceLastResume(signals, topFiles);
  const pendingBlocked = buildPendingBlocked(signals, topFiles);
  const recommendedFirstAction = nextSteps[0] ?? pendingBlocked[0];
  const mode = detectResumeMode(signals);
  const evidenceCatalog = buildEvidenceCatalog(signals, topFiles);
  const lastAction = buildLastActionCue(signals, topFiles, evidenceCatalog);
  const links = buildLinksFromEvidence(evidenceCatalog);
  const nextStepEvidenceIds = buildStepEvidenceIds(nextSteps, evidenceCatalog);

  const evidenceLines = evidenceCatalog.length
    ? evidenceCatalog.map((item) => {
        // Keep local file paths out of the markdown payload that can be sent to AI providers.
        const target = item.kind === 'url' && item.target ? ` -> ${item.target}` : '';
        return `- [${item.kind}] ${item.id}: ${item.label}${target}`;
      })
    : ['- None captured'];

  const intent = lowConfidence ? 'Unclear intent (low evidence).' : buildIntent(signals, topFiles);
  const detailsSections = [
    '## Intent',
    `- ${intent}`,
    ...(lowConfidence
      ? [
          '',
          '## Confidence',
          '- Low confidence: evidence is sparse or ambiguous.',
          '- Candidate intents:',
          ...candidateIntents.map((candidate) => `  - ${candidate}`),
          '- Suggested action: add a one-line checkpoint note.',
        ]
      : []),
    '',
    '## Last action',
    `- ${lastAction.label}`,
    '',
    '## Next steps',
    ...nextSteps.map((step) => `- ${step}`),
    '',
    '## Session recap',
    '- Done since last resume:',
    ...(doneSinceLastResume.length > 0
      ? doneSinceLastResume.map((item) => `  - ${item}`)
      : ['  - None captured']),
    '- Changes since last resume:',
    ...changesSinceLastResume.map((item) => `  - ${item}`),
    '- Pending / blocked:',
    ...(pendingBlocked.length > 0
      ? pendingBlocked.map((item) => `  - ${item}`)
      : ['  - None captured']),
    `- Recommended first action: ${recommendedFirstAction ?? 'Refresh summary for guidance.'}`,
    '',
    '## Top files',
    ...(topFiles.length > 0 ? topFiles.map((file) => `- ${file}`) : ['- None captured']),
    '',
    '## Mode',
    `- ${mode}`,
    '',
    '## Top links',
    ...(signals.recentUrls.length > 0
      ? dedupe(signals.recentUrls, 3).map((url) => `- ${url}`)
      : ['- None captured']),
    '',
    '## Evidence catalog',
    ...evidenceLines,
    '',
    '---',
    `**Workspace:** ${signals.workspaceName}`,
    signals.branch ? `**Branch:** ${signals.branch}` : '',
    signals.gitLog ? `\n**Recent commits:**\n\n\`\`\`\n${signals.gitLog}\n\`\`\`` : '',
    signals.gitStatus
      ? `\n**git status --porcelain:**\n\n\`\`\`\n${signals.gitStatus}\n\`\`\``
      : '',
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
    lastActionLabel: lastAction.label,
    lastActionContext: lastAction.context,
    lastActionEvidenceId: lastAction.evidenceId,
    doneSinceLastResume,
    changesSinceLastResume,
    pendingBlocked,
    recommendedFirstAction,
    lowConfidence,
    candidateIntents,
    mode,
    currentBranch: signals.branch || undefined,
    lastFailingCommand: signals.failingCommand,
    recentFilesSnapshot,
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
