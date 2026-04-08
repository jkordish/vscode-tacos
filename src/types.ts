export type TriggerReason = 'focus' | 'manual' | 'cached';
export type SummaryProvider = 'local' | 'vscode-lm' | 'openai';
export type CompanionNudgeAggressiveness = 'low' | 'balanced' | 'high';
export type UiSurface = 'statusbar' | 'notification' | 'silent';
export type PrivacyPreset = 'minimal' | 'balanced' | 'max-context';
export type RetentionPolicy = '1d' | '7d' | '30d' | 'forever';
export type EvidenceGranularity = 'coarse' | 'medium' | 'fine';

export interface ExtensionConfig {
  enabled: boolean;
  showOnFocus: boolean;
  pauseSummaries: boolean;
  resumeSafetyEnabled: boolean;
  resumeSafetyIdleMinutes: number;
  resumeSafetyStrict: boolean;
  taskCheckpointEnabled: boolean;
  taskCheckpointPromptOnLikelySwitch: boolean;
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
  percolationPolicyEnabled: boolean;
  percolationExplainabilityEnabled: boolean;
  percolationNotificationBrokerEnabled: boolean;
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
  evidenceGranularity: EvidenceGranularity;
}

export interface GitSnapshot {
  isRepo: boolean;
  branch: string;
  status: string;
  diffStat: string;
  diff: string;
  log: string;
  headCommit?: string;
  /** Most recent HEAD commit committer timestamp in epoch milliseconds. */
  headCommitAt?: number;
  upstreamAhead?: number;
  upstreamBehind?: number;
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
  recentCommitHash?: string;
  /** Most recent commit committer timestamp in epoch milliseconds. */
  recentCommitAt?: number;
  divergenceAhead?: number;
  divergenceBehind?: number;
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

export type SummaryNoveltyBucket = 'low' | 'medium' | 'high';

export interface SummaryNoveltyProfile {
  score: number;
  bucket: SummaryNoveltyBucket;
  changedFilesCount: number;
  runCount: number;
  blockerCount: number;
  keyFileCount: number;
  linkCount: number;
  gitContextCount: number;
}

export interface ResumeSummary {
  intent: string;
  inferredIntent?: string;
  intentOverridden?: boolean;
  whatYouWereDoing?: string[];
  whatChangedSince?: string[];
  nextLikelySafeMove?: string;
  openQuestions?: string[];
  timelineCues?: string[];
  structuredTaskStateUsed?: boolean;
  structuredTaskStateFreshness?: 'fresh' | 'stale' | 'none';
  structuredTaskSwitchClass?: 'stable' | 'repeated-switch' | 'none';
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
  resumePathCompletedStepIds?: ('confirmIntent' | 'runNextSafeAction' | 'clearBlocker')[];
  resumePathCollapsed?: boolean;
  candidateIntents?: string[];
  mode?: ResumeMode;
  currentBranch?: string;
  previousBranch?: string;
  lastFailingCommand?: string;
  recentFilesSnapshot?: string[];
  topFiles: string[];
  noveltyProfile?: SummaryNoveltyProfile;
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
  percolationDecisionCount?: number;
  surfaceSelectionNone?: number;
  surfaceSelectionStatusbar?: number;
  surfaceSelectionPanel?: number;
  surfaceSelectionPanelSilent?: number;
  surfaceSelectionPanelEmphasis?: number;
  surfaceSelectionNotification?: number;
  percolationConfidenceBandLow?: number;
  percolationConfidenceBandMedium?: number;
  percolationConfidenceBandHigh?: number;
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
  resumeSafetyShown?: number;
  resumeSafetyDismissed?: number;
  resumeSafetyActionClicks?: number;
  resumeSafetyMismatchDetected?: number;
  resumeSafetyStrictWarnings?: number;
  resumeSafetyFirstActionLagMs?: number;
  companionPrimaryCtaImpressions?: number;
  companionPrimaryCtaSourceClass?: string;
  companionPrimaryCtaClicks?: number;
  companionPrimaryCtaCompletions?: number;
  blockerPromotionTaskFailure?: number;
  blockerPromotionCommandFailure?: number;
  blockerPromotionDiagnostics?: number;
  blockerPromotionBranchContext?: number;
  blockerPromotionLowConfidence?: number;
  blockerPromotionRestricted?: number;
  blockerPromotionNoNextSteps?: number;
  priorPromotionCheckpoint?: number;
  priorPromotionCorrections?: number;
  priorPromotionScratchpad?: number;
  trustTrayOpens?: number;
  restrictedTrustTrayOpens?: number;
  whySurfacedOpens?: number;
  aiPayloadPreviewOpensTrustCenter?: number;
  aiPayloadPreviewOpensWhySurfaced?: number;
  aiPayloadPreviewOpensCompanionHome?: number;
  aiPayloadPreviewOpensProvenanceBadge?: number;
  percolationSuppressedQuietHours?: number;
  percolationSuppressedCooldown?: number;
  percolationSuppressedNoChange?: number;
  percolationSuppressedNoiseBudget?: number;
  percolationSuppressedLowConfidence?: number;
  noveltyScoreBucketLow?: number;
  noveltyScoreBucketMedium?: number;
  noveltyScoreBucketHigh?: number;
  percolationDismissActions?: number;
  percolationSnoozeActions?: number;
  lowConfidenceClarificationRate?: number;
  helpfulnessRating?: 1 | 2 | 3 | 4 | 5;
  pauseActions?: number;
  snoozeActions?: number;
  summaryQuietActions?: number;
  disableActions?: number;
  noteCreated?: number;
  noteMarkedDone?: number;
  notePinned?: number;
  checkpointOffered?: number;
  checkpointCompleted?: number;
  checkpointSkipped?: number;
  checkpointDismissed?: number;
  checkpointEditedLater?: number;
  checkpointFieldCompleteness?: number;
  structuredTaskStateCreated?: number;
  structuredTaskStateResolved?: number;
  structuredTaskStateStale?: number;
  taskSwitchDetected?: number;
  taskSwitchConfirmed?: number;
  taskSwitchCorrected?: number;
  resumeBriefUsesCheckpointState?: number;
  resumeBriefShowsTimelineCue?: number;
  dailyDebriefOpened?: number;
  abandonedThreadSurfaced?: number;
  unresolvedBlockerSurfaced?: number;
  resumePathCompletions?: number;
  resumeWithNote?: 0 | 1;
  resumeWithStructuredTaskState?: 0 | 1;
  taskSwitchSessionClass?: 'stable' | 'repeated-switch' | 'none';
  resumeTaskStateFreshness?: 'fresh' | 'stale' | 'none';
  scratchpadOpened?: number;
  scratchpadAppended?: number;
  redactionEventsTotal?: number;
  redactionHighRiskDetectedTotal?: number;
  aiSendBlockedBySanitizerTotal?: number;
  aiSendAllowedAfterReviewTotal?: number;
  /**
   * Number of times `prospectiveNextVerification` was explicitly captured in a
   * structured checkpoint during this session (non-empty value saved).
   */
  prospectiveIntentCaptureCount?: number;
  /**
   * Number of times an auto-triggered checkpoint prompt was suppressed because
   * the user was in a high-load activity window (recent edit activity).
   */
  checkpointPromptSuppressedHighLoad?: number;
  /**
   * Session friction summary was opened by the user.
   */
  sessionFrictionSummaryOpened?: number;
  /**
   * Number of times the user clicked "Undo" on a note-dismiss or task-resolve
   * toast to recover the item within the 30 s undo window.
   */
  noteDeleteUndoCount?: number;
}

export interface VscodeLmModelSelector {
  vendor: string;
  id?: string;
  family?: string;
  name?: string;
}
