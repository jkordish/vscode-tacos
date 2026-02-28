export type TriggerReason = 'focus' | 'manual' | 'cached';
export type SummaryProvider = 'local' | 'vscode-lm' | 'openai';
export type CompanionNudgeAggressiveness = 'low' | 'balanced' | 'high';
export type UiSurface = 'statusbar' | 'notification' | 'silent';
export type PrivacyPreset = 'minimal' | 'balanced' | 'max-context';
export type RetentionPolicy = '1d' | '7d' | '30d' | 'forever';

export interface ExtensionConfig {
  enabled: boolean;
  showOnFocus: boolean;
  pauseSummaries: boolean;
  showTimeline: boolean;
  promptCheckpointOnBlur: boolean;
  minIdleMinutes: number;
  longGapMinutes: number;
  cooldownMinutes: number;
  summaryQuietHours: string;
  includeDiff: boolean;
  maxDiffChars: number;
  includeTerminalHistory: boolean;
  includeDebugHistory: boolean;
  cacheIfContextUnchanged: boolean;
  redactionPatterns: string[];
  privacyPreset: PrivacyPreset;
  retentionPolicy: RetentionPolicy;
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
  aiIncludeCheckpointNotes: boolean;
  aiIncludeScratchpad: boolean;
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
  lastEditPath?: string;
  lastEditLine?: number;
  lastEditCharacter?: number;
  failingCommand?: string;
  resumeGapMinutes?: number;
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
  lastActionLabel?: string;
  lastActionContext?: string;
  lastActionEvidenceId?: string;
  doneSinceLastResume?: string[];
  changesSinceLastResume?: string[];
  pendingBlocked?: string[];
  recommendedFirstAction?: string;
  lowConfidence?: boolean;
  longGap?: boolean;
  resumeGapMinutes?: number;
  candidateIntents?: string[];
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
  uiSurface?: UiSurface;
  interruptionEvent?: number;
  interruptionTimingClass?: 'boundary' | 'mid-activity' | 'unknown';
  firstMeaningfulEditLagMs?: number;
  firstRunLagMs?: number;
  firstActionLagMs?: number;
  companionFirstActionLagMs?: number;
  companionPromptImpressions?: number;
  companionForcedOpenDetailsClicks?: number;
  companionQuickActionsTaken?: number;
  companionNudgeImpressions?: number;
  companionPrimaryCtaImpressions?: number;
  companionPrimaryCtaClicks?: number;
  companionPrimaryCtaCompletions?: number;
  helpfulnessRating?: 1 | 2 | 3 | 4 | 5;
  pauseActions?: number;
  snoozeActions?: number;
  summaryQuietActions?: number;
  disableActions?: number;
  noteCreated?: number;
  noteMarkedDone?: number;
  notePinned?: number;
  resumePathCompletions?: number;
  resumeWithNote?: 0 | 1;
  scratchpadOpened?: number;
  scratchpadAppended?: number;
  redactionEventsTotal?: number;
  redactionHighRiskDetectedTotal?: number;
  aiSendBlockedBySanitizerTotal?: number;
  aiSendAllowedAfterReviewTotal?: number;
}

export interface VscodeLmModelSelector {
  vendor: string;
  id?: string;
  family?: string;
  name?: string;
}
