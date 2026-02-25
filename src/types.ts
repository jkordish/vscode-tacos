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
  openaiApiKey: string;
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

export interface ResumeSummary {
  intent: string;
  nextSteps: string[];
  topFiles: string[];
  links: SummaryLink[];
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
