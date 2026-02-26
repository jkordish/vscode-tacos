export type TriggerReason = 'focus' | 'manual' | 'cached';

export interface ExtensionConfig {
  showOnFocus: boolean;
  pauseSummaries: boolean;
  idleMinutes: number;
  cooldownSeconds: number;
  includeDiff: boolean;
  maxDiffChars: number;
  includeTerminalHistory: boolean;
  includeDebugHistory: boolean;
  cacheIfContextUnchanged: boolean;
  redactionPatterns: string[];
  metricsEnabled: boolean;
  summaryProvider: 'local' | 'openai';
  openaiApiKeySetting: string;
  openaiModel: string;
  openaiBaseUrl: string;
  openaiTimeoutMs: number;
  codexOpenCommand: string;
}

export interface GitSnapshot {
  isRepo: boolean;
  branch: string;
  status: string;
  diffStat: string;
  diff: string;
  log: string;
  changedFiles: string[];
  hasUncommitted: boolean;
  hasConflicts: boolean;
}

export interface ResumeSignals {
  workspaceRoot: string;
  workspaceName: string;
  branch: string;
  gitStatus: string;
  gitDiffStat: string;
  gitDiff: string;
  gitLog: string;
  changedFiles: string[];
  openFiles: string[];
  recentFiles: string[];
  recentTerminal: string[];
  recentDebug: string[];
  recentUrls: string[];
  failingCommand?: string;
  doneItems: string[];
}

export interface SummaryLink {
  label: string;
  target: string;
  kind: 'file' | 'url';
}

export type SummaryEvidenceKind = 'file' | 'url' | 'commit' | 'branch' | 'terminal' | 'task' | 'debug';

export interface SummaryEvidenceItem {
  id: string;
  kind: SummaryEvidenceKind;
  label: string;
  target?: string;
  meta?: Record<string, string | number | boolean>;
}

export type ResumeMode = 'coding' | 'debugging';

export interface ResumeSummary {
  intent: string;
  nextSteps: string[];
  nextStepEvidenceIds?: string[][];
  mode?: ResumeMode;
  currentBranch?: string;
  previousBranch?: string;
  lastFailingCommand?: string;
  recentFilesSnapshot?: string[];
  topFiles: string[];
  links: SummaryLink[];
  evidenceCatalog?: SummaryEvidenceItem[];
  detailsMarkdown: string;
  codexPrompt: string;
  contextHash: string;
  generatedAt: number;
  source: 'local' | 'openai';
}

export interface MetricRecord {
  startedAt: number;
  workspaceRoot: string;
  trigger: TriggerReason;
  firstMeaningfulEditLagMs?: number;
  firstRunLagMs?: number;
}
