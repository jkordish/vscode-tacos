export type TriggerReason = 'focus' | 'manual' | 'cached';
export type SummaryProvider = 'local' | 'vscode-lm' | 'openai';
export type CompanionNudgeAggressiveness = 'low' | 'balanced' | 'high';
export type UiSurface = 'statusbar' | 'notification' | 'silent';

export interface ExtensionConfig {
  enabled: boolean;
  showOnFocus: boolean;
  pauseSummaries: boolean;
  showTimeline: boolean;
  promptCheckpointOnBlur: boolean;
  minIdleMinutes: number;
  cooldownMinutes: number;
  includeDiff: boolean;
  maxDiffChars: number;
  includeTerminalHistory: boolean;
  includeDebugHistory: boolean;
  cacheIfContextUnchanged: boolean;
  redactionPatterns: string[];
  metricsEnabled: boolean;
  uiSurface: UiSurface;
  autoRefreshInBackground: boolean;
  companionNudgesEnabled: boolean;
  companionNudgeAggressiveness: CompanionNudgeAggressiveness;
  companionNudgeQuietHours: string;
  companionNudgeCooldownMinutes: number;
  summaryProvider: SummaryProvider;
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

export type SummaryEvidenceKind =
  | 'file'
  | 'url'
  | 'commit'
  | 'branch'
  | 'git'
  | 'terminal'
  | 'task'
  | 'debug';

export interface SummaryEvidenceItem {
  id: string;
  kind: SummaryEvidenceKind;
  label: string;
  capturedAt?: number;
  target?: string;
  meta?: Record<string, string | number | boolean>;
}

export type ResumeMode = 'coding' | 'debugging';

export interface ResumeSummary {
  intent: string;
  nextSteps: string[];
  nextStepEvidenceIds?: string[][];
  doneSinceLastResume?: string[];
  pendingBlocked?: string[];
  recommendedFirstAction?: string;
  mode?: ResumeMode;
  currentBranch?: string;
  previousBranch?: string;
  lastFailingCommand?: string;
  recentFilesSnapshot?: string[];
  topFiles: string[];
  links: SummaryLink[];
  evidenceCatalog?: SummaryEvidenceItem[];
  userCorrections?: string[];
  correctionsFingerprint?: string;
  detailsMarkdown: string;
  codexPrompt: string;
  contextHash: string;
  localGeneratedAt?: number;
  generatedAt: number;
  source: SummaryProvider;
}

export interface MetricRecord {
  startedAt: number;
  workspaceRoot: string;
  trigger: TriggerReason;
  firstMeaningfulEditLagMs?: number;
  firstRunLagMs?: number;
  companionFirstActionLagMs?: number;
  companionPromptImpressions?: number;
  companionForcedOpenDetailsClicks?: number;
  companionQuickActionsTaken?: number;
  companionNudgeImpressions?: number;
}

export interface VscodeLmModelSelector {
  vendor: string;
  id?: string;
  family?: string;
  name?: string;
}
