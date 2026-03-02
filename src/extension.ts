import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { buildAiPayloadPreviewMarkdown } from './aiPayloadPreview';
import { decidePrimaryBlocker, type BlockerDecision } from './blockerModel';
import {
  applyCompanionNudgeFeedback,
  chooseCompanionNudges,
  describeCompanionNudgeReason,
  describeCompanionNudgeSuppression,
  type CompanionNudgeFeedback,
  type CompanionNudgeFeedbackStatus,
  type CompanionNudgeDecision,
} from './companionNudges';
import {
  persistTerminalCommandForStorage,
  sanitizeActivityForPersistence,
  type PersistedActivityState,
} from './activityPersistence';
import {
  checkpointNotesStorageKey,
  checkpointStorageKey,
  createCheckpointNote,
  createLegacyMigrationNote,
  decodeCheckpointScopeFromStorageKey,
  parseCheckpointNotes,
  pruneCheckpointNotesForCutoff,
  sanitizeCheckpointNoteWithReport,
  sortCheckpointNotes,
  type CheckpointNote,
  type CheckpointNoteScope,
} from './checkpoint';
import { resolveCodexOpenCommandCandidates } from './codexInterop';
import { buildDiagnosticsText } from './diagnostics';
import {
  captureEditLocation,
  decideEditActivity,
  pushRecentEditLocation,
  type EditLocation,
} from './editActivity';
import { isSummaryLinkEvidenceGrounded } from './evidenceSafety';
import { collectGit, parsePorcelainPaths } from './git';
import { buildStrictSanitizedSummaryContext, tryGenerateOpenAiSummary } from './llm';
import {
  buildMetricsBaselineSnapshotMarkdown,
  buildMetricsCsv,
  hasAnyRecordedMetric,
  pruneMetricsForWorkspace,
  removeMetricsForWorkspace,
} from './metrics';
import {
  evaluateNoiseBudget,
  type NoiseBudgetEvent,
  type NoiseBudgetSignalKind,
  shouldAutoTriggerSummary,
  shouldDeferPromptAfterFocusRegain,
  shouldPromptCheckpointOnBlur,
} from './noiseControl';
import {
  createPerformanceCounter,
  recordPerformanceSample,
  summarizePerformanceCounter,
  type PerformanceCounter,
} from './performanceGuard';
import {
  buildNextStepActions,
  describeNextStepActionRationale,
  type NextStepAction,
} from './nextStepActions';
import {
  resolveCompanionPrimaryCtaDecision,
  type CompanionPrimaryCtaDecision,
} from './companionPrimaryCta';
import {
  isPathWithinWorkspaceRoot,
  normalizeHttpUrl,
  resolveFileTargetInWorkspace,
} from './pathSafety';
import { rankCandidates, type RankedSurfacedItem } from './percolation/ranking';
import {
  buildPercolationExplainabilityPayload,
  formatPercolationExplainabilityLines,
} from './percolation/explainability';
import {
  filterSurfacedItemsByPercolationMemory,
  parsePercolationMemoryStore,
  trimPercolationMemoryStore,
  upsertPercolationMemoryRecord,
  type PercolationMemoryStatus,
  type PercolationMemoryStore,
} from './percolation/memory';
import { evaluatePercolationSuppression } from './percolation/suppression';
import {
  resolveSummarySurfaceDecision,
  type SummaryPresentationMode,
  type SummaryPresentationSurface,
} from './percolation/surfaceBroker';
import {
  createPercolationPolicyInput,
  type PercolationPolicyMode,
  type PercolationSuppressionReason,
} from './percolation/types';
import {
  buildPartitionScope,
  inferTaskPartitionKey,
  resolveTaskPartitionKey as resolveTaskPartitionFromInputs,
} from './partitionScope';
import { formatQuietHoursWindow, isInQuietHours, parseQuietHoursWindow } from './quietHours';
import {
  redactList,
  redactText,
  redactTextWithReport,
  validateCustomRedactionPatterns,
} from './redaction';
import { isRefinementActiveForSummary } from './refinement';
import {
  computeRestoreAvailability,
  describeCheckoutPreviousBranchUnavailableReason,
  describeRerunDebugUnavailableReason,
  describeRerunTaskUnavailableReason,
  type RestoreAvailability,
} from './restoreSafety';
import {
  SCRATCHPAD_FILES_SEGMENT,
  scratchpadFileNameForScope,
  workspaceScratchpadRootSegments,
} from './scratchpadStorage';
import {
  buildIntentOverrideStorageKey,
  createIntentOverrideState,
  MAX_INTENT_OVERRIDE_CHARS,
  normalizeIntentOverrideState,
  normalizeIntentOverrideText,
} from './intentOverride';
import { renderPanelClientScript } from './webview/panelClientScript';
import {
  renderChangesSinceCard,
  renderDetailsCard,
  renderEvidenceCard,
  renderPanelSectionEmphasisAttrs,
  renderPanelSectionEmphasisBadge,
  renderQuickActionsCard,
  renderRecapCard,
  renderRestorePackCard,
  renderStatusCard,
  renderTimelineCard,
  renderTitledListCard,
  renderTrustCenterCard,
  type PanelSectionEmphasis,
} from './webview/panelCards';
import {
  renderCheckpointCard,
  renderCompanionNextSteps,
  renderCompanionNudgeCard,
  renderConfidenceCard,
  renderGroupedEvidenceListItems,
  renderGroupedActionSections,
  renderIntentEditor,
  renderResumePathCard,
  renderScratchpadCard,
  renderTimelineGroupsHtml,
  renderTopFilesListItems,
  renderTopLinksListItems,
  renderWebviewDocument,
} from './webview/panelFragments';
import { PANEL_WEBVIEW_STYLE } from './webview/panelStyles';
import {
  buildResumePathSteps,
  buildResumePathStorageKey,
  createResumePathState,
  isResumePathComplete,
  normalizeResumePathState,
  toggleResumePathStep,
  type ResumePathState,
  type ResumePathStepId,
} from './resumePath';
import { renderResumeStackCard } from './resumeStackCard';
import { resolveScopeBranch as resolveScopeBranchFromInputs } from './scopeBranch';
import { applyIntentOverrideToSummary, buildResumeSummary } from './summary';
import { buildStandupUpdate } from './standup';
import { buildEvidenceRelevanceGroups, buildTimelineGroups } from './timeline';
import { buildTrustCue } from './trustCue';
import { chooseWorkspaceRoot } from './workspaceRoot';
import type {
  ExtensionConfig,
  MetricRecord,
  ResumeSignals,
  ResumeSummary,
  SummaryProvider,
  TriggerReason,
  VscodeLmModelSelector,
} from './types';
import { tryGenerateVscodeLmSummary, type VscodeLmModelLike } from './vscodeLm';
import { parseWebviewMessage, type WebviewMessage } from './webviewMessages';
import { buildWebviewCspMetaTag, escapeHtml } from './webviewSecurity';

const KEY_LAST_BLUR_AT = 'tacos.lastBlurAt';
const KEY_LAST_SUMMARY_AT = 'tacos.lastSummaryAt';
const KEY_LAST_WORKSPACE_ON_BLUR = 'tacos.lastWorkspaceOnBlur';
const KEY_LAST_AUTO_TRIGGER_FINGERPRINT = 'tacos.lastAutoTriggerFingerprint';
const KEY_SUMMARY_SNOOZE_UNTIL = 'tacos.summarySnoozeUntil';
const KEY_SUMMARY_QUIET_UNTIL = 'tacos.summaryQuietUntil';

const KEY_RECENT_FILES = 'tacos.recentFiles';
const KEY_RECENT_TERMINAL = 'tacos.recentTerminal';
const KEY_RECENT_DEBUG = 'tacos.recentDebug';
const KEY_RECENT_URLS = 'tacos.recentUrls';
const KEY_DONE_ITEMS = 'tacos.doneItems';
const KEY_LAST_FAILING_COMMAND = 'tacos.lastFailingCommand';
const KEY_RECENT_EDIT_LOCATIONS_PREFIX = 'tacos.recentEditLocations';
const KEY_LAST_TASK_META_PREFIX = 'tacos.lastTaskMeta';
const KEY_LAST_TERMINAL_CWD_PREFIX = 'tacos.lastTerminalCwd';
const KEY_RESTORE_SEARCH_QUERY_PREFIX = 'tacos.restoreSearchQuery';
const KEY_RESTORE_PRESET_PREFIX = 'tacos.restorePreset';
const KEY_TASK_PARTITION_PREFIX = 'tacos.taskPartition';
const KEY_SCRATCHPAD_SCOPE_MODE_PREFIX = 'tacos.scratchpadScopeMode';
const KEY_ACTIVITY_STORAGE_PREFIX = 'tacos.activityScoped';
const KEY_RESTRICTED_MODE_NOTICE_SHOWN = 'tacos.restrictedModeNoticeShown';
const KEY_SUMMARY_CORRECTIONS_PREFIX = 'tacos.summaryCorrections';
const KEY_VSCODE_LM_SELECTOR = 'tacos.vscodeLmSelector';
const KEY_ONBOARDING_NOTICE_SHOWN = 'tacos.onboardingNoticeShown';
const KEY_SETUP_CHECKLIST_COMPLETED_PREFIX = 'tacos.setupChecklistCompleted';
const KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX = 'tacos.lastCheckpointPromptAt';
const KEY_LAST_NUDGE_AT_PREFIX = 'tacos.lastNudgeAt';
const KEY_NUDGE_FEEDBACK_PREFIX = 'tacos.nudgeFeedback';
const KEY_PERCOLATION_MEMORY_PREFIX = 'tacos.percolationMemory';
const KEY_WORKSPACE_ACTIVITY_AT_PREFIX = 'tacos.workspaceActivityAt';
const KEY_RESUME_PATH_PREFIX = 'tacos.resumePath';
const KEY_INTENT_OVERRIDE_PREFIX = 'tacos.intentOverride';
const KEY_AI_PAYLOAD_CONSENT_PREFIX = 'tacos.aiPayloadConsent';
const KEY_NOISE_BUDGET_EVENTS_PREFIX = 'tacos.noiseBudgetEvents';
const KEY_PANEL_SECTION_STATE_PREFIX = 'tacos.panelSectionState';
const SECRET_OPENAI_API_KEY = 'tacos.openaiApiKey';
const DEMO_RESUME_CONTEXT_HASH = '__tacos_demo_resume__';

const KEY_METRIC_HISTORY = 'tacos.metricHistory';
const CHECKPOINT_PROMPT_COOLDOWN_MINUTES = 45;
const FOCUS_TRIGGER_DEBOUNCE_MS = 1200;
const FOCUS_BOUNDARY_WINDOW_MS = 90_000;
const FOCUS_MAX_DEFERRAL_WITHOUT_BOUNDARY_MS = 180_000;
const FOCUS_TYPING_DEFERRAL_GRACE_MS = 2_000;
const INTERRUPTION_TIMING_BOUNDARY_WINDOW_MS = 90_000;
const INTERRUPTION_TIMING_MID_ACTIVITY_WINDOW_MS = 15_000;
const PERF_WARN_COOLDOWN_MS = 60_000;
const PERF_FOCUS_HANDLING_SLOW_MS = 25;
const PERF_FOCUS_SUMMARY_SLOW_MS = 750;
const PERF_PANEL_RERENDER_SLOW_MS = 60;
const PERF_WEBVIEW_RENDER_SLOW_MS = 50;
const NOISE_BUDGET_WINDOW_MS = 15 * 60_000;
const NOISE_BUDGET_MAX_SIGNALS_PER_WINDOW = 2;
const NOISE_BUDGET_BLOCK_NUDGE_AFTER_SUMMARY_MS = 5 * 60_000;
const NOISE_BUDGET_BLOCK_NUDGE_AFTER_CHECKPOINT_MS = 3 * 60_000;
const NOISE_BUDGET_BLOCK_CHECKPOINT_AFTER_SUMMARY_MS = 5 * 60_000;
const DEMO_MODE_IGNORED_WEBVIEW_MESSAGE_TYPES = new Set<WebviewMessage['type']>([
  'fixSummary',
  'setPanelSectionExpanded',
  'toggleAutoSummaries',
  'sessionAddCheckpoint',
  'checkpointOpenList',
  'openScratchpad',
  'appendScratchpad',
  'setScratchpadScope',
  'checkpointPinToggle',
  'checkpointMarkDone',
  'checkpointDismiss',
  'acknowledgeNudge',
  'dismissNudge',
  'resumePathToggle',
  'setIntentOverride',
  'clearIntentOverride',
  'runNextStepAction',
  'restoreWorkingSet',
  'restoreJumpToLastEdit',
  'restoreReopenFiles',
  'restoreOpenChangedFiles',
  'restoreRerunTask',
  'restoreRerunDebug',
  'restoreOpenProblems',
  'restoreOpenDiagnosticFile',
  'restoreCheckoutPreviousBranch',
  'restoreCopyFailingCommand',
  'openAiPayloadPreview',
  'revokeAiPayloadConsent',
  'rateHelpfulness',
]);
const MAX_CHECKPOINT_NOTES_PER_SCOPE = 50;
const MAX_NUDGE_FEEDBACK_ENTRIES_PER_SCOPE = 40;
const MAX_PERCOLATION_MEMORY_ENTRIES_PER_SCOPE = 80;
const PERCOLATION_DISMISS_MEMORY_MS = 30 * 60_000;
const CHECKPOINT_WORKSPACE_GLOBAL_SCOPE = 'workspace-global';
const SCRATCHPAD_PREVIEW_MAX_LINES = 5;
const SCRATCHPAD_PREVIEW_MAX_BYTES = 256 * 1024;
const AI_SCRATCHPAD_MAX_LINES = 80;
const AI_SCRATCHPAD_MAX_CHARS = 4_000;
const execFileAsync = promisify(execFile);
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
}).disable(['link', 'image']);

class RingBuffer {
  private valuesList: string[] = [];

  constructor(
    private readonly max: number,
    initial: string[] = [],
  ) {
    for (const value of initial) {
      this.push(value);
    }
  }

  push(value: string): void {
    const cleaned = value.trim();
    if (!cleaned) {
      return;
    }

    this.valuesList = this.valuesList.filter((item) => item !== cleaned);
    this.valuesList.unshift(cleaned);

    if (this.valuesList.length > this.max) {
      this.valuesList.length = this.max;
    }
  }

  values(): string[] {
    return [...this.valuesList];
  }
}

interface RuntimeState {
  output: vscode.OutputChannel;
  recentFiles: RingBuffer;
  recentEditLocations: EditLocation[];
  recentTerminal: RingBuffer;
  recentDebug: RingBuffer;
  recentUrls: RingBuffer;
  doneItems: RingBuffer;
  lastFailingCommand?: string;
  lastFailingCommandRaw?: string;
  scratchSummary?: ResumeSummary;
  statusBar?: vscode.StatusBarItem;
  statusBarClass: CompanionStatusBarClass;
  statusBarReason: string;
  statusBarElevated: boolean;
  activeNudges?: {
    contextHash: string;
    decision: CompanionNudgeDecision;
  };
  panel?: vscode.WebviewPanel;
  panelSummary?: ResumeSummary;
  panelWorkspaceRoot?: string;
  panelCheckpointNotes: CheckpointNote[];
  panelPrimaryCheckpointNote?: CheckpointNote;
  panelCheckpointScope?: string;
  panelManualPercolationBypass: boolean;
  panelScratchpadPreviewLines: string[];
  panelScratchpadExists: boolean;
  panelScratchpadHasContent: boolean;
  panelScratchpadScopeLabel?: string;
  panelResumePathState?: ResumePathState;
  panelResumePathScope?: string;
  panelSectionState?: PanelSectionState;
  panelSectionScope?: string;
  lastTaskName?: string;
  lastTaskWorkspaceRoot?: string;
  lastTaskExitCode?: number;
  lastTaskEndedAt?: number;
  lastTerminalCwd?: string;
  lastDebugConfigName?: string;
  lastDebugWorkspaceRoot?: string;
  metricSession?: MetricRecord;
  workspaceTrusted: boolean;
  terminalHooks: vscode.Disposable[];
  refinementSequence: number;
  activeRefinementSequence?: number;
  activeRefinementContextHash?: string;
  autoSummaryInFlight: boolean;
  lastAutoFocusTriggerAt: number;
  lastFocusGainedAt: number;
  lastBoundarySignalAt: number;
  lastMeaningfulActivityAt: number;
  perfFocusHandling: PerformanceCounter;
  perfFocusSummary: PerformanceCounter;
  perfPanelRerender: PerformanceCounter;
  perfWebviewRender: PerformanceCounter;
  detailsMarkdownCache?: {
    contextHash: string;
    detailsMarkdown: string;
    html: string;
  };
  lastSummaryContextUnchanged: boolean;
  meaningfulActivitySinceCheckpointPrompt: boolean;
  pauseUntilRestart: boolean;
  snoozeUntil: number;
  summaryQuietUntil: number;
  vscodeLmModel?: VscodeLmModelLike;
  vscodeLmSelector?: VscodeLmModelSelector;
  vscodeLmUnavailableNotified: boolean;
  applyingPrivacyPreset: boolean;
  lastRedactionPatternWarningSignature?: string;
}

let state: RuntimeState;
let activeExtensionContext: vscode.ExtensionContext | undefined;

function maybeWarnRedactionPatternGuardrails(patterns: string[]): void {
  const validation = validateCustomRedactionPatterns(patterns);
  if (validation.invalid === 0 && validation.tooLong === 0 && validation.overLimit === 0) {
    return;
  }

  const signature = [
    validation.provided,
    validation.accepted,
    validation.invalid,
    validation.tooLong,
    validation.overLimit,
  ].join(':');
  if (state.lastRedactionPatternWarningSignature === signature) {
    return;
  }
  state.lastRedactionPatternWarningSignature = signature;

  const parts: string[] = [];
  if (validation.invalid > 0) {
    parts.push(`${validation.invalid} invalid`);
  }
  if (validation.tooLong > 0) {
    parts.push(`${validation.tooLong} too long`);
  }
  if (validation.overLimit > 0) {
    parts.push(`${validation.overLimit} beyond max`);
  }
  const detail = parts.join(', ');
  void vscode.window.showWarningMessage(`TaCoS: some redaction patterns were ignored (${detail}).`);
  state.output.appendLine(
    `TaCoS: redaction pattern guardrails applied (provided=${validation.provided}, accepted=${validation.accepted}, invalid=${validation.invalid}, tooLong=${validation.tooLong}, overLimit=${validation.overLimit}).`,
  );
}

interface PresentSummaryOptions {
  autoOpenDetails?: boolean;
  preferBackgroundPresentation?: boolean;
  focusRegainedAt?: number;
  workspaceRoot?: string;
  checkpointPrimaryNote?: CheckpointNote;
  checkpointNotes?: CheckpointNote[];
  checkpointScope?: string;
  manualPercolationBypass?: boolean;
}

type ScratchpadScopeMode = 'partition' | 'workspace';

type CompanionRuntimeMode = 'active' | 'paused' | 'restricted' | 'disabled';
type CompanionStatusBarClass =
  | 'active-idle'
  | 'active-suppressed'
  | 'active-next'
  | 'active-blocked'
  | 'active-clarify'
  | 'active-evidence'
  | 'active-trust'
  | 'active-restore'
  | 'active-status'
  | 'restricted'
  | 'paused'
  | 'disabled';

interface PersistedTaskMetadata {
  taskName: string;
  workspaceRoot?: string;
  exitCode: number;
  timestamp: number;
}

interface DiagnosticBlockerReference {
  path: string;
  absolutePath: string;
  line: number;
  character: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

interface DiagnosticBlockerSnapshot {
  errorCount: number;
  warningCount: number;
  top?: DiagnosticBlockerReference;
}

type PanelSectionId = 'trustCenter' | 'timeline' | 'evidence' | 'details' | 'moreContext';

interface PanelSectionState {
  expandedSectionIds: PanelSectionId[];
}

const PANEL_SECTION_IDS: PanelSectionId[] = [
  'trustCenter',
  'timeline',
  'evidence',
  'details',
  'moreContext',
];

export function activate(context: vscode.ExtensionContext): void {
  activeExtensionContext = context;
  const initialWorkspaceRoot = pickWorkspaceRoot() ?? '';
  const persistedActivity = loadPersistedActivitySnapshot(context);
  const persistedTaskMetadata = readPersistedTaskMetadata(context, initialWorkspaceRoot);
  state = {
    output: vscode.window.createOutputChannel('TaCoS'),
    recentFiles: new RingBuffer(15, persistedActivity.sanitized.recentFiles),
    recentEditLocations: readRecentEditLocations(context, initialWorkspaceRoot),
    recentTerminal: new RingBuffer(15, persistedActivity.sanitized.recentTerminal),
    recentDebug: new RingBuffer(10, persistedActivity.sanitized.recentDebug),
    recentUrls: new RingBuffer(5, persistedActivity.sanitized.recentUrls),
    doneItems: new RingBuffer(10, persistedActivity.sanitized.doneItems),
    lastFailingCommand: persistedActivity.sanitized.lastFailingCommand,
    lastFailingCommandRaw: undefined,
    scratchSummary: undefined,
    statusBarClass: 'active-idle',
    statusBarReason: 'awaiting summary',
    statusBarElevated: false,
    activeNudges: undefined,
    panelCheckpointNotes: [],
    panelPrimaryCheckpointNote: undefined,
    panelCheckpointScope: undefined,
    panelManualPercolationBypass: false,
    panelScratchpadPreviewLines: [],
    panelScratchpadExists: false,
    panelScratchpadHasContent: false,
    panelScratchpadScopeLabel: undefined,
    panelResumePathState: undefined,
    panelResumePathScope: undefined,
    panelSectionState: undefined,
    panelSectionScope: undefined,
    lastTaskName: persistedTaskMetadata?.taskName,
    lastTaskWorkspaceRoot: persistedTaskMetadata?.workspaceRoot,
    lastTaskExitCode: persistedTaskMetadata?.exitCode,
    lastTaskEndedAt: persistedTaskMetadata?.timestamp,
    lastTerminalCwd: readPersistedTerminalCwd(context, initialWorkspaceRoot),
    workspaceTrusted: vscode.workspace.isTrusted,
    terminalHooks: [],
    refinementSequence: 0,
    activeRefinementContextHash: undefined,
    autoSummaryInFlight: false,
    lastAutoFocusTriggerAt: 0,
    lastFocusGainedAt: 0,
    lastBoundarySignalAt: 0,
    lastMeaningfulActivityAt: 0,
    perfFocusHandling: createPerformanceCounter(),
    perfFocusSummary: createPerformanceCounter(),
    perfPanelRerender: createPerformanceCounter(),
    perfWebviewRender: createPerformanceCounter(),
    detailsMarkdownCache: undefined,
    lastSummaryContextUnchanged: false,
    meaningfulActivitySinceCheckpointPrompt: false,
    pauseUntilRestart: false,
    snoozeUntil: context.workspaceState.get<number>(KEY_SUMMARY_SNOOZE_UNTIL, 0),
    summaryQuietUntil: context.workspaceState.get<number>(KEY_SUMMARY_QUIET_UNTIL, 0),
    vscodeLmSelector: context.globalState.get<VscodeLmModelSelector | undefined>(
      KEY_VSCODE_LM_SELECTOR,
    ),
    vscodeLmUnavailableNotified: false,
    applyingPrivacyPreset: false,
    lastRedactionPatternWarningSignature: undefined,
  };

  state.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  state.statusBar.name = 'TaCoS Companion';
  state.statusBar.command = 'tacos.openCompanionActions';
  state.statusBar.show();
  context.subscriptions.push(state.statusBar);

  context.subscriptions.push(state.output);
  void migrateLegacyPersistedActivityIfNeeded(context, persistedActivity);
  void applyRetentionPolicy(context, initialWorkspaceRoot);
  maybeWarnRedactionPatternGuardrails(getConfig().redactionPatterns);

  context.subscriptions.push(
    vscode.commands.registerCommand('tacos.showNow', async () => {
      await triggerSummary(context, 'manual');
    }),
    vscode.commands.registerCommand('tacos.openCompanionActions', async () => {
      await showCompanionActions(context);
    }),
    vscode.commands.registerCommand('tacos.__test.getFocusPresentationMode', async () => {
      const mode = resolveSummaryPresentationMode(getConfig(), {
        autoOpenDetails: false,
      });
      return mode;
    }),
    vscode.commands.registerCommand(
      'tacos.__test.getFocusSurfaceDecision',
      async (input?: unknown) => {
        const payload =
          input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
        const config = getConfig();
        const configuredUiSurface =
          payload.uiSurface === 'statusbar' ||
          payload.uiSurface === 'notification' ||
          payload.uiSurface === 'silent'
            ? payload.uiSurface
            : config.uiSurface;
        const suppression =
          typeof payload.suppressionReason === 'string' && payload.suppressionReason.trim()
            ? {
                suppressed: true as const,
                reason: payload.suppressionReason.trim() as PercolationSuppressionReason,
              }
            : undefined;
        const primaryInput =
          payload.primary && typeof payload.primary === 'object'
            ? (payload.primary as Record<string, unknown>)
            : undefined;
        const primary = primaryInput
          ? {
              kind:
                typeof primaryInput.kind === 'string'
                  ? (primaryInput.kind as RankedSurfacedItem['kind'])
                  : 'status',
              actionId:
                typeof primaryInput.actionId === 'string' ? primaryInput.actionId : undefined,
              urgency: typeof primaryInput.urgency === 'number' ? primaryInput.urgency : 0,
              confidence: typeof primaryInput.confidence === 'number' ? primaryInput.confidence : 0,
              score: typeof primaryInput.score === 'number' ? primaryInput.score : 0,
            }
          : undefined;
        return resolveSummarySurfaceDecision({
          configuredUiSurface,
          autoOpenDetails: payload.autoOpenDetails === true,
          preferBackgroundPresentation: payload.preferBackgroundPresentation === true,
          suppression,
          primary,
        });
      },
    ),
    vscode.commands.registerCommand('tacos.__test.getStatusBarSnapshot', async () => {
      return {
        text: state.statusBar?.text ?? '',
        tooltip: typeof state.statusBar?.tooltip === 'string' ? state.statusBar.tooltip : '',
        mode: resolveCompanionRuntimeMode(getConfig()),
        statusClass: state.statusBarClass,
        statusReason: state.statusBarReason,
        elevated: state.statusBarElevated,
      };
    }),
    vscode.commands.registerCommand('tacos.__test.getPartitionScopeSnapshot', async () => {
      const workspaceRoot = pickWorkspaceRoot() ?? '';
      if (!workspaceRoot) {
        return undefined;
      }

      const persistedBranch = context.workspaceState.get<string>(branchStateKey(workspaceRoot), '');
      const scopeBranch = resolveScopeBranchFromInputs({
        workspaceRoot,
        persistedBranch,
      });
      const manualTaskPartition = context.workspaceState
        .get<string>(taskPartitionStorageKey(workspaceRoot), '')
        .trim();
      const resolvedTaskPartition = resolveTaskPartitionKey(context, workspaceRoot, scopeBranch);
      return {
        workspaceRoot,
        scopeBranch,
        manualTaskPartition,
        resolvedTaskPartition,
        scope: buildPartitionScope(workspaceRoot, scopeBranch, resolvedTaskPartition),
      };
    }),
    vscode.commands.registerCommand('tacos.__test.setTaskPartition', async (value?: string) => {
      const workspaceRoot = pickWorkspaceRoot();
      if (!workspaceRoot) {
        return false;
      }

      const nextValue = typeof value === 'string' ? value.trim() : '';
      await context.workspaceState.update(
        taskPartitionStorageKey(workspaceRoot),
        nextValue ? nextValue : undefined,
      );
      return true;
    }),
    vscode.commands.registerCommand('tacos.__test.setPersistedBranch', async (value?: string) => {
      const workspaceRoot = pickWorkspaceRoot();
      if (!workspaceRoot) {
        return false;
      }

      const nextValue = typeof value === 'string' ? value.trim() : '';
      await context.workspaceState.update(
        branchStateKey(workspaceRoot),
        nextValue ? nextValue : undefined,
      );
      return true;
    }),
    vscode.commands.registerCommand(
      'tacos.__test.pickWorkspaceRoot',
      async (preferred?: string) => {
        const preferredWorkspaceRoot = typeof preferred === 'string' ? preferred : undefined;
        return pickWorkspaceRoot(preferredWorkspaceRoot);
      },
    ),
    vscode.commands.registerCommand('tacos.__test.getRuntimeStateSnapshot', async () => {
      return {
        panelOpen: Boolean(state.panel),
        panelTitle: state.panel?.title,
        panelWorkspaceRoot: state.panelWorkspaceRoot,
        hasScratchSummary: Boolean(state.scratchSummary),
        scratchContextHash: state.scratchSummary?.contextHash,
        recentFilesCount: state.recentFiles.values().length,
        recentTerminalCount: state.recentTerminal.values().length,
        recentDebugCount: state.recentDebug.values().length,
        recentUrlsCount: state.recentUrls.values().length,
        doneItemsCount: state.doneItems.values().length,
      };
    }),
    vscode.commands.registerCommand('tacos.__test.disposePanel', async () => {
      if (!state.panel) {
        return false;
      }

      state.panel.dispose();
      return true;
    }),
    vscode.commands.registerCommand('tacos.__test.getResumeFlowSnapshot', async () => {
      const summary = state.panelSummary ?? state.scratchSummary;
      const nextStepActions = summary ? buildNextStepActionCandidates(summary) : [];
      const primaryNextAction = nextStepActions.find((candidate): candidate is NextStepAction =>
        Boolean(candidate),
      );
      const panelHtml = state.panel?.webview.html ?? '';
      const panelTitle = state.panel?.title ?? '';
      const isDemoSummary = isDemoResumeSummary(summary);
      const hasDemoResumeCard = panelHtml.includes('data-demo-resume-card="true"');
      const hasDismissDemoResumeAction = panelHtml.includes('data-action="dismissDemoResume"');
      const hasDemoIntentEditorReadOnly = panelHtml.includes('data-intent-editor-readonly="true"');
      const hasDemoResumePathReadOnly = panelHtml.includes('data-resume-path-readonly="true"');
      const primaryBlockerActionCount = (
        panelHtml.match(/data-blocker-primary-action="true"/gu) ?? []
      ).length;
      const hasPrimaryBlockerAction = primaryBlockerActionCount > 0;
      const hasDisabledPrimaryBlockerAction =
        /data-blocker-primary-action="true"[^>]*disabled/u.test(panelHtml);
      const hasActiveBlockedCard = panelHtml.includes('data-blocked-card="active"');
      const primaryNextActionCtaCount = (panelHtml.match(/data-primary-next-safe-action=/gu) ?? [])
        .length;
      const hasHomePrimaryNextAction = panelHtml.includes('data-primary-next-safe-action="home"');
      const totalPrimaryCtaCount = primaryBlockerActionCount + primaryNextActionCtaCount;
      const companionSectionOrder = [
        ...panelHtml.matchAll(/data-companion-section="([^"]+)"/gu),
      ].map((match) => match[1]);
      const companionSlotSourceMatches = [
        ...panelHtml.matchAll(/data-companion-slot-source="([^"]+)"/gu),
      ];
      const nextSlotSourceClass =
        panelHtml.match(
          /data-companion-section="next"[^>]*data-companion-slot-source="([^"]+)"/u,
        )?.[1] ?? '';
      const blockedSlotSourceClass =
        panelHtml.match(
          /data-companion-section="blocked"[^>]*data-companion-slot-source="([^"]+)"/u,
        )?.[1] ?? '';
      const restoreSlotSourceClass =
        panelHtml.match(
          /data-companion-section="restore"[^>]*data-companion-slot-source="([^"]+)"/u,
        )?.[1] ?? '';
      const nextSafeStatus = panelHtml.match(/data-next-safe-status="([^"]+)"/u)?.[1] ?? '';
      const nextEmphasisToken = panelHtml.match(/data-next-emphasis-token="([^"]+)"/u)?.[1] ?? '';
      const blockedEmphasisToken =
        panelHtml.match(/data-blocked-emphasis-token="([^"]+)"/u)?.[1] ?? '';
      const emphasisTokenCount = (panelHtml.match(/data-emphasis-token=/gu) ?? []).length;
      const advisoryOnlyRowCount = (panelHtml.match(/Advisory only/gu) ?? []).length;
      const restoreWorkingSetActionCount = (
        panelHtml.match(/data-action="restoreWorkingSet"/gu) ?? []
      ).length;
      const firstCardTitleMatch = panelHtml.match(
        /<div class="card(?: [^"]*)?">\s*<h3>([^<]+)<\/h3>/u,
      );
      const firstCardTitle = firstCardTitleMatch?.[1] ?? '';
      const hasTrustCenterSection = panelHtml.includes('data-panel-section="trustCenter"');
      const hasTimelineSection = panelHtml.includes('data-panel-section="timeline"');
      const hasEvidenceSection = panelHtml.includes('data-panel-section="evidence"');
      const hasDetailsSection = panelHtml.includes('data-panel-section="details"');
      const panelSectionOrder = [
        ...panelHtml.matchAll(/<details[^>]*data-panel-section="([^"]+)"/gu),
      ].map((match) => match[1]);
      const panelEmphasisBadgeCount = (panelHtml.match(/data-panel-emphasis-badge="true"/gu) ?? [])
        .length;
      const emphasizedPanelSections = [
        ...panelHtml.matchAll(
          /<details[^>]*data-panel-section="([^"]+)"[^>]*data-panel-emphasis-level="([^"]+)"[^>]*>/gu,
        ),
      ].map((match) => match[1]);
      const hasMoreContextEmphasis =
        /data-panel-section="moreContext"[^>]*data-panel-emphasis-level=/u.test(panelHtml);
      const moreContextEmphasisSource =
        panelHtml.match(
          /data-panel-section="moreContext"[^>]*data-panel-emphasis-source="([^"]+)"/u,
        )?.[1] ?? '';
      const hasAnchorOpenLinkAction = /<a[^>]*data-action=["']openLink["']/u.test(panelHtml);
      const hasAnchorOpenTopFileAction = /<a[^>]*data-action=["']openTopFile["']/u.test(panelHtml);
      const hasAnchorOpenEvidenceAction = /<a[^>]*data-action=["']openEvidence["']/u.test(
        panelHtml,
      );
      const hasButtonOpenLinkAction = /<button[^>]*data-action="openLink"/u.test(panelHtml);
      const hasButtonOpenTopFileAction = /<button[^>]*data-action="openTopFile"/u.test(panelHtml);
      const hasButtonOpenEvidenceAction = /<button[^>]*data-action="openEvidence"/u.test(panelHtml);
      const linkCount = summary?.links.length ?? 0;
      const topFilesCount = summary?.topFiles.length ?? 0;
      const clickableEvidenceCount =
        summary?.evidenceCatalog?.filter((item) => item.kind === 'file' || item.kind === 'url')
          .length ?? 0;
      const nonClickableEvidenceCount = Math.max(
        0,
        (summary?.evidenceCatalog?.length ?? 0) - clickableEvidenceCount,
      );
      const hiddenEvidenceCount = Math.max(0, (summary?.evidenceCatalog?.length ?? 0) - 5);
      const evidenceShowMoreLabelMatch = panelHtml.match(
        /data-action="toggleEvidenceMore"[^>]*>([^<]+)<\/button>/u,
      );
      const evidenceShowMoreLabel = evidenceShowMoreLabelMatch?.[1]?.trim() ?? '';
      const timelineOpenAffordanceCount = (
        panelHtml.match(/data-timeline-affordance="open"/gu) ?? []
      ).length;
      const timelineStaticAffordanceCount = (
        panelHtml.match(/data-timeline-affordance="static"/gu) ?? []
      ).length;
      const evidenceOpenAffordanceCount = (
        panelHtml.match(/data-evidence-affordance="open"/gu) ?? []
      ).length;
      const evidenceStaticAffordanceCount = (
        panelHtml.match(/data-evidence-affordance="static"/gu) ?? []
      ).length;
      const trustCenterExpanded = /data-panel-section="trustCenter"[^>]*\sopen(?:\s|>)/u.test(
        panelHtml,
      );
      const timelineExpanded = /data-panel-section="timeline"[^>]*\sopen(?:\s|>)/u.test(panelHtml);
      const evidenceExpanded = /data-panel-section="evidence"[^>]*\sopen(?:\s|>)/u.test(panelHtml);
      const detailsExpanded = /data-panel-section="details"[^>]*\sopen(?:\s|>)/u.test(panelHtml);
      const moreContextExpanded = /data-panel-section="moreContext"[^>]*\sopen(?:\s|>)/u.test(
        panelHtml,
      );
      const hasDisabledRestoreWorkingSet = /data-action="restoreWorkingSet"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledRestoreRerunTask = /data-action="restoreRerunTask"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledRestoreRerunDebug = /data-action="restoreRerunDebug"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledAddNoteAction = /data-action="sessionAddCheckpoint"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledListNotesAction = /data-action="checkpointOpenList"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledRateHelpfulnessAction = /data-action="rateHelpfulness"[^>]*disabled/u.test(
        panelHtml,
      );
      const hasDisabledFixSummaryAction = /data-action="fixSummary"[^>]*disabled/u.test(panelHtml);
      const hasDisabledToggleAutoSummariesAction =
        /data-action="toggleAutoSummaries"[^>]*disabled/u.test(panelHtml);
      const disabledResumePathToggleCount = (
        panelHtml.match(/<input[^>]*data-resume-path-toggle="true"[^>]*disabled/gu) ?? []
      ).length;

      return {
        panelTitle,
        hasPanelSummary: Boolean(state.panelSummary),
        hasScratchSummary: Boolean(state.scratchSummary),
        isDemoSummary,
        hasDemoResumeCard,
        hasDismissDemoResumeAction,
        hasDemoIntentEditorReadOnly,
        hasDemoResumePathReadOnly,
        summaryIntent: summary?.intent ?? '',
        intentOverridden: Boolean(summary?.intentOverridden),
        nextStepsCount: summary?.nextSteps.length ?? 0,
        nextStepActionsCount: nextStepActions.length,
        hasPrimaryNextAction: hasHomePrimaryNextAction,
        hasNextActionCandidate: Boolean(primaryNextAction),
        primaryNextActionLabel: primaryNextAction?.label ?? '',
        primaryNextActionStepIndex: primaryNextAction?.stepIndex ?? -1,
        hasPrimaryNextActionRationale: panelHtml.includes('data-next-step-rationale="true"'),
        hasHomePrimaryNextAction,
        primaryNextActionCtaCount,
        totalPrimaryCtaCount,
        companionSectionOrder,
        companionSlotSourceCount: companionSlotSourceMatches.length,
        nextSlotSourceClass,
        blockedSlotSourceClass,
        restoreSlotSourceClass,
        nextSafeStatus,
        nextEmphasisToken,
        blockedEmphasisToken,
        emphasisTokenCount,
        advisoryOnlyRowCount,
        hasLegacyNextStepsCard: panelHtml.includes('<h3>Next Steps</h3>'),
        hasRecommendedFirstAction: Boolean(summary?.recommendedFirstAction?.trim()),
        hasCompanionHomeCard: panelHtml.includes('<h3>Companion Home</h3>'),
        isCompanionHomeFirstCard: firstCardTitle === 'Companion Home',
        hasIntentEditor: panelHtml.includes('data-action="setIntentOverride"'),
        hasIntentSourceLabel: panelHtml.includes('Intent source:'),
        hasLastActionCue: panelHtml.includes('data-last-action-cue="true"'),
        hasActiveBlockedCard,
        primaryBlockerActionCount,
        hasPrimaryBlockerAction,
        hasDisabledPrimaryBlockerAction,
        hasRestoreWorkingSetAction: restoreWorkingSetActionCount > 0,
        restoreWorkingSetActionCount,
        hasTrustCenterCard: hasTrustCenterSection || panelHtml.includes('<h3>Trust Center</h3>'),
        hasTrustCenterSection,
        hasTimelineSection,
        hasEvidenceSection,
        hasDetailsSection,
        panelSectionOrder,
        panelEmphasisBadgeCount,
        emphasizedPanelSections,
        hasMoreContextEmphasis,
        moreContextEmphasisSource,
        hasAnchorOpenLinkAction,
        hasAnchorOpenTopFileAction,
        hasAnchorOpenEvidenceAction,
        hasButtonOpenLinkAction,
        hasButtonOpenTopFileAction,
        hasButtonOpenEvidenceAction,
        linkCount,
        topFilesCount,
        clickableEvidenceCount,
        nonClickableEvidenceCount,
        hiddenEvidenceCount,
        evidenceShowMoreLabel,
        timelineOpenAffordanceCount,
        timelineStaticAffordanceCount,
        evidenceOpenAffordanceCount,
        evidenceStaticAffordanceCount,
        trustCenterExpanded,
        timelineExpanded,
        evidenceExpanded,
        detailsExpanded,
        moreContextExpanded,
        hasResumePathCard: panelHtml.includes('<h3>Resume Path</h3>'),
        resumePathStepCount: (panelHtml.match(/<input[^>]*data-resume-path-toggle="true"/gu) ?? [])
          .length,
        disabledResumePathToggleCount,
        hasDisabledRestoreWorkingSet,
        hasDisabledRestoreRerunTask,
        hasDisabledRestoreRerunDebug,
        hasDisabledAddNoteAction,
        hasDisabledListNotesAction,
        hasDisabledRateHelpfulnessAction,
        hasDisabledFixSummaryAction,
        hasDisabledToggleAutoSummariesAction,
      };
    }),
    vscode.commands.registerCommand('tacos.__test.getResumePathSnapshot', async () => {
      const contextRef = activeExtensionContext;
      const summary = state.panelSummary ?? state.scratchSummary;
      const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
      if (!contextRef || !summary || !workspaceRoot) {
        return undefined;
      }

      const scope = partitionScope(contextRef, workspaceRoot);
      const storageKey = resumePathStorageKey(contextRef, workspaceRoot);
      const snapshot = resolveResumePathStateForSummary(contextRef, workspaceRoot, summary);
      return {
        scope,
        storageKey,
        contextHash: snapshot.contextHash,
        completedStepIds: [...snapshot.completedStepIds],
        collapsed: snapshot.collapsed,
      };
    }),
    vscode.commands.registerCommand('tacos.__test.getPanelSectionStateSnapshot', async () => {
      const contextRef = activeExtensionContext;
      const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
      if (!contextRef || !workspaceRoot) {
        return undefined;
      }

      const scope = partitionScope(contextRef, workspaceRoot);
      const storageKey = panelSectionStateStorageKey(contextRef, workspaceRoot);
      const snapshot = resolvePanelSectionState(contextRef, workspaceRoot);
      return {
        scope,
        storageKey,
        expandedSectionIds: [...snapshot.expandedSectionIds],
      };
    }),
    vscode.commands.registerCommand(
      'tacos.__test.setPanelSectionExpanded',
      async (sectionId: PanelSectionId, expanded = true) => {
        const contextRef = activeExtensionContext;
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!contextRef || !workspaceRoot || !isPanelSectionId(sectionId)) {
          return false;
        }

        await setPanelSectionExpanded(contextRef, workspaceRoot, sectionId, expanded);
        rerenderPanel();
        return true;
      },
    ),
    vscode.commands.registerCommand(
      'tacos.__test.setIntentOverride',
      async (intentValue?: unknown) => {
        const contextRef = activeExtensionContext;
        const summary = state.panelSummary ?? state.scratchSummary;
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!contextRef || !summary || !workspaceRoot) {
          return false;
        }

        const nextIntent = await applyIntentOverrideToActiveContext(
          contextRef,
          workspaceRoot,
          summary.contextHash,
          intentValue,
        );
        rerenderPanel();
        return nextIntent ?? null;
      },
    ),
    vscode.commands.registerCommand('tacos.__test.getIntentOverrideSnapshot', async () => {
      const contextRef = activeExtensionContext;
      const summary = state.panelSummary ?? state.scratchSummary;
      const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
      if (!contextRef || !summary || !workspaceRoot) {
        return undefined;
      }

      const scope = partitionScope(contextRef, workspaceRoot);
      const storageKey = intentOverrideStorageKey(contextRef, workspaceRoot);
      const overrideIntent = readIntentOverrideForContext(
        contextRef,
        workspaceRoot,
        summary.contextHash,
      );
      return {
        scope,
        storageKey,
        contextHash: summary.contextHash,
        intent: overrideIntent,
      };
    }),
    vscode.commands.registerCommand(
      'tacos.__test.toggleResumePathStep',
      async (stepId: ResumePathStepId, completed = true) => {
        const contextRef = activeExtensionContext;
        const summary = state.panelSummary ?? state.scratchSummary;
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!contextRef || !summary || !workspaceRoot) {
          return false;
        }

        if (
          stepId !== 'confirmIntent' &&
          stepId !== 'runNextSafeAction' &&
          stepId !== 'clearBlocker'
        ) {
          return false;
        }

        const nextState = await setResumePathStepCompletion(
          contextRef,
          workspaceRoot,
          summary,
          stepId,
          Boolean(completed),
        );
        if (state.panelSummary) {
          state.panelSummary.resumePathCompletedStepIds = [...nextState.completedStepIds];
          state.panelSummary.resumePathCollapsed = nextState.collapsed;
        }
        rerenderPanel();
        return true;
      },
    ),
    vscode.commands.registerCommand('tacos.__test.getFocusSuppressionSnapshot', async () => {
      const now = Date.now();
      const config = getConfig();
      const debounced =
        state.autoSummaryInFlight || now - state.lastAutoFocusTriggerAt < FOCUS_TRIGGER_DEBOUNCE_MS;
      const disabledOrPaused =
        !config.enabled || state.pauseUntilRestart || !config.showOnFocus || config.pauseSummaries;
      const snoozed = state.snoozeUntil > now;
      const quietState = resolveSummaryQuietState(now, config.summaryQuietHours);
      const quietHours = quietState.active;

      let suppressionReason:
        | 'none'
        | 'debounced'
        | 'disabled-or-paused'
        | 'snoozed'
        | 'quiet-hours' = 'none';
      if (debounced) {
        suppressionReason = 'debounced';
      } else if (disabledOrPaused) {
        suppressionReason = 'disabled-or-paused';
      } else if (snoozed) {
        suppressionReason = 'snoozed';
      } else if (quietHours) {
        suppressionReason = 'quiet-hours';
      }

      return {
        now,
        suppressionReason,
        debounced,
        disabledOrPaused,
        snoozed,
        quietHours,
        temporaryQuiet: quietState.source === 'temporary',
        configuredQuietHours: quietState.source === 'configured',
      };
    }),
    vscode.commands.registerCommand(
      'tacos.__test.evaluateAutoTriggerDecision',
      async (rawInput?: unknown) => {
        const overrides =
          rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
        const config = getConfig();
        const now =
          typeof overrides.now === 'number' && Number.isFinite(overrides.now)
            ? overrides.now
            : Date.now();
        const lastBlurAt =
          typeof overrides.lastBlurAt === 'number' && Number.isFinite(overrides.lastBlurAt)
            ? overrides.lastBlurAt
            : now - config.minIdleMinutes * 60_000 - 1_000;
        const lastSummaryAt =
          typeof overrides.lastSummaryAt === 'number' && Number.isFinite(overrides.lastSummaryAt)
            ? overrides.lastSummaryAt
            : now - config.cooldownMinutes * 60_000 - 1_000;
        const projectSwitched = Boolean(overrides.projectSwitched);
        const significantChange =
          typeof overrides.significantChange === 'boolean' ? overrides.significantChange : true;
        const lastBoundarySignalAt =
          typeof overrides.lastBoundarySignalAt === 'number' &&
          Number.isFinite(overrides.lastBoundarySignalAt)
            ? overrides.lastBoundarySignalAt
            : state.lastBoundarySignalAt;

        const shouldTrigger = shouldAutoTriggerSummary({
          now,
          lastBlurAt,
          lastSummaryAt,
          minIdleMinutes: config.minIdleMinutes,
          cooldownMinutes: config.cooldownMinutes,
          projectSwitched,
          significantChange,
          lastBoundarySignalAt,
          boundaryWindowMs: FOCUS_BOUNDARY_WINDOW_MS,
          maxDeferralWithoutBoundaryMs: FOCUS_MAX_DEFERRAL_WITHOUT_BOUNDARY_MS,
        });

        const hasRecentBoundary =
          typeof lastBoundarySignalAt === 'number' &&
          lastBoundarySignalAt > 0 &&
          now - lastBoundarySignalAt <= FOCUS_BOUNDARY_WINDOW_MS;

        return {
          shouldTrigger,
          hasRecentBoundary,
          now,
          lastBlurAt,
          lastSummaryAt,
          lastBoundarySignalAt,
          projectSwitched,
          significantChange,
          boundaryWindowMs: FOCUS_BOUNDARY_WINDOW_MS,
          maxDeferralWithoutBoundaryMs: FOCUS_MAX_DEFERRAL_WITHOUT_BOUNDARY_MS,
        };
      },
    ),
    vscode.commands.registerCommand(
      'tacos.__test.evaluateFocusPromptDeferral',
      async (rawInput?: unknown) => {
        const input =
          rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
        const focusGainedAt =
          typeof input.focusGainedAt === 'number' && Number.isFinite(input.focusGainedAt)
            ? input.focusGainedAt
            : state.lastFocusGainedAt;
        const observedAt =
          typeof input.observedAt === 'number' && Number.isFinite(input.observedAt)
            ? input.observedAt
            : Date.now();
        const lastMeaningfulActivityAt =
          typeof input.lastMeaningfulActivityAt === 'number' &&
          Number.isFinite(input.lastMeaningfulActivityAt)
            ? input.lastMeaningfulActivityAt
            : state.lastMeaningfulActivityAt;
        const graceWindowMs =
          typeof input.graceWindowMs === 'number' && Number.isFinite(input.graceWindowMs)
            ? input.graceWindowMs
            : FOCUS_TYPING_DEFERRAL_GRACE_MS;

        return shouldDeferPromptAfterFocusRegain({
          focusGainedAt,
          observedAt,
          lastMeaningfulActivityAt,
          graceWindowMs,
        });
      },
    ),
    vscode.commands.registerCommand('tacos.__test.setSnoozeUntil', async (value?: number) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        state.snoozeUntil = value;
        await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, value);
        return true;
      }

      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      return true;
    }),
    vscode.commands.registerCommand('tacos.__test.setSummaryQuietUntil', async (value?: number) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        state.summaryQuietUntil = value;
        await context.workspaceState.update(KEY_SUMMARY_QUIET_UNTIL, value);
        updateCompanionStatusBar();
        return true;
      }

      state.summaryQuietUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_QUIET_UNTIL, undefined);
      updateCompanionStatusBar();
      return true;
    }),
    vscode.commands.registerCommand(
      'tacos.__test.setLastSummaryContextUnchanged',
      async (value?: boolean) => {
        state.lastSummaryContextUnchanged = value === true;
        updateCompanionStatusBar();
        return true;
      },
    ),
    vscode.commands.registerCommand('tacos.__test.switchTaskPartition', async (value?: string) => {
      const workspaceRoot = pickWorkspaceRoot();
      if (!workspaceRoot) {
        return false;
      }

      const nextValue = typeof value === 'string' ? value.trim() : '';
      await applyTaskPartitionSwitch(context, workspaceRoot, nextValue);
      return true;
    }),
    vscode.commands.registerCommand('tacos.__test.runActionSafetyNoopChecks', async () => {
      return runActionSafetyNoopChecks(context);
    }),
    vscode.commands.registerCommand('tacos.__test.getExecutionActionGuardSnapshot', async () => {
      return runExecutionActionGuardChecks();
    }),
    vscode.commands.registerCommand('tacos.slash', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const { summary } = await generateSummary(context, root, 'manual');
      const markdownSummary = formatMarkdownSummary(summary);
      await context.workspaceState.update(KEY_LAST_SUMMARY_AT, Date.now());
      await vscode.env.clipboard.writeText(markdownSummary);
      await openSummaryEditor(markdownSummary);
      void vscode.window.showInformationMessage(
        'TaCoS: complete summary generated, copied, and opened in a new editor tab.',
      );
    }),
    vscode.commands.registerCommand('tacos.copyPromptAndOpenCodex', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const result = await generateSummary(context, root, 'manual');
      await context.workspaceState.update(KEY_LAST_SUMMARY_AT, Date.now());
      await copyPromptAndOpenCodex(result.summary);
    }),
    vscode.commands.registerCommand('tacos.showLastSummary', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const cached = context.workspaceState.get<ResumeSummary>(summaryCacheKey(context, root));
      if (!cached) {
        void vscode.window.showInformationMessage(
          'TaCoS: No cached summary yet for this workspace.',
        );
        return;
      }

      const checkpointContext = await resolveCheckpointContext(
        context,
        root,
        cached.currentBranch,
        true,
      );
      const summaryWithCheckpoint = applyCheckpointNoteToSummary(
        cached,
        checkpointContext.primaryNote,
      );

      await presentSummary(context, summaryWithCheckpoint, 'cached', {
        autoOpenDetails: true,
        workspaceRoot: root,
        checkpointPrimaryNote: checkpointContext.primaryNote,
        checkpointNotes: checkpointContext.notes,
        checkpointScope: checkpointContext.scope,
      });
    }),
    vscode.commands.registerCommand('tacos.generateStandupUpdate', async () => {
      await generateStandupUpdateCommand(context);
    }),
    vscode.commands.registerCommand('tacos.restoreWorkingSet', async () => {
      await restoreWorkingSetCommand(context);
    }),
    vscode.commands.registerCommand('tacos.captureRestoreSearchQuery', async () => {
      await captureRestoreSearchQuery(context);
    }),
    vscode.commands.registerCommand('tacos.switchTaskPartition', async () => {
      await switchTaskPartition(context);
    }),
    vscode.commands.registerCommand('tacos.jumpToLastEdit', async () => {
      await jumpToRecentEdit(context);
    }),
    vscode.commands.registerCommand('tacos.setPrivacyPreset', async () => {
      await promptAndApplyPrivacyPreset(context);
    }),
    vscode.commands.registerCommand('tacos.setRetentionPolicy', async () => {
      await promptAndSetRetentionPolicy(context);
    }),
    vscode.commands.registerCommand('tacos.openSetupChecklist', async () => {
      await runSetupChecklist(context);
    }),
    vscode.commands.registerCommand('tacos.showDemoResumeCard', async () => {
      await showDemoResumeCard(context);
    }),
    vscode.commands.registerCommand('tacos.resetSetupChecklist', async () => {
      await resetSetupChecklist(context);
    }),
    vscode.commands.registerCommand('tacos.forgetWorkspaceNow', async () => {
      await forgetWorkspaceNow(context);
    }),
    vscode.commands.registerCommand('tacos.revokeAiPayloadConsent', async () => {
      await revokeAiPayloadConsent(context);
    }),
    vscode.commands.registerCommand('tacos.rateSummaryHelpfulness', async () => {
      await promptSummaryHelpfulnessRating();
    }),
    vscode.commands.registerCommand('tacos.pauseSummaries', async () => {
      state.pauseUntilRestart = false;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      await setPaused(true);
      recordMetricCounter('pauseActions');
      updateCompanionStatusBar();
      void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
    }),
    vscode.commands.registerCommand('tacos.snoozeAutoSummaries', async () => {
      await promptAndSetAutoSummarySnooze(context);
    }),
    vscode.commands.registerCommand('tacos.quietNow', async () => {
      await quietNowSummariesForOneHour(context);
    }),
    vscode.commands.registerCommand('tacos.configureSummaryQuietHours', async () => {
      await promptAndConfigureSummaryQuietHours(context);
    }),
    vscode.commands.registerCommand('tacos.resumeSummaries', async () => {
      state.pauseUntilRestart = false;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      await setSummaryQuietUntil(context, 0);
      await setPaused(false);
      updateCompanionStatusBar();
      void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
    }),
    vscode.commands.registerCommand('tacos.toggleEnabled', async () => {
      const config = getConfig();
      await setEnabled(!config.enabled);
      if (config.enabled) {
        recordMetricCounter('disableActions');
      }
      void vscode.window.showInformationMessage(
        !config.enabled
          ? 'TaCoS: automatic summaries enabled.'
          : 'TaCoS: automatic summaries disabled.',
      );
    }),
    vscode.commands.registerCommand('tacos.pauseUntilRestart', async () => {
      state.pauseUntilRestart = true;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      recordMetricCounter('snoozeActions');
      updateCompanionStatusBar();
      rerenderPanel();
      void vscode.window.showInformationMessage('TaCoS: summaries paused until VS Code restarts.');
    }),
    vscode.commands.registerCommand('tacos.addVisitedUrl', async () => {
      const value = await vscode.window.showInputBox({
        title: 'TaCoS: Add URL',
        prompt: 'Add a recent issue/PR/docs URL to include in summaries',
        placeHolder: 'https://...',
        validateInput: (input) => {
          if (!input.trim()) {
            return 'URL is required.';
          }

          try {
            const parsed = new URL(input.trim());
            if (!/^https?:$/.test(parsed.protocol)) {
              return 'URL must use http or https.';
            }
            return null;
          } catch {
            return 'Enter a valid URL.';
          }
        },
      });

      if (!value) {
        return;
      }

      state.recentUrls.push(value.trim());
      markMeaningfulActivity();
      await persistActivity(context);
      void vscode.window.showInformationMessage('TaCoS: URL added to recent context.');
    }),
    vscode.commands.registerCommand('tacos.addCheckpointNote', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }
      const saved = await promptAndSaveCheckpointNote(context, root);
      if (saved) {
        await refreshPanelCheckpointState(context, root);
        rerenderPanel();
      }
    }),
    vscode.commands.registerCommand('tacos.addCheckpointNoteFromClipboard', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }
      const saved = await saveCheckpointNoteFromClipboard(context, root, {
        successMessage: 'TaCoS: checkpoint note saved from clipboard.',
      });
      if (saved) {
        await refreshPanelCheckpointState(context, root);
        rerenderPanel();
      }
    }),
    vscode.commands.registerCommand('tacos.addCheckpointFromSelection', async () => {
      await addCheckpointFromSelectionCommand(context);
    }),
    vscode.commands.registerCommand('tacos.addQuickCheckpointNote', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const saved = await saveCheckpointNoteFromClipboard(context, root, {
        successMessage: 'TaCoS: quick checkpoint saved.',
        noPrompt: true,
      });
      if (saved) {
        await refreshPanelCheckpointState(context, root);
        rerenderPanel();
      }
    }),
    vscode.commands.registerCommand('tacos.listCheckpointNotes', async () => {
      await listCheckpointNotesCommand(context);
    }),
    vscode.commands.registerCommand('tacos.clearCheckpointNote', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const cleared = await clearCheckpointNotesInScope(context, root);
      void vscode.window.showInformationMessage(
        cleared > 0
          ? `TaCoS: cleared ${cleared} checkpoint note${cleared === 1 ? '' : 's'} in this task scope.`
          : 'TaCoS: no checkpoint notes found in this task scope.',
      );
    }),
    vscode.commands.registerCommand('tacos.openScratchpad', async () => {
      await openScratchpadCommand(context);
    }),
    vscode.commands.registerCommand('tacos.appendToScratchpad', async () => {
      await appendToScratchpadCommand(context);
    }),
    vscode.commands.registerCommand('tacos.setScratchpadScope', async () => {
      await setScratchpadScopeCommand(context);
    }),
    vscode.commands.registerCommand('tacos.configureAiProvider', async () => {
      await configureAiProvider(context);
    }),
    vscode.commands.registerCommand('tacos.openPrivacySafety', async () => {
      await openPrivacySafetyDoc(context);
    }),
    vscode.commands.registerCommand('tacos.clearCorrections', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      await clearSummaryCorrections(context, root);
      void vscode.window.showInformationMessage(
        'TaCoS: saved summary corrections cleared for this workspace.',
      );
    }),
    vscode.commands.registerCommand('tacos.setOpenAiApiKey', async () => {
      const value = await vscode.window.showInputBox({
        title: 'TaCoS: Set OpenAI API Key',
        prompt: 'Enter your OpenAI API key. It will be stored in VS Code Secret Storage.',
        password: true,
        ignoreFocusOut: true,
      });

      if (!value) {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        void vscode.window.showWarningMessage('TaCoS: API key was empty, nothing was saved.');
        return;
      }

      await context.secrets.store(SECRET_OPENAI_API_KEY, trimmed);
      void vscode.window.showInformationMessage('TaCoS: OpenAI API key saved securely.');
    }),
    vscode.commands.registerCommand('tacos.clearOpenAiApiKey', async () => {
      await context.secrets.delete(SECRET_OPENAI_API_KEY);
      void vscode.window.showInformationMessage('TaCoS: stored OpenAI API key cleared.');
    }),
    vscode.commands.registerCommand('tacos.exportMetrics', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const metrics = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
      const outputDir = path.join(root, '.tacos');
      const jsonPath = path.join(outputDir, 'metrics.json');
      const csvPath = path.join(outputDir, 'metrics.csv');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(jsonPath, JSON.stringify(metrics, null, 2), 'utf8');
      await fs.writeFile(csvPath, buildMetricsCsv(metrics), 'utf8');
      void vscode.window.showInformationMessage(
        `TaCoS: exported metrics to ${jsonPath} and ${csvPath}.`,
      );
    }),
    vscode.commands.registerCommand('tacos.copyMetricsBaselineSnapshot', async () => {
      await copyMetricsBaselineSnapshot(context);
    }),
    vscode.commands.registerCommand('tacos.copyDiagnostics', async () => {
      await copyDiagnosticsBundle(context);
    }),
    vscode.commands.registerCommand('tacos.testSanitizer', async () => {
      await testSanitizerCommand();
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      const uri = editor?.document?.uri;
      if (!uri || uri.scheme !== 'file') {
        return;
      }

      const root = pickWorkspaceRoot();
      const relative = root ? toRelativePath(uri.fsPath, root) : uri.fsPath;
      state.recentFiles.push(relative);
      markMeaningfulActivity();
      await persistActivity(context);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.uri.scheme === 'file') {
        markBoundarySignal();
        markMeaningfulActivity();
      }

      if (!state.panel) {
        return;
      }

      const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
      if (!workspaceRoot) {
        return;
      }

      const { uri } = resolveScratchpadFileUri(
        context,
        workspaceRoot,
        state.panelSummary?.currentBranch,
      );
      if (document.uri.toString() !== uri.toString()) {
        return;
      }

      await refreshPanelScratchpadState(context, workspaceRoot);
      rerenderPanel();
    }),
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(async (session) => {
      const label = session?.name ? `${session.type}: ${session.name}` : session.type;
      if (label) {
        recordFirstActionLag();
        state.recentDebug.push(label);
        state.lastDebugConfigName = session.name;
        state.lastDebugWorkspaceRoot = session.workspaceFolder?.uri.fsPath;
        markMeaningfulActivity();
        await persistActivity(context);
      }
    }),
  );

  context.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession(async () => {
      markBoundarySignal();
      markMeaningfulActivity();
      await persistActivity(context);
    }),
  );

  context.subscriptions.push(
    vscode.tasks.onDidStartTaskProcess((event) => {
      const task = event.execution.task;
      recordFirstActionLag();
      state.lastTaskName = task.name;
      state.lastTaskWorkspaceRoot = pickWorkspaceRoot(taskWorkspaceRoot(task));
      markMeaningfulActivity();
    }),
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess(async (event) => {
      const task = event.execution.task;
      const exitCode = typeof event.exitCode === 'number' ? event.exitCode : undefined;
      state.lastTaskName = task.name;
      state.lastTaskWorkspaceRoot = pickWorkspaceRoot(taskWorkspaceRoot(task));
      if (typeof exitCode === 'number') {
        state.lastTaskExitCode = exitCode;
        state.lastTaskEndedAt = Date.now();
      }

      markBoundarySignal();
      markMeaningfulActivity();
      await persistTaskMetadata(context);
      rerenderPanel();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const hasMeaningfulChange = isMeaningfulChange(event.contentChanges);
      const decision = decideEditActivity({
        documentScheme: event.document.uri.scheme,
        hasMeaningfulChange,
        hasMetricSession: Boolean(state.metricSession),
        hasCapturedFirstMeaningfulEdit: state.metricSession?.firstMeaningfulEditLagMs !== undefined,
      });
      if (!decision.shouldMarkMeaningfulActivity) {
        return;
      }

      const workspaceRoot = pickWorkspaceRoot(
        vscode.workspace.getWorkspaceFolder(event.document.uri)?.uri.fsPath,
      );
      const relativePath = workspaceRoot
        ? toRelativePath(event.document.uri.fsPath, workspaceRoot)
        : event.document.uri.fsPath;
      const lastChange = event.contentChanges[event.contentChanges.length - 1];
      const activeSelection =
        vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.uri.toString() === event.document.uri.toString()
          ? vscode.window.activeTextEditor.selection.active
          : undefined;
      const location = captureEditLocation({
        documentScheme: event.document.uri.scheme,
        hasMeaningfulChange,
        relativePath,
        now: Date.now(),
        fallbackLine: lastChange?.range.start.line ?? 0,
        fallbackCharacter: lastChange?.range.start.character ?? 0,
        selectionLine: activeSelection?.line,
        selectionCharacter: activeSelection?.character,
      });
      if (location) {
        state.recentEditLocations = pushRecentEditLocation(state.recentEditLocations, location, 15);
        await persistRecentEditLocations(context, workspaceRoot);
      }

      markMeaningfulActivity();
      if (!decision.shouldCaptureMetricLag || !state.metricSession) {
        return;
      }

      state.metricSession.firstMeaningfulEditLagMs = Date.now() - state.metricSession.startedAt;
      await maybeFinalizeMetric(context);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      const affectsPanel =
        event.affectsConfiguration('tacos.enabled') ||
        event.affectsConfiguration('tacos.pauseSummaries') ||
        event.affectsConfiguration('tacos.showTimeline');
      const affectsNudges =
        event.affectsConfiguration('tacos.companionNudgesEnabled') ||
        event.affectsConfiguration('tacos.companionNudgeAggressiveness') ||
        event.affectsConfiguration('tacos.companionNudgeQuietHours') ||
        event.affectsConfiguration('tacos.companionNudgeCooldownMinutes');
      const affectsRedactionPatterns = event.affectsConfiguration('tacos.redactionPatterns');
      const affectsPrivacyPreset = event.affectsConfiguration('tacos.privacyPreset');
      const affectsRetention = event.affectsConfiguration('tacos.retentionPolicy');
      const affectsStatus =
        affectsPanel ||
        event.affectsConfiguration('tacos.summaryProvider') ||
        event.affectsConfiguration('tacos.uiSurface') ||
        event.affectsConfiguration('tacos.summaryQuietHours') ||
        event.affectsConfiguration('tacos.autoRefreshInBackground') ||
        affectsNudges;

      if (affectsPrivacyPreset && !state.applyingPrivacyPreset) {
        await applyPrivacyPreset(getConfig().privacyPreset, context);
      }

      if (affectsRetention) {
        await applyRetentionPolicy(context, pickWorkspaceRoot() ?? '');
      }

      if (affectsRedactionPatterns) {
        maybeWarnRedactionPatternGuardrails(getConfig().redactionPatterns);
      }

      if (affectsNudges && state.scratchSummary) {
        await updateActiveNudges(
          context,
          state.scratchSummary,
          pickWorkspaceRoot(state.panelWorkspaceRoot),
          getConfig(),
          state.lastSummaryContextUnchanged,
        );
      }

      if (affectsPanel || affectsNudges) {
        rerenderPanel();
      }
      if (affectsStatus) {
        updateCompanionStatusBar();
      }

      if (!affectsPanel && !affectsStatus && !affectsRetention && !affectsPrivacyPreset) {
        return;
      }
    }),
  );

  void applyWorkspaceTrust(context, vscode.workspace.isTrusted, true);

  const workspaceAny = vscode.workspace as typeof vscode.workspace & {
    onDidChangeWorkspaceTrust?: (
      listener: (event: { isTrusted: boolean }) => unknown,
    ) => vscode.Disposable;
  };

  if (workspaceAny.onDidChangeWorkspaceTrust) {
    context.subscriptions.push(
      workspaceAny.onDidChangeWorkspaceTrust((event: { isTrusted: boolean }) => {
        void applyWorkspaceTrust(context, event.isTrusted, false);
      }),
    );
  } else {
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        void applyWorkspaceTrust(context, true, false);
      }),
    );
  }
  context.subscriptions.push({
    dispose: () => {
      clearTerminalHooks();
    },
  });

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(async (windowState) => {
      const now = Date.now();
      if (!windowState.focused) {
        const workspaceRoot = pickWorkspaceRoot() ?? '';
        await context.workspaceState.update(KEY_LAST_BLUR_AT, now);
        await context.workspaceState.update(KEY_LAST_WORKSPACE_ON_BLUR, workspaceRoot);
        await maybePromptCheckpointOnBlur(context, now, workspaceRoot || undefined);
        return;
      }
      state.lastFocusGainedAt = now;
      await handleFocusRegainSummaryTrigger(context, now);
    }),
  );

  void maybeShowOnboardingNotice(context);
  updateCompanionStatusBar();
  state.output.appendLine('TaCoS activated.');
}

export function deactivate(): void {
  activeExtensionContext = undefined;
}

function monotonicNowNs(): bigint {
  return process.hrtime.bigint();
}

function durationMsSince(startNs: bigint): number {
  return Number(process.hrtime.bigint() - startNs) / 1_000_000;
}

function recordPerformanceGuardrail(
  label: string,
  counter: PerformanceCounter,
  durationMs: number,
  thresholdMs: number,
  details?: string,
): void {
  const sample = recordPerformanceSample(counter, durationMs, {
    slowThresholdMs: thresholdMs,
    warnCooldownMs: PERF_WARN_COOLDOWN_MS,
  });
  if (!sample.shouldWarn) {
    return;
  }

  const detailsSuffix = details ? `; ${details}` : '';
  state.output.appendLine(
    `TaCoS perf: ${label} slow-path ${sample.durationMs.toFixed(1)}ms (avg ${sample.averageDurationMs.toFixed(1)}ms, threshold ${thresholdMs}ms)${detailsSuffix}.`,
  );
}

async function handleFocusRegainSummaryTrigger(
  context: vscode.ExtensionContext,
  now: number,
): Promise<void> {
  const focusHandlingStartNs = monotonicNowNs();
  let outcome = 'unknown';
  let uiSurfaceLabel = getConfig().uiSurface;

  try {
    if (
      state.autoSummaryInFlight ||
      now - state.lastAutoFocusTriggerAt < FOCUS_TRIGGER_DEBOUNCE_MS
    ) {
      outcome = 'debounced';
      return;
    }

    const config = getConfig();
    uiSurfaceLabel = config.uiSurface;
    if (
      !config.enabled ||
      state.pauseUntilRestart ||
      !config.showOnFocus ||
      config.pauseSummaries
    ) {
      outcome = 'disabled-or-paused';
      return;
    }

    await clearExpiredSnoozeIfNeeded(context, now);
    await clearExpiredSummaryQuietIfNeeded(context, now);
    if (state.snoozeUntil > now) {
      outcome = 'snoozed';
      return;
    }

    if (resolveSummaryQuietState(now, config.summaryQuietHours).active) {
      outcome = 'quiet-hours';
      return;
    }

    const root = pickWorkspaceRoot();
    if (!root) {
      outcome = 'no-workspace';
      return;
    }

    const lastBlurAt = context.workspaceState.get<number>(KEY_LAST_BLUR_AT, now);
    const lastWorkspaceOnBlur = context.workspaceState.get<string>(KEY_LAST_WORKSPACE_ON_BLUR, '');
    const projectSwitched = Boolean(lastWorkspaceOnBlur) && lastWorkspaceOnBlur !== root;
    const lastSummaryAt = context.workspaceState.get<number>(KEY_LAST_SUMMARY_AT, 0);
    const fingerprint = computeAutoTriggerFingerprint(root);
    const lastFingerprint = context.workspaceState.get<string>(
      autoTriggerFingerprintKey(context, root),
      '',
    );
    const significantChange = fingerprint !== lastFingerprint;

    const shouldTrigger = shouldAutoTriggerSummary({
      now,
      lastBlurAt,
      lastSummaryAt,
      minIdleMinutes: config.minIdleMinutes,
      cooldownMinutes: config.cooldownMinutes,
      projectSwitched,
      significantChange,
      lastBoundarySignalAt: state.lastBoundarySignalAt,
      boundaryWindowMs: FOCUS_BOUNDARY_WINDOW_MS,
      maxDeferralWithoutBoundaryMs: FOCUS_MAX_DEFERRAL_WITHOUT_BOUNDARY_MS,
    });
    if (!shouldTrigger) {
      outcome = 'gated';
      return;
    }

    outcome = 'triggered';
    state.lastAutoFocusTriggerAt = now;
    state.autoSummaryInFlight = true;
    const focusSummaryStartNs = monotonicNowNs();
    try {
      let deferPromptToBackground = false;
      if (config.uiSurface === 'notification') {
        await delay(FOCUS_TYPING_DEFERRAL_GRACE_MS);
        if (!vscode.window.state.focused) {
          outcome = 'blurred-during-deferral';
          return;
        }
        deferPromptToBackground = shouldDeferPromptAfterFocusRegain({
          focusGainedAt: now,
          observedAt: Date.now(),
          lastMeaningfulActivityAt: state.lastMeaningfulActivityAt,
          graceWindowMs: FOCUS_TYPING_DEFERRAL_GRACE_MS,
        });
      }

      const summaryTriggered = await triggerSummary(
        context,
        'focus',
        undefined,
        deferPromptToBackground,
        now,
      );
      if (summaryTriggered) {
        await context.workspaceState.update(autoTriggerFingerprintKey(context, root), fingerprint);
      } else {
        outcome = 'trigger-aborted';
      }
    } finally {
      state.autoSummaryInFlight = false;
      recordPerformanceGuardrail(
        'focus-summary',
        state.perfFocusSummary,
        durationMsSince(focusSummaryStartNs),
        PERF_FOCUS_SUMMARY_SLOW_MS,
        `uiSurface=${uiSurfaceLabel}`,
      );
    }
  } finally {
    recordPerformanceGuardrail(
      'focus-handling',
      state.perfFocusHandling,
      durationMsSince(focusHandlingStartNs),
      PERF_FOCUS_HANDLING_SLOW_MS,
      `outcome=${outcome}; uiSurface=${uiSurfaceLabel}`,
    );
  }
}

function registerTerminalHooks(context: vscode.ExtensionContext): vscode.Disposable[] {
  const windowAny = vscode.window as unknown as {
    onDidStartTerminalShellExecution?: (listener: (event: any) => unknown) => vscode.Disposable;
    onDidEndTerminalShellExecution?: (listener: (event: any) => unknown) => vscode.Disposable;
  };

  if (!windowAny.onDidStartTerminalShellExecution || !windowAny.onDidEndTerminalShellExecution) {
    state.output.appendLine(
      'Terminal shell integration events are unavailable in this VS Code build.',
    );
    return [];
  }

  const startDisposable = windowAny.onDidStartTerminalShellExecution(async (event: any) => {
    if (!vscode.workspace.isTrusted) {
      return;
    }

    const command = String(event?.execution?.commandLine?.value ?? '').trim();
    if (!command) {
      return;
    }

    const config = getConfig();
    const workspaceRoot = pickWorkspaceRoot() ?? '';
    const sanitizedCommand = persistTerminalCommandForStorage(
      command,
      workspaceRoot,
      config.redactionPatterns,
    );
    const rawCwd = String(event?.execution?.cwd?.value ?? event?.execution?.cwd ?? '').trim();
    if (workspaceRoot && rawCwd && isPathWithinWorkspaceRoot(workspaceRoot, rawCwd)) {
      state.lastTerminalCwd = toRelativePath(rawCwd, workspaceRoot);
      await persistTerminalCwd(context, workspaceRoot);
    }
    if (config.includeTerminalHistory) {
      state.recentTerminal.push(sanitizedCommand);
      for (const url of extractUrls(command)) {
        state.recentUrls.push(url);
      }
    }
    markMeaningfulActivity();

    if (
      isTestOrBuildCommand(command) &&
      state.metricSession &&
      state.metricSession.firstRunLagMs === undefined
    ) {
      recordFirstActionLag();
      state.metricSession.firstRunLagMs = Date.now() - state.metricSession.startedAt;
      await maybeFinalizeMetric(context);
    }

    await persistActivity(context);
  });
  const endDisposable = windowAny.onDidEndTerminalShellExecution(async (event: any) => {
    if (!vscode.workspace.isTrusted) {
      return;
    }

    const command = String(event?.execution?.commandLine?.value ?? '').trim();
    const exitCode: number | undefined = event?.exitCode;
    if (!command) {
      return;
    }
    const config = getConfig();
    const workspaceRoot = pickWorkspaceRoot() ?? '';
    const sanitizedCommand = persistTerminalCommandForStorage(
      command,
      workspaceRoot,
      config.redactionPatterns,
    );
    const testOrBuildCommand = isTestOrBuildCommand(command);
    if (typeof exitCode === 'number' && testOrBuildCommand) {
      markBoundarySignal();
      markMeaningfulActivity();
    }

    if (
      config.includeTerminalHistory &&
      typeof exitCode === 'number' &&
      exitCode !== 0 &&
      testOrBuildCommand
    ) {
      state.lastFailingCommandRaw = command;
      state.lastFailingCommand = sanitizedCommand;
      await persistActivity(context);
    }

    if (
      config.includeTerminalHistory &&
      typeof exitCode === 'number' &&
      exitCode === 0 &&
      testOrBuildCommand
    ) {
      state.doneItems.push(sanitizedCommand);

      if (
        state.lastFailingCommand &&
        doesCommandMatchStoredFailure(state.lastFailingCommand, command)
      ) {
        state.lastFailingCommand = undefined;
        state.lastFailingCommandRaw = undefined;
      }

      await persistActivity(context);
    }
  });
  return [startDisposable, endDisposable];
}

function clearTerminalHooks(): void {
  for (const disposable of state.terminalHooks) {
    disposable.dispose();
  }
  state.terminalHooks = [];
}

async function applyWorkspaceTrust(
  context: vscode.ExtensionContext,
  isTrusted: boolean,
  initial: boolean,
): Promise<void> {
  state.workspaceTrusted = isTrusted;
  updateCompanionStatusBar();

  clearTerminalHooks();
  if (isTrusted) {
    state.terminalHooks = registerTerminalHooks(context);
    updateCompanionStatusBar();
    if (!initial) {
      void vscode.window.showInformationMessage(
        'TaCoS: workspace is trusted. Full context collection is enabled.',
      );
    }
    return;
  }

  const alreadyShown = context.workspaceState.get<boolean>(KEY_RESTRICTED_MODE_NOTICE_SHOWN, false);
  if (!alreadyShown) {
    await context.workspaceState.update(KEY_RESTRICTED_MODE_NOTICE_SHOWN, true);
    void vscode.window.showInformationMessage(
      'TaCoS: Restricted Mode is active. Git commands and terminal command collection are disabled until you trust this workspace.',
    );
  } else if (!initial) {
    void vscode.window.showInformationMessage(
      'TaCoS: Restricted Mode is active. Git and terminal command collection are currently disabled.',
    );
  }
  updateCompanionStatusBar();
}

async function triggerSummary(
  context: vscode.ExtensionContext,
  reason: Exclude<TriggerReason, 'cached'>,
  preferredWorkspaceRoot?: string,
  deferPromptToBackground = false,
  focusRegainedAt?: number,
): Promise<boolean> {
  const root = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!root) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return false;
  }

  state.activeRefinementSequence = undefined;
  state.activeRefinementContextHash = undefined;
  const prepared = await prepareTriggerSummary(context, root, reason);

  await context.workspaceState.update(KEY_LAST_SUMMARY_AT, Date.now());
  await touchWorkspaceActivity(context, root);

  await presentSummary(context, prepared.summary, prepared.triggerReason, {
    autoOpenDetails: reason === 'manual',
    preferBackgroundPresentation: reason === 'focus' && deferPromptToBackground,
    focusRegainedAt: reason === 'focus' ? focusRegainedAt : undefined,
    workspaceRoot: root,
    checkpointPrimaryNote: prepared.checkpointPrimaryNote,
    checkpointNotes: prepared.checkpointNotes,
    checkpointScope: prepared.checkpointScope,
  });
  state.meaningfulActivitySinceCheckpointPrompt = false;

  if (prepared.shouldRefineWithAi) {
    void refineSummaryInBackground(context, prepared);
  }

  return true;
}

interface ProviderPlan {
  requestedProvider: SummaryProvider;
  activeProvider: SummaryProvider;
  openAiApiKey?: string;
  vscodeLmModel?: VscodeLmModelLike;
}

interface PreparedTriggerSummary {
  root: string;
  cacheKey: string;
  triggerReason: TriggerReason;
  summary: ResumeSummary;
  localSummary: ResumeSummary;
  aiPayloadSummary: ResumeSummary;
  aiPayloadCheckpointNotes: string[];
  aiPayloadScratchpadExcerpt?: string;
  checkpointNotes: CheckpointNote[];
  checkpointPrimaryNote?: CheckpointNote;
  checkpointScope: string;
  signals: ResumeSignals;
  config: ExtensionConfig;
  providerPlan: ProviderPlan;
  shouldRefineWithAi: boolean;
}

async function applyBranchHistory(
  context: vscode.ExtensionContext,
  root: string,
  summary: ResumeSummary,
): Promise<ResumeSummary> {
  const previousBranch = context.workspaceState.get<string>(branchStateKey(root));
  if (summary.currentBranch && previousBranch && summary.currentBranch !== previousBranch) {
    summary.previousBranch = previousBranch;
  }

  if (summary.currentBranch) {
    await context.workspaceState.update(branchStateKey(root), summary.currentBranch);
  }

  return summary;
}

async function prepareTriggerSummary(
  context: vscode.ExtensionContext,
  root: string,
  reason: Exclude<TriggerReason, 'cached'>,
): Promise<PreparedTriggerSummary> {
  const config = getConfig();
  const providerPlan = await resolveProviderPlan(context, config, reason);
  const resumeGapMinutes = computeResumeGapMinutes(context, root);
  const signals = await collectSignals(root, config);
  signals.resumeGapMinutes = resumeGapMinutes;
  const inferredSummary = await applyBranchHistory(
    context,
    root,
    buildResumeSummary(signals, { longGapMinutes: config.longGapMinutes }),
  );
  const intentOverride = readIntentOverrideForContext(context, root, inferredSummary.contextHash);
  const baseSummary = applyIntentOverrideToSummary(inferredSummary, intentOverride);
  const checkpointContext = await resolveCheckpointContext(
    context,
    root,
    baseSummary.currentBranch,
    true,
  );
  const localSummary = applyCheckpointNoteToSummary(baseSummary, checkpointContext.primaryNote);
  const aiPayloadCheckpointNotes =
    config.aiIncludeCheckpointNotes && checkpointContext.primaryNote?.status === 'open'
      ? [checkpointContext.primaryNote.text]
      : [];
  const aiPayloadScratchpadExcerpt = config.aiIncludeScratchpad
    ? await loadScratchpadExcerptForAi(context, root, baseSummary.currentBranch)
    : undefined;
  let aiPayloadSummary =
    aiPayloadCheckpointNotes.length > 0
      ? localSummary
      : { ...baseSummary, links: [...baseSummary.links] };
  if (aiPayloadScratchpadExcerpt) {
    aiPayloadSummary = applyScratchpadExcerptToSummary(
      aiPayloadSummary,
      aiPayloadScratchpadExcerpt,
    );
  }
  const corrections = getSummaryCorrectionsForContext(context, root, baseSummary.contextHash);
  const correctionsFingerprint = summarizeCorrectionsFingerprint(corrections);
  localSummary.userCorrections = corrections;
  localSummary.correctionsFingerprint = correctionsFingerprint;
  aiPayloadSummary.userCorrections = corrections;
  aiPayloadSummary.correctionsFingerprint = correctionsFingerprint;
  const cacheKey = summaryCacheKey(context, root);
  const cached = context.workspaceState.get<ResumeSummary>(cacheKey);
  const correctionsUnchanged =
    (cached?.correctionsFingerprint ?? '') === (localSummary.correctionsFingerprint ?? '');
  const checkpointUnchanged =
    (cached?.recommendedFirstAction ?? '') === (localSummary.recommendedFirstAction ?? '');
  const intentUnchanged =
    (cached?.intent ?? '') === localSummary.intent &&
    Boolean(cached?.intentOverridden) === Boolean(localSummary.intentOverridden);
  const providerCompatibleWithCache =
    !cached || providerPlan.activeProvider !== 'local' || cached.source === 'local';
  const contextUnchanged =
    config.cacheIfContextUnchanged &&
    Boolean(cached) &&
    cached?.contextHash === localSummary.contextHash &&
    correctionsUnchanged &&
    checkpointUnchanged &&
    intentUnchanged &&
    providerCompatibleWithCache;

  if (!contextUnchanged) {
    await context.workspaceState.update(cacheKey, localSummary);
  }

  const summary = contextUnchanged && cached ? cached : localSummary;
  const shouldRefineWithAi =
    providerPlan.activeProvider !== 'local' && summary.source !== providerPlan.activeProvider;

  return {
    root,
    cacheKey,
    triggerReason: contextUnchanged && cached ? 'cached' : reason,
    summary,
    localSummary,
    aiPayloadSummary,
    aiPayloadCheckpointNotes,
    aiPayloadScratchpadExcerpt,
    checkpointNotes: checkpointContext.notes,
    checkpointPrimaryNote: checkpointContext.primaryNote,
    checkpointScope: checkpointContext.scope,
    signals,
    config,
    providerPlan,
    shouldRefineWithAi,
  };
}

async function refineSummaryInBackground(
  context: vscode.ExtensionContext,
  prepared: PreparedTriggerSummary,
): Promise<void> {
  const sequence = state.refinementSequence + 1;
  state.refinementSequence = sequence;
  state.activeRefinementSequence = sequence;
  state.activeRefinementContextHash = prepared.localSummary.contextHash;
  rerenderPanel();

  const hasConsent = await ensureAiPayloadConsent(context, prepared);
  if (!hasConsent) {
    if (state.activeRefinementSequence === sequence) {
      state.activeRefinementSequence = undefined;
      state.activeRefinementContextHash = undefined;
      rerenderPanel();
    }
    void vscode.window.showInformationMessage(
      'TaCoS: AI refinement skipped because payload send was not approved.',
    );
    return;
  }

  let refined: ResumeSummary | undefined;
  try {
    refined = await generateAiSummary(prepared);
  } catch (error) {
    state.output.appendLine(`TaCoS: AI refinement failed: ${(error as Error).message}`);
    refined = undefined;
  }

  if (!refined) {
    if (state.activeRefinementSequence === sequence) {
      state.activeRefinementSequence = undefined;
      state.activeRefinementContextHash = undefined;
      rerenderPanel();
    }
    return;
  }
  refined = applyCheckpointNoteToSummary(refined, prepared.checkpointPrimaryNote);
  refined = applyIntentOverrideToSummary(
    refined,
    prepared.localSummary.intentOverridden ? prepared.localSummary.intent : undefined,
  );

  if (state.activeRefinementSequence !== sequence) {
    return;
  }
  state.activeRefinementSequence = undefined;
  state.activeRefinementContextHash = undefined;

  await context.workspaceState.update(prepared.cacheKey, refined);

  if (state.scratchSummary?.contextHash === prepared.localSummary.contextHash) {
    updateSummaryScratchpad(refined, prepared.root);
    return;
  }

  void vscode.window.showInformationMessage('TaCoS: refined summary is ready.');
}

async function generateSummary(
  context: vscode.ExtensionContext,
  root: string,
  reason: Exclude<TriggerReason, 'cached'>,
): Promise<{ summary: ResumeSummary; triggerReason: TriggerReason }> {
  const prepared = await prepareTriggerSummary(context, root, reason);
  if (!prepared.shouldRefineWithAi) {
    return {
      summary: prepared.summary,
      triggerReason: prepared.triggerReason,
    };
  }

  const hasConsent = await ensureAiPayloadConsent(context, prepared);
  if (!hasConsent) {
    return {
      summary: prepared.summary,
      triggerReason: prepared.triggerReason,
    };
  }

  const refined = await generateAiSummary(prepared);
  if (!refined) {
    return {
      summary: prepared.summary,
      triggerReason: prepared.triggerReason,
    };
  }

  const refinedWithCheckpoint = applyCheckpointNoteToSummary(
    refined,
    prepared.checkpointPrimaryNote,
  );
  const refinedWithIntentOverride = applyIntentOverrideToSummary(
    refinedWithCheckpoint,
    prepared.localSummary.intentOverridden ? prepared.localSummary.intent : undefined,
  );

  await context.workspaceState.update(prepared.cacheKey, refinedWithIntentOverride);
  return {
    summary: refinedWithIntentOverride,
    triggerReason: prepared.triggerReason,
  };
}

async function resolveProviderPlan(
  context: vscode.ExtensionContext,
  config: ExtensionConfig,
  reason: Exclude<TriggerReason, 'cached'>,
): Promise<ProviderPlan> {
  const requestedProvider = config.summaryProvider;

  if (!state.workspaceTrusted || !vscode.workspace.isTrusted) {
    if (requestedProvider !== 'local' && reason === 'manual') {
      void vscode.window.showInformationMessage(
        'TaCoS: AI refinement is disabled in Restricted Mode. Trust this workspace to enable AI providers.',
      );
    }
    return {
      requestedProvider,
      activeProvider: 'local',
    };
  }

  if (requestedProvider === 'local') {
    return {
      requestedProvider,
      activeProvider: 'local',
    };
  }

  if (requestedProvider === 'openai') {
    const openAiApiKey = await resolveOpenAiApiKey(context);
    if (openAiApiKey) {
      return {
        requestedProvider,
        activeProvider: 'openai',
        openAiApiKey,
      };
    }

    return {
      requestedProvider,
      activeProvider: 'local',
    };
  }

  // `selectChatModels` must only run from a user-initiated action.
  if (reason === 'manual' && !state.vscodeLmModel && state.vscodeLmSelector) {
    const restored = await restoreVscodeLmModelFromSelector(context);
    if (restored) {
      state.output.appendLine(`TaCoS: restored VS Code LM model (${modelLabel(restored)}).`);
    }
  }

  if (state.vscodeLmModel) {
    return {
      requestedProvider,
      activeProvider: 'vscode-lm',
      vscodeLmModel: state.vscodeLmModel,
    };
  }

  if (reason === 'manual') {
    const action = await vscode.window.showInformationMessage(
      'TaCoS: VS Code LM is configured but not available in this session. Run "TaCoS: Configure AI Provider" to re-select a model.',
      'Configure AI Provider',
    );
    if (action === 'Configure AI Provider') {
      await vscode.commands.executeCommand('tacos.configureAiProvider');
    }
  } else if (!state.vscodeLmUnavailableNotified) {
    state.vscodeLmUnavailableNotified = true;
    state.output.appendLine(
      'TaCoS: VS Code LM is configured but unavailable for auto summaries in this session; falling back to local.',
    );
  }

  return {
    requestedProvider,
    activeProvider: 'local',
  };
}

async function generateAiSummary(
  prepared: PreparedTriggerSummary,
): Promise<ResumeSummary | undefined> {
  const log = (message: string): void => {
    state.output.appendLine(message);
  };

  if (prepared.providerPlan.activeProvider === 'openai') {
    return tryGenerateOpenAiSummary(
      prepared.signals,
      prepared.aiPayloadSummary,
      prepared.config,
      prepared.providerPlan.openAiApiKey ?? '',
      log,
    );
  }

  if (prepared.providerPlan.activeProvider === 'vscode-lm' && prepared.providerPlan.vscodeLmModel) {
    return tryGenerateVscodeLmSummary(
      prepared.signals,
      prepared.aiPayloadSummary,
      prepared.providerPlan.vscodeLmModel,
      prepared.config.redactionPatterns,
      log,
    );
  }

  return undefined;
}

async function presentSummary(
  context: vscode.ExtensionContext,
  summary: ResumeSummary,
  triggerReason: TriggerReason,
  options: PresentSummaryOptions = {},
): Promise<void> {
  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot(options.workspaceRoot);
  state.lastSummaryContextUnchanged = triggerReason === 'cached';

  if (config.metricsEnabled) {
    await finalizeCurrentMetric(context);
    const root = pickWorkspaceRoot() ?? '';
    state.metricSession = {
      startedAt: Date.now(),
      workspaceRoot: root,
      trigger: triggerReason,
      uiSurface: config.uiSurface,
      interruptionEvent: 0,
      interruptionTimingClass: classifyInterruptionTiming(triggerReason, options.focusRegainedAt),
      resumeWithNote: options.checkpointPrimaryNote ? 1 : 0,
    };
  }

  await updateActiveNudges(context, summary, workspaceRoot, config, triggerReason === 'cached');
  updateSummaryScratchpad(summary, options.workspaceRoot);

  const panelOptions: PresentSummaryOptions = {
    ...options,
    manualPercolationBypass: triggerReason === 'manual',
  };

  const percolationMode = resolveCompanionRuntimeMode(config);
  const notificationNow = Date.now();
  const notificationSuppression =
    triggerReason !== 'manual'
      ? evaluatePercolationSuppression({
          enabled: config.enabled,
          mode: percolationMode,
          now: notificationNow,
          lowConfidence: Boolean(summary.lowConfidence),
          suppressLowConfidence: true,
          quietHours: config.summaryQuietHours,
          contextUnchanged: triggerReason === 'cached',
        })
      : undefined;
  let notificationPrimary: RankedSurfacedItem | undefined;
  const ensureNotificationPrimary = (): RankedSurfacedItem | undefined => {
    if (!notificationPrimary) {
      notificationPrimary = rankPercolationForSummary(summary, percolationMode, {
        context,
        workspaceRoot,
      }).primary;
    }
    return notificationPrimary;
  };

  // Keep low-confidence clarification telemetry populated even when notifications are suppressed.
  if (summary.lowConfidence) {
    if (notificationSuppression?.suppressed) {
      recordLowConfidenceClarificationRate(summary, undefined);
    } else {
      notificationPrimary = ensureNotificationPrimary();
      recordLowConfidenceClarificationRate(summary, notificationPrimary);
    }
  }

  const surfaceDecision = resolveSummarySurfaceDecision({
    configuredUiSurface: config.uiSurface,
    autoOpenDetails: options.autoOpenDetails === true,
    preferBackgroundPresentation: options.preferBackgroundPresentation === true,
    suppression: notificationSuppression,
    primary:
      config.uiSurface === 'notification' &&
      !notificationSuppression?.suppressed &&
      !options.autoOpenDetails &&
      !options.preferBackgroundPresentation
        ? ensureNotificationPrimary()
        : undefined,
  });
  const presentationMode = surfaceDecision.presentationMode;

  if (notificationSuppression?.suppressed) {
    recordPercolationSuppressionMetric(notificationSuppression.reason);
  }
  recordSurfaceSelectionMetric(surfaceDecision.surface);
  if (state.metricSession) {
    state.metricSession.interruptionEvent =
      triggerReason === 'focus' && presentationMode === 'prompt' ? 1 : 0;
  }

  if (presentationMode === 'auto-open-details') {
    await showDetailsPanel(context, summary, panelOptions);
    return;
  }

  if (presentationMode === 'background') {
    return;
  }

  if (presentationMode === 'silent') {
    return;
  }

  if (!notificationPrimary) {
    notificationPrimary = ensureNotificationPrimary();
  }

  if (!notificationPrimary) {
    return;
  }

  if (triggerReason === 'focus' && presentationMode === 'prompt' && workspaceRoot) {
    await consumeNoiseBudgetSignal(context, workspaceRoot, 'summary-prompt', notificationNow);
  }
  const notificationHeadline = selectNotificationHeadline(summary, notificationPrimary);
  const actionPauseLabel = config.pauseSummaries ? 'Resume auto summaries' : 'Pause auto summaries';
  recordCompanionPromptImpression();
  const choice = await vscode.window.showInformationMessage(
    `TaCoS (${summary.source}): ${notificationHeadline}`,
    'Open details',
    'Copy prompt for Codex',
    'Copy + Open Codex',
    'Copy next steps',
    'Copy summary',
    actionPauseLabel,
  );

  if (choice === 'Open details') {
    recordCompanionForcedOpenDetailsClick();
    await showDetailsPanel(context, summary, panelOptions);
    return;
  }

  if (choice === 'Copy prompt for Codex') {
    recordCompanionQuickAction();
    await vscode.env.clipboard.writeText(summary.codexPrompt);
    void vscode.window.showInformationMessage('TaCoS: Codex-ready prompt copied to clipboard.');
    return;
  }

  if (choice === 'Copy + Open Codex') {
    recordCompanionQuickAction();
    await copyPromptAndOpenCodex(summary);
    return;
  }

  if (choice === 'Copy next steps') {
    recordCompanionQuickAction();
    await vscode.env.clipboard.writeText(
      summary.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    );
    void vscode.window.showInformationMessage('TaCoS: next steps copied to clipboard.');
    return;
  }

  if (choice === 'Copy summary') {
    recordCompanionQuickAction();
    await vscode.env.clipboard.writeText(formatPlainSummary(summary));
    void vscode.window.showInformationMessage('TaCoS: summary copied to clipboard.');
    return;
  }

  if (choice === actionPauseLabel) {
    recordCompanionQuickAction();
    state.snoozeUntil = 0;
    await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
    await setPaused(!config.pauseSummaries);
    if (!config.pauseSummaries) {
      recordMetricCounter('pauseActions');
    }
    void vscode.window.showInformationMessage(
      !config.pauseSummaries ? 'TaCoS: auto summaries paused.' : 'TaCoS: auto summaries resumed.',
    );
  }
}

function nudgeShownAtKey(workspaceRoot: string): string {
  return `${KEY_LAST_NUDGE_AT_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function nudgeFeedbackKey(context: vscode.ExtensionContext, workspaceRoot: string): string {
  const scope = partitionScope(context, workspaceRoot);
  return `${KEY_NUDGE_FEEDBACK_PREFIX}.${Buffer.from(scope).toString('base64url')}`;
}

type NudgeFeedbackStore = Record<string, CompanionNudgeFeedback>;

function parseNudgeFeedbackRecord(
  value: unknown,
  fallbackContextHash?: string,
): CompanionNudgeFeedback | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const contextHashCandidate =
    typeof record.contextHash === 'string' ? record.contextHash.trim() : '';
  const contextHash = (fallbackContextHash ?? '').trim() || contextHashCandidate;
  const status = record.status;
  const at =
    typeof record.at === 'number' && Number.isFinite(record.at) && record.at > 0 ? record.at : 0;

  if (!contextHash || (status !== 'acknowledged' && status !== 'dismissed')) {
    return undefined;
  }

  return {
    contextHash,
    status,
    at,
  };
}

function readNudgeFeedbackStore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): NudgeFeedbackStore {
  const raw = context.workspaceState.get<unknown>(nudgeFeedbackKey(context, workspaceRoot));
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const legacyRecord = parseNudgeFeedbackRecord(raw);
  if (legacyRecord) {
    return {
      [legacyRecord.contextHash]: legacyRecord,
    };
  }

  const store: NudgeFeedbackStore = {};
  for (const [contextHash, value] of Object.entries(raw)) {
    const parsed = parseNudgeFeedbackRecord(value, contextHash);
    if (!parsed) {
      continue;
    }
    store[contextHash] = parsed;
  }

  return store;
}

function readNudgeFeedback(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  contextHash: string,
): CompanionNudgeFeedback | undefined {
  const store = readNudgeFeedbackStore(context, workspaceRoot);
  const trimmedContextHash = contextHash.trim();
  if (!trimmedContextHash) {
    return undefined;
  }
  return store[trimmedContextHash];
}

async function writeNudgeFeedbackStore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  store: NudgeFeedbackStore,
): Promise<void> {
  await context.workspaceState.update(
    nudgeFeedbackKey(context, workspaceRoot),
    Object.keys(store).length > 0 ? store : undefined,
  );
}

async function writeNudgeFeedback(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  feedback: CompanionNudgeFeedback,
): Promise<void> {
  const store = readNudgeFeedbackStore(context, workspaceRoot);
  store[feedback.contextHash] = feedback;

  const trimmed = Object.fromEntries(
    Object.entries(store)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, MAX_NUDGE_FEEDBACK_ENTRIES_PER_SCOPE),
  );

  await writeNudgeFeedbackStore(context, workspaceRoot, trimmed);
}

async function setNudgeFeedbackForCurrentContext(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  summary: ResumeSummary,
  status: CompanionNudgeFeedbackStatus,
): Promise<void> {
  const now = Date.now();
  const feedback: CompanionNudgeFeedback = {
    contextHash: summary.contextHash,
    status,
    at: now,
  };
  await writeNudgeFeedback(context, workspaceRoot, feedback);
  state.activeNudges = {
    contextHash: summary.contextHash,
    decision: {
      suppressedReason: status,
    },
  };
  rerenderPanel();
}

function percolationMemoryKey(context: vscode.ExtensionContext, workspaceRoot: string): string {
  const scope = partitionScope(context, workspaceRoot);
  return `${KEY_PERCOLATION_MEMORY_PREFIX}.${Buffer.from(scope).toString('base64url')}`;
}

function readPercolationMemoryStore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): PercolationMemoryStore {
  return parsePercolationMemoryStore(
    context.workspaceState.get<unknown>(percolationMemoryKey(context, workspaceRoot)),
  );
}

async function writePercolationMemoryStore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  store: PercolationMemoryStore,
): Promise<void> {
  await context.workspaceState.update(
    percolationMemoryKey(context, workspaceRoot),
    Object.keys(store).length > 0 ? store : undefined,
  );
}

async function writePercolationMemory(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  record: {
    contextHash: string;
    itemKind: RankedSurfacedItem['kind'];
    status: PercolationMemoryStatus;
    at: number;
    until: number;
  },
): Promise<void> {
  const store = readPercolationMemoryStore(context, workspaceRoot);
  const next = upsertPercolationMemoryRecord(
    store,
    record,
    MAX_PERCOLATION_MEMORY_ENTRIES_PER_SCOPE,
  );
  await writePercolationMemoryStore(context, workspaceRoot, next);
}

async function rememberPercolationPrimaryForSummary(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  summary: ResumeSummary,
  status: PercolationMemoryStatus,
  until: number,
): Promise<boolean> {
  const now = Date.now();
  if (!Number.isFinite(until) || until <= now) {
    return false;
  }

  const mode = resolveCompanionRuntimeMode(getConfig());
  const primary = rankPercolationForSummary(summary, mode, {
    context,
    workspaceRoot,
    now,
  }).primary;
  if (!primary) {
    return false;
  }

  await writePercolationMemory(context, workspaceRoot, {
    contextHash: summary.contextHash,
    itemKind: primary.kind,
    status,
    at: now,
    until,
  });
  recordMetricCounter(
    status === 'dismissed' ? 'percolationDismissActions' : 'percolationSnoozeActions',
  );
  return true;
}

function noiseBudgetEventsKey(workspaceRoot: string): string {
  return `${KEY_NOISE_BUDGET_EVENTS_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function isNoiseBudgetSignalKind(value: unknown): value is NoiseBudgetSignalKind {
  return value === 'summary-prompt' || value === 'checkpoint-prompt' || value === 'nudge';
}

function readNoiseBudgetEvents(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): NoiseBudgetEvent[] {
  const raw = context.workspaceState.get<unknown>(noiseBudgetEventsKey(workspaceRoot), []);
  if (!Array.isArray(raw)) {
    return [];
  }

  const events: NoiseBudgetEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    if (!isNoiseBudgetSignalKind(candidate.kind)) {
      continue;
    }
    if (typeof candidate.at !== 'number' || !Number.isFinite(candidate.at) || candidate.at <= 0) {
      continue;
    }
    events.push({
      kind: candidate.kind,
      at: candidate.at,
    });
  }

  return events;
}

async function consumeNoiseBudgetSignal(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  signalKind: NoiseBudgetSignalKind,
  now: number,
): Promise<ReturnType<typeof evaluateNoiseBudget>> {
  const existing = readNoiseBudgetEvents(context, workspaceRoot);
  const decision = evaluateNoiseBudget({
    now,
    signalKind,
    events: existing,
    policy: {
      windowMs: NOISE_BUDGET_WINDOW_MS,
      maxSignalsPerWindow: NOISE_BUDGET_MAX_SIGNALS_PER_WINDOW,
      blockNudgesAfterSummaryMs: NOISE_BUDGET_BLOCK_NUDGE_AFTER_SUMMARY_MS,
      blockNudgesAfterCheckpointMs: NOISE_BUDGET_BLOCK_NUDGE_AFTER_CHECKPOINT_MS,
      blockCheckpointAfterSummaryMs: NOISE_BUDGET_BLOCK_CHECKPOINT_AFTER_SUMMARY_MS,
    },
  });

  const nextEvents = decision.allowed
    ? [...decision.recentEvents, { kind: signalKind, at: now }]
    : decision.recentEvents;
  await context.workspaceState.update(noiseBudgetEventsKey(workspaceRoot), nextEvents);
  return {
    ...decision,
    recentEvents: nextEvents,
  };
}

async function updateActiveNudges(
  context: vscode.ExtensionContext,
  summary: ResumeSummary,
  workspaceRoot: string | undefined,
  config: ExtensionConfig,
  contextUnchanged = false,
): Promise<void> {
  if (!workspaceRoot) {
    state.activeNudges = undefined;
    return;
  }

  const now = Date.now();
  const runtimeMode = resolveCompanionRuntimeMode(config);
  const lastShownAt = context.workspaceState.get<number>(nudgeShownAtKey(workspaceRoot), 0);
  let decision = chooseCompanionNudges({
    summary,
    provider: config.summaryProvider,
    mode: runtimeMode,
    now,
    enabled: config.companionNudgesEnabled,
    aggressiveness: config.companionNudgeAggressiveness,
    quietHours: config.companionNudgeQuietHours,
    cooldownMinutes: config.companionNudgeCooldownMinutes,
    lastShownAt,
    contextUnchanged,
  });

  const feedback = readNudgeFeedback(context, workspaceRoot, summary.contextHash);
  decision = applyCompanionNudgeFeedback(decision, summary.contextHash, feedback);

  if (decision.primary) {
    const budgetDecision = await consumeNoiseBudgetSignal(context, workspaceRoot, 'nudge', now);
    if (!budgetDecision.allowed) {
      const suppression = evaluatePercolationSuppression({
        enabled: config.companionNudgesEnabled,
        mode: runtimeMode,
        now,
        quietHours: config.companionNudgeQuietHours,
        cooldownMinutes: config.companionNudgeCooldownMinutes,
        lastShownAt,
        contextUnchanged,
        noiseBudgetAllowed: false,
        noiseBudgetNextEligibleAt: budgetDecision.nextEligibleAt,
      });
      decision = {
        suppressedReason: suppression.reason,
        nextEligibleAt: suppression.nextEligibleAt,
      };
    }
  }

  state.activeNudges = {
    contextHash: summary.contextHash,
    decision,
  };

  if (!decision.primary) {
    recordPercolationSuppressionMetric(decision.suppressedReason);
    return;
  }

  await context.workspaceState.update(nudgeShownAtKey(workspaceRoot), now);
  recordCompanionNudgeImpression();
}

function resolveSummaryPresentationMode(
  config: ExtensionConfig,
  options: Pick<PresentSummaryOptions, 'autoOpenDetails' | 'preferBackgroundPresentation'>,
): SummaryPresentationMode {
  if (options.autoOpenDetails) {
    return 'auto-open-details';
  }

  if (options.preferBackgroundPresentation) {
    return 'background';
  }

  if (config.uiSurface === 'silent') {
    return 'silent';
  }

  if (config.uiSurface === 'notification') {
    return 'prompt';
  }

  return 'background';
}

function resolveCompanionRuntimeMode(config: ExtensionConfig): CompanionRuntimeMode {
  if (!config.enabled) {
    return 'disabled';
  }

  if (!state.workspaceTrusted || !vscode.workspace.isTrusted) {
    return 'restricted';
  }

  if (state.snoozeUntil > Date.now()) {
    return 'paused';
  }

  if (config.pauseSummaries || state.pauseUntilRestart) {
    return 'paused';
  }

  return 'active';
}

function resolveCompanionPausedReason(config: ExtensionConfig, now: number): string {
  if (state.snoozeUntil > now) {
    return 'snoozed';
  }

  if (state.pauseUntilRestart) {
    return 'until restart';
  }

  if (config.pauseSummaries) {
    return 'settings pause';
  }

  return 'paused';
}

function classifyInterruptionTiming(
  triggerReason: TriggerReason,
  referenceAt?: number,
): 'boundary' | 'mid-activity' | 'unknown' {
  if (triggerReason !== 'focus') {
    return 'unknown';
  }

  const now =
    typeof referenceAt === 'number' && Number.isFinite(referenceAt) && referenceAt > 0
      ? referenceAt
      : Date.now();
  const boundaryDelta =
    state.lastBoundarySignalAt > 0 ? now - state.lastBoundarySignalAt : Number.POSITIVE_INFINITY;
  if (boundaryDelta >= 0 && boundaryDelta <= INTERRUPTION_TIMING_BOUNDARY_WINDOW_MS) {
    return 'boundary';
  }

  const activityDelta =
    state.lastMeaningfulActivityAt > 0
      ? now - state.lastMeaningfulActivityAt
      : Number.POSITIVE_INFINITY;
  if (activityDelta >= 0 && activityDelta <= INTERRUPTION_TIMING_MID_ACTIVITY_WINDOW_MS) {
    return 'mid-activity';
  }

  return 'unknown';
}

function recordFirstActionLag(): void {
  if (!state.metricSession || state.metricSession.firstActionLagMs !== undefined) {
    return;
  }

  state.metricSession.firstActionLagMs = Date.now() - state.metricSession.startedAt;
}

function recordCompanionFirstActionLag(): void {
  if (!state.metricSession || state.metricSession.companionFirstActionLagMs !== undefined) {
    return;
  }

  recordFirstActionLag();
  state.metricSession.companionFirstActionLagMs = Date.now() - state.metricSession.startedAt;
}

function recordCompanionQuickAction(): void {
  if (!state.metricSession) {
    return;
  }

  recordCompanionFirstActionLag();
  state.metricSession.companionQuickActionsTaken =
    (state.metricSession.companionQuickActionsTaken ?? 0) + 1;
}

function recordCompanionPromptImpression(): void {
  if (!state.metricSession) {
    return;
  }

  state.metricSession.companionPromptImpressions =
    (state.metricSession.companionPromptImpressions ?? 0) + 1;
}

function recordCompanionForcedOpenDetailsClick(): void {
  if (!state.metricSession) {
    return;
  }

  recordCompanionFirstActionLag();
  state.metricSession.companionForcedOpenDetailsClicks =
    (state.metricSession.companionForcedOpenDetailsClicks ?? 0) + 1;
}

function recordCompanionNudgeImpression(): void {
  if (!state.metricSession) {
    return;
  }

  state.metricSession.companionNudgeImpressions =
    (state.metricSession.companionNudgeImpressions ?? 0) + 1;
}

function recordCompanionPrimaryCtaImpression(sourceClass?: string): void {
  if (!state.metricSession) {
    return;
  }

  if ((state.metricSession.companionPrimaryCtaImpressions ?? 0) > 0) {
    if (!state.metricSession.companionPrimaryCtaSourceClass && sourceClass) {
      state.metricSession.companionPrimaryCtaSourceClass = sourceClass;
    }
    return;
  }

  state.metricSession.companionPrimaryCtaImpressions = 1;
  if (sourceClass) {
    state.metricSession.companionPrimaryCtaSourceClass = sourceClass;
  }
}

function recordCompanionPrimaryCtaClick(): void {
  if (!state.metricSession) {
    return;
  }

  recordCompanionFirstActionLag();
  state.metricSession.companionPrimaryCtaClicks =
    (state.metricSession.companionPrimaryCtaClicks ?? 0) + 1;
}

function recordCompanionPrimaryCtaCompletion(): void {
  if (!state.metricSession) {
    return;
  }

  state.metricSession.companionPrimaryCtaCompletions =
    (state.metricSession.companionPrimaryCtaCompletions ?? 0) + 1;
}

function recordCompanionPrimaryCtaCompletionForSession(
  metricSession: MetricRecord | undefined,
): void {
  if (!metricSession) {
    return;
  }

  metricSession.companionPrimaryCtaCompletions =
    (metricSession.companionPrimaryCtaCompletions ?? 0) + 1;
}

function recordLowConfidenceClarificationRate(
  summary: ResumeSummary,
  primary: RankedSurfacedItem | undefined,
): void {
  if (!state.metricSession || !summary.lowConfidence) {
    return;
  }

  state.metricSession.lowConfidenceClarificationRate = primary?.kind === 'clarification' ? 1 : 0;
}

function recordMetricCounter(
  field:
    | 'surfaceSelectionNone'
    | 'surfaceSelectionStatusbar'
    | 'surfaceSelectionPanel'
    | 'surfaceSelectionNotification'
    | 'pauseActions'
    | 'snoozeActions'
    | 'summaryQuietActions'
    | 'disableActions'
    | 'trustTrayOpens'
    | 'restrictedTrustTrayOpens'
    | 'whySurfacedOpens'
    | 'percolationSuppressedQuietHours'
    | 'percolationSuppressedCooldown'
    | 'percolationSuppressedNoChange'
    | 'percolationSuppressedNoiseBudget'
    | 'percolationSuppressedLowConfidence'
    | 'percolationDismissActions'
    | 'percolationSnoozeActions'
    | 'noteCreated'
    | 'noteMarkedDone'
    | 'notePinned'
    | 'resumePathCompletions'
    | 'scratchpadOpened'
    | 'scratchpadAppended'
    | 'redactionEventsTotal'
    | 'redactionHighRiskDetectedTotal'
    | 'aiSendBlockedBySanitizerTotal'
    | 'aiSendAllowedAfterReviewTotal',
  amount = 1,
): void {
  if (!state.metricSession) {
    return;
  }

  state.metricSession[field] = (state.metricSession[field] ?? 0) + amount;
}

function recordSurfaceSelectionMetric(surface: SummaryPresentationSurface): void {
  if (surface === 'none') {
    recordMetricCounter('surfaceSelectionNone');
    return;
  }

  if (surface === 'statusbar') {
    recordMetricCounter('surfaceSelectionStatusbar');
    return;
  }

  if (surface === 'panel') {
    recordMetricCounter('surfaceSelectionPanel');
    return;
  }

  recordMetricCounter('surfaceSelectionNotification');
}

function recordRedactionMetrics(totalReplacements: number, highRiskDetected: boolean): void {
  if (totalReplacements > 0) {
    recordMetricCounter('redactionEventsTotal', totalReplacements);
  }
  if (highRiskDetected) {
    recordMetricCounter('redactionHighRiskDetectedTotal');
  }
}

async function promptSummaryHelpfulnessRating(): Promise<void> {
  if (!state.metricSession) {
    void vscode.window.showInformationMessage(
      'TaCoS: generate or refresh a summary first to record helpfulness for this session.',
    );
    return;
  }

  type HelpfulnessPick = vscode.QuickPickItem & { rating: 1 | 2 | 3 | 4 | 5 };
  const picks: HelpfulnessPick[] = [
    { rating: 5, label: '5 - Very helpful' },
    { rating: 4, label: '4 - Helpful' },
    { rating: 3, label: '3 - Mixed' },
    { rating: 2, label: '2 - Not very helpful' },
    { rating: 1, label: '1 - Not helpful' },
  ];
  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Rate Summary Helpfulness',
    placeHolder: 'Optional local rating',
    ignoreFocusOut: true,
  });
  if (!picked || !state.metricSession) {
    return;
  }

  state.metricSession.helpfulnessRating = picked.rating;
  void vscode.window.showInformationMessage(
    `TaCoS: helpfulness rating saved (${picked.rating}/5).`,
  );
}

function nudgeActionLabel(action: string): string {
  if (action === 'restoreCopyFailingCommand') {
    return 'Copy failing command';
  }
  if (action === 'restoreCheckoutPreviousBranch') {
    return 'Checkout previous branch';
  }
  if (action === 'copyNextSteps') {
    return 'Copy next steps';
  }
  if (action === 'refreshSummary') {
    return 'Refresh summary';
  }
  return 'Take action';
}

function isBlockedPrimaryCtaMessage(message: WebviewMessage): boolean {
  if (
    message.type !== 'sessionAddCheckpoint' &&
    message.type !== 'refreshSummary' &&
    message.type !== 'restoreRerunTask' &&
    message.type !== 'restoreCopyFailingCommand' &&
    message.type !== 'restoreOpenProblems' &&
    message.type !== 'restoreOpenDiagnosticFile' &&
    message.type !== 'restoreCheckoutPreviousBranch'
  ) {
    return false;
  }

  return 'primarySurface' in message && message.primarySurface === 'blocked';
}

interface RankPercolationOptions {
  context?: vscode.ExtensionContext;
  workspaceRoot?: string;
  now?: number;
  ignoreMemory?: boolean;
}

function rankPercolationForSummary(
  summary: ResumeSummary,
  mode: PercolationPolicyMode,
  options: RankPercolationOptions = {},
): ReturnType<typeof rankCandidates> {
  const evaluationNow = options.now ?? Date.now();
  const input = createPercolationPolicyInput(summary, {
    mode,
    now: summary.generatedAt > 0 ? summary.generatedAt : evaluationNow,
  });
  if (options.context && options.workspaceRoot && !options.ignoreMemory) {
    const workspaceRoot = options.workspaceRoot.trim();
    if (workspaceRoot) {
      const store = readPercolationMemoryStore(options.context, workspaceRoot);
      input.candidates = filterSurfacedItemsByPercolationMemory(
        input.candidates,
        store,
        input.contextHash,
        evaluationNow,
      );
    }
  }
  return rankCandidates(input);
}

function summarizeRankedPrimary(primary: RankedSurfacedItem | undefined): string {
  if (!primary) {
    return '';
  }

  const detail = primary.detail.trim();
  if (detail) {
    return detail;
  }

  return primary.title.trim();
}

function selectPanelPrimarySummary(
  summary: ResumeSummary,
  primary: RankedSurfacedItem | undefined,
): string {
  if (primary) {
    const headline = summarizeRankedPrimary(primary);
    if (headline) {
      if (primary.kind === 'blocked') {
        return `Address blocker: ${headline}`;
      }
      return headline;
    }
  }

  return summary.recommendedFirstAction?.trim() ?? summary.nextSteps[0] ?? '';
}

function resolveCompanionNextSlotSourceClass(
  summary: ResumeSummary,
  primaryNextAction: NextStepAction | undefined,
  rankedPrimary: RankedSurfacedItem | undefined,
  primaryCtaDecision: CompanionPrimaryCtaDecision,
): string {
  if (primaryNextAction && primaryCtaDecision.winner === 'next') {
    return `next-step-action:${primaryNextAction.kind}`;
  }

  if (primaryNextAction) {
    return `policy:secondary-next-step-action:${primaryNextAction.kind}`;
  }

  if (rankedPrimary) {
    return `policy:${rankedPrimary.kind}`;
  }

  if (summary.recommendedFirstAction?.trim()) {
    return 'summary:recommended-first-action';
  }

  if (summary.nextSteps.length > 0) {
    return 'summary:first-next-step';
  }

  return 'summary:none';
}

function resolveCompanionBlockedSlotSourceClass(
  blockerDecision: BlockerDecision,
  primaryCtaDecision: CompanionPrimaryCtaDecision,
): string {
  if (primaryCtaDecision.winner === 'blocked') {
    return `blocker:${blockerDecision.kind}:primary`;
  }

  if (blockerDecision.hasBlocker) {
    return `blocker:${blockerDecision.kind}:advisory`;
  }

  return `blocker:${blockerDecision.kind}`;
}

function resolveCompanionSlotSourceClasses(
  summary: ResumeSummary,
  primaryNextAction: NextStepAction | undefined,
  rankedPrimary: RankedSurfacedItem | undefined,
  blockerDecision: BlockerDecision,
  primaryCtaDecision: CompanionPrimaryCtaDecision,
): {
  now: string;
  next: string;
  blocked: string;
  restore: string;
  primaryCta?: string;
} {
  return {
    now: 'summary:intent-and-retrieval-cues',
    next: resolveCompanionNextSlotSourceClass(
      summary,
      primaryNextAction,
      rankedPrimary,
      primaryCtaDecision,
    ),
    blocked: resolveCompanionBlockedSlotSourceClass(blockerDecision, primaryCtaDecision),
    restore: 'restore:availability-and-trust',
    primaryCta: primaryCtaDecision.sourceClass,
  };
}

type PanelSectionPolicyTarget = Exclude<PanelSectionId, 'moreContext'>;

const PANEL_SECTION_FOCUS_LABELS: Record<PanelSectionPolicyTarget, string> = {
  trustCenter: 'Trust',
  timeline: 'Timeline',
  evidence: 'Evidence',
  details: 'Details',
};

function resolvePanelSectionEmphasis(
  summary: ResumeSummary,
  primary: RankedSurfacedItem | undefined,
  blockerDecision: BlockerDecision,
  companionRuntimeMode: CompanionRuntimeMode,
  showTimeline: boolean,
  timelineGroupsCount: number,
  summaryProvider: SummaryProvider,
): Partial<Record<PanelSectionId, PanelSectionEmphasis>> {
  let focusSection: PanelSectionPolicyTarget = 'details';
  let focusLevel: PanelSectionEmphasis['level'] = 'elevated';
  let focusBadge = 'Policy';
  let focusSourceClass = 'policy:fallback';

  const hasEvidenceLinks = (primary?.evidenceIds.length ?? 0) > 0;
  const hasChangesSinceLastResume = (summary.changesSinceLastResume?.length ?? 0) > 0;

  if (companionRuntimeMode === 'restricted') {
    focusSection = 'trustCenter';
    focusLevel = 'critical';
    focusBadge = 'Restricted';
    focusSourceClass = 'runtime:restricted';
  } else if (summaryProvider !== 'local') {
    focusSection = 'trustCenter';
    focusBadge = 'AI path';
    focusSourceClass = `provider:${summaryProvider}`;
  } else if (primary?.kind === 'trust-privacy') {
    focusSection = 'trustCenter';
    focusBadge = 'Trust';
    focusSourceClass = 'policy:trust-privacy';
  } else if (primary?.kind === 'evidence' || hasEvidenceLinks) {
    focusSection = 'evidence';
    focusBadge = 'Evidence';
    focusSourceClass = hasEvidenceLinks ? 'policy:primary-evidence' : 'policy:evidence';
  } else if (showTimeline && hasChangesSinceLastResume && timelineGroupsCount > 0) {
    focusSection = 'timeline';
    focusBadge = 'Recent';
    focusSourceClass = 'policy:recent-change';
  } else if (blockerDecision.hasBlocker || summary.lowConfidence || summary.longGap) {
    focusSection = 'details';
    focusBadge = 'Reorient';
    focusSourceClass = blockerDecision.hasBlocker
      ? 'policy:blocker-context'
      : summary.lowConfidence
        ? 'policy:low-confidence'
        : 'policy:long-gap';
  } else if (showTimeline && timelineGroupsCount > 0) {
    focusSection = 'timeline';
    focusBadge = 'Recent';
    focusSourceClass = 'policy:timeline-signal';
  }

  return {
    [focusSection]: {
      level: focusLevel,
      sourceClass: focusSourceClass,
      badgeLabel: focusBadge,
    },
    moreContext: {
      level: 'elevated',
      sourceClass: `policy-focus:${focusSection}`,
      badgeLabel: `Focus: ${PANEL_SECTION_FOCUS_LABELS[focusSection]}`,
    },
  };
}

function selectNotificationHeadline(
  summary: ResumeSummary,
  primary: RankedSurfacedItem | undefined,
): string {
  if (primary) {
    const rankedHeadline = summarizeRankedPrimary(primary);
    if (rankedHeadline) {
      return rankedHeadline;
    }
  }

  return summary.intent;
}

function recordPercolationSuppressionMetric(reason: string | undefined): void {
  if (!reason) {
    return;
  }

  if (reason === 'quiet-hours') {
    recordMetricCounter('percolationSuppressedQuietHours');
    return;
  }

  if (reason === 'cooldown') {
    recordMetricCounter('percolationSuppressedCooldown');
    return;
  }

  if (reason === 'no-change') {
    recordMetricCounter('percolationSuppressedNoChange');
    return;
  }

  if (reason === 'noise-budget') {
    recordMetricCounter('percolationSuppressedNoiseBudget');
    return;
  }

  if (reason === 'low-confidence') {
    recordMetricCounter('percolationSuppressedLowConfidence');
  }
}

function summarizeForStatusBar(raw: string, maxChars = 44): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return 'ready';
  }

  if (compact.length <= maxChars) {
    return compact;
  }

  return `${compact.slice(0, maxChars - 1)}…`;
}

function summarizeStatusReason(raw: string, maxChars = 22): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return '';
  }

  if (compact.length <= maxChars) {
    return compact;
  }

  return `${compact.slice(0, maxChars - 1)}…`;
}

function describeSuppressionReason(reason: string | undefined): string {
  if (!reason) {
    return 'suppressed';
  }

  if (reason === 'quiet-hours') {
    return 'quiet window';
  }
  if (reason === 'cooldown') {
    return 'cooldown';
  }
  if (reason === 'no-change') {
    return 'no change';
  }
  if (reason === 'noise-budget') {
    return 'noise budget';
  }
  if (reason === 'low-confidence') {
    return 'low confidence';
  }

  return reason;
}

interface CompanionStatusBarSemantic {
  className: CompanionStatusBarClass;
  headline: string;
  reason: string;
  elevation: 'none' | 'prominent' | 'warning';
}

function resolveCompanionStatusBarSemantic(
  mode: CompanionRuntimeMode,
  percolationSuppression: ReturnType<typeof evaluatePercolationSuppression>,
  quietState: ReturnType<typeof resolveSummaryQuietState>,
  pausedReason: string,
  primary: RankedSurfacedItem | undefined,
  summary: ResumeSummary | undefined,
  summaryProvider: SummaryProvider,
): CompanionStatusBarSemantic {
  if (mode === 'restricted') {
    return {
      className: 'restricted',
      headline: 'restricted',
      reason: 'workspace trust',
      elevation: 'warning',
    };
  }

  if (mode === 'paused') {
    return {
      className: 'paused',
      headline: 'paused',
      reason: pausedReason,
      elevation: 'prominent',
    };
  }

  if (mode === 'disabled') {
    return {
      className: 'disabled',
      headline: 'disabled',
      reason: 'extension off',
      elevation: 'prominent',
    };
  }

  if (quietState.active) {
    return {
      className: 'active-suppressed',
      headline: 'calm',
      reason: 'quiet window',
      elevation: 'none',
    };
  }

  if (percolationSuppression.suppressed) {
    return {
      className: 'active-suppressed',
      headline: 'calm',
      reason: describeSuppressionReason(percolationSuppression.reason),
      elevation: 'none',
    };
  }

  if (!primary) {
    return {
      className: summary ? 'active-status' : 'active-idle',
      headline: 'ready',
      reason: summary ? 'summary cached' : 'awaiting summary',
      elevation: 'none',
    };
  }

  if (primary.kind === 'blocked') {
    return {
      className: 'active-blocked',
      headline: 'blocked',
      reason: summary?.lastFailingCommand ? 'failing command' : 'blocker',
      elevation: primary.urgency >= 0.85 && primary.confidence >= 0.65 ? 'warning' : 'none',
    };
  }

  if (primary.kind === 'clarification') {
    return {
      className: 'active-clarify',
      headline: 'clarify',
      reason: 'low confidence',
      elevation: 'none',
    };
  }

  if (primary.kind === 'trust-privacy') {
    return {
      className: 'active-trust',
      headline: 'trust',
      reason: summaryProvider === 'local' ? 'local-first' : 'ai path',
      elevation: 'none',
    };
  }

  if (primary.kind === 'evidence') {
    return {
      className: 'active-evidence',
      headline: 'evidence',
      reason: 'drill-down',
      elevation: 'none',
    };
  }

  if (primary.kind === 'restore') {
    return {
      className: 'active-restore',
      headline: 'restore',
      reason: 'working set',
      elevation: 'none',
    };
  }

  if (primary.kind === 'recommended-action' || primary.kind === 'next-step') {
    return {
      className: 'active-next',
      headline: 'next',
      reason: 'policy action',
      elevation: 'none',
    };
  }

  return {
    className: 'active-status',
    headline: 'status',
    reason: 'policy signal',
    elevation: 'none',
  };
}

function updateCompanionStatusBar(): void {
  if (!state.statusBar) {
    return;
  }

  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot();
  const mode = resolveCompanionRuntimeMode(config);
  const now = Date.now();
  const quietState = resolveSummaryQuietState(now, config.summaryQuietHours);
  const pausedReason = resolveCompanionPausedReason(config, now);
  const summary = state.scratchSummary;
  const percolationSuppression = evaluatePercolationSuppression({
    enabled: config.enabled,
    mode,
    now,
    quietHours: config.summaryQuietHours,
    contextUnchanged: state.lastSummaryContextUnchanged,
  });
  const rankedPrimary =
    mode === 'active' && summary && !quietState.active && !percolationSuppression.suppressed
      ? rankPercolationForSummary(summary, mode, {
          context: activeExtensionContext,
          workspaceRoot,
          now,
        }).primary
      : undefined;
  const modeIcon =
    mode === 'restricted'
      ? '$(shield)'
      : mode === 'paused'
        ? '$(circle-slash)'
        : mode === 'disabled'
          ? '$(close)'
          : '$(pulse)';
  const modeLabel =
    mode === 'restricted'
      ? 'restricted'
      : mode === 'paused'
        ? 'paused'
        : mode === 'disabled'
          ? 'disabled'
          : 'active';
  const semantic = resolveCompanionStatusBarSemantic(
    mode,
    percolationSuppression,
    quietState,
    pausedReason,
    rankedPrimary,
    summary,
    config.summaryProvider,
  );
  const topStep = summary?.nextSteps[0]?.trim();
  const statusReason = semantic.reason;
  const reasonSuffix = statusReason ? ` · ${summarizeStatusReason(statusReason)}` : '';
  const trustCue = buildTrustCue(summary);
  state.statusBarClass = semantic.className;
  state.statusBarReason = statusReason;
  state.statusBarElevated = semantic.elevation !== 'none';
  state.statusBar.text = `${modeIcon} TaCoS: ${semantic.headline}${reasonSuffix}`;
  state.statusBar.backgroundColor =
    semantic.elevation === 'warning'
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : semantic.elevation === 'prominent'
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : undefined;
  state.statusBar.tooltip = [
    'TaCoS Companion',
    `Mode: ${modeLabel}`,
    `Status class: ${state.statusBarClass}`,
    `Status reason: ${state.statusBarReason || 'none'}`,
    `Surface: ${config.uiSurface}`,
    `Provider: ${describeProvider(config.summaryProvider)}`,
    `Privacy preset: ${PRIVACY_PRESET_LABELS[config.privacyPreset]}`,
    `Retention: ${RETENTION_POLICY_LABELS[config.retentionPolicy]}`,
    `Summary quiet hours: ${config.summaryQuietHours || 'off'}`,
    quietState.source === 'temporary'
      ? `Temporary quiet until: ${formatTimestamp(quietState.temporaryUntil ?? 0)}`
      : 'Temporary quiet: off',
    quietState.source === 'configured'
      ? 'Quiet window status: active now'
      : config.summaryQuietHours
        ? 'Quiet window status: inactive now'
        : 'Quiet window status: off',
    percolationSuppression.suppressed && percolationSuppression.reason
      ? `Percolation suppression: ${percolationSuppression.reason}`
      : 'Percolation suppression: none',
    rankedPrimary
      ? `Percolation primary: ${summarizeForStatusBar(summarizeRankedPrimary(rankedPrimary), 120)}`
      : 'Percolation primary: (none)',
    state.snoozeUntil > now
      ? `Snoozed until: ${formatTimestamp(state.snoozeUntil)}`
      : 'Snooze: off',
    trustCue.headline,
    summary ? `Intent: ${summarizeForStatusBar(summary.intent, 120)}` : 'Intent: (none yet)',
    topStep ? `Next: ${summarizeForStatusBar(topStep, 120)}` : 'Next: (none yet)',
    summary
      ? `Last summary: ${summary.source} at ${formatTimestamp(summary.generatedAt)}`
      : 'No summary yet.',
    'Click for quick actions.',
  ].join('\n');
  state.statusBar.show();
}

interface CompanionActionPick extends vscode.QuickPickItem {
  id:
    | 'showNow'
    | 'showDemo'
    | 'showLast'
    | 'standup'
    | 'restoreWorkingSet'
    | 'switchPartition'
    | 'listCheckpointNotes'
    | 'openScratchpad'
    | 'appendScratchpad'
    | 'setScratchpadScope'
    | 'jumpLastEdit'
    | 'copyPrompt'
    | 'togglePause'
    | 'snoozeAuto'
    | 'quietNow'
    | 'setSummaryQuietHours'
    | 'enable'
    | 'openPrivacy'
    | 'configureProvider'
    | 'setupChecklist'
    | 'setPrivacyPreset'
    | 'setRetentionPolicy'
    | 'forgetWorkspace'
    | 'revokeAiConsent'
    | 'rateHelpfulness';
}

async function showCompanionActions(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  const mode = resolveCompanionRuntimeMode(config);
  const picks: CompanionActionPick[] = [
    {
      id: 'showNow',
      label: 'Show resume brief now',
      detail: 'Generate a fresh summary immediately.',
    },
    {
      id: 'showDemo',
      label: 'Show demo resume card',
      detail: 'Open a clearly-labeled sample brief (no workspace evidence mixed in).',
    },
    {
      id: 'showLast',
      label: 'Show last summary',
      detail: 'Open the latest cached TaCoS summary.',
    },
    {
      id: 'standup',
      label: 'Generate standup update',
      detail: 'Create concise Done/Next/Blockers output.',
    },
    {
      id: 'restoreWorkingSet',
      label: 'Restore working set',
      detail: 'Preview and restore files, diff target, terminal cwd, and search query.',
    },
    {
      id: 'switchPartition',
      label: 'Switch task partition',
      detail: 'Set or clear manual task key for context partitioning.',
    },
    {
      id: 'listCheckpointNotes',
      label: 'List checkpoint notes',
      detail: 'Review, edit, pin, dismiss, or mark notes done.',
    },
    {
      id: 'openScratchpad',
      label: 'Open scratchpad',
      detail: 'Open the scoped scratchpad in a real editor tab.',
    },
    {
      id: 'appendScratchpad',
      label: 'Append to scratchpad',
      detail: 'Append selected text (or clipboard fallback) with a timestamp divider.',
    },
    {
      id: 'setScratchpadScope',
      label: 'Set scratchpad scope',
      detail: 'Switch between task scope and workspace-global scratchpad.',
    },
    {
      id: 'jumpLastEdit',
      label: 'Jump to last edit',
      detail: 'Open your most recent edited location.',
    },
    {
      id: 'copyPrompt',
      label: 'Copy prompt and open Codex',
      detail: 'Create a Codex-ready prompt from current context.',
    },
    {
      id: 'snoozeAuto',
      label: 'Snooze auto summaries',
      detail: 'Temporarily suppress focus-triggered summaries.',
    },
    {
      id: 'quietNow',
      label: 'Quiet now (1 hour)',
      detail: 'Suppress focus-triggered summaries for the next hour.',
    },
    {
      id: 'setSummaryQuietHours',
      label: 'Configure summary quiet hours',
      detail: `Current daily window: ${config.summaryQuietHours || 'off'}.`,
    },
    {
      id: 'configureProvider',
      label: 'Configure AI provider',
      detail: 'Switch between local, VS Code LM, and OpenAI providers.',
    },
    {
      id: 'setupChecklist',
      label: 'Run setup checklist',
      detail: 'Guided first-run setup for privacy, provider mode, and trust expectations.',
    },
    {
      id: 'openPrivacy',
      label: 'Open Privacy & Safety',
      detail: 'Review what TaCoS stores and sends.',
    },
    {
      id: 'setPrivacyPreset',
      label: 'Set privacy preset',
      detail: `Current: ${PRIVACY_PRESET_LABELS[config.privacyPreset]}.`,
    },
    {
      id: 'setRetentionPolicy',
      label: 'Set retention policy',
      detail: `Current: ${RETENTION_POLICY_LABELS[config.retentionPolicy]}.`,
    },
    {
      id: 'forgetWorkspace',
      label: 'Forget this workspace now',
      detail: 'Clear TaCoS workspace-scoped data immediately.',
    },
    {
      id: 'revokeAiConsent',
      label: 'Revoke AI payload consent',
      detail: 'Require payload review before the next AI send.',
    },
    {
      id: 'rateHelpfulness',
      label: 'Rate summary helpfulness',
      detail: 'Optional local rating for TaCoS quality metrics.',
    },
  ];

  if (mode === 'disabled') {
    picks.unshift({
      id: 'enable',
      label: 'Enable auto summaries',
      detail: 'Turn tacos.enabled back on.',
    });
  } else if (mode === 'paused') {
    picks.unshift({
      id: 'togglePause',
      label: 'Resume auto summaries',
      detail: 'Resume auto summaries and clear pause-until-restart state.',
    });
  } else {
    picks.unshift({
      id: 'togglePause',
      label: 'Pause auto summaries',
      detail: 'Pause automatic focus-triggered summaries.',
    });
  }

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS Companion',
    placeHolder: `Current mode: ${mode}`,
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  if (picked.id === 'showNow') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.showNow');
  } else if (picked.id === 'showDemo') {
    recordCompanionQuickAction();
    await showDemoResumeCard(context);
  } else if (picked.id === 'showLast') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.showLastSummary');
  } else if (picked.id === 'standup') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.generateStandupUpdate');
  } else if (picked.id === 'restoreWorkingSet') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.restoreWorkingSet');
  } else if (picked.id === 'switchPartition') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.switchTaskPartition');
  } else if (picked.id === 'listCheckpointNotes') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.listCheckpointNotes');
  } else if (picked.id === 'openScratchpad') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.openScratchpad');
  } else if (picked.id === 'appendScratchpad') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.appendToScratchpad');
  } else if (picked.id === 'setScratchpadScope') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.setScratchpadScope');
  } else if (picked.id === 'jumpLastEdit') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.jumpToLastEdit');
  } else if (picked.id === 'copyPrompt') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.copyPromptAndOpenCodex');
  } else if (picked.id === 'snoozeAuto') {
    recordCompanionQuickAction();
    await promptAndSetAutoSummarySnooze(context);
  } else if (picked.id === 'quietNow') {
    recordCompanionQuickAction();
    await quietNowSummariesForOneHour(context);
  } else if (picked.id === 'setSummaryQuietHours') {
    recordCompanionQuickAction();
    await promptAndConfigureSummaryQuietHours(context);
  } else if (picked.id === 'configureProvider') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.configureAiProvider');
  } else if (picked.id === 'setupChecklist') {
    recordCompanionQuickAction();
    await runSetupChecklist(context);
  } else if (picked.id === 'openPrivacy') {
    recordCompanionQuickAction();
    await openPrivacySafetyDoc(context);
  } else if (picked.id === 'setPrivacyPreset') {
    recordCompanionQuickAction();
    await promptAndApplyPrivacyPreset(context);
  } else if (picked.id === 'setRetentionPolicy') {
    recordCompanionQuickAction();
    await promptAndSetRetentionPolicy(context);
  } else if (picked.id === 'forgetWorkspace') {
    recordCompanionQuickAction();
    await forgetWorkspaceNow(context);
  } else if (picked.id === 'revokeAiConsent') {
    recordCompanionQuickAction();
    await revokeAiPayloadConsent(context);
  } else if (picked.id === 'rateHelpfulness') {
    recordCompanionQuickAction();
    await promptSummaryHelpfulnessRating();
  } else if (picked.id === 'enable') {
    recordCompanionQuickAction();
    await setEnabled(true);
    void vscode.window.showInformationMessage('TaCoS: automatic summaries enabled.');
  } else if (picked.id === 'togglePause') {
    recordCompanionQuickAction();
    if (mode === 'paused') {
      state.pauseUntilRestart = false;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      await setSummaryQuietUntil(context, 0);
      await setPaused(false);
      void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
    } else {
      state.pauseUntilRestart = false;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
      await setPaused(true);
      recordMetricCounter('pauseActions');
      void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
    }
    rerenderPanel();
  }

  updateCompanionStatusBar();
}

async function showDetailsPanel(
  context: vscode.ExtensionContext,
  summary: ResumeSummary,
  options: Pick<
    PresentSummaryOptions,
    | 'workspaceRoot'
    | 'checkpointPrimaryNote'
    | 'checkpointNotes'
    | 'checkpointScope'
    | 'manualPercolationBypass'
  > = {},
): Promise<void> {
  const demoMode = isDemoResumeSummary(summary);
  const workspaceRoot = demoMode ? undefined : pickWorkspaceRoot(options.workspaceRoot);
  if (!demoMode) {
    updateSummaryScratchpad(summary, workspaceRoot);
  }
  state.panelSummary = summary;
  state.panelWorkspaceRoot = workspaceRoot;
  state.panelCheckpointNotes = sortCheckpointNotes(options.checkpointNotes ?? []);
  state.panelPrimaryCheckpointNote = options.checkpointPrimaryNote;
  state.panelCheckpointScope = options.checkpointScope;
  state.panelManualPercolationBypass = Boolean(options.manualPercolationBypass);
  if (demoMode) {
    state.panelCheckpointNotes = [];
    state.panelPrimaryCheckpointNote = undefined;
    state.panelCheckpointScope = undefined;
    state.panelManualPercolationBypass = false;
    state.panelScratchpadPreviewLines = [];
    state.panelScratchpadExists = false;
    state.panelScratchpadHasContent = false;
    state.panelScratchpadScopeLabel = undefined;
  }

  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel(
      'tacos.details',
      'TaCoS Resume Brief',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [],
      },
    );

    state.panel.onDidDispose(() => {
      state.panel = undefined;
      state.panelSummary = undefined;
      state.panelWorkspaceRoot = undefined;
      state.detailsMarkdownCache = undefined;
      state.panelCheckpointNotes = [];
      state.panelPrimaryCheckpointNote = undefined;
      state.panelCheckpointScope = undefined;
      state.panelManualPercolationBypass = false;
      state.panelScratchpadPreviewLines = [];
      state.panelScratchpadExists = false;
      state.panelScratchpadHasContent = false;
      state.panelScratchpadScopeLabel = undefined;
      state.panelSectionState = undefined;
      state.panelSectionScope = undefined;
    });

    state.panel.webview.onDidReceiveMessage(async (rawMessage: unknown) => {
      const message = parseWebviewMessage(rawMessage);
      if (!message) {
        return;
      }
      const demoMode = isDemoResumeSummary(state.panelSummary);
      if (demoMode && DEMO_MODE_IGNORED_WEBVIEW_MESSAGE_TYPES.has(message.type)) {
        return;
      }
      const blockedPrimaryCta = isBlockedPrimaryCtaMessage(message);
      const blockedPrimaryMetricSession = blockedPrimaryCta ? state.metricSession : undefined;
      const recordBlockedPrimaryClick = (): void => {
        if (blockedPrimaryCta) {
          recordCompanionPrimaryCtaClick();
        }
      };
      const recordBlockedPrimaryCompletion = (
        completed: boolean,
        metricSessionOverride?: MetricRecord,
      ): void => {
        if (blockedPrimaryCta && completed) {
          if (metricSessionOverride) {
            recordCompanionPrimaryCtaCompletionForSession(metricSessionOverride);
            return;
          }
          recordCompanionPrimaryCtaCompletion();
        }
      };

      if (message.type === 'setPanelSectionExpanded') {
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          return;
        }

        await setPanelSectionExpanded(context, workspaceRoot, message.sectionId, message.expanded);
        if (message.sectionId === 'trustCenter' && message.expanded) {
          recordMetricCounter('trustTrayOpens');
          if (resolveCompanionRuntimeMode(getConfig()) === 'restricted') {
            recordMetricCounter('restrictedTrustTrayOpens');
          }
        }
        return;
      }

      if (message.type === 'fixSummary') {
        await captureSummaryCorrection(context);
        return;
      }

      if (message.type === 'dismissDemoResume') {
        state.panel?.dispose();
        return;
      }

      if (message.type === 'sessionAddCheckpoint') {
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        const firstAction = state.panelSummary?.recommendedFirstAction?.trim();
        const seededValue = firstAction ? `Next: ${firstAction}` : undefined;
        recordBlockedPrimaryClick();
        const saved = await promptAndSaveCheckpointNote(context, workspaceRoot, {
          title: 'TaCoS: Capture Session Checkpoint',
          prompt: 'Save a one-line checkpoint for your next resume.',
          placeHolder: 'Example: Continue from parser error and rerun npm test',
          initialValue: seededValue,
        });
        recordBlockedPrimaryCompletion(saved);
        await refreshPanelCheckpointState(context, workspaceRoot);
        rerenderPanel();
        return;
      }

      if (message.type === 'checkpointOpenList') {
        await listCheckpointNotesCommand(context, state.panelWorkspaceRoot);
        await refreshPanelCheckpointState(context, state.panelWorkspaceRoot);
        rerenderPanel();
        return;
      }

      if (message.type === 'openScratchpad') {
        recordCompanionQuickAction();
        await openScratchpadCommand(context, state.panelWorkspaceRoot);
        await refreshPanelScratchpadState(context, state.panelWorkspaceRoot);
        rerenderPanel();
        return;
      }

      if (message.type === 'appendScratchpad') {
        recordCompanionQuickAction();
        await appendToScratchpadCommand(context, state.panelWorkspaceRoot);
        await refreshPanelScratchpadState(context, state.panelWorkspaceRoot);
        rerenderPanel();
        return;
      }

      if (message.type === 'setScratchpadScope') {
        recordCompanionQuickAction();
        await setScratchpadScopeCommand(context, state.panelWorkspaceRoot);
        await refreshPanelScratchpadState(context, state.panelWorkspaceRoot);
        rerenderPanel();
        return;
      }

      if (
        message.type === 'checkpointPinToggle' ||
        message.type === 'checkpointMarkDone' ||
        message.type === 'checkpointDismiss'
      ) {
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        const note = state.panelPrimaryCheckpointNote;
        if (!workspaceRoot || !note) {
          return;
        }

        if (message.type === 'checkpointPinToggle') {
          await updateCheckpointNoteById(context, workspaceRoot, note.id, (current) => ({
            ...current,
            pinned: current.pinned ? undefined : true,
          }));
          if (!note.pinned) {
            recordMetricCounter('notePinned');
          }
        } else if (message.type === 'checkpointMarkDone') {
          await updateCheckpointNoteById(context, workspaceRoot, note.id, (current) => ({
            ...current,
            status: 'done',
            pinned: undefined,
          }));
          recordMetricCounter('noteMarkedDone');
        } else if (message.type === 'checkpointDismiss') {
          await updateCheckpointNoteById(context, workspaceRoot, note.id, (current) => ({
            ...current,
            status: 'dismissed',
            pinned: undefined,
          }));
        }

        await refreshPanelCheckpointState(context, workspaceRoot);
        rerenderPanel();
        return;
      }

      if (message.type === 'copyNextSteps') {
        if (!state.panelSummary) {
          return;
        }

        recordCompanionQuickAction();
        await vscode.env.clipboard.writeText(
          state.panelSummary.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
        );
        void vscode.window.showInformationMessage('TaCoS: next steps copied to clipboard.');
        postPanelStatus('TaCoS: next steps copied to clipboard.');
        return;
      }

      if (message.type === 'copySummary') {
        if (!state.panelSummary) {
          return;
        }

        recordCompanionQuickAction();
        await vscode.env.clipboard.writeText(formatPlainSummary(state.panelSummary));
        void vscode.window.showInformationMessage('TaCoS: summary copied to clipboard.');
        postPanelStatus('TaCoS: summary copied to clipboard.');
        return;
      }

      if (message.type === 'copyPromptAndOpenCodex') {
        if (!state.panelSummary) {
          return;
        }

        recordCompanionQuickAction();
        await copyPromptAndOpenCodex(state.panelSummary);
        return;
      }

      if (message.type === 'refreshSummary') {
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        await triggerSummary(context, 'manual', workspaceRoot);
        recordBlockedPrimaryCompletion(true, blockedPrimaryMetricSession);
        return;
      }

      if (message.type === 'toggleAutoSummaries') {
        const config = getConfig();
        if (!config.enabled) {
          void vscode.window.showInformationMessage(
            'TaCoS: summaries are disabled via tacos.enabled. Enable summaries in Settings first.',
          );
          return;
        }

        recordCompanionQuickAction();
        const wasPaused = config.pauseSummaries || state.pauseUntilRestart;
        if (wasPaused) {
          state.pauseUntilRestart = false;
          state.snoozeUntil = 0;
          await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
          await setSummaryQuietUntil(context, 0);
          await setPaused(false);
          void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
        } else {
          state.snoozeUntil = 0;
          await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
          await setPaused(true);
          recordMetricCounter('pauseActions');
          void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
        }

        rerenderPanel();
        updateCompanionStatusBar();
        return;
      }

      if (message.type === 'openPrivacySafety') {
        recordCompanionQuickAction();
        await openPrivacySafetyDoc(context);
        return;
      }

      if (message.type === 'openAiPayloadPreview') {
        recordCompanionQuickAction();
        await openAiPayloadPreviewFromPanel(context);
        return;
      }

      if (message.type === 'revokeAiPayloadConsent') {
        recordCompanionQuickAction();
        await revokeAiPayloadConsent(context);
        rerenderPanel();
        return;
      }

      if (message.type === 'whySurfacedOpened') {
        recordMetricCounter('whySurfacedOpens');
        return;
      }

      if (message.type === 'rateHelpfulness') {
        recordCompanionQuickAction();
        await promptSummaryHelpfulnessRating();
        return;
      }

      if (message.type === 'acknowledgeNudge' || message.type === 'dismissNudge') {
        if (!state.panelSummary) {
          return;
        }

        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        recordCompanionQuickAction();
        const status: CompanionNudgeFeedbackStatus =
          message.type === 'dismissNudge' ? 'dismissed' : 'acknowledged';
        await setNudgeFeedbackForCurrentContext(context, workspaceRoot, state.panelSummary, status);
        if (status === 'dismissed') {
          await rememberPercolationPrimaryForSummary(
            context,
            workspaceRoot,
            state.panelSummary,
            'dismissed',
            Date.now() + PERCOLATION_DISMISS_MEMORY_MS,
          );
        }
        void vscode.window.showInformationMessage(
          message.type === 'dismissNudge'
            ? 'TaCoS: nudge dismissed for this context.'
            : 'TaCoS: nudge acknowledged for this context.',
        );
        return;
      }

      if (message.type === 'resumePathToggle') {
        if (!state.panelSummary) {
          return;
        }

        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        const nextState = await setResumePathStepCompletion(
          context,
          workspaceRoot,
          state.panelSummary,
          message.stepId,
          message.completed,
        );
        state.panelSummary.resumePathCompletedStepIds = [...nextState.completedStepIds];
        state.panelSummary.resumePathCollapsed = nextState.collapsed;
        rerenderPanel();
        return;
      }

      if (message.type === 'setIntentOverride' || message.type === 'clearIntentOverride') {
        if (!state.panelSummary) {
          return;
        }

        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        const contextHash = state.panelSummary.contextHash;
        const rawIntent = message.type === 'setIntentOverride' ? message.intent : undefined;
        await applyIntentOverrideToActiveContext(context, workspaceRoot, contextHash, rawIntent);
        rerenderPanel();
        return;
      }

      if (message.type === 'runNextStepAction') {
        if (!state.panelSummary) {
          return;
        }

        const isPrimaryStep = message.primarySurface === 'home';
        const outcome = await runNextStepActionDetailed(
          state.panelSummary,
          message.stepIndex,
          state.panelWorkspaceRoot,
        );
        if (outcome.attempted) {
          recordCompanionQuickAction();
        }
        if (outcome.completed) {
          recordMetricCounter('resumePathCompletions');
        }
        if (isPrimaryStep && outcome.attempted) {
          recordCompanionPrimaryCtaClick();
        }
        if (isPrimaryStep && outcome.completed) {
          recordCompanionPrimaryCtaCompletion();
        }
        return;
      }

      if (message.type === 'blockedLink') {
        void vscode.window.showWarningMessage(
          'TaCoS blocked a link that was not part of the validated summary link list.',
        );
        postPanelStatus(
          'TaCoS blocked a link that was not part of the validated summary link list.',
        );
        return;
      }

      if (message.type === 'restoreJumpToLastEdit') {
        recordCompanionQuickAction();
        await jumpToRecentEdit(context, state.panelWorkspaceRoot);
        return;
      }

      if (message.type === 'restoreWorkingSet') {
        recordCompanionQuickAction();
        await restoreWorkingSetCommand(context);
        return;
      }

      if (message.type === 'restoreOpenProblems') {
        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        await openProblemsView();
        recordBlockedPrimaryCompletion(true);
        return;
      }

      if (message.type === 'restoreOpenDiagnosticFile') {
        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        const completed = await openPrimaryDiagnosticFile(state.panelWorkspaceRoot);
        recordBlockedPrimaryCompletion(completed);
        return;
      }

      if (message.type === 'restoreReopenFiles') {
        recordCompanionQuickAction();
        const opened = await reopenSummaryFiles(state.panelSummary, 6, state.panelWorkspaceRoot);
        if (opened === 0) {
          void vscode.window.showInformationMessage('TaCoS: no recent files available to reopen.');
        }
        return;
      }

      if (message.type === 'restoreOpenChangedFiles') {
        recordCompanionQuickAction();
        const opened = await openChangedSummaryFiles(
          state.panelSummary,
          6,
          state.panelWorkspaceRoot,
        );
        if (opened === 0) {
          void vscode.window.showInformationMessage('TaCoS: no changed files available to open.');
        }
        return;
      }

      if (message.type === 'restoreRerunTask') {
        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        const completed = await rerunLastTask();
        recordBlockedPrimaryCompletion(completed);
        return;
      }

      if (message.type === 'restoreRerunDebug') {
        recordCompanionQuickAction();
        await rerunLastDebugSession();
        return;
      }

      if (message.type === 'restoreCheckoutPreviousBranch') {
        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        const completed = await checkoutPreviousBranch(
          state.panelSummary,
          state.panelWorkspaceRoot,
        );
        recordBlockedPrimaryCompletion(completed);
        return;
      }

      if (message.type === 'restoreCopyFailingCommand') {
        recordCompanionQuickAction();
        recordBlockedPrimaryClick();
        const completed = await copyFailingCommand();
        recordBlockedPrimaryCompletion(completed);
        return;
      }

      if (message.type === 'openEvidence') {
        const evidence = (state.panelSummary?.evidenceCatalog ?? []).find(
          (item) => item.id === message.evidenceId,
        );
        if (!evidence || (evidence.kind !== 'file' && evidence.kind !== 'url')) {
          void vscode.window.showWarningMessage('TaCoS blocked an unsupported evidence link.');
          return;
        }

        if (evidence.kind === 'file') {
          const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
          if (!workspaceRoot) {
            void vscode.window.showWarningMessage(
              'TaCoS blocked file evidence because no workspace root is available for validation.',
            );
            return;
          }

          const safeTarget = resolveFileTargetInWorkspace(evidence.target ?? '', workspaceRoot);
          if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
            void vscode.window.showWarningMessage('TaCoS blocked an unsafe file evidence target.');
            return;
          }

          recordCompanionQuickAction();
          await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
          return;
        }

        const safeUrl = normalizeHttpUrl(evidence.target ?? '');
        if (!safeUrl) {
          void vscode.window.showWarningMessage('TaCoS blocked an unsafe evidence URL.');
          return;
        }

        recordCompanionQuickAction();
        await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
        return;
      }

      if (message.type === 'openTopFile') {
        const file = state.panelSummary?.topFiles[message.index];
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!file || !workspaceRoot) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked file link because no workspace root is available for validation.',
          );
          return;
        }

        const safeTarget = resolveFileTargetInWorkspace(file, workspaceRoot);
        if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked an unsafe file link from the summary.',
          );
          return;
        }

        recordCompanionQuickAction();
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
        return;
      }

      if (message.type !== 'openLink') {
        return;
      }

      const link = state.panelSummary?.links[message.index];
      if (!link) {
        return;
      }

      if (link.kind === 'file') {
        const summary = state.panelSummary;
        const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
        if (!summary || !workspaceRoot) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked file link because no workspace root is available for validation.',
          );
          return;
        }

        if (!isSummaryLinkEvidenceGrounded(summary, link, workspaceRoot)) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked a file link that is not evidence-grounded.',
          );
          return;
        }

        const safeTarget = resolveFileTargetInWorkspace(link.target, workspaceRoot);
        if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked an unsafe file link from the summary.',
          );
          return;
        }

        recordCompanionQuickAction();
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
        return;
      }

      if (link.kind === 'url') {
        const summary = state.panelSummary;
        if (!summary || !isSummaryLinkEvidenceGrounded(summary, link)) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked an external link that is not evidence-grounded.',
          );
          return;
        }

        const safeUrl = normalizeHttpUrl(link.target);
        if (!safeUrl) {
          void vscode.window.showWarningMessage(
            'TaCoS blocked an unsafe external link from the summary.',
          );
          return;
        }

        recordCompanionQuickAction();
        await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
      }
    });
  }

  if (!demoMode && workspaceRoot) {
    if (options.checkpointNotes && options.checkpointScope) {
      state.panelCheckpointNotes = sortCheckpointNotes(options.checkpointNotes);
      state.panelPrimaryCheckpointNote =
        options.checkpointPrimaryNote ?? selectPrimaryCheckpointNote(state.panelCheckpointNotes);
      state.panelCheckpointScope = options.checkpointScope;
      if (state.panelSummary) {
        const nextSummary = applyCheckpointNoteToSummary(
          state.panelSummary,
          state.panelPrimaryCheckpointNote,
        );
        state.panelSummary = nextSummary;
        updateSummaryScratchpad(nextSummary, workspaceRoot);
      }
    } else {
      await refreshPanelCheckpointState(context, workspaceRoot);
    }
    await refreshPanelScratchpadState(context, workspaceRoot);
  }

  rerenderPanel();
  state.panel.reveal(vscode.ViewColumn.Beside, true);
}

function updateSummaryScratchpad(summary: ResumeSummary, workspaceRoot?: string): void {
  state.scratchSummary = summary;
  updateCompanionStatusBar();

  if (!state.panel) {
    return;
  }

  state.panelSummary = summary;
  if (workspaceRoot) {
    state.panelWorkspaceRoot = workspaceRoot;
  }
  rerenderPanel();
}

function titleForSummary(summary: ResumeSummary): string {
  if (isDemoResumeSummary(summary)) {
    return 'TaCoS Resume Brief (Sample)';
  }

  return summary.source === 'local' ? 'TaCoS Resume Brief' : 'TaCoS Resume Brief (Refined)';
}

function isDemoResumeSummary(summary: ResumeSummary | undefined): boolean {
  return summary?.contextHash === DEMO_RESUME_CONTEXT_HASH;
}

function rerenderPanel(): void {
  if (!state.panel || !state.panelSummary) {
    return;
  }

  const rerenderStartNs = monotonicNowNs();
  state.panel.title = titleForSummary(state.panelSummary);
  const webviewRenderStartNs = monotonicNowNs();
  const webviewHtml = renderWebview(
    state.panel.webview,
    state.panelSummary,
    state.panelCheckpointNotes,
    state.panelPrimaryCheckpointNote,
  );
  recordPerformanceGuardrail(
    'webview-render',
    state.perfWebviewRender,
    durationMsSince(webviewRenderStartNs),
    PERF_WEBVIEW_RENDER_SLOW_MS,
    `evidence=${state.panelSummary.evidenceCatalog?.length ?? 0}`,
  );
  state.panel.webview.html = webviewHtml;
  recordPerformanceGuardrail(
    'panel-rerender',
    state.perfPanelRerender,
    durationMsSince(rerenderStartNs),
    PERF_PANEL_RERENDER_SLOW_MS,
    `evidence=${state.panelSummary.evidenceCatalog?.length ?? 0}`,
  );
}

function postPanelStatus(message: string): void {
  if (!state.panel || !message.trim()) {
    return;
  }
  void state.panel.webview.postMessage({ type: 'panelStatus', message });
}

function renderDetailsMarkdown(summary: ResumeSummary): string {
  const detailsMarkdown = summary.detailsMarkdown ?? '';
  const cached = state.detailsMarkdownCache;
  if (
    cached &&
    cached.contextHash === summary.contextHash &&
    cached.detailsMarkdown === detailsMarkdown
  ) {
    return cached.html;
  }

  const html = markdownRenderer.render(detailsMarkdown);
  state.detailsMarkdownCache = {
    contextHash: summary.contextHash,
    detailsMarkdown,
    html,
  };
  return html;
}

function renderWebview(
  webview: vscode.Webview,
  summary: ResumeSummary,
  checkpointNotes: CheckpointNote[],
  primaryCheckpointNote?: CheckpointNote,
): string {
  const nonce = createNonce();
  const cspMetaTag = buildWebviewCspMetaTag(webview.cspSource, nonce);
  const config = getConfig();
  const demoMode = isDemoResumeSummary(summary);
  const evidenceById = new Map(
    (summary.evidenceCatalog ?? []).map((item) => [item.id, item] as const),
  );
  const timelineGroups = config.showTimeline
    ? buildTimelineGroups(summary.evidenceCatalog ?? [], Date.now())
    : [];
  const openCheckpointNotes = sortCheckpointNotes(
    checkpointNotes.filter((note) => note.status === 'open'),
  );
  const openCheckpointCount = openCheckpointNotes.length;
  const primaryOpenCheckpoint =
    primaryCheckpointNote?.status === 'open' ? primaryCheckpointNote : undefined;
  const currentCheckpointNote = primaryOpenCheckpoint ?? openCheckpointNotes[0];
  const checkpointCard = demoMode
    ? ''
    : renderCheckpointCard({
        openCheckpointCount,
        currentCheckpointNote: currentCheckpointNote
          ? {
              text: currentCheckpointNote.text,
              file: currentCheckpointNote.file,
              line: currentCheckpointNote.line,
              branch: currentCheckpointNote.branch,
              partition: currentCheckpointNote.partition,
              pinned: currentCheckpointNote.pinned,
            }
          : undefined,
      });
  const scratchpadPreviewLines = state.panelScratchpadPreviewLines.slice(
    0,
    SCRATCHPAD_PREVIEW_MAX_LINES,
  );
  const scratchpadScopeLabel = state.panelScratchpadScopeLabel?.trim() ?? '';
  const showScratchpadCard = state.panelScratchpadExists || state.panelScratchpadHasContent;
  const scratchpadCard = demoMode
    ? ''
    : renderScratchpadCard({
        showScratchpadCard,
        scratchpadScopeLabel,
        scratchpadPreviewLines,
        scratchpadHasContent: state.panelScratchpadHasContent,
      });
  const hasLongGap = Boolean(summary.longGap);
  const confidenceCard = renderConfidenceCard({
    longGap: hasLongGap,
    lowConfidence: Boolean(summary.lowConfidence),
    hasCurrentCheckpointNote: Boolean(currentCheckpointNote),
    resumeGapMinutes: summary.resumeGapMinutes,
    lastActionLabel: summary.lastActionLabel,
    recommendedFirstAction: summary.recommendedFirstAction,
    firstNextStep: summary.nextSteps[0],
    candidateIntents: summary.candidateIntents,
  });
  const linkItems = renderTopLinksListItems(summary.links);

  const mode = summary.mode ?? 'coding';
  const panelWorkspaceRoot = demoMode ? undefined : pickWorkspaceRoot(state.panelWorkspaceRoot);
  const intentInputId = 'intent-override-input';
  const intentEditorHtml = renderIntentEditor({
    intentInputId,
    intent: summary.intent,
    intentOverridden: summary.intentOverridden,
    readOnly: demoMode,
  });
  const trusted = vscode.workspace.isTrusted;
  const hasLastTask = !demoMode && Boolean(state.lastTaskName);
  const hasLastDebug = !demoMode && Boolean(state.lastDebugConfigName);
  const availability = computeRestoreAvailability({
    trusted,
    hasLastTask,
    hasLastDebug,
    hasFailingCommand: !demoMode && Boolean(getCopyableFailingCommand()),
    hasRecentEditLocation: !demoMode && state.recentEditLocations.length > 0,
    currentBranch: demoMode ? undefined : summary.currentBranch,
    previousBranch: demoMode ? undefined : summary.previousBranch,
  });
  const diagnostics = demoMode
    ? { errorCount: 0, warningCount: 0, top: undefined }
    : collectWorkspaceDiagnostics(panelWorkspaceRoot);
  const hasFailingTask =
    !demoMode &&
    Boolean(state.lastTaskName) &&
    Number.isInteger(state.lastTaskExitCode) &&
    (state.lastTaskExitCode ?? 0) !== 0;
  const percolationMode = resolveCompanionRuntimeMode(config);
  const panelPercolationSuppression =
    !demoMode && state.panelManualPercolationBypass
      ? { suppressed: false, reason: undefined, nextEligibleAt: undefined }
      : evaluatePercolationSuppression({
          enabled: config.enabled,
          mode: percolationMode,
          now: Date.now(),
          quietHours: config.summaryQuietHours,
          contextUnchanged: state.lastSummaryContextUnchanged,
        });
  const rankedPrimaryCandidate =
    panelPercolationSuppression.suppressed || demoMode
      ? undefined
      : rankPercolationForSummary(summary, percolationMode, {
          context: activeExtensionContext,
          workspaceRoot: panelWorkspaceRoot,
        }).primary;
  const canOpenProblems = diagnostics.errorCount > 0 || diagnostics.warningCount > 0;
  const canOpenDiagnosticFile = Boolean(diagnostics.top);
  const trustCue = buildTrustCue(summary);
  const nextStepActions = demoMode ? [] : buildNextStepActionCandidates(summary);
  const primaryNextAction = nextStepActions.find((candidate): candidate is NextStepAction =>
    Boolean(candidate),
  );
  const primaryNextActionStepIndex = primaryNextAction?.stepIndex ?? -1;
  const directNextActionSummary =
    primaryNextActionStepIndex >= 0 ? (summary.nextSteps[primaryNextActionStepIndex] ?? '') : '';
  const switchedBranches =
    !demoMode &&
    Boolean(summary.currentBranch) &&
    Boolean(summary.previousBranch) &&
    summary.currentBranch !== summary.previousBranch;
  const blockerDecision = decidePrimaryBlocker({
    trusted,
    longGap: Boolean(summary.longGap),
    lowConfidence: Boolean(summary.lowConfidence),
    hasCheckpointNote: Boolean(currentCheckpointNote),
    hasFailingTask,
    lastTaskName: demoMode ? undefined : state.lastTaskName,
    lastTaskExitCode: demoMode ? undefined : state.lastTaskExitCode,
    lastFailingCommand: demoMode ? undefined : summary.lastFailingCommand,
    diagnosticsErrorCount: diagnostics.errorCount,
    diagnosticsTopPath: diagnostics.top?.path,
    diagnosticsTopLine: diagnostics.top?.line,
    switchedBranches,
    currentBranch: demoMode ? undefined : summary.currentBranch,
    previousBranch: demoMode ? undefined : summary.previousBranch,
    hasNextSteps: summary.nextSteps.length > 0,
    canOpenProblems,
    canOpenDiagnosticFile,
    availability,
  });
  const primaryCtaDecision = resolveCompanionPrimaryCtaDecision({
    primaryNextAction,
    blockerDecision,
  });
  const hasPrimaryNextAction = primaryCtaDecision.winner === 'next' && Boolean(primaryNextAction);
  const hasPrimaryBlockedAction =
    primaryCtaDecision.winner === 'blocked' &&
    Boolean(blockerDecision.action) &&
    !blockerDecision.action?.disabled;
  const primaryNextActionSummary =
    directNextActionSummary || selectPanelPrimarySummary(summary, rankedPrimaryCandidate);
  const primaryNextActionDisabledAttr = demoMode ? 'disabled aria-disabled="true"' : '';
  const primaryNextActionPrimaryAttr = hasPrimaryNextAction
    ? 'data-primary-next-safe-action="home" '
    : '';
  const primaryNextActionClassAttr = hasPrimaryNextAction ? '' : 'class="secondary" ';
  const companionPrimaryNextActionButton = primaryNextAction
    ? `<button type="button" ${primaryNextActionClassAttr}${primaryNextActionPrimaryAttr}data-action="runNextStepAction" data-step-index="${primaryNextActionStepIndex}" ${primaryNextActionDisabledAttr}>${escapeHtml(primaryNextAction.label)}</button>`
    : '';
  const primaryNextActionEvidence =
    hasPrimaryNextAction && primaryNextAction
      ? evidenceById.get(primaryNextAction.evidenceId)
      : undefined;
  const primaryNextStepRationale =
    hasPrimaryNextAction && primaryNextAction
      ? describeNextStepActionRationale(primaryNextAction, primaryNextActionEvidence)
      : '';
  const primaryNextStepRationaleHtml = primaryNextStepRationale
    ? `<details><summary><strong>Why this next step?</strong></summary><p class="muted" data-next-step-rationale="true">${escapeHtml(primaryNextStepRationale)}</p></details>`
    : '';
  const companionNextSteps = renderCompanionNextSteps({
    nextSteps: summary.nextSteps,
    nextStepEvidenceIds: summary.nextStepEvidenceIds,
    nextStepActions,
    primaryNextActionStepIndex,
    lowConfidence: Boolean(summary.lowConfidence),
    evidenceById,
  });
  const topFiles = renderTopFilesListItems(summary.topFiles);
  const evidenceCatalog = summary.evidenceCatalog ?? [];
  const evidenceGroups = buildEvidenceRelevanceGroups(
    evidenceCatalog,
    rankedPrimaryCandidate?.evidenceIds ?? [],
  );
  const evidenceItems =
    evidenceGroups.length > 0
      ? renderGroupedEvidenceListItems(evidenceGroups)
      : '<li>None captured</li>';
  const hiddenEvidenceCount = Math.max(0, evidenceCatalog.length - 5);
  const recapDoneItems = summary.doneSinceLastResume?.slice(0, 3) ?? [];
  const recapPendingItems = summary.pendingBlocked?.slice(0, 3) ?? [];
  const recapDoneList = recapDoneItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const recapPendingList = recapPendingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const nowCheckpointLine = currentCheckpointNote
    ? `<p class="companion-meta"><strong>Checkpoint:</strong> ${escapeHtml(currentCheckpointNote.text)}</p>`
    : '';
  const lastActionLabel = summary.lastActionLabel?.trim() || 'No last action captured yet.';
  const lastActionContext = summary.lastActionContext?.trim();
  const lastActionEvidence = summary.lastActionEvidenceId
    ? evidenceById.get(summary.lastActionEvidenceId)
    : undefined;
  const canOpenLastActionEvidence =
    Boolean(lastActionEvidence) &&
    (lastActionEvidence?.kind === 'file' || lastActionEvidence?.kind === 'url');
  const lastActionActionHtml = canOpenLastActionEvidence
    ? `<button type="button" class="secondary" data-action="openEvidence" data-evidence-id="${escapeHtml(summary.lastActionEvidenceId ?? '')}">Open last action</button>`
    : '';
  const activeNudgeDecision =
    !demoMode && state.activeNudges?.contextHash === summary.contextHash
      ? state.activeNudges.decision
      : undefined;
  const primaryNudge = activeNudgeDecision?.primary;
  const secondaryNudge = activeNudgeDecision?.secondary;
  const nudgeSuppressionLabel = describeCompanionNudgeSuppression(activeNudgeDecision, {
    formatTimestamp,
  });
  const primaryNudgeReason = primaryNudge ? describeCompanionNudgeReason(primaryNudge) : '';
  const secondaryNudgeReason = secondaryNudge ? describeCompanionNudgeReason(secondaryNudge) : '';
  const nudgeExplainability =
    primaryNudge || nudgeSuppressionLabel
      ? `<details>
        <summary><strong>${primaryNudge ? 'Why this nudge?' : 'Why no nudge right now?'}</strong></summary>
        ${
          primaryNudge
            ? `<ul class="compact-list">
            <li>${escapeHtml(primaryNudgeReason)}</li>
            ${
              secondaryNudge
                ? `<li>Secondary action rationale: ${escapeHtml(secondaryNudgeReason)}</li>`
                : ''
            }
          </ul>`
            : `<p class="muted">${escapeHtml(nudgeSuppressionLabel)}</p>`
        }
      </details>`
      : '';
  const explainabilityPayload = buildPercolationExplainabilityPayload({
    summary,
    primary: rankedPrimaryCandidate,
    suppressionReason: panelPercolationSuppression.reason,
  });
  const percolationExplainabilityTrustedHtml = formatPercolationExplainabilityLines(
    explainabilityPayload,
  )
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');
  const blockerTitle = blockerDecision.title;
  const blockerDetail = blockerDecision.detail;
  const blockerAction = blockerDecision.action;
  const blockerActionDisabledAttr = blockerAction?.disabled ? 'disabled aria-disabled="true"' : '';
  const blockerActionClassAttr = hasPrimaryBlockedAction ? '' : ' class="secondary"';
  const blockerActionPrimaryAttr = hasPrimaryBlockedAction
    ? ' data-blocker-primary-action="true"'
    : '';
  const blockerActionAdvisoryAttr = hasPrimaryBlockedAction
    ? ''
    : ' data-blocker-advisory-action="true"';
  const blockerActionHtml = blockerAction
    ? `<button type="button"${blockerActionClassAttr}${blockerActionPrimaryAttr}${blockerActionAdvisoryAttr} data-action="${escapeHtml(
        blockerAction.type,
      )}" ${blockerActionDisabledAttr}>${escapeHtml(blockerAction.label)}</button>`
    : '';
  const blockerMetaBadges = blockerDecision.hasBlocker
    ? [
        blockerDecision.evidenceLabel
          ? `<span class="badge">Evidence: ${escapeHtml(blockerDecision.evidenceLabel)}</span>`
          : '',
        blockerDecision.confidenceLabel
          ? `<span class="badge">Confidence: ${escapeHtml(blockerDecision.confidenceLabel)}</span>`
          : '',
      ]
        .filter(Boolean)
        .join('')
    : '';
  const blockerMetaHtml = blockerMetaBadges
    ? `<div class="step-evidence">${blockerMetaBadges}</div>`
    : '';
  const blockerSuppressionHintHtml =
    blockerDecision.kind === 'restricted'
      ? '<p class="muted blocker-disabled-reason"><strong>SUPPRESSED:</strong> Restricted Mode filtered task/debug rerun and branch checkout actions until workspace trust is granted.</p>'
      : '';
  const blockerDisabledReasonHtml =
    blockerDecision.hasBlocker && blockerAction?.disabled && blockerAction.disabledReason
      ? `${blockerSuppressionHintHtml}<p class="muted blocker-disabled-reason">Unavailable: ${escapeHtml(
          blockerAction.disabledReason,
        )}</p>`
      : blockerSuppressionHintHtml;
  const companionSlotSources = resolveCompanionSlotSourceClasses(
    summary,
    primaryNextAction,
    rankedPrimaryCandidate,
    blockerDecision,
    primaryCtaDecision,
  );
  if (!demoMode && primaryCtaDecision.winner !== 'none') {
    recordCompanionPrimaryCtaImpression(companionSlotSources.primaryCta);
  }
  const evidenceTrayActionHtml =
    '<button type="button" class="secondary" data-action="openEvidenceTray">Open evidence tray</button>';
  const panelSectionState =
    activeExtensionContext && panelWorkspaceRoot
      ? resolvePanelSectionState(activeExtensionContext, panelWorkspaceRoot)
      : createPanelSectionState(undefined);
  const expandedSections = new Set(panelSectionState.expandedSectionIds);
  const resumePathState =
    activeExtensionContext && panelWorkspaceRoot
      ? resolveResumePathStateForSummary(activeExtensionContext, panelWorkspaceRoot, summary)
      : createResumePathState(summary.contextHash);
  summary.resumePathCompletedStepIds = [...resumePathState.completedStepIds];
  summary.resumePathCollapsed = resumePathState.collapsed;
  const resumePathSteps = buildResumePathSteps(blockerDecision.hasBlocker).slice(0, 3);
  const resumePathCompleted = isResumePathComplete(resumePathState);
  const resumePathCard = renderResumePathCard({
    completed: resumePathCompleted,
    collapsed: resumePathState.collapsed,
    readOnly: demoMode,
    steps: resumePathSteps.map((step) => ({
      id: step.id,
      label: step.label,
      detail: step.detail,
      checked: resumePathState.completedStepIds.includes(step.id),
    })),
  });

  const demoDisabledAttr = demoMode ? 'disabled aria-disabled="true"' : '';
  const restoreActionButtons = {
    workingSet: `<button type="button" data-action="restoreWorkingSet" ${demoDisabledAttr}>Restore working set</button>`,
    jumpToLastEdit: `<button type="button" data-action="restoreJumpToLastEdit" ${availability.canJumpToLastEdit && !demoMode ? '' : 'disabled aria-disabled="true"'}>Jump to last edit</button>`,
    reopenFiles: `<button type="button" data-action="restoreReopenFiles" ${demoDisabledAttr}>Reopen files</button>`,
    openChangedFiles: `<button type="button" data-action="restoreOpenChangedFiles" ${demoDisabledAttr}>Open changed files</button>`,
    rerunTask: `<button type="button" data-action="restoreRerunTask" ${availability.canRerunTask && !demoMode ? '' : 'disabled aria-disabled="true"'}>Rerun task</button>`,
    rerunDebug: `<button type="button" data-action="restoreRerunDebug" ${availability.canRerunDebug && !demoMode ? '' : 'disabled aria-disabled="true"'}>Rerun debug</button>`,
    openProblems: `<button type="button" data-action="restoreOpenProblems" ${canOpenProblems && !demoMode ? '' : 'disabled aria-disabled="true"'}>Open Problems</button>`,
    openDiagnosticFile: `<button type="button" data-action="restoreOpenDiagnosticFile" ${canOpenDiagnosticFile && !demoMode ? '' : 'disabled aria-disabled="true"'}>Open diagnostic file</button>`,
    checkoutPreviousBranch: `<button type="button" data-action="restoreCheckoutPreviousBranch" ${availability.canCheckoutPreviousBranch && !demoMode ? '' : 'disabled aria-disabled="true"'}>Checkout previous branch</button>`,
    copyFailingCommand: `<button type="button" data-action="restoreCopyFailingCommand" ${availability.canCopyFailingCommand && !demoMode ? '' : 'disabled aria-disabled="true"'}>Copy failing command</button>`,
  };

  const companionRestoreSections = renderGroupedActionSections({
    groups: [
      {
        label: 'Open',
        buttonsTrustedHtml: [
          restoreActionButtons.workingSet,
          restoreActionButtons.jumpToLastEdit,
          restoreActionButtons.reopenFiles,
          restoreActionButtons.openChangedFiles,
        ],
      },
      {
        label: 'Run',
        buttonsTrustedHtml: [restoreActionButtons.rerunTask, restoreActionButtons.rerunDebug],
      },
      {
        label: 'Diagnose',
        buttonsTrustedHtml: [
          restoreActionButtons.openProblems,
          restoreActionButtons.openDiagnosticFile,
        ],
      },
    ],
    headingTag: 'h5',
    sectionClassName: 'action-group compact-action-group',
    buttonContainerClassName: 'companion-restore-grid',
  });
  const restoreUnavailableReasons: string[] = [];
  if (!demoMode && !availability.canJumpToLastEdit) {
    restoreUnavailableReasons.push(
      'Jump to last edit is unavailable: no recent edit was captured.',
    );
  }
  if (!demoMode && !availability.canRerunTask) {
    const reason = describeRerunTaskUnavailableReason({ trusted, hasLastTask });
    if (reason) {
      restoreUnavailableReasons.push(reason);
    }
  }
  if (!demoMode && !availability.canRerunDebug) {
    const reason = describeRerunDebugUnavailableReason({ trusted, hasLastDebug });
    if (reason) {
      restoreUnavailableReasons.push(reason);
    }
  }
  if (!demoMode && !availability.canCheckoutPreviousBranch) {
    const reason = describeCheckoutPreviousBranchUnavailableReason({
      trusted,
      currentBranch: summary.currentBranch,
      previousBranch: summary.previousBranch,
    });
    if (reason) {
      restoreUnavailableReasons.push(reason);
    }
  }
  if (!demoMode && !canOpenProblems) {
    restoreUnavailableReasons.push(
      'Open Problems is unavailable: no workspace diagnostics are active.',
    );
  }
  if (!demoMode && !canOpenDiagnosticFile) {
    restoreUnavailableReasons.push(
      'Open diagnostic file is unavailable: no primary diagnostic file was detected.',
    );
  }
  const restoreUnavailableHints =
    !demoMode && restoreUnavailableReasons.length > 0
      ? `<details><summary><strong>Why are some actions unavailable?</strong></summary><ul class="compact-list">${restoreUnavailableReasons
          .map((reason) => `<li>${escapeHtml(reason)}</li>`)
          .join('')}</ul></details>`
      : '';

  const quickActionGroups = renderGroupedActionSections({
    groups: [
      {
        label: 'Copy',
        buttonsTrustedHtml: [
          '<button type="button" data-action="copySummary">Copy summary</button>',
        ],
      },
      {
        label: 'Notes & Feedback',
        buttonsTrustedHtml: [
          `<button type="button" class="secondary" data-action="sessionAddCheckpoint" ${demoDisabledAttr}>Add note</button>`,
          `<button type="button" class="secondary" data-action="checkpointOpenList" ${demoDisabledAttr}>List notes</button>`,
          `<button type="button" data-action="rateHelpfulness" ${demoDisabledAttr}>Rate helpfulness</button>`,
          `<button type="button" class="secondary" data-action="fixSummary" ${demoDisabledAttr}>Fix summary</button>`,
        ],
      },
    ],
    headingTag: 'h4',
    sectionClassName: 'action-group',
    buttonContainerClassName: 'quick-actions',
  });

  const restorePackGroups = renderGroupedActionSections({
    groups: [
      {
        label: 'Context',
        buttonsTrustedHtml: [restoreActionButtons.checkoutPreviousBranch],
      },
      {
        label: 'Copy',
        buttonsTrustedHtml: [restoreActionButtons.copyFailingCommand],
      },
    ],
    headingTag: 'h4',
    sectionClassName: 'action-group',
    buttonContainerClassName: 'restore-grid',
  });

  const detailsHtml = renderDetailsMarkdown(summary);
  const sourceLabel = demoMode
    ? 'Sample resume brief (demo)'
    : summary.source === 'local'
      ? 'Local summary (instant)'
      : 'Refined summary (AI)';
  const generatedAtLabel = formatTimestamp(summary.generatedAt);
  const localGeneratedAtLabel = summary.localGeneratedAt
    ? formatTimestamp(summary.localGeneratedAt)
    : undefined;
  const refinementActive = isRefinementActiveForSummary(
    state.activeRefinementContextHash,
    summary.contextHash,
  );
  const statusHint = demoMode
    ? 'Sample data only; no workspace evidence is mixed into this view.'
    : summary.source === 'local'
      ? refinementActive
        ? 'AI refinement in progress.'
        : 'Running local-only summary.'
      : localGeneratedAtLabel
        ? `Started local at ${localGeneratedAtLabel}.`
        : 'AI refinement complete.';
  const autoSummariesDisabled = !config.enabled;
  const autoSummariesPaused =
    !autoSummariesDisabled && (config.pauseSummaries || state.pauseUntilRestart);
  const summaryQuietState = resolveSummaryQuietState(Date.now(), config.summaryQuietHours);
  const autoSummariesSnoozed =
    !autoSummariesDisabled && !autoSummariesPaused && state.snoozeUntil > Date.now();
  const autoSummariesQuieted =
    !autoSummariesDisabled &&
    !autoSummariesPaused &&
    !autoSummariesSnoozed &&
    summaryQuietState.active;
  const companionRuntimeMode = resolveCompanionRuntimeMode(config);
  const trustTrackingLabel = demoMode
    ? 'sample'
    : companionRuntimeMode === 'restricted'
      ? 'restricted'
      : companionRuntimeMode === 'paused'
        ? 'paused'
        : companionRuntimeMode === 'disabled'
          ? 'disabled'
          : 'on';
  const sentToAiLabel = demoMode
    ? 'Nothing. Demo mode never sends sample data.'
    : config.summaryProvider === 'local'
      ? 'Nothing (local-only mode).'
      : companionRuntimeMode === 'restricted'
        ? 'Nothing while Restricted Mode is active (AI refinement disabled).'
        : 'Redacted summary context, evidence, and your checkpoint notes when AI refinement runs.';
  const collectionPolicyLabel = demoMode
    ? 'Sample mode'
    : companionRuntimeMode === 'restricted'
      ? 'Restricted Mode filters git execution signals and terminal command collection.'
      : companionRuntimeMode === 'paused'
        ? 'Local signal collection stays on while companion surfacing is paused.'
        : companionRuntimeMode === 'disabled'
          ? 'Companion surfacing is disabled until tacos.enabled is re-enabled.'
          : 'Local signal collection is active; quiet/cooldown/no-change policy can still suppress surfacing.';
  const storedLocallyLabel = demoMode
    ? 'Sample card is generated in memory and not mixed with workspace snapshots.'
    : 'Redacted activity snapshots, summary cache, checkpoint notes, scratchpad files, and local metrics.';
  const privacyPresetLabel = demoMode ? 'Sample mode' : PRIVACY_PRESET_LABELS[config.privacyPreset];
  const retentionPolicyLabel = demoMode
    ? 'Sample mode'
    : RETENTION_POLICY_LABELS[config.retentionPolicy];
  const aiProviderModeLabel = demoMode
    ? 'Demo mode (no provider sends).'
    : resolveAiProviderModeLabel(config, companionRuntimeMode);
  const aiConsentStatusLabel = demoMode
    ? 'Not required in sample mode.'
    : resolveAiConsentStatusLabel(
        activeExtensionContext,
        panelWorkspaceRoot,
        config,
        companionRuntimeMode,
      );
  const storedAiConsentSignature =
    !demoMode && activeExtensionContext && panelWorkspaceRoot
      ? activeExtensionContext.workspaceState
          .get<string>(aiPayloadConsentKey(panelWorkspaceRoot), '')
          .trim()
      : '';
  const aiPayloadPreviewDisabledAttr = demoMode ? 'disabled aria-disabled="true"' : '';
  const revokeAiConsentDisabledAttr =
    demoMode || !storedAiConsentSignature ? 'disabled aria-disabled="true"' : '';
  const trustCueDetails = trustCue.details.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const autoSummaryStatusLabel = autoSummariesDisabled
    ? 'Auto summaries disabled'
    : autoSummariesPaused
      ? 'Auto summaries paused'
      : autoSummariesSnoozed
        ? 'Auto summaries snoozed'
        : autoSummariesQuieted
          ? 'Auto summaries quieted'
          : 'Auto summaries active';
  const autoSummaryStatusDetail = autoSummariesDisabled
    ? 'Enable tacos.enabled in settings to restore automatic summaries.'
    : state.pauseUntilRestart
      ? 'Paused until restart.'
      : config.pauseSummaries
        ? 'Paused in settings.'
        : autoSummariesSnoozed
          ? `Snoozed until ${formatTimestamp(state.snoozeUntil)}.`
          : summaryQuietState.source === 'temporary'
            ? `Temporary quiet is active until ${formatTimestamp(summaryQuietState.temporaryUntil ?? 0)}.`
            : summaryQuietState.source === 'configured'
              ? `Within your configured quiet window (${config.summaryQuietHours}).`
              : 'Runs on focus after idle and cooldown checks.';
  const autoSummaryToggleLabel = autoSummariesPaused
    ? 'Resume auto summaries'
    : 'Pause auto summaries';
  const autoSummaryToggleDisabledAttr =
    autoSummariesDisabled || demoMode ? 'disabled aria-disabled="true"' : '';
  const panelSectionEmphasis: Partial<Record<PanelSectionId, PanelSectionEmphasis>> = demoMode
    ? {}
    : resolvePanelSectionEmphasis(
        summary,
        rankedPrimaryCandidate,
        blockerDecision,
        companionRuntimeMode,
        config.showTimeline,
        timelineGroups.length,
        config.summaryProvider,
      );
  const timelineGroupsHtml = renderTimelineGroupsHtml({ timelineGroups });
  const timelineCard = renderTimelineCard({
    showTimeline: config.showTimeline,
    timelineGroupsTrustedHtml: timelineGroupsHtml,
    expanded: expandedSections.has('timeline'),
    emphasis: panelSectionEmphasis.timeline,
  });
  const recapCard =
    recapDoneItems.length > 0 || recapPendingItems.length > 0
      ? renderRecapCard({
          recapDoneListTrustedHtml: recapDoneList,
          recapPendingListTrustedHtml: recapPendingList,
        })
      : '';
  const changesSinceItems = (summary.changesSinceLastResume ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const changesSinceCard = renderChangesSinceCard(changesSinceItems);
  const nudgeCard = renderCompanionNudgeCard({
    primaryNudge,
    secondaryNudge,
    nudgeSuppressionLabel,
    nudgeExplainabilityTrustedHtml: nudgeExplainability,
    actionLabelForId: nudgeActionLabel,
  });

  const statusCard = renderStatusCard({
    sourceLabel,
    generatedAtLabel,
    statusHint,
    autoSummaryStatusLabel,
    autoSummaryStatusDetail,
    autoSummaryToggleDisabledAttr,
    autoSummaryToggleLabel,
  });
  const trustCenterCard = renderTrustCenterCard({
    trustTrackingLabel,
    storedLocallyLabel,
    sentToAiLabel,
    collectionPolicyLabel,
    privacyPresetLabel,
    retentionPolicyLabel,
    aiProviderModeLabel,
    aiConsentStatusLabel,
    trustBasedOn: trustCue.headline.replace('Based on: ', ''),
    trustCueDetailsTrustedHtml: trustCueDetails,
    percolationExplainabilityTrustedHtml,
    autoSummaryToggleDisabledAttr,
    autoSummaryToggleLabel,
    aiPayloadPreviewDisabledAttr,
    revokeAiConsentDisabledAttr,
    expanded: expandedSections.has('trustCenter'),
    emphasis: panelSectionEmphasis.trustCenter,
  });
  const topFilesCard = renderTitledListCard({
    title: 'Top Files',
    listItemsTrustedHtml: topFiles,
    emptyMessage: 'None captured',
  });
  const topLinksCard = renderTitledListCard({
    title: 'Top Links / Files',
    listItemsTrustedHtml: linkItems,
    emptyMessage: 'None captured',
  });
  const quickActionsCard = renderQuickActionsCard(quickActionGroups);
  const restorePackCard = renderRestorePackCard(restorePackGroups, trusted);
  const evidenceCard = renderEvidenceCard({
    evidenceItemsTrustedHtml: evidenceItems,
    hiddenEvidenceCount,
    expanded: expandedSections.has('evidence'),
    emphasis: panelSectionEmphasis.evidence,
  });
  const detailsCard = renderDetailsCard(
    detailsHtml,
    expandedSections.has('details'),
    panelSectionEmphasis.details,
  );
  const moreContextCards = [
    trustCenterCard,
    recapCard,
    changesSinceCard,
    nudgeCard,
    topFilesCard,
    topLinksCard,
    timelineCard,
    evidenceCard,
    detailsCard,
  ]
    .filter(Boolean)
    .join('\n\n');
  const moreContextEmphasisAttrs = renderPanelSectionEmphasisAttrs(
    panelSectionEmphasis.moreContext,
  );
  const moreContextEmphasisBadge = renderPanelSectionEmphasisBadge(
    panelSectionEmphasis.moreContext,
  );
  const moreContextCard = moreContextCards
    ? `<div class="card">
      <details data-panel-section="moreContext" ${
        moreContextEmphasisAttrs ? `${moreContextEmphasisAttrs} ` : ''
      }${expandedSections.has('moreContext') ? 'open' : ''}>
        <summary class="panel-disclosure-summary"><span class="section-heading" role="heading" aria-level="3">More Context</span>${moreContextEmphasisBadge}</summary>
        <div class="panel-section-body more-context-stack">
          ${moreContextCards}
        </div>
      </details>
    </div>`
    : '';
  const demoCard = demoMode
    ? `<div class="card" data-demo-resume-card="true">
      <h3>Sample Resume Card</h3>
      <p class="muted">
        This is sample onboarding data only. It is separate from your workspace evidence.
      </p>
      <div class="status-actions">
        <button type="button" data-action="dismissDemoResume">Dismiss sample</button>
        <button type="button" class="secondary" data-action="refreshSummary">Show real resume now</button>
      </div>
    </div>`
    : '';
  const bodyCards = [
    demoCard,
    renderResumeStackCard({
      intent: summary.intent,
      intentOverridden: summary.intentOverridden,
      intentEditorTrustedHtml: intentEditorHtml,
      mode,
      nowSlotSourceClass: companionSlotSources.now,
      nowCheckpointLineTrustedHtml: nowCheckpointLine,
      lastActionLabel,
      lastActionContext,
      lastActionActionTrustedHtml: lastActionActionHtml,
      nextSlotSourceClass: companionSlotSources.next,
      nextSafeActionSummary:
        primaryNextActionSummary || 'Refresh summary to regenerate first-action guidance.',
      hasPrimaryNextAction,
      nextPrimaryCtaSourceClass: hasPrimaryNextAction ? companionSlotSources.primaryCta : undefined,
      nextEmphasisToken: primaryCtaDecision.nextToken,
      primaryNextActionTrustedHtml: companionPrimaryNextActionButton,
      whySurfacedActionTrustedHtml:
        '<button type="button" class="secondary" data-action="openWhySurfaced">Why am I seeing this?</button>',
      evidenceTrayActionTrustedHtml: evidenceTrayActionHtml,
      nextStepRationaleTrustedHtml: primaryNextStepRationaleHtml,
      nextStepsListTrustedHtml: companionNextSteps,
      hasBlocker: blockerDecision.hasBlocker,
      blockedSlotSourceClass: companionSlotSources.blocked,
      hasPrimaryBlockedAction,
      blockedPrimaryCtaSourceClass: hasPrimaryBlockedAction
        ? companionSlotSources.primaryCta
        : undefined,
      blockedEmphasisToken: primaryCtaDecision.blockedToken,
      blockerTitle,
      blockerDetail,
      blockerMetaTrustedHtml: blockerMetaHtml,
      blockerDisabledReasonTrustedHtml: blockerDisabledReasonHtml,
      blockerActionTrustedHtml: blockerActionHtml,
      restoreSlotSourceClass: companionSlotSources.restore,
      restoreSectionsTrustedHtml: companionRestoreSections,
      restoreUnavailableHintsTrustedHtml: restoreUnavailableHints,
    }),
    resumePathCard,
    confidenceCard,
    statusCard,
    checkpointCard,
    scratchpadCard,
    quickActionsCard,
    restorePackCard,
    moreContextCard,
  ]
    .filter(Boolean)
    .join('\n\n');
  const panelSectionScopeToken =
    activeExtensionContext && panelWorkspaceRoot
      ? Buffer.from(partitionScope(activeExtensionContext, panelWorkspaceRoot)).toString(
          'base64url',
        )
      : 'global';
  const clientScript = renderPanelClientScript(MAX_INTENT_OVERRIDE_CHARS, panelSectionScopeToken);

  return renderWebviewDocument({
    cspMetaTag,
    nonce,
    panelStyle: PANEL_WEBVIEW_STYLE,
    bodyCardsTrustedHtml: bodyCards,
    clientScript,
  });
}

function createNonce(): string {
  return randomBytes(18).toString('base64url');
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'unknown time';
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function markBoundarySignal(): void {
  state.lastBoundarySignalAt = Date.now();
}

function markMeaningfulActivity(): void {
  state.lastMeaningfulActivityAt = Date.now();
  state.meaningfulActivitySinceCheckpointPrompt = true;
}

function formatPlainSummary(summary: ResumeSummary): string {
  return [
    `Intent: ${summary.intent}`,
    'Next steps:',
    ...summary.nextSteps.map((step) => `- ${step}`),
    'Top files:',
    ...(summary.topFiles.length > 0
      ? summary.topFiles.map((file) => `- ${file}`)
      : ['- None captured']),
  ].join('\n');
}

async function copyPromptAndOpenCodex(summary: ResumeSummary): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot) ?? '';
  const strictPrompt = redactTextWithReport(
    summary.codexPrompt,
    workspaceRoot,
    getConfig().redactionPatterns,
    { mode: 'ai-send' },
  );
  recordRedactionMetrics(
    strictPrompt.report.totalReplacements,
    strictPrompt.report.highRiskDetected,
  );
  if (strictPrompt.report.highRiskDetected) {
    recordMetricCounter('aiSendBlockedBySanitizerTotal');
    void vscode.window.showWarningMessage(
      'TaCoS: Copy Prompt blocked by strict sanitizer due to high-risk content.',
    );
    return;
  }

  await vscode.env.clipboard.writeText(strictPrompt.text);
  const openedCommand = await tryOpenCodexPanel(getConfig());
  const redactionDetail =
    strictPrompt.report.totalReplacements > 0
      ? ` (${strictPrompt.report.totalReplacements} item${strictPrompt.report.totalReplacements === 1 ? '' : 's'} redacted)`
      : '';

  if (openedCommand) {
    void vscode.window.showInformationMessage(
      `TaCoS: prompt copied${redactionDetail} and opened Codex via \`${openedCommand}\`.`,
    );
    return;
  }

  await vscode.commands.executeCommand('workbench.action.quickOpen', '>Codex');
  void vscode.window.showWarningMessage(
    `TaCoS: prompt copied${redactionDetail}. Set \`tacos.codexOpenCommand\` to your Codex panel command id for one-click opening.`,
  );
}

async function openSummaryEditor(content: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content,
  });

  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
}

async function testSanitizerCommand(): Promise<void> {
  const selected =
    vscode.window.activeTextEditor?.document
      .getText(vscode.window.activeTextEditor.selection)
      .trim() ?? '';
  const source =
    selected ||
    (
      await vscode.window.showInputBox({
        title: 'TaCoS: Test Sanitizer',
        prompt: 'Paste text to sanitize locally (nothing is sent to AI)',
        ignoreFocusOut: true,
      })
    )?.trim() ||
    '';
  if (!source) {
    void vscode.window.showInformationMessage('TaCoS: no text provided for sanitizer test.');
    return;
  }

  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const sanitizedResult = redactTextWithReport(
    source,
    workspaceRoot,
    getConfig().redactionPatterns,
    {
      mode: 'storage',
    },
  );
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const categoryEntries = Object.entries(sanitizedResult.report.categoryCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const categoryLines =
    categoryEntries.length > 0
      ? categoryEntries.map(([category, count]) => `- ${category}: ${count}`)
      : ['- none'];
  const reportMarkdown = [
    '# TaCoS Sanitizer Test',
    '',
    '- Local only: no AI send',
    '- Mode: `storage`',
    `- Workspace root tokenization: ${workspaceRoot ? 'enabled' : 'disabled'}`,
    `- Total replacements: ${sanitizedResult.report.totalReplacements}`,
    `- Total chars replaced: ${sanitizedResult.report.totalCharsReplaced}`,
    `- High-risk detected: ${sanitizedResult.report.highRiskDetected ? 'yes' : 'no'}`,
    '',
    '## Category counts',
    ...categoryLines,
    '',
    '## Sanitized output',
    '```text',
    sanitizedResult.text,
    '```',
  ].join('\n');
  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: reportMarkdown,
  });
  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
}

async function generateStandupUpdateCommand(context: vscode.ExtensionContext): Promise<void> {
  const root = pickWorkspaceRoot();
  if (!root) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const cached = context.workspaceState.get<ResumeSummary>(summaryCacheKey(context, root));
  const summary = cached ?? (await generateSummary(context, root, 'manual')).summary;
  const checkpointContext = await resolveCheckpointContext(
    context,
    root,
    summary.currentBranch,
    true,
  );
  const summaryWithCheckpoint = applyCheckpointNoteToSummary(
    summary,
    checkpointContext.primaryNote,
  );
  const standup = buildStandupUpdate(summaryWithCheckpoint, path.basename(root), Date.now(), {
    checkpointNext: checkpointContext.primaryNote?.text,
  });
  const action = await vscode.window.showInformationMessage(
    'TaCoS: standup update generated.',
    'Copy',
    'Open',
    'Copy + Open',
  );
  if (action === 'Copy') {
    await vscode.env.clipboard.writeText(standup);
    void vscode.window.showInformationMessage('TaCoS: standup update copied to clipboard.');
    return;
  }

  if (action === 'Open') {
    await openSummaryEditor(standup);
    return;
  }

  if (action === 'Copy + Open') {
    await vscode.env.clipboard.writeText(standup);
    await openSummaryEditor(standup);
    void vscode.window.showInformationMessage(
      'TaCoS: standup update copied and opened in an editor tab.',
    );
  }
}

function terminalCwdStorageKey(workspaceRoot: string): string {
  return `${KEY_LAST_TERMINAL_CWD_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function readPersistedTerminalCwd(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const value = context.workspaceState.get<string>(terminalCwdStorageKey(workspaceRoot), '').trim();
  return value || undefined;
}

async function persistTerminalCwd(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  await context.workspaceState.update(terminalCwdStorageKey(workspaceRoot), state.lastTerminalCwd);
}

function restoreSearchQueryKey(workspaceRoot: string): string {
  return `${KEY_RESTORE_SEARCH_QUERY_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function readPersistedRestoreSearchQuery(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): string | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const value = context.workspaceState.get<string>(restoreSearchQueryKey(workspaceRoot), '').trim();
  return value || undefined;
}

type RestorePreset = 'files-only' | 'files-terminal' | 'full-restore';

interface RestorePlanOptions {
  preset: RestorePreset;
  workspaceName: string;
  filesToOpen: string[];
  diffTarget?: string;
  terminalCwd?: string;
  searchQuery?: string;
  availability: RestoreAvailability;
  trusted: boolean;
}

const DEFAULT_RESTORE_PRESET: RestorePreset = 'full-restore';

const RESTORE_PRESET_LABELS: Record<RestorePreset, string> = {
  'files-only': 'Files only',
  'files-terminal': 'Files + terminal',
  'full-restore': 'Full restore',
};

const RESTORE_PRESET_DETAILS: Record<RestorePreset, string> = {
  'files-only': 'Reopen files and diff target only.',
  'files-terminal': 'Reopen files plus terminal cwd.',
  'full-restore': 'Reopen files, terminal cwd, and search query.',
};

function parseRestorePreset(value: string): RestorePreset | undefined {
  if (value === 'files-only' || value === 'files-terminal' || value === 'full-restore') {
    return value;
  }

  return undefined;
}

function restorePresetKey(workspaceRoot: string): string {
  return `${KEY_RESTORE_PRESET_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function readPersistedRestorePreset(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): RestorePreset {
  if (!workspaceRoot) {
    return DEFAULT_RESTORE_PRESET;
  }

  const raw = context.workspaceState.get<string>(restorePresetKey(workspaceRoot), '').trim();
  return parseRestorePreset(raw) ?? DEFAULT_RESTORE_PRESET;
}

async function persistRestorePreset(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  preset: RestorePreset,
): Promise<void> {
  await context.workspaceState.update(restorePresetKey(workspaceRoot), preset);
}

async function promptForRestorePreset(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<RestorePreset | undefined> {
  type RestorePresetPick = vscode.QuickPickItem & { preset: RestorePreset };
  const current = readPersistedRestorePreset(context, workspaceRoot);
  const allPresets: RestorePreset[] = ['files-only', 'files-terminal', 'full-restore'];
  const ordered = [current, ...allPresets.filter((preset) => preset !== current)];
  const picks: RestorePresetPick[] = ordered.map((preset) => ({
    preset,
    label: RESTORE_PRESET_LABELS[preset],
    detail: RESTORE_PRESET_DETAILS[preset],
    description: preset === current ? 'Current' : undefined,
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Restore Preset',
    placeHolder: 'Choose which restore actions to execute',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return undefined;
  }

  await persistRestorePreset(context, workspaceRoot, picked.preset);
  return picked.preset;
}

function isPresetEnabled(options: RestorePlanOptions, action: 'terminal' | 'search'): boolean {
  if (action === 'terminal') {
    return options.preset === 'files-terminal' || options.preset === 'full-restore';
  }

  return options.preset === 'full-restore';
}

function buildRestoreDryRunMarkdown(options: RestorePlanOptions): string {
  const terminalEnabled = isPresetEnabled(options, 'terminal');
  const searchEnabled = isPresetEnabled(options, 'search');
  const lines = [
    '# TaCoS Restore Dry-Run Plan',
    '',
    `- Workspace: ${options.workspaceName}`,
    `- Preset: ${RESTORE_PRESET_LABELS[options.preset]}`,
    `- Mode: ${options.trusted ? 'trusted' : 'restricted'}`,
    '',
    '## Actions That Will Execute',
    '',
    `- Reopen files: ${options.filesToOpen.length} target(s)`,
    options.diffTarget ? `- Open diff target: ${options.diffTarget}` : '- Open diff target: none',
    terminalEnabled
      ? `- Restore terminal cwd: ${options.terminalCwd ?? 'none available'}`
      : '- Restore terminal cwd: skipped by preset',
    searchEnabled
      ? `- Restore search query: ${options.searchQuery ? 'yes' : 'none available'}`
      : '- Restore search query: skipped by preset',
    '',
    '## Pending Execution Actions (Manual)',
    '',
    options.availability.canRerunTask
      ? '- Rerun last task: available in Restore Pack'
      : '- Rerun last task: unavailable',
    options.availability.canRerunDebug
      ? '- Rerun debug config: available in Restore Pack'
      : '- Rerun debug config: unavailable',
    '',
    'Notes:',
    '- TaCoS keeps workspace path validation and trust-mode safety checks before execution.',
    '- Restricted Mode keeps execution actions disabled.',
  ];

  return `${lines.join('\n')}\n`;
}

async function captureRestoreSearchQuery(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const current = readPersistedRestoreSearchQuery(context, workspaceRoot) ?? '';
  const input = await vscode.window.showInputBox({
    title: 'TaCoS: Set Restore Search Query',
    prompt: 'Optional query to re-open in Search during restore working set.',
    placeHolder: 'Example: TODO auth middleware',
    value: current,
    ignoreFocusOut: true,
  });
  if (typeof input === 'undefined') {
    return;
  }

  const nextValue = input.trim();
  await context.workspaceState.update(
    restoreSearchQueryKey(workspaceRoot),
    nextValue ? nextValue : undefined,
  );
  void vscode.window.showInformationMessage(
    nextValue ? 'TaCoS: restore search query saved.' : 'TaCoS: restore search query cleared.',
  );
}

async function switchTaskPartition(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const current =
    context.workspaceState.get<string>(taskPartitionStorageKey(workspaceRoot), '').trim() || '';
  const inferred = inferTaskPartitionKey(resolveScopeBranch(context, workspaceRoot)) || '';
  const input = await vscode.window.showInputBox({
    title: 'TaCoS: Switch Task Partition',
    prompt:
      'Set an optional task key (for example ABC-123). Leave empty to use inferred/default partition.',
    placeHolder: inferred ? `Inferred from branch: ${inferred}` : 'Example: ABC-123',
    value: current,
    ignoreFocusOut: true,
  });
  if (typeof input === 'undefined') {
    return;
  }

  const nextValue = input.trim();
  await applyTaskPartitionSwitch(context, workspaceRoot, nextValue);
  void vscode.window.showInformationMessage(
    nextValue
      ? `TaCoS: switched to task partition "${nextValue}".`
      : `TaCoS: switched to ${inferred ? `inferred partition "${inferred}"` : 'default partition'}.`,
  );
}

async function applyTaskPartitionSwitch(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  nextValue: string,
): Promise<void> {
  await context.workspaceState.update(
    taskPartitionStorageKey(workspaceRoot),
    nextValue ? nextValue : undefined,
  );

  const snapshot = loadPersistedActivitySnapshot(context);
  state.recentFiles = new RingBuffer(15, snapshot.sanitized.recentFiles);
  state.recentTerminal = new RingBuffer(15, snapshot.sanitized.recentTerminal);
  state.recentDebug = new RingBuffer(10, snapshot.sanitized.recentDebug);
  state.recentUrls = new RingBuffer(5, snapshot.sanitized.recentUrls);
  state.doneItems = new RingBuffer(10, snapshot.sanitized.doneItems);
  state.lastFailingCommand = snapshot.sanitized.lastFailingCommand;
  state.lastFailingCommandRaw = undefined;
  state.lastFocusGainedAt = 0;
  state.lastBoundarySignalAt = 0;
  state.lastMeaningfulActivityAt = 0;
  state.scratchSummary = undefined;
  state.detailsMarkdownCache = undefined;
  if (state.panel) {
    state.panel.dispose();
  }
  updateCompanionStatusBar();
}

async function restoreWorkingSetCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const summary =
    state.panelSummary ??
    state.scratchSummary ??
    context.workspaceState.get<ResumeSummary>(summaryCacheKey(context, workspaceRoot));
  if (!summary) {
    void vscode.window.showInformationMessage(
      'TaCoS: no summary context available to restore yet.',
    );
    return;
  }

  const filesToOpen = uniqueStrings([
    ...(summary.recentFilesSnapshot ?? []),
    ...summary.topFiles,
  ]).slice(0, 6);
  const diffTarget = summary.topFiles[0];
  const terminalCwd = state.lastTerminalCwd?.trim() || undefined;
  const searchQuery = readPersistedRestoreSearchQuery(context, workspaceRoot);
  const preset = await promptForRestorePreset(context, workspaceRoot);
  if (!preset) {
    return;
  }

  const availability = computeRestoreAvailability({
    trusted: vscode.workspace.isTrusted,
    hasLastTask: Boolean(state.lastTaskName),
    hasLastDebug: Boolean(state.lastDebugConfigName),
    hasFailingCommand: Boolean(getCopyableFailingCommand()),
    hasRecentEditLocation: state.recentEditLocations.length > 0,
    currentBranch: summary.currentBranch,
    previousBranch: summary.previousBranch,
  });

  const dryRunMarkdown = buildRestoreDryRunMarkdown({
    preset,
    workspaceName: path.basename(workspaceRoot),
    filesToOpen,
    diffTarget,
    terminalCwd,
    searchQuery,
    availability,
    trusted: vscode.workspace.isTrusted,
  });
  const dryRunDoc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: dryRunMarkdown,
  });
  await vscode.window.showTextDocument(dryRunDoc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: true,
  });

  const choice = await vscode.window.showInformationMessage(
    `TaCoS dry-run ready (${RESTORE_PRESET_LABELS[preset]}). Apply restore actions now?`,
    { modal: true },
    'Restore',
  );
  if (choice !== 'Restore') {
    return;
  }

  const openedFiles = await openWorkspaceFiles(filesToOpen, workspaceRoot);
  let openedDiff = false;
  if (diffTarget) {
    const safePath = resolveFileTargetInWorkspace(diffTarget, workspaceRoot);
    if (safePath && isPathWithinWorkspaceRoot(workspaceRoot, safePath)) {
      const diffUri = vscode.Uri.file(safePath);
      try {
        await vscode.commands.executeCommand('git.openChange', diffUri);
        openedDiff = true;
      } catch {
        await vscode.commands.executeCommand('vscode.open', diffUri, {
          preview: false,
          preserveFocus: true,
        });
        openedDiff = true;
      }
    }
  }

  const includeTerminal = preset === 'files-terminal' || preset === 'full-restore';
  let openedTerminal = false;
  if (includeTerminal && terminalCwd) {
    const safeCwd = resolveFileTargetInWorkspace(terminalCwd, workspaceRoot);
    if (safeCwd && isPathWithinWorkspaceRoot(workspaceRoot, safeCwd)) {
      try {
        await vscode.commands.executeCommand('workbench.action.terminal.newWithCwd', {
          cwd: safeCwd,
        });
        openedTerminal = true;
      } catch {
        const terminal = vscode.window.createTerminal({
          name: 'TaCoS Restore',
          cwd: safeCwd,
        });
        terminal.show(true);
        openedTerminal = true;
      }
    }
  }

  const includeSearch = preset === 'full-restore';
  let restoredSearch = false;
  if (includeSearch && searchQuery) {
    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query: searchQuery,
      triggerSearch: true,
    });
    restoredSearch = true;
  }

  void vscode.window.showInformationMessage(
    `TaCoS: restored ${openedFiles} files${openedDiff ? ', diff target' : ''}${openedTerminal ? ', terminal cwd' : ''}${restoredSearch ? ', and search query' : ''} (${RESTORE_PRESET_LABELS[preset]}). Missing resources were skipped safely.`,
  );
}

function formatMarkdownSummary(summary: ResumeSummary): string {
  const lines: string[] = [];

  lines.push('# TaCoS Resume Summary');
  lines.push('');
  lines.push(`- Source: ${summary.source}`);
  if (summary.mode) {
    lines.push(`- Mode: ${summary.mode}`);
  }
  lines.push(`- Generated: ${new Date(summary.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('## Intent');
  lines.push(summary.intent);
  lines.push('');
  lines.push('## Next Steps');
  for (const step of summary.nextSteps) {
    lines.push(`- ${step}`);
  }
  lines.push('');
  lines.push('## Top Files');
  if (summary.topFiles.length > 0) {
    for (const file of summary.topFiles) {
      lines.push(`- ${file}`);
    }
  } else {
    lines.push('- None captured');
  }
  lines.push('');
  lines.push('## Top Links');
  if (summary.links.length > 0) {
    for (const link of summary.links) {
      const target = link.kind === 'url' ? link.target : vscode.Uri.file(link.target).toString();
      lines.push(`- [${link.label}](${target}) (${link.kind})`);
    }
  } else {
    lines.push('- None captured');
  }
  lines.push('');
  lines.push('## Details');
  lines.push(summary.detailsMarkdown);

  return lines.join('\n');
}

async function reopenSummaryFiles(
  summary: ResumeSummary | undefined,
  limit: number,
  preferredWorkspaceRoot?: string,
): Promise<number> {
  if (!summary) {
    return 0;
  }

  const candidates = uniqueStrings([
    ...(summary.recentFilesSnapshot ?? []),
    ...summary.topFiles,
  ]).slice(0, limit);
  return openWorkspaceFiles(candidates, preferredWorkspaceRoot);
}

async function openChangedSummaryFiles(
  summary: ResumeSummary | undefined,
  limit: number,
  preferredWorkspaceRoot?: string,
): Promise<number> {
  if (!summary) {
    return 0;
  }

  return openWorkspaceFiles(summary.topFiles.slice(0, limit), preferredWorkspaceRoot);
}

async function openWorkspaceFiles(
  paths: string[],
  preferredWorkspaceRoot?: string,
): Promise<number> {
  const workspaceRoot = preferredWorkspaceRoot;
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage('TaCoS: open a workspace folder to restore files.');
    return 0;
  }

  let opened = 0;
  for (const item of paths) {
    const safePath = resolveFileTargetInWorkspace(item, workspaceRoot);
    if (!safePath || !isPathWithinWorkspaceRoot(workspaceRoot, safePath)) {
      continue;
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safePath), {
      preview: false,
      preserveFocus: opened > 0,
    });
    opened += 1;
  }

  return opened;
}

function diagnosticSeverityRank(severity: vscode.DiagnosticSeverity): number {
  if (severity === vscode.DiagnosticSeverity.Error) {
    return 0;
  }
  if (severity === vscode.DiagnosticSeverity.Warning) {
    return 1;
  }
  if (severity === vscode.DiagnosticSeverity.Information) {
    return 2;
  }
  return 3;
}

function collectWorkspaceDiagnostics(preferredWorkspaceRoot?: string): DiagnosticBlockerSnapshot {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  let errorCount = 0;
  let warningCount = 0;
  let top: DiagnosticBlockerReference | undefined;

  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (uri.scheme !== 'file') {
      continue;
    }

    if (workspaceRoot && !isPathWithinWorkspaceRoot(workspaceRoot, uri.fsPath)) {
      continue;
    }

    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        errorCount += 1;
      } else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
        warningCount += 1;
      }

      const candidate: DiagnosticBlockerReference = {
        path: workspaceRoot ? toRelativePath(uri.fsPath, workspaceRoot) : uri.fsPath,
        absolutePath: uri.fsPath,
        line: diagnostic.range.start.line,
        character: diagnostic.range.start.character,
        message: diagnostic.message.trim().split(/\r?\n/)[0]?.slice(0, 160) ?? '',
        severity: diagnostic.severity,
      };
      if (
        !top ||
        diagnosticSeverityRank(candidate.severity) < diagnosticSeverityRank(top.severity)
      ) {
        top = candidate;
      }
    }
  }

  return { errorCount, warningCount, top };
}

async function openProblemsView(): Promise<void> {
  await vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function openPrimaryDiagnosticFile(preferredWorkspaceRoot?: string): Promise<boolean> {
  const diagnostics = collectWorkspaceDiagnostics(preferredWorkspaceRoot);
  if (!diagnostics.top) {
    void vscode.window.showInformationMessage('TaCoS: no active diagnostics are available.');
    return false;
  }

  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage(
      'TaCoS blocked diagnostic navigation because no workspace root is available.',
    );
    return false;
  }

  if (!isPathWithinWorkspaceRoot(workspaceRoot, diagnostics.top.absolutePath)) {
    void vscode.window.showWarningMessage('TaCoS blocked an unsafe diagnostic file target.');
    return false;
  }

  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(diagnostics.top.absolutePath),
  );
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false,
  });
  const position = new vscode.Position(diagnostics.top.line, diagnostics.top.character);
  const range = new vscode.Range(position, position);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  return true;
}

interface NextStepActionOutcome {
  attempted: boolean;
  completed: boolean;
}

function buildNextStepActionCandidates(summary: ResumeSummary): Array<NextStepAction | undefined> {
  const availability = computeRestoreAvailability({
    trusted: vscode.workspace.isTrusted,
    hasLastTask: Boolean(state.lastTaskName),
    hasLastDebug: Boolean(state.lastDebugConfigName),
    hasFailingCommand: Boolean(getCopyableFailingCommand()),
    hasRecentEditLocation: state.recentEditLocations.length > 0,
    currentBranch: summary.currentBranch,
    previousBranch: summary.previousBranch,
  });
  return buildNextStepActions({
    summary,
    canRerunTask: availability.canRerunTask,
    canRerunDebug: availability.canRerunDebug,
    canCopyFailingCommand: availability.canCopyFailingCommand,
  });
}

async function runNextStepActionDetailed(
  summary: ResumeSummary,
  stepIndex: number,
  preferredWorkspaceRoot?: string,
): Promise<NextStepActionOutcome> {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= summary.nextSteps.length) {
    void vscode.window.showWarningMessage('TaCoS blocked an invalid next-step action target.');
    return { attempted: false, completed: false };
  }

  const actions = buildNextStepActionCandidates(summary);
  const action = actions[stepIndex];
  if (!action) {
    void vscode.window.showInformationMessage(
      'TaCoS: this step has no verified clickable action yet. Use evidence links to continue.',
    );
    return { attempted: false, completed: false };
  }

  const evidence = (summary.evidenceCatalog ?? []).find((item) => item.id === action.evidenceId);
  if (!evidence) {
    void vscode.window.showWarningMessage('TaCoS blocked a stale next-step action.');
    return { attempted: false, completed: false };
  }

  if (action.kind === 'copyFailingCommand') {
    return { attempted: true, completed: await copyFailingCommand() };
  }

  if (action.kind === 'rerunTask') {
    return { attempted: true, completed: await rerunLastTask() };
  }

  if (action.kind === 'rerunDebug') {
    return { attempted: true, completed: await rerunLastDebugSession() };
  }

  if (action.kind === 'openFile') {
    const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage(
        'TaCoS blocked file action because no workspace root is available for validation.',
      );
      return { attempted: false, completed: false };
    }

    const safeTarget = resolveFileTargetInWorkspace(evidence.target ?? '', workspaceRoot);
    if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
      void vscode.window.showWarningMessage('TaCoS blocked an unsafe next-step file target.');
      return { attempted: false, completed: false };
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
    return { attempted: true, completed: true };
  }

  if (action.kind === 'openUrl') {
    const safeUrl = normalizeHttpUrl(evidence.target ?? '');
    if (!safeUrl) {
      void vscode.window.showWarningMessage('TaCoS blocked an unsafe next-step URL.');
      return { attempted: false, completed: false };
    }

    try {
      const opened = await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
      if (!opened) {
        void vscode.window.showWarningMessage('TaCoS: unable to open this URL in your browser.');
      }
      return { attempted: true, completed: opened };
    } catch {
      void vscode.window.showWarningMessage('TaCoS: failed to open this URL.');
      return { attempted: true, completed: false };
    }
  }

  return { attempted: false, completed: false };
}

async function runNextStepAction(
  summary: ResumeSummary,
  stepIndex: number,
  preferredWorkspaceRoot?: string,
): Promise<boolean> {
  const outcome = await runNextStepActionDetailed(summary, stepIndex, preferredWorkspaceRoot);
  return outcome.completed;
}

function recentEditLocationsStorageKey(workspaceRoot: string): string {
  return `${KEY_RECENT_EDIT_LOCATIONS_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function readRecentEditLocations(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): EditLocation[] {
  if (!workspaceRoot) {
    return [];
  }

  const raw = context.workspaceState.get<unknown>(recentEditLocationsStorageKey(workspaceRoot), []);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object',
    )
    .map((entry) => ({
      path: typeof entry.path === 'string' ? entry.path.trim() : '',
      line: typeof entry.line === 'number' ? entry.line : -1,
      character: typeof entry.character === 'number' ? entry.character : -1,
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : 0,
    }))
    .filter(
      (entry) =>
        Boolean(entry.path) &&
        Number.isInteger(entry.line) &&
        entry.line >= 0 &&
        Number.isInteger(entry.character) &&
        entry.character >= 0 &&
        Number.isFinite(entry.timestamp) &&
        entry.timestamp > 0,
    )
    .slice(0, 15);
}

async function persistRecentEditLocations(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    return;
  }

  await context.workspaceState.update(
    recentEditLocationsStorageKey(workspaceRoot),
    state.recentEditLocations.slice(0, 15),
  );
  await touchWorkspaceActivity(context, workspaceRoot);
}

async function jumpToRecentEdit(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const locations = state.recentEditLocations.slice(0, 8);
  if (locations.length === 0) {
    void vscode.window.showInformationMessage('TaCoS: no recent edit locations are available.');
    return;
  }

  type EditQuickPick = vscode.QuickPickItem & { location: EditLocation };
  const picks: EditQuickPick[] = locations.map((location) => ({
    label: `${location.path}:${location.line + 1}:${location.character + 1}`,
    description: new Date(location.timestamp).toLocaleString(),
    detail: 'Jump to this recent edit location',
    location,
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Jump to Recent Edit',
    placeHolder: 'Select a recent edit location',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  await openRecentEditLocation(context, picked.location, preferredWorkspaceRoot);
}

async function openRecentEditLocation(
  context: vscode.ExtensionContext,
  location: EditLocation,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage(
      'TaCoS blocked jump-to-edit because no workspace root is available for validation.',
    );
    return;
  }

  const safeTarget = resolveFileTargetInWorkspace(location.path, workspaceRoot);
  if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
    void vscode.window.showWarningMessage('TaCoS blocked an unsafe recent edit target.');
    return;
  }

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(safeTarget));
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false,
  });
  const position = new vscode.Position(location.line, location.character);
  const range = new vscode.Range(position, position);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  await persistRecentEditLocations(context, workspaceRoot);
}

function taskWorkspaceRoot(task: vscode.Task): string | undefined {
  const scope = task.scope;
  if (scope && typeof scope === 'object' && 'uri' in scope) {
    return scope.uri.fsPath;
  }

  return undefined;
}

function taskMetadataStorageKey(workspaceRoot: string): string {
  return `${KEY_LAST_TASK_META_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function readPersistedTaskMetadata(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): PersistedTaskMetadata | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const raw = context.workspaceState.get<unknown>(taskMetadataStorageKey(workspaceRoot));
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const taskName = typeof record.taskName === 'string' ? record.taskName.trim() : '';
  const exitCode = typeof record.exitCode === 'number' ? record.exitCode : NaN;
  const timestamp = typeof record.timestamp === 'number' ? record.timestamp : NaN;
  const storedWorkspaceRoot =
    typeof record.workspaceRoot === 'string' ? record.workspaceRoot.trim() : undefined;
  if (!taskName || !Number.isInteger(exitCode) || !Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }

  return {
    taskName,
    workspaceRoot: storedWorkspaceRoot || undefined,
    exitCode,
    timestamp,
  };
}

async function persistTaskMetadata(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(state.lastTaskWorkspaceRoot) ?? '';
  if (!workspaceRoot) {
    return;
  }

  const taskName = state.lastTaskName?.trim();
  if (
    !taskName ||
    !Number.isInteger(state.lastTaskExitCode) ||
    !Number.isFinite(state.lastTaskEndedAt)
  ) {
    await context.workspaceState.update(taskMetadataStorageKey(workspaceRoot), undefined);
    await touchWorkspaceActivity(context, workspaceRoot);
    return;
  }

  const payload: PersistedTaskMetadata = {
    taskName,
    workspaceRoot: state.lastTaskWorkspaceRoot,
    exitCode: state.lastTaskExitCode ?? 0,
    timestamp: state.lastTaskEndedAt ?? Date.now(),
  };
  await context.workspaceState.update(taskMetadataStorageKey(workspaceRoot), payload);
  await touchWorkspaceActivity(context, workspaceRoot);
}

interface ExecutionActionOptions {
  isWorkspaceTrustedOverride?: boolean;
  suppressMessages?: boolean;
}

function isExecutionActionAllowed(options?: ExecutionActionOptions): boolean {
  if (typeof options?.isWorkspaceTrustedOverride === 'boolean') {
    return options.isWorkspaceTrustedOverride;
  }

  return vscode.workspace.isTrusted;
}

async function rerunLastTask(options?: ExecutionActionOptions): Promise<boolean> {
  if (!isExecutionActionAllowed(options)) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage('TaCoS: rerun task is disabled in Restricted Mode.');
    }
    return false;
  }

  if (!state.lastTaskName) {
    if (!options?.suppressMessages) {
      void vscode.window.showInformationMessage(
        'TaCoS: no recent VS Code task is available to rerun.',
      );
    }
    return false;
  }

  const tasks = await vscode.tasks.fetchTasks();
  const match = tasks.find((task) => {
    if (task.name !== state.lastTaskName) {
      return false;
    }

    if (!state.lastTaskWorkspaceRoot) {
      return true;
    }

    const root = taskWorkspaceRoot(task);
    return !root || root === state.lastTaskWorkspaceRoot;
  });

  if (!match) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage(
        `TaCoS: could not find task "${state.lastTaskName}" to rerun.`,
      );
    }
    return false;
  }

  await vscode.tasks.executeTask(match);
  if (!options?.suppressMessages) {
    void vscode.window.showInformationMessage(`TaCoS: reran task "${state.lastTaskName}".`);
  }
  return true;
}

async function rerunLastDebugSession(options?: ExecutionActionOptions): Promise<boolean> {
  if (!isExecutionActionAllowed(options)) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage('TaCoS: rerun debug is disabled in Restricted Mode.');
    }
    return false;
  }

  if (!state.lastDebugConfigName) {
    if (!options?.suppressMessages) {
      void vscode.window.showInformationMessage(
        'TaCoS: no recent debug configuration is available.',
      );
    }
    return false;
  }

  const folder = vscode.workspace.workspaceFolders?.find(
    (entry) => entry.uri.fsPath === state.lastDebugWorkspaceRoot,
  );
  const started = await vscode.debug.startDebugging(folder, state.lastDebugConfigName);
  if (!started) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage(
        `TaCoS: failed to start debug configuration "${state.lastDebugConfigName}".`,
      );
    }
    return false;
  }

  if (!options?.suppressMessages) {
    void vscode.window.showInformationMessage(
      `TaCoS: started debug configuration "${state.lastDebugConfigName}".`,
    );
  }
  return true;
}

async function checkoutPreviousBranch(
  summary: ResumeSummary | undefined,
  preferredWorkspaceRoot?: string,
  options?: ExecutionActionOptions,
): Promise<boolean> {
  if (!isExecutionActionAllowed(options)) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage(
        'TaCoS: checkout branch is disabled in Restricted Mode.',
      );
    }
    return false;
  }

  const previousBranch = summary?.previousBranch?.trim() ?? '';
  const currentBranch = summary?.currentBranch?.trim() ?? '';
  if (!previousBranch || !currentBranch || previousBranch === currentBranch) {
    if (!options?.suppressMessages) {
      void vscode.window.showInformationMessage(
        'TaCoS: no previous branch is available to checkout.',
      );
    }
    return false;
  }

  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    if (!options?.suppressMessages) {
      void vscode.window.showWarningMessage('TaCoS: open a workspace folder to checkout a branch.');
    }
    return false;
  }

  const choice = await vscode.window.showWarningMessage(
    `Checkout previous branch "${previousBranch}"?`,
    { modal: true },
    'Checkout',
  );
  if (choice !== 'Checkout') {
    return false;
  }

  try {
    await execFileAsync('git', ['-C', workspaceRoot, 'checkout', previousBranch], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    if (!options?.suppressMessages) {
      void vscode.window.showInformationMessage(`TaCoS: checked out "${previousBranch}".`);
    }
    return true;
  } catch (error) {
    if (!options?.suppressMessages) {
      void vscode.window.showErrorMessage(
        `TaCoS: failed to checkout "${previousBranch}": ${(error as Error).message}`,
      );
    }
    return false;
  }
}

async function copyFailingCommand(): Promise<boolean> {
  const command = getCopyableFailingCommand();
  if (!command) {
    void vscode.window.showInformationMessage(
      'TaCoS: no copyable failing command is available (raw commands are not persisted).',
    );
    return false;
  }

  await vscode.env.clipboard.writeText(command);
  void vscode.window.showInformationMessage('TaCoS: failing command copied to clipboard.');
  return true;
}

function getCopyableFailingCommand(): string | undefined {
  const raw = state.lastFailingCommandRaw?.trim();
  return raw || undefined;
}

async function runActionSafetyNoopChecks(
  context: vscode.ExtensionContext,
): Promise<Record<string, boolean>> {
  const root = pickWorkspaceRoot();
  const original = {
    panelSummary: state.panelSummary,
    scratchSummary: state.scratchSummary,
    lastTaskName: state.lastTaskName,
    lastTaskWorkspaceRoot: state.lastTaskWorkspaceRoot,
    lastDebugConfigName: state.lastDebugConfigName,
    lastDebugWorkspaceRoot: state.lastDebugWorkspaceRoot,
  };
  const results: Record<string, boolean> = {
    restoreWithoutSummaryNoThrow: false,
    rerunTaskWithoutTaskNoThrow: false,
    rerunDebugWithoutSessionNoThrow: false,
    checkoutWithoutPreviousBranchNoThrow: false,
    invalidNextStepActionNoThrow: false,
  };

  const noOpSummary: ResumeSummary = {
    intent: 'test',
    nextSteps: ['noop'],
    topFiles: [],
    links: [],
    detailsMarkdown: '',
    codexPrompt: '',
    contextHash: '__test_noop__',
    generatedAt: Date.now(),
    source: 'local',
  };

  try {
    state.panelSummary = undefined;
    state.scratchSummary = undefined;
    if (root) {
      await context.workspaceState.update(summaryCacheKey(context, root), undefined);
    }

    state.lastTaskName = undefined;
    state.lastTaskWorkspaceRoot = undefined;
    state.lastDebugConfigName = undefined;
    state.lastDebugWorkspaceRoot = undefined;

    try {
      await restoreWorkingSetCommand(context);
      results.restoreWithoutSummaryNoThrow = true;
    } catch {
      results.restoreWithoutSummaryNoThrow = false;
    }

    try {
      await rerunLastTask();
      results.rerunTaskWithoutTaskNoThrow = true;
    } catch {
      results.rerunTaskWithoutTaskNoThrow = false;
    }

    try {
      await rerunLastDebugSession();
      results.rerunDebugWithoutSessionNoThrow = true;
    } catch {
      results.rerunDebugWithoutSessionNoThrow = false;
    }

    try {
      await checkoutPreviousBranch(undefined, root);
      results.checkoutWithoutPreviousBranchNoThrow = true;
    } catch {
      results.checkoutWithoutPreviousBranchNoThrow = false;
    }

    try {
      await runNextStepAction(noOpSummary, -1, root);
      results.invalidNextStepActionNoThrow = true;
    } catch {
      results.invalidNextStepActionNoThrow = false;
    }
  } finally {
    state.panelSummary = original.panelSummary;
    state.scratchSummary = original.scratchSummary;
    state.lastTaskName = original.lastTaskName;
    state.lastTaskWorkspaceRoot = original.lastTaskWorkspaceRoot;
    state.lastDebugConfigName = original.lastDebugConfigName;
    state.lastDebugWorkspaceRoot = original.lastDebugWorkspaceRoot;
  }

  return results;
}

async function runExecutionActionGuardChecks(): Promise<Record<string, boolean>> {
  const original = {
    lastTaskName: state.lastTaskName,
    lastTaskWorkspaceRoot: state.lastTaskWorkspaceRoot,
    lastDebugConfigName: state.lastDebugConfigName,
    lastDebugWorkspaceRoot: state.lastDebugWorkspaceRoot,
  };
  const results: Record<string, boolean> = {
    restrictedTaskExecuted: false,
    restrictedDebugExecuted: false,
    restrictedCheckoutExecuted: false,
    trustedTaskWithoutPrereqExecuted: false,
    trustedDebugWithoutPrereqExecuted: false,
    trustedCheckoutWithoutPrereqExecuted: false,
  };

  try {
    state.lastTaskName = undefined;
    state.lastTaskWorkspaceRoot = undefined;
    state.lastDebugConfigName = undefined;
    state.lastDebugWorkspaceRoot = undefined;

    results.restrictedTaskExecuted = await rerunLastTask({
      isWorkspaceTrustedOverride: false,
      suppressMessages: true,
    });
    results.restrictedDebugExecuted = await rerunLastDebugSession({
      isWorkspaceTrustedOverride: false,
      suppressMessages: true,
    });
    results.restrictedCheckoutExecuted = await checkoutPreviousBranch(undefined, undefined, {
      isWorkspaceTrustedOverride: false,
      suppressMessages: true,
    });

    results.trustedTaskWithoutPrereqExecuted = await rerunLastTask({
      isWorkspaceTrustedOverride: true,
      suppressMessages: true,
    });
    results.trustedDebugWithoutPrereqExecuted = await rerunLastDebugSession({
      isWorkspaceTrustedOverride: true,
      suppressMessages: true,
    });
    results.trustedCheckoutWithoutPrereqExecuted = await checkoutPreviousBranch(
      undefined,
      undefined,
      {
        isWorkspaceTrustedOverride: true,
        suppressMessages: true,
      },
    );
  } finally {
    state.lastTaskName = original.lastTaskName;
    state.lastTaskWorkspaceRoot = original.lastTaskWorkspaceRoot;
    state.lastDebugConfigName = original.lastDebugConfigName;
    state.lastDebugWorkspaceRoot = original.lastDebugWorkspaceRoot;
  }

  return results;
}

async function tryOpenCodexPanel(config: ExtensionConfig): Promise<string | undefined> {
  const knownCommands = await vscode.commands.getCommands(true);
  const candidates = resolveCodexOpenCommandCandidates(config.codexOpenCommand, knownCommands);

  for (const commandId of candidates) {
    try {
      await vscode.commands.executeCommand(commandId);
      return commandId;
    } catch (error) {
      state.output.appendLine(
        `Could not execute Codex command ${commandId}: ${(error as Error).message}`,
      );
    }
  }

  return undefined;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SummaryCorrectionEntry {
  corrections: string[];
  updatedAt: number;
}

type SummaryCorrectionStore = Record<string, SummaryCorrectionEntry>;

function summaryCorrectionsKey(root: string): string {
  return `${KEY_SUMMARY_CORRECTIONS_PREFIX}.${Buffer.from(root).toString('base64url')}`;
}

function summarizeCorrectionsFingerprint(corrections: string[]): string {
  if (corrections.length === 0) {
    return '';
  }

  return createHash('sha1').update(corrections.join('\n')).digest('hex');
}

function readSummaryCorrectionStore(
  context: vscode.ExtensionContext,
  root: string,
): SummaryCorrectionStore {
  const raw = context.workspaceState.get<Record<string, unknown>>(summaryCorrectionsKey(root), {});
  const normalized: SummaryCorrectionStore = {};

  for (const [contextHash, value] of Object.entries(raw)) {
    if (!contextHash.trim() || !value || typeof value !== 'object') {
      continue;
    }

    const entry = value as { corrections?: unknown; updatedAt?: unknown };
    const corrections = Array.isArray(entry.corrections)
      ? uniqueStrings(
          entry.corrections.filter((item): item is string => typeof item === 'string'),
        ).slice(0, 5)
      : [];
    if (corrections.length === 0) {
      continue;
    }

    normalized[contextHash] = {
      corrections,
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
    };
  }

  return normalized;
}

function getSummaryCorrectionsForContext(
  context: vscode.ExtensionContext,
  root: string,
  contextHash: string,
): string[] {
  const store = readSummaryCorrectionStore(context, root);
  return store[contextHash]?.corrections ?? [];
}

async function persistSummaryCorrection(
  context: vscode.ExtensionContext,
  root: string,
  contextHash: string,
  correction: string,
): Promise<void> {
  const store = readSummaryCorrectionStore(context, root);
  const existing = store[contextHash]?.corrections ?? [];
  store[contextHash] = {
    corrections: uniqueStrings([correction, ...existing]).slice(0, 5),
    updatedAt: Date.now(),
  };

  const trimmedEntries = Object.entries(store)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, 40);
  const trimmed = Object.fromEntries(trimmedEntries);

  await context.workspaceState.update(summaryCorrectionsKey(root), trimmed);
}

async function clearSummaryCorrections(
  context: vscode.ExtensionContext,
  root: string,
): Promise<void> {
  await context.workspaceState.update(summaryCorrectionsKey(root), undefined);
}

async function captureSummaryCorrection(context: vscode.ExtensionContext): Promise<void> {
  const summary = state.panelSummary;
  const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
  if (!summary || !workspaceRoot) {
    void vscode.window.showInformationMessage(
      'TaCoS: no active summary context is available for correction.',
    );
    return;
  }

  const reason = await vscode.window.showQuickPick(
    [
      { label: 'Wrong intent', value: 'wrong intent' },
      { label: 'Wrong next step', value: 'wrong next step' },
      { label: 'Missing evidence', value: 'missing evidence' },
      { label: 'Other', value: 'other' },
    ],
    {
      title: 'TaCoS: Fix Summary',
      placeHolder: 'What needs fixing?',
      ignoreFocusOut: true,
    },
  );
  if (!reason) {
    return;
  }

  const rawCorrection = await vscode.window.showInputBox({
    title: 'TaCoS: Add Correction',
    prompt: 'One-line correction TaCoS should respect for this context',
    placeHolder: 'Example: Intent is parser stabilization, not release prep',
    ignoreFocusOut: true,
  });
  if (!rawCorrection?.trim()) {
    return;
  }

  const redacted = redactText(
    `${reason.value}: ${rawCorrection.trim()}`,
    workspaceRoot,
    getConfig().redactionPatterns,
  ).trim();
  if (!redacted) {
    void vscode.window.showWarningMessage(
      'TaCoS: correction was empty after redaction and was not saved.',
    );
    return;
  }

  const capped = redacted.length > 280 ? `${redacted.slice(0, 279)}…` : redacted;
  await persistSummaryCorrection(context, workspaceRoot, summary.contextHash, capped);
  const action = await vscode.window.showInformationMessage(
    'TaCoS: correction saved and will be applied to future summaries for this context.',
    'Regenerate now',
  );
  if (action === 'Regenerate now') {
    await triggerSummary(context, 'manual', workspaceRoot);
  }
}

async function setPaused(value: boolean): Promise<void> {
  const scope = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await vscode.workspace.getConfiguration('tacos').update('pauseSummaries', value, scope);
  updateCompanionStatusBar();
}

async function setEnabled(value: boolean): Promise<void> {
  const scope = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await vscode.workspace.getConfiguration('tacos').update('enabled', value, scope);
  updateCompanionStatusBar();
}

async function setSummaryProvider(value: SummaryProvider): Promise<void> {
  const scope = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await vscode.workspace.getConfiguration('tacos').update('summaryProvider', value, scope);
}

function describeProvider(provider: SummaryProvider): string {
  if (provider === 'vscode-lm') {
    return 'VS Code LM';
  }

  if (provider === 'openai') {
    return 'OpenAI';
  }

  return 'Local-only';
}

function modelLabel(model: VscodeLmModelLike): string {
  return model.name?.trim() || model.id?.trim() || model.family?.trim() || 'Selected model';
}

type VscodeWithLmApi = typeof vscode & {
  lm?: {
    selectChatModels?: (selector?: Record<string, string>) => Promise<unknown[]>;
  };
};

function getSelectChatModelsApi():
  | ((selector?: Record<string, string>) => Promise<unknown[]>)
  | undefined {
  const selectChatModels = (vscode as VscodeWithLmApi).lm?.selectChatModels;
  return typeof selectChatModels === 'function' ? selectChatModels : undefined;
}

function toVscodeLmModels(available: unknown): VscodeLmModelLike[] {
  return (Array.isArray(available) ? available : []).filter((entry) =>
    Boolean(entry && typeof entry === 'object' && 'sendRequest' in entry),
  ) as unknown as VscodeLmModelLike[];
}

function normalizeModelSelector(
  model: VscodeLmModelLike,
  fallbackVendor = 'copilot',
): VscodeLmModelSelector {
  return {
    vendor: model.vendor?.trim() || fallbackVendor,
    id: model.id?.trim() || undefined,
    family: model.family?.trim() || undefined,
    name: model.name?.trim() || undefined,
  };
}

function modelSelectorCacheKey(model: VscodeLmModelLike): string {
  return [
    model.vendor?.trim().toLowerCase() || '',
    model.id?.trim().toLowerCase() || '',
    model.family?.trim().toLowerCase() || '',
    model.name?.trim().toLowerCase() || '',
  ].join('|');
}

function modelMatchesSelector(model: VscodeLmModelLike, selector: VscodeLmModelSelector): boolean {
  const vendor = model.vendor?.trim().toLowerCase() ?? '';
  const id = model.id?.trim().toLowerCase() ?? '';
  const family = model.family?.trim().toLowerCase() ?? '';
  const name = model.name?.trim().toLowerCase() ?? '';
  const selectedVendor = selector.vendor?.trim().toLowerCase() ?? '';
  const selectedId = selector.id?.trim().toLowerCase() ?? '';
  const selectedFamily = selector.family?.trim().toLowerCase() ?? '';
  const selectedName = selector.name?.trim().toLowerCase() ?? '';

  if (selectedVendor && vendor && selectedVendor !== vendor) {
    return false;
  }
  if (selectedId && selectedId !== id) {
    return false;
  }
  if (selectedFamily && selectedFamily !== family) {
    return false;
  }
  if (selectedName && selectedName !== name) {
    return false;
  }

  return true;
}

async function restoreVscodeLmModelFromSelector(
  context: vscode.ExtensionContext,
): Promise<VscodeLmModelLike | undefined> {
  const selector = state.vscodeLmSelector;
  if (!selector) {
    return undefined;
  }

  const selectChatModels = getSelectChatModelsApi();
  if (!selectChatModels) {
    return undefined;
  }

  const queries: Record<string, string>[] = [];
  const selectorVendor = selector.vendor?.trim() || 'copilot';
  const selectorQuery: Record<string, string> = { vendor: selectorVendor };
  if (selector.id) {
    selectorQuery.id = selector.id;
  }
  if (selector.family) {
    selectorQuery.family = selector.family;
  }
  queries.push(selectorQuery);
  queries.push({ vendor: selectorVendor });
  if (selectorVendor !== 'copilot') {
    queries.push({ vendor: 'copilot' });
  }

  const models: VscodeLmModelLike[] = [];
  for (const query of queries) {
    try {
      models.push(...toVscodeLmModels(await selectChatModels(query)));
    } catch (error) {
      state.output.appendLine(
        `TaCoS: failed restoring VS Code LM with selector ${JSON.stringify(query)}: ${(error as Error).message}`,
      );
    }
  }

  const uniqueModels: VscodeLmModelLike[] = [];
  const seen = new Set<string>();
  for (const model of models) {
    const key = modelSelectorCacheKey(model);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueModels.push(model);
  }

  const restored =
    uniqueModels.find((model) => modelMatchesSelector(model, selector)) ?? uniqueModels[0];
  if (!restored) {
    return undefined;
  }

  state.vscodeLmModel = restored;
  state.vscodeLmSelector = normalizeModelSelector(restored, selectorVendor);
  await context.globalState.update(KEY_VSCODE_LM_SELECTOR, state.vscodeLmSelector);
  state.vscodeLmUnavailableNotified = false;
  return restored;
}

async function selectVscodeLmModel(): Promise<VscodeLmModelLike | undefined> {
  const selectChatModels = getSelectChatModelsApi();
  if (!selectChatModels) {
    void vscode.window.showWarningMessage(
      'TaCoS: this VS Code build does not expose the Language Model API.',
    );
    return undefined;
  }

  const models = toVscodeLmModels(await selectChatModels({ vendor: 'copilot' }));

  if (models.length === 0) {
    void vscode.window.showWarningMessage(
      'TaCoS: no VS Code LM models are available. Ensure Copilot chat access is enabled and try again.',
    );
    return undefined;
  }

  if (models.length === 1) {
    return models[0];
  }

  const picked = await vscode.window.showQuickPick(
    models.map((model) => ({
      label: modelLabel(model),
      description: [model.vendor, model.family, model.id].filter(Boolean).join(' • '),
      model,
    })),
    {
      title: 'TaCoS: Select VS Code LM Model',
      placeHolder: 'Choose a model for AI summary refinement',
      ignoreFocusOut: true,
    },
  );

  return picked?.model;
}

async function configureAiProvider(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: 'Local-only (Recommended)',
        description: 'No network calls',
        detail: 'Fastest and most private. TaCoS renders from local/cached evidence only.',
        provider: 'local' as const,
      },
      {
        label: 'VS Code LM (Copilot)',
        description: 'Uses VS Code Language Model API',
        detail:
          'Refines summaries asynchronously. Availability depends on VS Code LM access; falls back to local when unavailable.',
        provider: 'vscode-lm' as const,
      },
      {
        label: 'OpenAI (direct API)',
        description: 'Uses OpenAI-compatible endpoint',
        detail:
          'Requires API key. Sends redacted summary context for refinement only when enabled; unsafe links are still blocked.',
        provider: 'openai' as const,
      },
    ],
    {
      title: 'TaCoS: Configure AI Provider',
      placeHolder: `Current provider: ${describeProvider(config.summaryProvider)}`,
      ignoreFocusOut: true,
    },
  );

  if (!picked) {
    return;
  }

  if (picked.provider === 'local') {
    await setSummaryProvider('local');
    void vscode.window.showInformationMessage('TaCoS: provider set to local-only.');
    return;
  }

  if (picked.provider === 'openai') {
    const consent = await vscode.window.showWarningMessage(
      'OpenAI mode sends redacted task context to your configured endpoint in trusted workspaces. Continue?',
      { modal: true },
      'Continue',
    );
    if (consent !== 'Continue') {
      return;
    }

    await setSummaryProvider('openai');
    const key = await resolveOpenAiApiKey(context);
    if (!key) {
      const action = await vscode.window.showInformationMessage(
        'TaCoS: OpenAI selected. Set an API key in Secret Storage to enable refinement.',
        'Set API Key',
      );
      if (action === 'Set API Key') {
        await vscode.commands.executeCommand('tacos.setOpenAiApiKey');
      }
      return;
    }

    void vscode.window.showInformationMessage('TaCoS: provider set to OpenAI.');
    return;
  }

  const lmConsent = await vscode.window.showInformationMessage(
    'VS Code LM mode may send redacted context through VS Code model providers and only runs in trusted workspaces.',
    { modal: true },
    'Continue',
  );
  if (lmConsent !== 'Continue') {
    return;
  }

  const model = await selectVscodeLmModel();
  if (!model) {
    return;
  }

  const selector: VscodeLmModelSelector = normalizeModelSelector(model);
  state.vscodeLmModel = model;
  state.vscodeLmSelector = selector;
  state.vscodeLmUnavailableNotified = false;
  await context.globalState.update(KEY_VSCODE_LM_SELECTOR, selector);
  await setSummaryProvider('vscode-lm');
  void vscode.window.showInformationMessage(
    `TaCoS: provider set to VS Code LM (${modelLabel(model)}).`,
  );
}

function hasExplicitConfigValue<T>(
  inspected:
    | {
        globalValue?: T;
        workspaceValue?: T;
        workspaceFolderValue?: T;
      }
    | undefined,
): boolean {
  if (!inspected) {
    return false;
  }

  return (
    typeof inspected.globalValue !== 'undefined' ||
    typeof inspected.workspaceValue !== 'undefined' ||
    typeof inspected.workspaceFolderValue !== 'undefined'
  );
}

function resolveUiSurfaceConfig(
  config: vscode.WorkspaceConfiguration,
): ExtensionConfig['uiSurface'] {
  const uiSurfaceInspect = config.inspect<ExtensionConfig['uiSurface']>('uiSurface');
  const hasExplicitUiSurface = hasExplicitConfigValue(uiSurfaceInspect);
  const configuredUiSurface = config.get<ExtensionConfig['uiSurface']>('uiSurface', 'statusbar');

  if (hasExplicitUiSurface) {
    return configuredUiSurface;
  }

  const autoRefreshInspect = config.inspect<boolean>('autoRefreshInBackground');
  const hasExplicitAutoRefresh = hasExplicitConfigValue(autoRefreshInspect);
  if (!hasExplicitAutoRefresh) {
    return configuredUiSurface;
  }

  return config.get<boolean>('autoRefreshInBackground', true) ? 'statusbar' : 'notification';
}

const PRIVACY_PRESET_LABELS: Record<ExtensionConfig['privacyPreset'], string> = {
  minimal: 'Minimal',
  balanced: 'Balanced',
  'max-context': 'Max Context',
};

const PRIVACY_PRESET_DETAILS: Record<ExtensionConfig['privacyPreset'], string> = {
  minimal: 'No diff, no terminal/debug history, local summary only.',
  balanced: 'Terminal/debug context enabled, no diff, local summary only.',
  'max-context': 'Terminal/debug + diff enabled, local summary only.',
};

const RETENTION_POLICY_LABELS: Record<ExtensionConfig['retentionPolicy'], string> = {
  '1d': '1 day',
  '7d': '7 days',
  '30d': '30 days',
  forever: 'Forever',
};

const PRIVACY_PRESET_PROFILES: Record<
  ExtensionConfig['privacyPreset'],
  {
    includeDiff: boolean;
    includeTerminalHistory: boolean;
    includeDebugHistory: boolean;
    summaryProvider: SummaryProvider;
  }
> = {
  minimal: {
    includeDiff: false,
    includeTerminalHistory: false,
    includeDebugHistory: false,
    summaryProvider: 'local',
  },
  balanced: {
    includeDiff: false,
    includeTerminalHistory: true,
    includeDebugHistory: true,
    summaryProvider: 'local',
  },
  'max-context': {
    includeDiff: true,
    includeTerminalHistory: true,
    includeDebugHistory: true,
    summaryProvider: 'local',
  },
};

function retentionPolicyToMs(
  retentionPolicy: ExtensionConfig['retentionPolicy'],
): number | undefined {
  if (retentionPolicy === '1d') {
    return 24 * 60 * 60 * 1000;
  }
  if (retentionPolicy === '7d') {
    return 7 * 24 * 60 * 60 * 1000;
  }
  if (retentionPolicy === '30d') {
    return 30 * 24 * 60 * 60 * 1000;
  }
  return undefined;
}

async function promptAndApplyPrivacyPreset(context: vscode.ExtensionContext): Promise<void> {
  type PresetPick = vscode.QuickPickItem & { preset: ExtensionConfig['privacyPreset'] };
  const current = getConfig().privacyPreset;
  const picks: PresetPick[] = (['minimal', 'balanced', 'max-context'] as const).map((preset) => ({
    preset,
    label: PRIVACY_PRESET_LABELS[preset],
    detail: PRIVACY_PRESET_DETAILS[preset],
    description: preset === current ? 'Current' : undefined,
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Privacy Preset',
    placeHolder: 'Choose a preset',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  await applyPrivacyPreset(picked.preset, context);
  rerenderPanel();
  updateCompanionStatusBar();
  void vscode.window.showInformationMessage(
    `TaCoS: privacy preset set to ${PRIVACY_PRESET_LABELS[picked.preset]}.`,
  );
}

async function promptAndSetRetentionPolicy(context: vscode.ExtensionContext): Promise<void> {
  type RetentionPick = vscode.QuickPickItem & { policy: ExtensionConfig['retentionPolicy'] };
  const current = getConfig().retentionPolicy;
  const picks: RetentionPick[] = (['1d', '7d', '30d', 'forever'] as const).map((policy) => ({
    policy,
    label: RETENTION_POLICY_LABELS[policy],
    description: policy === current ? 'Current' : undefined,
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Retention Policy',
    placeHolder: 'Choose how long workspace context is kept',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  const config = vscode.workspace.getConfiguration('tacos');
  await config.update('retentionPolicy', picked.policy, vscode.ConfigurationTarget.Global);
  await applyRetentionPolicy(context, pickWorkspaceRoot() ?? '');
  rerenderPanel();
  void vscode.window.showInformationMessage(
    `TaCoS: retention policy set to ${RETENTION_POLICY_LABELS[picked.policy]}.`,
  );
}

function nextTomorrowMorning(now: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

type SummaryQuietSource = 'none' | 'temporary' | 'configured';

interface SummaryQuietState {
  active: boolean;
  source: SummaryQuietSource;
  temporaryUntil?: number;
}

function resolveSummaryQuietState(now: number, summaryQuietHours: string): SummaryQuietState {
  if (state.summaryQuietUntil > now) {
    return {
      active: true,
      source: 'temporary',
      temporaryUntil: state.summaryQuietUntil,
    };
  }

  if (isInQuietHours(now, summaryQuietHours)) {
    return {
      active: true,
      source: 'configured',
    };
  }

  return {
    active: false,
    source: 'none',
  };
}

async function setSummaryQuietUntil(
  context: vscode.ExtensionContext,
  quietUntil: number,
): Promise<void> {
  if (Number.isFinite(quietUntil) && quietUntil > Date.now()) {
    state.summaryQuietUntil = quietUntil;
    await context.workspaceState.update(KEY_SUMMARY_QUIET_UNTIL, quietUntil);
  } else {
    state.summaryQuietUntil = 0;
    await context.workspaceState.update(KEY_SUMMARY_QUIET_UNTIL, undefined);
  }

  updateCompanionStatusBar();
  rerenderPanel();
}

async function clearExpiredSummaryQuietIfNeeded(
  context: vscode.ExtensionContext,
  now: number,
): Promise<void> {
  if (state.summaryQuietUntil <= 0 || now < state.summaryQuietUntil) {
    return;
  }

  state.summaryQuietUntil = 0;
  await context.workspaceState.update(KEY_SUMMARY_QUIET_UNTIL, undefined);
  updateCompanionStatusBar();
  rerenderPanel();
}

function resolveSummaryQuietHoursConfigurationTarget(): {
  config: vscode.WorkspaceConfiguration;
  target: vscode.ConfigurationTarget;
} {
  const workspaceRoot = pickWorkspaceRoot();
  const workspaceFolder = workspaceRoot
    ? vscode.workspace.workspaceFolders?.find((folder) => folder.uri.fsPath === workspaceRoot)
    : undefined;
  const scopedConfig = workspaceFolder
    ? vscode.workspace.getConfiguration('tacos', workspaceFolder.uri)
    : vscode.workspace.getConfiguration('tacos');
  const inspected = scopedConfig.inspect<string>('summaryQuietHours');
  if (typeof inspected?.workspaceFolderValue === 'string') {
    return {
      config: scopedConfig,
      target: vscode.ConfigurationTarget.WorkspaceFolder,
    };
  }

  if (typeof inspected?.workspaceValue === 'string') {
    return {
      config: vscode.workspace.getConfiguration('tacos'),
      target: vscode.ConfigurationTarget.Workspace,
    };
  }

  return {
    config: vscode.workspace.getConfiguration('tacos'),
    target: vscode.ConfigurationTarget.Global,
  };
}

async function updateSummaryQuietHoursSetting(value: string): Promise<void> {
  const { config, target } = resolveSummaryQuietHoursConfigurationTarget();
  await config.update('summaryQuietHours', value, target);
}

async function quietNowSummariesForOneHour(context: vscode.ExtensionContext): Promise<void> {
  const quietUntil = Date.now() + 60 * 60_000;
  await setSummaryQuietUntil(context, quietUntil);
  recordMetricCounter('summaryQuietActions');
  void vscode.window.showInformationMessage(
    `TaCoS: summary notifications quieted until ${formatTimestamp(quietUntil)}.`,
  );
}

async function promptAndSetSummaryQuietHoursWindow(): Promise<void> {
  const config = getConfig();
  const value = await vscode.window.showInputBox({
    title: 'TaCoS: Summary Quiet Hours',
    prompt: 'Set a daily quiet window in HH:MM-HH:MM format.',
    placeHolder: '22:00-07:00',
    value: config.summaryQuietHours.trim(),
    validateInput: (input) => {
      if (!input.trim()) {
        return 'Quiet window is required. Use Clear in the previous menu to remove it.';
      }

      const parsed = parseQuietHoursWindow(input);
      if (!parsed) {
        return 'Use HH:MM-HH:MM, for example 22:00-07:00.';
      }

      return null;
    },
    ignoreFocusOut: true,
  });
  if (!value) {
    return;
  }

  const parsed = parseQuietHoursWindow(value);
  if (!parsed) {
    return;
  }

  const normalized = formatQuietHoursWindow(parsed);
  await updateSummaryQuietHoursSetting(normalized);
  updateCompanionStatusBar();
  rerenderPanel();
  void vscode.window.showInformationMessage(
    `TaCoS: daily summary quiet hours set to ${normalized}.`,
  );
}

async function promptAndConfigureSummaryQuietHours(
  context: vscode.ExtensionContext,
): Promise<void> {
  const now = Date.now();
  await clearExpiredSummaryQuietIfNeeded(context, now);

  const config = getConfig();
  const configuredQuietHours = config.summaryQuietHours.trim();
  const hasConfiguredValue = configuredQuietHours.length > 0;
  const hasConfiguredWindow = Boolean(parseQuietHoursWindow(configuredQuietHours));
  const hasTemporaryQuiet = state.summaryQuietUntil > now;

  type QuietHoursPick = vscode.QuickPickItem & {
    id: 'quietNow' | 'untilTomorrow' | 'setWindow' | 'clearWindow' | 'clearTemporary' | 'clearAll';
  };

  const picks: QuietHoursPick[] = [
    {
      id: 'quietNow',
      label: 'Quiet now (1 hour)',
      detail: 'Suppress focus-triggered summaries for the next hour.',
    },
    {
      id: 'untilTomorrow',
      label: 'Quiet until tomorrow morning',
      detail: 'Suppress focus-triggered summaries until 9:00 AM local time tomorrow.',
    },
    {
      id: 'setWindow',
      label: 'Set daily quiet window',
      detail: hasConfiguredWindow
        ? `Current: ${configuredQuietHours}`
        : hasConfiguredValue
          ? `Current value is invalid (${configuredQuietHours}); set a valid HH:MM-HH:MM window.`
          : 'Set recurring quiet hours in HH:MM-HH:MM format.',
    },
  ];

  if (hasTemporaryQuiet) {
    picks.push({
      id: 'clearTemporary',
      label: 'Clear temporary quiet window',
      detail: `Currently active until ${formatTimestamp(state.summaryQuietUntil)}.`,
    });
  }
  if (hasConfiguredValue) {
    picks.push({
      id: 'clearWindow',
      label: 'Clear daily quiet window',
      detail: `Remove configured daily window value (${configuredQuietHours}).`,
    });
  }
  if (hasTemporaryQuiet || hasConfiguredValue) {
    picks.push({
      id: 'clearAll',
      label: 'Turn quiet mode off',
      detail: 'Clear temporary and recurring summary quiet suppression.',
    });
  }

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Summary Quiet Hours',
    placeHolder: 'Choose how long summary prompts should stay quiet',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  if (picked.id === 'quietNow') {
    await quietNowSummariesForOneHour(context);
    return;
  }

  if (picked.id === 'untilTomorrow') {
    const quietUntil = nextTomorrowMorning(Date.now());
    await setSummaryQuietUntil(context, quietUntil);
    recordMetricCounter('summaryQuietActions');
    void vscode.window.showInformationMessage(
      `TaCoS: summary notifications quieted until ${formatTimestamp(quietUntil)}.`,
    );
    return;
  }

  if (picked.id === 'setWindow') {
    await promptAndSetSummaryQuietHoursWindow();
    return;
  }

  if (picked.id === 'clearTemporary') {
    await setSummaryQuietUntil(context, 0);
    void vscode.window.showInformationMessage('TaCoS: temporary summary quiet window cleared.');
    return;
  }

  if (picked.id === 'clearWindow') {
    await updateSummaryQuietHoursSetting('');
    updateCompanionStatusBar();
    rerenderPanel();
    void vscode.window.showInformationMessage('TaCoS: daily summary quiet window cleared.');
    return;
  }

  if (picked.id === 'clearAll') {
    await setSummaryQuietUntil(context, 0);
    await updateSummaryQuietHoursSetting('');
    updateCompanionStatusBar();
    rerenderPanel();
    void vscode.window.showInformationMessage('TaCoS: summary quiet mode turned off.');
  }
}

async function promptAndSetAutoSummarySnooze(context: vscode.ExtensionContext): Promise<void> {
  type SnoozePick = vscode.QuickPickItem & { id: '30m' | 'tomorrow' | 'clear' };
  const picks: SnoozePick[] = [
    {
      id: '30m',
      label: 'Snooze 30 minutes',
      detail: 'Suppress focus-triggered summaries for 30 minutes.',
    },
    {
      id: 'tomorrow',
      label: 'Snooze until tomorrow morning',
      detail: 'Suppress focus-triggered summaries until 9:00 AM local time tomorrow.',
    },
    {
      id: 'clear',
      label: 'Clear snooze',
      detail: 'Resume normal focus-triggered summaries.',
    },
  ];
  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Snooze Auto Summaries',
    placeHolder: 'Choose a snooze duration',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  if (picked.id === 'clear') {
    state.snoozeUntil = 0;
    await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
    updateCompanionStatusBar();
    rerenderPanel();
    void vscode.window.showInformationMessage('TaCoS: auto summary snooze cleared.');
    return;
  }

  const now = Date.now();
  state.snoozeUntil = picked.id === '30m' ? now + 30 * 60_000 : nextTomorrowMorning(now);
  await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, state.snoozeUntil);
  recordMetricCounter('snoozeActions');
  const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot) ?? pickWorkspaceRoot();
  const summaryForMemory = state.panelSummary ?? state.scratchSummary;
  if (workspaceRoot && summaryForMemory) {
    await rememberPercolationPrimaryForSummary(
      context,
      workspaceRoot,
      summaryForMemory,
      'snoozed',
      state.snoozeUntil,
    );
  }
  updateCompanionStatusBar();
  rerenderPanel();
  void vscode.window.showInformationMessage(
    `TaCoS: auto summaries snoozed until ${formatTimestamp(state.snoozeUntil)}.`,
  );
}

async function clearExpiredSnoozeIfNeeded(
  context: vscode.ExtensionContext,
  now: number,
): Promise<void> {
  if (state.snoozeUntil <= 0 || now < state.snoozeUntil) {
    return;
  }

  state.snoozeUntil = 0;
  await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
  updateCompanionStatusBar();
  rerenderPanel();
}

async function applyPrivacyPreset(
  preset: ExtensionConfig['privacyPreset'],
  context?: vscode.ExtensionContext,
): Promise<void> {
  const profile = PRIVACY_PRESET_PROFILES[preset];
  const config = vscode.workspace.getConfiguration('tacos');

  state.applyingPrivacyPreset = true;
  try {
    await Promise.all([
      config.update('privacyPreset', preset, vscode.ConfigurationTarget.Global),
      config.update('includeDiff', profile.includeDiff, vscode.ConfigurationTarget.Global),
      config.update(
        'includeTerminalHistory',
        profile.includeTerminalHistory,
        vscode.ConfigurationTarget.Global,
      ),
      config.update(
        'includeDebugHistory',
        profile.includeDebugHistory,
        vscode.ConfigurationTarget.Global,
      ),
      config.update('summaryProvider', profile.summaryProvider, vscode.ConfigurationTarget.Global),
    ]);
  } finally {
    state.applyingPrivacyPreset = false;
  }

  if (!context) {
    return;
  }

  if (!profile.includeTerminalHistory) {
    state.recentTerminal = new RingBuffer(15);
    state.doneItems = new RingBuffer(10);
    state.lastFailingCommand = undefined;
    state.lastFailingCommandRaw = undefined;
    state.recentUrls = new RingBuffer(5);
  }
  if (!profile.includeDebugHistory) {
    state.recentDebug = new RingBuffer(10);
  }

  await persistActivity(context);
}

async function forgetWorkspaceNow(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Forget all TaCoS state for this workspace (${path.basename(workspaceRoot)})?`,
    { modal: true },
    'Forget',
  );
  if (choice !== 'Forget') {
    return;
  }

  await clearWorkspaceScopedState(context, workspaceRoot);
  await clearScratchpadStorageForWorkspace(context, workspaceRoot);
  const metricHistory = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  const retainedMetrics = removeMetricsForWorkspace(metricHistory, workspaceRoot);
  if (retainedMetrics.length !== metricHistory.length) {
    await context.workspaceState.update(KEY_METRIC_HISTORY, retainedMetrics);
  }
  resetRuntimeWorkspaceState();
  rerenderPanel();
  updateCompanionStatusBar();
  void vscode.window.showInformationMessage('TaCoS: forgot workspace-scoped data.');
}

async function clearScratchpadStorageForWorkspace(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const workspaceScratchpadRoot = resolveScratchpadStorageRootUri(context, workspaceRoot);
  try {
    await vscode.workspace.fs.delete(workspaceScratchpadRoot, { recursive: true, useTrash: false });
  } catch {
    // Ignore missing scratchpad storage paths.
  }
}

function aiPayloadConsentKey(workspaceRoot: string): string {
  return `${KEY_AI_PAYLOAD_CONSENT_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function resolveAiPreviewProvider(
  config: ExtensionConfig,
  runtimeMode: CompanionRuntimeMode,
): SummaryProvider {
  if (runtimeMode === 'restricted' || runtimeMode === 'disabled') {
    return 'local';
  }

  return config.summaryProvider;
}

function resolveAiProviderModeLabel(
  config: ExtensionConfig,
  runtimeMode: CompanionRuntimeMode,
): string {
  const requestedProviderLabel =
    config.summaryProvider === 'local'
      ? 'Local'
      : config.summaryProvider === 'openai'
        ? 'OpenAI'
        : 'VS Code LM';

  if (runtimeMode === 'restricted') {
    return `${requestedProviderLabel} requested; Restricted Mode enforces local-only behavior.`;
  }

  if (runtimeMode === 'disabled') {
    return `${requestedProviderLabel} requested; summaries are currently disabled.`;
  }

  if (config.summaryProvider === 'local') {
    return 'Local-only mode.';
  }

  return `${requestedProviderLabel} with explicit per-workspace consent.`;
}

function resolveAiConsentStatusLabel(
  context: vscode.ExtensionContext | undefined,
  workspaceRoot: string | undefined,
  config: ExtensionConfig,
  runtimeMode: CompanionRuntimeMode,
): string {
  if (runtimeMode === 'restricted') {
    return 'Not required while Restricted Mode is active.';
  }

  if (runtimeMode === 'disabled' || config.summaryProvider === 'local') {
    return 'Not required in local-only mode.';
  }

  if (!context || !workspaceRoot) {
    return 'Unavailable: open a workspace folder to evaluate consent status.';
  }

  const storedSignature = context.workspaceState
    .get<string>(aiPayloadConsentKey(workspaceRoot), '')
    .trim();
  if (storedSignature) {
    return 'Saved for this workspace (provider/inclusion scoped).';
  }

  return 'Not saved; TaCoS will ask before AI send.';
}

function aiPayloadConsentSignature(prepared: PreparedTriggerSummary): string {
  const includeCheckpointNotes = prepared.aiPayloadCheckpointNotes.length > 0;
  const includeScratchpad = Boolean(prepared.aiPayloadScratchpadExcerpt);
  return [
    prepared.providerPlan.activeProvider,
    `checkpoint:${includeCheckpointNotes ? '1' : '0'}`,
    `scratchpad:${includeScratchpad ? '1' : '0'}`,
  ].join('|');
}

function hasAiPayloadConsent(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  expectedSignature: string,
): boolean {
  const storedSignature = context.workspaceState.get<string>(
    aiPayloadConsentKey(workspaceRoot),
    '',
  );
  return storedSignature.trim() === expectedSignature;
}

async function setAiPayloadConsent(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  allowed: boolean,
  signature: string,
): Promise<void> {
  await context.workspaceState.update(
    aiPayloadConsentKey(workspaceRoot),
    allowed ? signature : undefined,
  );
}

async function openAiPayloadPreviewFromPanel(context: vscode.ExtensionContext): Promise<void> {
  const summary = state.panelSummary;
  const workspaceRoot = pickWorkspaceRoot(state.panelWorkspaceRoot);
  if (!summary || !workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const config = getConfig();
  const runtimeMode = resolveCompanionRuntimeMode(config);
  const provider = resolveAiPreviewProvider(config, runtimeMode);
  const signals = await collectSignals(workspaceRoot, config);
  const checkpointContext = await resolveCheckpointContext(
    context,
    workspaceRoot,
    summary.currentBranch,
    true,
  );
  const primaryNote = checkpointContext.primaryNote;
  const includeCheckpointNotes = config.aiIncludeCheckpointNotes && primaryNote?.status === 'open';
  const checkpointNotes = includeCheckpointNotes && primaryNote ? [primaryNote.text] : [];
  const scratchpadExcerpt = config.aiIncludeScratchpad
    ? await loadScratchpadExcerptForAi(context, workspaceRoot, summary.currentBranch)
    : undefined;
  const strictContext = buildStrictSanitizedSummaryContext(
    signals,
    summary,
    config.redactionPatterns,
  );
  const previewMarkdown = buildAiPayloadPreviewMarkdown({
    provider,
    workspaceName: path.basename(workspaceRoot),
    generatedAt: Date.now(),
    signals,
    summary: {
      intent: summary.intent,
      intentOverridden: summary.intentOverridden,
      nextSteps: summary.nextSteps,
      topFiles: summary.topFiles,
      links: summary.links,
      evidenceCatalog: summary.evidenceCatalog,
    },
    checkpointNotes,
    includeCheckpointNotes,
    includeScratchpad: Boolean(scratchpadExcerpt),
    scratchpadExcerpt,
    redactionReport: strictContext.report,
  });
  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: previewMarkdown,
  });
  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
  postPanelStatus('TaCoS: AI payload preview opened.');
}

async function revokeAiPayloadConsent(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  await setAiPayloadConsent(context, workspaceRoot, false, '');
  void vscode.window.showInformationMessage(
    'TaCoS: AI payload consent revoked for this workspace.',
  );
}

async function ensureAiPayloadConsent(
  context: vscode.ExtensionContext,
  prepared: PreparedTriggerSummary,
): Promise<boolean> {
  const includeCheckpointNotes = prepared.aiPayloadCheckpointNotes.length > 0;
  const includeScratchpad = Boolean(prepared.aiPayloadScratchpadExcerpt);
  const consentSignature = aiPayloadConsentSignature(prepared);
  const strictContext = buildStrictSanitizedSummaryContext(
    prepared.signals,
    prepared.aiPayloadSummary,
    prepared.config.redactionPatterns,
  );
  recordRedactionMetrics(
    strictContext.report.totalReplacements,
    strictContext.report.highRiskDetected,
  );
  const hasStoredConsent = hasAiPayloadConsent(context, prepared.root, consentSignature);

  const previewMarkdown = buildAiPayloadPreviewMarkdown({
    provider: prepared.providerPlan.activeProvider,
    workspaceName: path.basename(prepared.root),
    generatedAt: Date.now(),
    signals: prepared.signals,
    summary: {
      intent: prepared.aiPayloadSummary.intent,
      intentOverridden: prepared.aiPayloadSummary.intentOverridden,
      nextSteps: prepared.aiPayloadSummary.nextSteps,
      topFiles: prepared.aiPayloadSummary.topFiles,
      links: prepared.aiPayloadSummary.links,
      evidenceCatalog: prepared.aiPayloadSummary.evidenceCatalog,
    },
    checkpointNotes: prepared.aiPayloadCheckpointNotes,
    includeCheckpointNotes,
    includeScratchpad,
    scratchpadExcerpt: prepared.aiPayloadScratchpadExcerpt,
    redactionReport: strictContext.report,
  });

  if (strictContext.report.highRiskDetected) {
    if (!hasStoredConsent) {
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: previewMarkdown,
      });
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      });
    }
    recordMetricCounter('aiSendBlockedBySanitizerTotal');
    void vscode.window.showWarningMessage(
      'TaCoS: AI payload send blocked by strict sanitizer due to high-risk content.',
    );
    return false;
  }
  if (hasStoredConsent) {
    return true;
  }

  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: previewMarkdown,
  });
  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });

  type ConsentPick = vscode.QuickPickItem & { id: 'once' | 'always' | 'deny' };
  const picks: ConsentPick[] = [
    {
      id: 'once',
      label: 'Send once',
      detail: 'Allow this one AI refinement send.',
    },
    {
      id: 'always',
      label: 'Always allow in this workspace',
      detail: 'Remember consent locally for this workspace.',
    },
    {
      id: 'deny',
      label: 'Do not send',
      detail: 'Keep local summary only for now.',
    },
  ];

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Review AI Payload',
    placeHolder: 'Choose whether to send this redacted payload',
    ignoreFocusOut: true,
  });
  if (!picked || picked.id === 'deny') {
    return false;
  }

  recordMetricCounter('aiSendAllowedAfterReviewTotal');

  if (picked.id === 'always') {
    await setAiPayloadConsent(context, prepared.root, true, consentSignature);
  }

  return true;
}

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('tacos');

  return {
    enabled: config.get<boolean>('enabled', true),
    showOnFocus: config.get<boolean>('showOnFocus', true),
    pauseSummaries: config.get<boolean>('pauseSummaries', false),
    showTimeline: config.get<boolean>('showTimeline', true),
    promptCheckpointOnBlur: config.get<boolean>('promptCheckpointOnBlur', false),
    minIdleMinutes: Math.max(1, config.get<number>('minIdleMinutes', 10)),
    longGapMinutes: Math.max(5, config.get<number>('longGapMinutes', 30)),
    cooldownMinutes: Math.max(1, config.get<number>('cooldownMinutes', 5)),
    summaryQuietHours: config.get<string>('summaryQuietHours', ''),
    includeDiff: config.get<boolean>('includeDiff', false),
    maxDiffChars: config.get<number>('maxDiffChars', 6000),
    includeTerminalHistory: config.get<boolean>('includeTerminalHistory', false),
    includeDebugHistory: config.get<boolean>('includeDebugHistory', false),
    cacheIfContextUnchanged: config.get<boolean>('cacheIfContextUnchanged', true),
    redactionPatterns: config.get<string[]>('redactionPatterns', []),
    privacyPreset: config.get<ExtensionConfig['privacyPreset']>('privacyPreset', 'minimal'),
    retentionPolicy: config.get<ExtensionConfig['retentionPolicy']>('retentionPolicy', '7d'),
    metricsEnabled: config.get<boolean>('metricsEnabled', true),
    uiSurface: resolveUiSurfaceConfig(config),
    autoRefreshInBackground: config.get<boolean>('autoRefreshInBackground', true),
    companionNudgesEnabled: config.get<boolean>('companionNudgesEnabled', true),
    companionNudgeAggressiveness: config.get<ExtensionConfig['companionNudgeAggressiveness']>(
      'companionNudgeAggressiveness',
      'balanced',
    ),
    companionNudgeQuietHours: config.get<string>('companionNudgeQuietHours', ''),
    companionNudgeCooldownMinutes: Math.max(
      1,
      config.get<number>('companionNudgeCooldownMinutes', 20),
    ),
    summaryProvider: config.get<SummaryProvider>('summaryProvider', 'local'),
    openaiModel: config.get<string>('openaiModel', 'gpt-4.1-mini'),
    openaiBaseUrl: config.get<string>('openaiBaseUrl', 'https://api.openai.com/v1'),
    openaiTimeoutMs: config.get<number>('openaiTimeoutMs', 15000),
    aiIncludeCheckpointNotes: config.get<boolean>('aiIncludeCheckpointNotes', false),
    aiIncludeScratchpad: config.get<boolean>('aiIncludeScratchpad', false),
    codexOpenCommand: config.get<string>('codexOpenCommand', ''),
  };
}

async function resolveOpenAiApiKey(context: vscode.ExtensionContext): Promise<string> {
  const secret = (await context.secrets.get(SECRET_OPENAI_API_KEY))?.trim() ?? '';
  if (secret) {
    return secret;
  }

  const env = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (env) {
    return env;
  }
  return '';
}

function pickWorkspaceRoot(preferredWorkspaceRoot?: string): string | undefined {
  const workspaceRoots =
    vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  const activeWorkspaceRoot = activeUri
    ? vscode.workspace.getWorkspaceFolder(activeUri)?.uri.fsPath
    : undefined;
  const runtimeWorkspaceHints = state
    ? [state.panelWorkspaceRoot, state.lastTaskWorkspaceRoot, state.lastDebugWorkspaceRoot]
    : [];

  return chooseWorkspaceRoot({
    workspaceRoots,
    preferredWorkspaceRoot,
    activeWorkspaceRoot,
    runtimeWorkspaceHints,
  });
}

function toRelativePath(filePath: string, workspaceRoot: string): string {
  const relative = path.relative(workspaceRoot, filePath);
  if (!relative || relative.startsWith('..')) {
    return filePath;
  }

  return relative;
}

function extractUrls(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s)\]}>"']+/gi);
  return matches ? matches.map((item) => item.trim()) : [];
}

function isMeaningfulChange(changes: readonly vscode.TextDocumentContentChangeEvent[]): boolean {
  return changes.some((change) => {
    const inserted = change.text.replace(/\s+/g, '');
    const removed = change.rangeLength > 0;
    return inserted.length > 0 || removed;
  });
}

function isTestOrBuildCommand(command: string): boolean {
  return /\b(test|jest|vitest|pytest|go test|cargo test|npm\s+run\s+test|pnpm\s+test|yarn\s+test|build|compile|make\s+test|make\s+build)\b/i.test(
    command,
  );
}

function doesCommandMatchStoredFailure(stored: string, rawCommand: string): boolean {
  if (stored === rawCommand) {
    return true;
  }

  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const redactedCommand = redactText(rawCommand, workspaceRoot, config.redactionPatterns);
  const persistedCommand = persistTerminalCommandForStorage(
    rawCommand,
    workspaceRoot,
    config.redactionPatterns,
  );
  return stored === redactedCommand || stored === persistedCommand;
}

async function collectSignals(root: string, config: ExtensionConfig): Promise<ResumeSignals> {
  const isTrusted = vscode.workspace.isTrusted;
  state.workspaceTrusted = isTrusted;

  const git = isTrusted
    ? await collectGit(root, config)
    : {
        isRepo: false,
        branch: '',
        status: '',
        diffStat: '',
        diff: '',
        log: '',
        changedFiles: [],
        hasUncommitted: false,
        hasConflicts: false,
      };
  const customPatterns = config.redactionPatterns;

  const openFiles = vscode.workspace.textDocuments
    .filter((document) => document.uri.scheme === 'file')
    .map((document) => toRelativePath(document.uri.fsPath, root));

  const changedFromStatus = parsePorcelainPaths(git.status).map((file) =>
    toRelativePath(path.isAbsolute(file) ? file : path.join(root, file), root),
  );

  const allChangedFiles = [...git.changedFiles, ...changedFromStatus]
    .map((file) => toRelativePath(path.isAbsolute(file) ? file : path.join(root, file), root))
    .filter(Boolean);

  const recentTerminal =
    isTrusted && config.includeTerminalHistory ? state.recentTerminal.values() : [];
  const recentDebug = config.includeDebugHistory ? state.recentDebug.values() : [];
  const failingCommand =
    isTrusted && config.includeTerminalHistory ? state.lastFailingCommand?.trim() : undefined;
  const lastEditLocation = state.recentEditLocations[0];
  const lastEditPath = lastEditLocation?.path
    ? redactText(lastEditLocation.path, root, customPatterns)
    : undefined;

  return {
    workspaceRoot: root,
    workspaceName: path.basename(root),
    branch: redactText(git.branch, root, customPatterns),
    gitStatus: redactText(git.status, root, customPatterns),
    gitDiffStat: redactText(git.diffStat, root, customPatterns),
    gitDiff: redactText(git.diff, root, customPatterns),
    gitLog: redactText(git.log, root, customPatterns),
    changedFiles: redactList(allChangedFiles, root, customPatterns),
    openFiles: redactList(openFiles, root, customPatterns),
    recentFiles: redactList(state.recentFiles.values(), root, customPatterns),
    recentTerminal: redactList(recentTerminal, root, customPatterns),
    recentDebug: redactList(recentDebug, root, customPatterns),
    recentUrls: redactList(state.recentUrls.values(), root, customPatterns),
    lastEditPath: lastEditPath?.trim() ? lastEditPath : undefined,
    lastEditLine: Number.isInteger(lastEditLocation?.line) ? lastEditLocation?.line : undefined,
    lastEditCharacter: Number.isInteger(lastEditLocation?.character)
      ? lastEditLocation?.character
      : undefined,
    failingCommand,
    doneItems: redactList(state.doneItems.values(), root, customPatterns),
  };
}

function branchStateKey(root: string): string {
  return `tacos.branch.${Buffer.from(root).toString('base64url')}`;
}

function taskPartitionStorageKey(root: string): string {
  return `${KEY_TASK_PARTITION_PREFIX}.${Buffer.from(root).toString('base64url')}`;
}

function resolveTaskPartitionKey(
  context: vscode.ExtensionContext,
  root: string,
  scopeBranch?: string,
): string {
  const manual = context.workspaceState.get<string>(taskPartitionStorageKey(root), '');
  const branch = scopeBranch ?? resolveScopeBranch(context, root);
  return resolveTaskPartitionFromInputs({
    manualTaskPartition: manual,
    scopeBranch: branch,
  });
}

function resolveScopeBranch(context: vscode.ExtensionContext, root: string): string {
  return resolveScopeBranchFromInputs({
    workspaceRoot: root,
    persistedBranch: context.workspaceState.get<string>(branchStateKey(root), ''),
  });
}

function partitionScope(context: vscode.ExtensionContext, root: string): string {
  const branch = resolveScopeBranch(context, root);
  const taskPartition = resolveTaskPartitionKey(context, root, branch);
  return buildPartitionScope(root, branch, taskPartition);
}

function summaryCacheKey(context: vscode.ExtensionContext, root: string): string {
  return `tacos.summary.${Buffer.from(partitionScope(context, root)).toString('base64url')}`;
}

function intentOverrideStorageKey(context: vscode.ExtensionContext, root: string): string {
  return buildIntentOverrideStorageKey(partitionScope(context, root));
}

function readIntentOverrideForContext(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  contextHash: string,
): string | undefined {
  const storageKey = intentOverrideStorageKey(context, workspaceRoot);
  const raw = context.workspaceState.get<unknown>(storageKey);
  const normalized = normalizeIntentOverrideState(raw, contextHash);
  if (normalized) {
    return normalized.intent;
  }
  return undefined;
}

async function persistIntentOverrideForContext(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  contextHash: string,
  rawIntent: unknown,
  inferredIntentCandidate?: unknown,
): Promise<string | undefined> {
  const normalizedIntent = normalizeIntentOverrideText(rawIntent);
  const normalizedInferredIntent = normalizeIntentOverrideText(inferredIntentCandidate);
  const storageKey = intentOverrideStorageKey(context, workspaceRoot);
  if (
    !normalizedIntent ||
    (normalizedInferredIntent && normalizedIntent === normalizedInferredIntent)
  ) {
    await context.workspaceState.update(storageKey, undefined);
    return undefined;
  }

  const payload = createIntentOverrideState(contextHash, normalizedIntent);
  await context.workspaceState.update(storageKey, payload);
  return payload.intent;
}

async function applyIntentOverrideToActiveContext(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  contextHash: string,
  rawIntent: unknown,
): Promise<string | undefined> {
  const contextSummary =
    state.panelSummary?.contextHash === contextHash
      ? state.panelSummary
      : state.scratchSummary?.contextHash === contextHash
        ? state.scratchSummary
        : undefined;
  const inferredIntent = contextSummary?.inferredIntent ?? contextSummary?.intent;
  const persistedIntent = await persistIntentOverrideForContext(
    context,
    workspaceRoot,
    contextHash,
    rawIntent,
    inferredIntent,
  );

  if (state.scratchSummary?.contextHash === contextHash) {
    state.scratchSummary = applyIntentOverrideToSummary(state.scratchSummary, persistedIntent);
  }

  if (state.panelSummary?.contextHash === contextHash) {
    state.panelSummary = applyIntentOverrideToSummary(state.panelSummary, persistedIntent);
  }

  const cacheKey = summaryCacheKey(context, workspaceRoot);
  const cached = context.workspaceState.get<ResumeSummary>(cacheKey);
  if (cached?.contextHash === contextHash) {
    await context.workspaceState.update(
      cacheKey,
      applyIntentOverrideToSummary(cached, persistedIntent),
    );
  }

  return persistedIntent;
}

function resumePathStorageKey(context: vscode.ExtensionContext, root: string): string {
  return buildResumePathStorageKey(partitionScope(context, root));
}

function isPanelSectionId(value: unknown): value is PanelSectionId {
  return PANEL_SECTION_IDS.includes(value as PanelSectionId);
}

function createPanelSectionState(raw: unknown): PanelSectionState {
  if (!raw || typeof raw !== 'object') {
    return { expandedSectionIds: [] };
  }

  const candidate = (raw as { expandedSectionIds?: unknown }).expandedSectionIds;
  if (!Array.isArray(candidate)) {
    return { expandedSectionIds: [] };
  }

  const normalized = Array.from(
    new Set(candidate.filter((value): value is PanelSectionId => isPanelSectionId(value))),
  );
  return { expandedSectionIds: normalized };
}

function panelSectionStateStorageKey(context: vscode.ExtensionContext, root: string): string {
  const scope = partitionScope(context, root);
  return `${KEY_PANEL_SECTION_STATE_PREFIX}.${Buffer.from(scope).toString('base64url')}`;
}

function resolvePanelSectionState(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): PanelSectionState {
  const scope = partitionScope(context, workspaceRoot);
  const cached = state.panelSectionState;
  if (cached && state.panelSectionScope === scope) {
    return cached;
  }

  const raw = context.workspaceState.get<unknown>(
    panelSectionStateStorageKey(context, workspaceRoot),
  );
  const normalized = createPanelSectionState(raw);
  state.panelSectionState = normalized;
  state.panelSectionScope = scope;
  return normalized;
}

async function setPanelSectionExpanded(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  sectionId: PanelSectionId,
  expanded: boolean,
): Promise<void> {
  const current = resolvePanelSectionState(context, workspaceRoot);
  const expandedIds = new Set(current.expandedSectionIds);
  if (expanded) {
    expandedIds.add(sectionId);
  } else {
    expandedIds.delete(sectionId);
  }

  const next: PanelSectionState = { expandedSectionIds: [...expandedIds] };
  const currentSerialized = JSON.stringify(current.expandedSectionIds);
  const nextSerialized = JSON.stringify(next.expandedSectionIds);
  if (currentSerialized === nextSerialized) {
    return;
  }

  const storageKey = panelSectionStateStorageKey(context, workspaceRoot);
  await context.workspaceState.update(
    storageKey,
    next.expandedSectionIds.length > 0 ? next : undefined,
  );
  state.panelSectionState = next;
  state.panelSectionScope = partitionScope(context, workspaceRoot);
}

function resolveResumePathStateForSummary(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  summary: ResumeSummary,
): ResumePathState {
  const scope = partitionScope(context, workspaceRoot);
  const storageKey = resumePathStorageKey(context, workspaceRoot);
  const cached = state.panelResumePathState;
  if (
    cached &&
    state.panelResumePathScope === scope &&
    cached.contextHash === summary.contextHash
  ) {
    return cached;
  }

  const raw = context.workspaceState.get<unknown>(storageKey);
  const normalized = normalizeResumePathState(raw, summary.contextHash);
  state.panelResumePathState = normalized;
  state.panelResumePathScope = scope;
  return normalized;
}

async function setResumePathStepCompletion(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  summary: ResumeSummary,
  stepId: ResumePathStepId,
  completed: boolean,
): Promise<ResumePathState> {
  const current = resolveResumePathStateForSummary(context, workspaceRoot, summary);
  const next = toggleResumePathStep(current, stepId, completed);
  const storageKey = resumePathStorageKey(context, workspaceRoot);
  await context.workspaceState.update(storageKey, next);

  const wasComplete = isResumePathComplete(current);
  const nowComplete = isResumePathComplete(next);
  if (!wasComplete && nowComplete) {
    recordMetricCounter('resumePathCompletions');
  }

  state.panelResumePathState = next;
  state.panelResumePathScope = partitionScope(context, workspaceRoot);
  return next;
}

function autoTriggerFingerprintKey(context: vscode.ExtensionContext, root: string): string {
  const scope = partitionScope(context, root);
  return `${KEY_LAST_AUTO_TRIGGER_FINGERPRINT}.${Buffer.from(scope).toString('base64url')}`;
}

function workspaceActivityKey(root: string): string {
  return `${KEY_WORKSPACE_ACTIVITY_AT_PREFIX}.${Buffer.from(root).toString('base64url')}`;
}

async function touchWorkspaceActivity(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<void> {
  const root = pickWorkspaceRoot(workspaceRoot);
  if (!root) {
    return;
  }

  await context.workspaceState.update(workspaceActivityKey(root), Date.now());
}

function computeResumeGapMinutes(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  now: number = Date.now(),
): number | undefined {
  if (!workspaceRoot) {
    return undefined;
  }

  const lastActivityAt = context.workspaceState.get<number>(workspaceActivityKey(workspaceRoot), 0);
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0 || lastActivityAt >= now) {
    return undefined;
  }

  const gapMinutes = Math.floor((now - lastActivityAt) / 60_000);
  return gapMinutes > 0 ? gapMinutes : undefined;
}

function decodeBase64UrlToken(token: string): string | undefined {
  try {
    return Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return undefined;
  }
}

function matchesEncodedWorkspaceKey(
  key: string,
  prefix: string,
  workspaceRoot: string,
  allowScopedWorkspace: boolean,
): boolean {
  const keyPrefix = `${prefix}.`;
  if (!key.startsWith(keyPrefix)) {
    return false;
  }

  const decoded = decodeBase64UrlToken(key.slice(keyPrefix.length));
  if (!decoded) {
    return false;
  }

  if (decoded === workspaceRoot) {
    return true;
  }

  return allowScopedWorkspace && decoded.startsWith(`${workspaceRoot}::`);
}

function collectWorkspaceScopedKeys(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): string[] {
  const keys = context.workspaceState.keys();
  return keys.filter((key) => {
    if (
      key === KEY_LAST_SUMMARY_AT ||
      key === KEY_LAST_BLUR_AT ||
      key === KEY_LAST_WORKSPACE_ON_BLUR
    ) {
      return true;
    }

    if (key === KEY_SUMMARY_SNOOZE_UNTIL) {
      return true;
    }

    if (key === KEY_SUMMARY_QUIET_UNTIL) {
      return true;
    }

    return (
      matchesEncodedWorkspaceKey(key, 'tacos.summary', workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, 'tacos.branch', workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_AUTO_TRIGGER_FINGERPRINT, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, KEY_RECENT_EDIT_LOCATIONS_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_TASK_META_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_TERMINAL_CWD_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_RESTORE_SEARCH_QUERY_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_RESTORE_PRESET_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_TASK_PARTITION_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_SUMMARY_CORRECTIONS_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_NUDGE_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_NUDGE_FEEDBACK_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, KEY_PERCOLATION_MEMORY_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, KEY_WORKSPACE_ACTIVITY_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_RESUME_PATH_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, KEY_INTENT_OVERRIDE_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, KEY_SETUP_CHECKLIST_COMPLETED_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_AI_PAYLOAD_CONSENT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_SCRATCHPAD_SCOPE_MODE_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_ACTIVITY_STORAGE_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, 'tacos.checkpointNotes', workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, 'tacos.checkpointNote', workspaceRoot, false)
    );
  });
}

function collectWorkspacePartitionSummaryKeys(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): string[] {
  return context.workspaceState
    .keys()
    .filter((key) => matchesEncodedWorkspaceKey(key, 'tacos.summary', workspaceRoot, true));
}

async function clearWorkspaceScopedState(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const keys = collectWorkspaceScopedKeys(context, workspaceRoot);
  if (keys.length === 0) {
    return;
  }

  await Promise.all(keys.map((key) => context.workspaceState.update(key, undefined)));
}

function resetRuntimeWorkspaceState(): void {
  state.recentFiles = new RingBuffer(15);
  state.recentEditLocations = [];
  state.recentTerminal = new RingBuffer(15);
  state.recentDebug = new RingBuffer(10);
  state.recentUrls = new RingBuffer(5);
  state.doneItems = new RingBuffer(10);
  state.lastFailingCommand = undefined;
  state.lastFailingCommandRaw = undefined;
  state.lastTaskName = undefined;
  state.lastTaskWorkspaceRoot = undefined;
  state.lastTaskExitCode = undefined;
  state.lastTaskEndedAt = undefined;
  state.lastTerminalCwd = undefined;
  state.lastDebugConfigName = undefined;
  state.lastDebugWorkspaceRoot = undefined;
  state.lastFocusGainedAt = 0;
  state.lastBoundarySignalAt = 0;
  state.lastMeaningfulActivityAt = 0;
  state.snoozeUntil = 0;
  state.summaryQuietUntil = 0;
  state.panelCheckpointNotes = [];
  state.panelPrimaryCheckpointNote = undefined;
  state.panelCheckpointScope = undefined;
  state.panelScratchpadPreviewLines = [];
  state.panelScratchpadExists = false;
  state.panelScratchpadHasContent = false;
  state.panelScratchpadScopeLabel = undefined;
  state.panelResumePathState = undefined;
  state.panelResumePathScope = undefined;
  state.activeNudges = undefined;
  state.scratchSummary = undefined;
  state.detailsMarkdownCache = undefined;
  if (state.panel) {
    state.panel.dispose();
  }
}

function isCheckpointScopeForWorkspace(scope: string, workspaceRoot: string): boolean {
  return (
    scope === workspaceGlobalCheckpointScope(workspaceRoot) ||
    scope.startsWith(`${workspaceRoot}::`)
  );
}

async function pruneCheckpointNotesForWorkspace(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  cutoffAt: number,
): Promise<void> {
  const checkpointKeys = context.workspaceState
    .keys()
    .filter((key) => key.startsWith('tacos.checkpointNotes.'));
  if (checkpointKeys.length === 0) {
    return;
  }

  const pruneOps: Thenable<void>[] = [];
  for (const key of checkpointKeys) {
    const scope = decodeCheckpointScopeFromStorageKey(key);
    if (!scope || !isCheckpointScopeForWorkspace(scope, workspaceRoot)) {
      continue;
    }

    const notes = parseCheckpointNotes(context.workspaceState.get<unknown>(key, []));
    const pruned = pruneCheckpointNotesForCutoff(notes, cutoffAt);
    if (pruned.length === notes.length) {
      continue;
    }

    pruneOps.push(context.workspaceState.update(key, pruned.length > 0 ? pruned : undefined));
  }

  if (pruneOps.length > 0) {
    await Promise.all(pruneOps);
  }
}

async function prunePercolationMemoryForWorkspace(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  cutoffAt: number,
): Promise<void> {
  const memoryKeys = context.workspaceState
    .keys()
    .filter((key) => key.startsWith(`${KEY_PERCOLATION_MEMORY_PREFIX}.`));
  if (memoryKeys.length === 0) {
    return;
  }

  const pruneOps: Thenable<void>[] = [];
  for (const key of memoryKeys) {
    if (!matchesEncodedWorkspaceKey(key, KEY_PERCOLATION_MEMORY_PREFIX, workspaceRoot, true)) {
      continue;
    }

    const store = parsePercolationMemoryStore(context.workspaceState.get<unknown>(key));
    const pruned = trimPercolationMemoryStore(
      Object.fromEntries(
        Object.entries(store).filter(
          ([, record]) => record.at >= cutoffAt || record.until >= cutoffAt,
        ),
      ),
      MAX_PERCOLATION_MEMORY_ENTRIES_PER_SCOPE,
    );
    if (Object.keys(pruned).length === Object.keys(store).length) {
      continue;
    }

    pruneOps.push(
      context.workspaceState.update(key, Object.keys(pruned).length > 0 ? pruned : undefined),
    );
  }

  if (pruneOps.length > 0) {
    await Promise.all(pruneOps);
  }
}

async function applyRetentionPolicy(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  if (!workspaceRoot) {
    return;
  }

  const cutoffWindowMs = retentionPolicyToMs(getConfig().retentionPolicy);
  if (!cutoffWindowMs) {
    return;
  }

  const cutoffAt = Date.now() - cutoffWindowMs;
  const lastActivityAt = context.workspaceState.get<number>(workspaceActivityKey(workspaceRoot), 0);
  const metricHistory = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  if (lastActivityAt > 0 && lastActivityAt < cutoffAt) {
    await clearWorkspaceScopedState(context, workspaceRoot);
    const prunedMetrics = pruneMetricsForWorkspace(metricHistory, workspaceRoot, cutoffAt);
    if (prunedMetrics.length !== metricHistory.length) {
      await context.workspaceState.update(KEY_METRIC_HISTORY, prunedMetrics);
    }
    resetRuntimeWorkspaceState();
    return;
  }

  const recentEditLocations = readRecentEditLocations(context, workspaceRoot);
  const prunedEditLocations = recentEditLocations.filter((entry) => entry.timestamp >= cutoffAt);
  if (prunedEditLocations.length !== recentEditLocations.length) {
    await context.workspaceState.update(
      recentEditLocationsStorageKey(workspaceRoot),
      prunedEditLocations,
    );
    if (pickWorkspaceRoot(state.panelWorkspaceRoot) === workspaceRoot) {
      state.recentEditLocations = prunedEditLocations;
    }
  }

  const taskMetadata = readPersistedTaskMetadata(context, workspaceRoot);
  if (taskMetadata && taskMetadata.timestamp < cutoffAt) {
    await context.workspaceState.update(taskMetadataStorageKey(workspaceRoot), undefined);
    if ((state.lastTaskWorkspaceRoot ?? workspaceRoot) === workspaceRoot) {
      state.lastTaskName = undefined;
      state.lastTaskWorkspaceRoot = undefined;
      state.lastTaskExitCode = undefined;
      state.lastTaskEndedAt = undefined;
    }
  }

  const activeSummaryKey = summaryCacheKey(context, workspaceRoot);
  const summaryKeys = collectWorkspacePartitionSummaryKeys(context, workspaceRoot);
  const summaryPruneOps: Thenable<void>[] = [];
  let clearedActiveSummary = false;
  for (const key of summaryKeys) {
    const cachedSummary = context.workspaceState.get<ResumeSummary | undefined>(key);
    if (!cachedSummary || cachedSummary.generatedAt >= cutoffAt) {
      continue;
    }

    summaryPruneOps.push(context.workspaceState.update(key, undefined));
    if (key === activeSummaryKey) {
      clearedActiveSummary = true;
    }
  }
  if (summaryPruneOps.length > 0) {
    await Promise.all(summaryPruneOps);
  }
  if (clearedActiveSummary && pickWorkspaceRoot(state.panelWorkspaceRoot) === workspaceRoot) {
    state.scratchSummary = undefined;
  }

  await pruneCheckpointNotesForWorkspace(context, workspaceRoot, cutoffAt);
  await prunePercolationMemoryForWorkspace(context, workspaceRoot, cutoffAt);

  const prunedMetrics = pruneMetricsForWorkspace(metricHistory, workspaceRoot, cutoffAt);
  if (prunedMetrics.length !== metricHistory.length) {
    await context.workspaceState.update(KEY_METRIC_HISTORY, prunedMetrics);
  }
}

function computeAutoTriggerFingerprint(root: string): string {
  const config = getConfig();
  const activeFileRaw = vscode.window.activeTextEditor?.document?.uri.fsPath
    ? toRelativePath(vscode.window.activeTextEditor.document.uri.fsPath, root)
    : '';
  const activeFile = redactText(activeFileRaw, root, config.redactionPatterns);
  const redacted = sanitizeActivityForPersistence(
    {
      recentFiles: state.recentFiles.values(),
      recentTerminal: state.recentTerminal.values(),
      recentDebug: state.recentDebug.values(),
      recentUrls: [],
      doneItems: state.doneItems.values(),
      lastFailingCommand: state.lastFailingCommand,
    },
    root,
    config.redactionPatterns,
  );

  return createHash('sha256')
    .update(
      [
        activeFile,
        redacted.recentFiles[0] ?? '',
        redacted.recentTerminal[0] ?? '',
        redacted.recentDebug[0] ?? '',
        redacted.lastFailingCommand ?? '',
        redacted.doneItems[0] ?? '',
      ].join('|'),
    )
    .digest('hex');
}

interface CheckpointScopeState {
  scope: string;
  branch: string;
  partition: string;
}

interface ResolvedCheckpointContext {
  scope: string;
  branch: string;
  partition: string;
  notes: CheckpointNote[];
  primaryNote?: CheckpointNote;
}

interface CheckpointPromptOptions {
  title?: string;
  prompt?: string;
  placeHolder?: string;
  initialValue?: string;
  successMessage?: string;
  scope?: CheckpointNoteScope;
  file?: string;
  line?: number;
}

interface ClipboardCheckpointOptions {
  successMessage?: string;
  noPrompt?: boolean;
  scope?: CheckpointNoteScope;
  file?: string;
  line?: number;
}

function workspaceGlobalCheckpointScope(workspaceRoot: string): string {
  return `${workspaceRoot}::${CHECKPOINT_WORKSPACE_GLOBAL_SCOPE}`;
}

function resolveCheckpointScopeState(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
): CheckpointScopeState {
  const branch = branchHint?.trim() || resolveScopeBranch(context, workspaceRoot);
  const partition = resolveTaskPartitionKey(context, workspaceRoot, branch);
  return {
    scope: buildPartitionScope(workspaceRoot, branch, partition),
    branch,
    partition,
  };
}

function readCheckpointNotesForScope(
  context: vscode.ExtensionContext,
  scope: string,
): CheckpointNote[] {
  return parseCheckpointNotes(
    context.workspaceState.get<unknown>(checkpointNotesStorageKey(scope), []),
  );
}

async function writeCheckpointNotesForScope(
  context: vscode.ExtensionContext,
  scope: string,
  notes: CheckpointNote[],
): Promise<void> {
  const normalized = sortCheckpointNotes(parseCheckpointNotes(notes)).slice(
    0,
    MAX_CHECKPOINT_NOTES_PER_SCOPE,
  );
  await context.workspaceState.update(
    checkpointNotesStorageKey(scope),
    normalized.length > 0 ? normalized : undefined,
  );
}

async function migrateLegacyCheckpointNoteIfNeeded(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  const legacy = context.workspaceState.get<string | undefined>(
    checkpointStorageKey(workspaceRoot),
  );
  if (typeof legacy !== 'string' || !legacy.trim()) {
    return;
  }

  const migrated = createLegacyMigrationNote(legacy, workspaceRoot, getConfig().redactionPatterns);
  if (migrated) {
    const globalScope = workspaceGlobalCheckpointScope(workspaceRoot);
    const existing = readCheckpointNotesForScope(context, globalScope);
    const hasExistingEquivalent = existing.some(
      (note) => note.text === migrated.text && note.status !== 'dismissed',
    );
    if (!hasExistingEquivalent) {
      existing.unshift(migrated);
      await writeCheckpointNotesForScope(context, globalScope, existing);
    }
  }

  await context.workspaceState.update(checkpointStorageKey(workspaceRoot), undefined);
}

function selectPrimaryCheckpointNote(notes: CheckpointNote[]): CheckpointNote | undefined {
  const open = notes.filter((note) => note.status === 'open');
  if (open.length === 0) {
    return undefined;
  }

  return sortCheckpointNotes(open)[0];
}

async function resolveCheckpointContext(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
  includeWorkspaceGlobal = true,
): Promise<ResolvedCheckpointContext> {
  await migrateLegacyCheckpointNoteIfNeeded(context, workspaceRoot);
  const scoped = resolveCheckpointScopeState(context, workspaceRoot, branchHint);
  const scopedNotes = readCheckpointNotesForScope(context, scoped.scope).map((note) => ({
    ...note,
    scope: 'partition' as const,
    branch: note.branch ?? scoped.branch,
    partition: note.partition ?? scoped.partition,
  }));
  const workspaceNotes = includeWorkspaceGlobal
    ? readCheckpointNotesForScope(context, workspaceGlobalCheckpointScope(workspaceRoot)).map(
        (note) => ({
          ...note,
          scope: 'workspace' as const,
        }),
      )
    : [];
  const notes = sortCheckpointNotes([...scopedNotes, ...workspaceNotes]);
  return {
    scope: scoped.scope,
    branch: scoped.branch,
    partition: scoped.partition,
    notes,
    primaryNote: selectPrimaryCheckpointNote(notes),
  };
}

function applyCheckpointNoteToSummary(
  summary: ResumeSummary,
  note?: CheckpointNote,
  previousOpenNoteText?: string,
): ResumeSummary {
  const openText = note?.status === 'open' ? note.text.trim() : '';
  const previousText = previousOpenNoteText?.trim() ?? '';
  let nextSummary = summary;

  if (previousText && previousText !== openText) {
    const escapedPrevious = previousText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const previousLinePattern = new RegExp(
      `(^|\\n)- Recommended first action: ${escapedPrevious}(?=\\n|$)`,
      'u',
    );
    const detailsMarkdown = nextSummary.detailsMarkdown
      .replace(previousLinePattern, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    const codexPrompt = nextSummary.codexPrompt
      .replace(previousLinePattern, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
    const recommendedFirstAction =
      nextSummary.recommendedFirstAction?.trim() === previousText
        ? nextSummary.nextSteps[0]
        : nextSummary.recommendedFirstAction;
    nextSummary = {
      ...nextSummary,
      recommendedFirstAction,
      detailsMarkdown,
      codexPrompt,
    };
  }

  if (!openText) {
    return nextSummary;
  }

  const replacement = `- Recommended first action: ${openText}`;
  const detailsMarkdown = nextSummary.detailsMarkdown.includes('- Recommended first action:')
    ? nextSummary.detailsMarkdown.replace(/- Recommended first action: .*/u, replacement)
    : `${nextSummary.detailsMarkdown}\n${replacement}`;
  const codexPrompt = nextSummary.codexPrompt.includes('- Recommended first action:')
    ? nextSummary.codexPrompt.replace(/- Recommended first action: .*/u, replacement)
    : `${nextSummary.codexPrompt}\n${replacement}`;

  return {
    ...nextSummary,
    recommendedFirstAction: openText,
    detailsMarkdown,
    codexPrompt,
  };
}

async function appendCheckpointNote(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  text: string,
  options: {
    scope?: CheckpointNoteScope;
    file?: string;
    line?: number;
    pinned?: boolean;
    status?: CheckpointNote['status'];
  } = {},
): Promise<CheckpointNote | undefined> {
  if (!workspaceRoot || !text.trim()) {
    return undefined;
  }

  await migrateLegacyCheckpointNoteIfNeeded(context, workspaceRoot);
  const scope = options.scope ?? 'partition';
  const scopeState = resolveCheckpointScopeState(context, workspaceRoot);
  const targetScope =
    scope === 'workspace' ? workspaceGlobalCheckpointScope(workspaceRoot) : scopeState.scope;
  const existing = readCheckpointNotesForScope(context, targetScope);
  const note = createCheckpointNote(text, {
    branch: scope === 'partition' ? scopeState.branch : undefined,
    partition: scope === 'partition' ? scopeState.partition : undefined,
    file: options.file,
    line: options.line,
    pinned: options.pinned,
    status: options.status,
    scope,
  });
  existing.unshift(note);
  await writeCheckpointNotesForScope(context, targetScope, existing);
  state.meaningfulActivitySinceCheckpointPrompt = false;
  recordMetricCounter('noteCreated');
  return note;
}

async function updateCheckpointNoteById(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  noteId: string,
  updater: (note: CheckpointNote) => CheckpointNote | undefined,
): Promise<boolean> {
  if (!workspaceRoot || !noteId.trim()) {
    return false;
  }

  await migrateLegacyCheckpointNoteIfNeeded(context, workspaceRoot);
  const scopeState = resolveCheckpointScopeState(context, workspaceRoot);
  const candidateScopes = Array.from(
    new Set(
      [
        state.panelCheckpointScope,
        scopeState.scope,
        workspaceGlobalCheckpointScope(workspaceRoot),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  for (const scope of candidateScopes) {
    const notes = readCheckpointNotesForScope(context, scope);
    const index = notes.findIndex((note) => note.id === noteId);
    if (index < 0) {
      continue;
    }

    const updated = updater(notes[index]);
    if (!updated) {
      notes.splice(index, 1);
    } else {
      notes[index] = {
        ...updated,
        updatedAt: Date.now(),
      };
    }
    await writeCheckpointNotesForScope(context, scope, notes);
    return true;
  }

  return false;
}

async function clearCheckpointNotesInScope(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<number> {
  await migrateLegacyCheckpointNoteIfNeeded(context, workspaceRoot);
  const scopeState = resolveCheckpointScopeState(context, workspaceRoot);
  const existing = readCheckpointNotesForScope(context, scopeState.scope);
  await context.workspaceState.update(checkpointNotesStorageKey(scopeState.scope), undefined);
  return existing.length;
}

async function refreshPanelCheckpointState(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<void> {
  const root = pickWorkspaceRoot(workspaceRoot ?? state.panelWorkspaceRoot);
  if (!root) {
    state.panelCheckpointNotes = [];
    state.panelPrimaryCheckpointNote = undefined;
    state.panelCheckpointScope = undefined;
    state.panelScratchpadPreviewLines = [];
    state.panelScratchpadExists = false;
    state.panelScratchpadHasContent = false;
    state.panelScratchpadScopeLabel = undefined;
    return;
  }

  const resolved = await resolveCheckpointContext(
    context,
    root,
    state.panelSummary?.currentBranch,
    true,
  );
  const previousOpenNoteText =
    state.panelPrimaryCheckpointNote?.status === 'open'
      ? state.panelPrimaryCheckpointNote.text
      : undefined;
  state.panelCheckpointNotes = resolved.notes;
  state.panelPrimaryCheckpointNote = resolved.primaryNote;
  state.panelCheckpointScope = resolved.scope;

  if (state.panelSummary) {
    const nextSummary = applyCheckpointNoteToSummary(
      state.panelSummary,
      resolved.primaryNote,
      previousOpenNoteText,
    );
    state.panelSummary = nextSummary;
    state.scratchSummary = nextSummary;
    updateCompanionStatusBar();
  }
}

async function promptAndSaveCheckpointNote(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options: CheckpointPromptOptions = {},
): Promise<boolean> {
  const note = await vscode.window.showInputBox({
    title: options.title ?? 'TaCoS: Add Checkpoint Note',
    prompt: options.prompt ?? 'One-line next step for future you',
    placeHolder: options.placeHolder ?? 'Example: Fix failing parser test and rerun npm test',
    value: options.initialValue ?? '',
    ignoreFocusOut: true,
  });
  if (!note) {
    return false;
  }

  const sanitizedResult = sanitizeCheckpointNoteWithReport(
    note,
    workspaceRoot,
    getConfig().redactionPatterns,
  );
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const sanitized = sanitizedResult.text;
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: note was empty after sanitization and was not saved.',
    );
    return false;
  }

  const saved = await appendCheckpointNote(context, workspaceRoot, sanitized, {
    scope: options.scope,
    file: options.file,
    line: options.line,
  });
  if (!saved) {
    return false;
  }

  const redactionDetail =
    sanitizedResult.report.totalReplacements > 0
      ? ` Removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`
      : '';
  void vscode.window.showInformationMessage(
    `${options.successMessage ?? 'TaCoS: checkpoint note saved for this task scope.'}${redactionDetail}`,
  );
  return true;
}

async function saveCheckpointNoteFromClipboard(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options: ClipboardCheckpointOptions = {},
): Promise<boolean> {
  const clipboardValue = (await vscode.env.clipboard.readText()).trim();
  if (!clipboardValue) {
    if (!options.noPrompt) {
      void vscode.window.showWarningMessage(
        'TaCoS: clipboard is empty; no checkpoint note was saved.',
      );
    }
    return false;
  }

  const sanitizedResult = sanitizeCheckpointNoteWithReport(
    clipboardValue,
    workspaceRoot,
    getConfig().redactionPatterns,
  );
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const sanitized = sanitizedResult.text;
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: clipboard note was empty after sanitization and was not saved.',
    );
    return false;
  }

  const saved = await appendCheckpointNote(context, workspaceRoot, sanitized, {
    scope: options.scope,
    file: options.file,
    line: options.line,
  });
  if (!saved) {
    return false;
  }

  const redactionDetail =
    sanitizedResult.report.totalReplacements > 0
      ? ` Removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`
      : '';
  void vscode.window.showInformationMessage(
    `${options.successMessage ?? 'TaCoS: checkpoint note saved for this task scope.'}${redactionDetail}`,
  );
  return true;
}

async function addCheckpointFromSelectionCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    void vscode.window.showInformationMessage('TaCoS: Open a file and select text first.');
    return;
  }

  const selected = editor.document.getText(editor.selection).trim();
  if (!selected) {
    void vscode.window.showInformationMessage('TaCoS: Select text first.');
    return;
  }

  const relativeFile = toRelativePath(editor.document.uri.fsPath, workspaceRoot);
  const line = editor.selection.start.line + 1;
  const sanitizedResult = sanitizeCheckpointNoteWithReport(
    selected,
    workspaceRoot,
    getConfig().redactionPatterns,
  );
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const sanitized = sanitizedResult.text;
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: selection was empty after sanitization and was not saved.',
    );
    return;
  }

  const saved = await appendCheckpointNote(context, workspaceRoot, sanitized, {
    file: relativeFile,
    line,
  });
  if (!saved) {
    return;
  }

  await refreshPanelCheckpointState(context, workspaceRoot);
  rerenderPanel();
  const redactionDetail =
    sanitizedResult.report.totalReplacements > 0
      ? ` Removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`
      : '';
  void vscode.window.showInformationMessage(
    `TaCoS: checkpoint note saved from selection.${redactionDetail}`,
  );
}

async function listCheckpointNotesCommand(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const resolved = await resolveCheckpointContext(
    context,
    workspaceRoot,
    resolveScopeBranch(context, workspaceRoot),
    true,
  );

  type NotePick = vscode.QuickPickItem & {
    id: 'note' | 'add-partition' | 'add-workspace' | 'clear-partition' | 'noop';
    noteId?: string;
  };

  const notePicks: NotePick[] = resolved.notes.map((note) => ({
    id: 'note',
    noteId: note.id,
    label: `${note.status === 'done' ? '[✓]' : note.status === 'dismissed' ? '[-]' : '[ ]'} ${note.pinned ? '[PIN] ' : ''}${note.text}`,
    description: `${note.scope === 'workspace' ? 'workspace-global' : `${note.branch ?? resolved.branch} / ${note.partition ?? resolved.partition}`}`,
    detail:
      note.file && typeof note.line === 'number'
        ? `${note.file}:${note.line}`
        : note.file
          ? note.file
          : undefined,
  }));

  const picks: NotePick[] = [
    ...notePicks,
    {
      id: 'add-partition',
      label: 'Add note (current task scope)',
      detail: `${resolved.branch} / ${resolved.partition}`,
    },
    {
      id: 'add-workspace',
      label: 'Add note (workspace-global)',
      detail: 'Shared across branch/partition in this workspace.',
    },
    {
      id: 'clear-partition',
      label: 'Clear notes in current task scope',
      detail: 'Removes all notes in this partition scope.',
    },
  ];

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: List Checkpoint Notes',
    placeHolder: resolved.notes.length
      ? 'Pick a note to manage, or add a new one'
      : 'No notes yet. Add one now.',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  if (picked.id === 'add-partition' || picked.id === 'add-workspace') {
    const saved = await promptAndSaveCheckpointNote(context, workspaceRoot, {
      scope: picked.id === 'add-workspace' ? 'workspace' : 'partition',
      successMessage:
        picked.id === 'add-workspace'
          ? 'TaCoS: workspace-global checkpoint note saved.'
          : 'TaCoS: checkpoint note saved for this task scope.',
    });
    if (saved) {
      await refreshPanelCheckpointState(context, workspaceRoot);
      rerenderPanel();
    }
    return;
  }

  if (picked.id === 'clear-partition') {
    const cleared = await clearCheckpointNotesInScope(context, workspaceRoot);
    await refreshPanelCheckpointState(context, workspaceRoot);
    rerenderPanel();
    void vscode.window.showInformationMessage(
      cleared > 0
        ? `TaCoS: cleared ${cleared} note${cleared === 1 ? '' : 's'} in this task scope.`
        : 'TaCoS: no notes found in this task scope.',
    );
    return;
  }

  if (picked.id !== 'note' || !picked.noteId) {
    return;
  }

  const target = resolved.notes.find((note) => note.id === picked.noteId);
  if (!target) {
    return;
  }

  type NoteActionPick = vscode.QuickPickItem & {
    id: 'done' | 'reopen' | 'edit' | 'delete' | 'pin' | 'dismiss';
  };
  const actionPicks: NoteActionPick[] = [
    {
      id: target.status === 'open' ? 'done' : 'reopen',
      label: target.status === 'open' ? 'Mark done' : 'Mark open',
    },
    { id: 'pin', label: target.pinned ? 'Unpin' : 'Pin' },
    { id: 'edit', label: 'Edit' },
    { id: 'dismiss', label: 'Dismiss' },
    { id: 'delete', label: 'Delete' },
  ];
  const action = await vscode.window.showQuickPick(actionPicks, {
    title: 'TaCoS: Note Actions',
    placeHolder: target.text,
    ignoreFocusOut: true,
  });
  if (!action) {
    return;
  }

  if (action.id === 'edit') {
    const edited = await vscode.window.showInputBox({
      title: 'TaCoS: Edit Checkpoint Note',
      value: target.text,
      prompt: 'One-line next step for future you',
      ignoreFocusOut: true,
    });
    if (!edited) {
      return;
    }

    const sanitizedResult = sanitizeCheckpointNoteWithReport(
      edited,
      workspaceRoot,
      getConfig().redactionPatterns,
    );
    recordRedactionMetrics(
      sanitizedResult.report.totalReplacements,
      sanitizedResult.report.highRiskDetected,
    );
    const sanitized = sanitizedResult.text;
    if (!sanitized) {
      void vscode.window.showWarningMessage(
        'TaCoS: note was empty after sanitization and was not saved.',
      );
      return;
    }

    await updateCheckpointNoteById(context, workspaceRoot, target.id, (current) => ({
      ...current,
      text: sanitized,
    }));
    if (sanitizedResult.report.totalReplacements > 0) {
      void vscode.window.showInformationMessage(
        `TaCoS: removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`,
      );
    }
  } else if (action.id === 'done') {
    await updateCheckpointNoteById(context, workspaceRoot, target.id, (current) => ({
      ...current,
      status: 'done',
      pinned: undefined,
    }));
    recordMetricCounter('noteMarkedDone');
  } else if (action.id === 'reopen') {
    await updateCheckpointNoteById(context, workspaceRoot, target.id, (current) => ({
      ...current,
      status: 'open',
    }));
  } else if (action.id === 'pin') {
    await updateCheckpointNoteById(context, workspaceRoot, target.id, (current) => ({
      ...current,
      pinned: current.pinned ? undefined : true,
    }));
    if (!target.pinned) {
      recordMetricCounter('notePinned');
    }
  } else if (action.id === 'dismiss') {
    await updateCheckpointNoteById(context, workspaceRoot, target.id, (current) => ({
      ...current,
      status: 'dismissed',
      pinned: undefined,
    }));
  } else if (action.id === 'delete') {
    await updateCheckpointNoteById(context, workspaceRoot, target.id, () => undefined);
  }

  await refreshPanelCheckpointState(context, workspaceRoot);
  rerenderPanel();
}

interface ScratchpadScopeState {
  mode: ScratchpadScopeMode;
  scope: string;
  branch: string;
  partition: string;
}

function scratchpadScopeModeStorageKey(workspaceRoot: string): string {
  return `${KEY_SCRATCHPAD_SCOPE_MODE_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function getScratchpadScopeMode(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): ScratchpadScopeMode {
  const raw = context.workspaceState
    .get<string>(scratchpadScopeModeStorageKey(workspaceRoot), '')
    .trim();
  return raw === 'workspace' ? 'workspace' : 'partition';
}

async function setScratchpadScopeMode(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  mode: ScratchpadScopeMode,
): Promise<void> {
  await context.workspaceState.update(
    scratchpadScopeModeStorageKey(workspaceRoot),
    mode === 'workspace' ? 'workspace' : undefined,
  );
}

function resolveScratchpadScopeState(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
): ScratchpadScopeState {
  const mode = getScratchpadScopeMode(context, workspaceRoot);
  const branch = branchHint?.trim() || resolveScopeBranch(context, workspaceRoot);
  const partition = resolveTaskPartitionKey(context, workspaceRoot, branch);
  if (mode === 'workspace') {
    return {
      mode,
      scope: workspaceGlobalCheckpointScope(workspaceRoot),
      branch,
      partition,
    };
  }

  return {
    mode,
    scope: buildPartitionScope(workspaceRoot, branch, partition),
    branch,
    partition,
  };
}

function scratchpadScopeLabel(scopeState: ScratchpadScopeState): string {
  if (scopeState.mode === 'workspace') {
    return 'Scope: workspace-global';
  }

  return `Scope: ${scopeState.branch} / ${scopeState.partition}`;
}

function resolveScratchpadStorageRootUri(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): vscode.Uri {
  const segments = workspaceScratchpadRootSegments(workspaceRoot);
  if (context.storageUri) {
    return vscode.Uri.joinPath(context.storageUri, ...segments);
  }

  return vscode.Uri.joinPath(context.globalStorageUri, ...segments);
}

function resolveLegacyScratchpadFileUri(
  context: vscode.ExtensionContext,
  scope: string,
): vscode.Uri | undefined {
  if (!context.storageUri) {
    return undefined;
  }

  // Pre-v0.4.0 layout stored scoped files directly under storageUri/scratchpads.
  return vscode.Uri.joinPath(
    context.storageUri,
    SCRATCHPAD_FILES_SEGMENT,
    scratchpadFileNameForScope(scope),
  );
}

function resolveScratchpadFileUri(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
): { uri: vscode.Uri; scopeState: ScratchpadScopeState } {
  const scopeState = resolveScratchpadScopeState(context, workspaceRoot, branchHint);
  const rootUri = resolveScratchpadStorageRootUri(context, workspaceRoot);
  const uri = vscode.Uri.joinPath(
    rootUri,
    SCRATCHPAD_FILES_SEGMENT,
    scratchpadFileNameForScope(scopeState.scope),
  );
  return { uri, scopeState };
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function ensureScratchpadDocument(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
): Promise<{ document: vscode.TextDocument; uri: vscode.Uri; scopeState: ScratchpadScopeState }> {
  const { uri, scopeState } = resolveScratchpadFileUri(context, workspaceRoot, branchHint);
  await migrateLegacyScratchpadFileIfNeeded(context, workspaceRoot, scopeState.scope, uri);
  const scratchpadsDir = vscode.Uri.joinPath(
    resolveScratchpadStorageRootUri(context, workspaceRoot),
    SCRATCHPAD_FILES_SEGMENT,
  );
  await vscode.workspace.fs.createDirectory(scratchpadsDir);
  if (!(await fileExists(uri))) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from('', 'utf8'));
  }

  const document = await vscode.workspace.openTextDocument(uri);
  return { document, uri, scopeState };
}

async function migrateLegacyScratchpadFileIfNeeded(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  scope: string,
  targetUri: vscode.Uri,
): Promise<void> {
  const legacyUri = resolveLegacyScratchpadFileUri(context, scope);
  if (!legacyUri) {
    return;
  }

  if (await fileExists(targetUri)) {
    return;
  }
  if (!(await fileExists(legacyUri))) {
    return;
  }

  const scratchpadsDir = vscode.Uri.joinPath(
    resolveScratchpadStorageRootUri(context, workspaceRoot),
    SCRATCHPAD_FILES_SEGMENT,
  );
  await vscode.workspace.fs.createDirectory(scratchpadsDir);

  try {
    const bytes = await vscode.workspace.fs.readFile(legacyUri);
    await vscode.workspace.fs.writeFile(targetUri, bytes);
    await vscode.workspace.fs.delete(legacyUri, { recursive: false, useTrash: false });
  } catch {
    // Keep legacy file intact on migration errors.
  }
}

function extractScratchpadPreviewLines(
  rawContent: string,
  maxLines = SCRATCHPAD_PREVIEW_MAX_LINES,
): string[] {
  if (!rawContent.trim()) {
    return [];
  }

  return rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^---\s/.test(line))
    .slice(0, maxLines);
}

function buildAiScratchpadExcerpt(rawContent: string): string | undefined {
  if (!rawContent.trim()) {
    return undefined;
  }

  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^---\s/.test(line))
    .slice(0, AI_SCRATCHPAD_MAX_LINES);
  if (lines.length === 0) {
    return undefined;
  }

  const joined = lines.join('\n');
  if (joined.length <= AI_SCRATCHPAD_MAX_CHARS) {
    return joined;
  }

  return `${joined.slice(0, AI_SCRATCHPAD_MAX_CHARS)}\n...truncated...`;
}

function applyScratchpadExcerptToSummary(summary: ResumeSummary, excerpt: string): ResumeSummary {
  const section = ['## Scratchpad excerpt (opt-in)', '```text', excerpt, '```'].join('\n');

  return {
    ...summary,
    detailsMarkdown: `${summary.detailsMarkdown}\n\n${section}`,
  };
}

async function loadScratchpadExcerptForAi(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  branchHint?: string,
): Promise<string | undefined> {
  if (!workspaceRoot) {
    return undefined;
  }

  const { uri, scopeState } = resolveScratchpadFileUri(context, workspaceRoot, branchHint);
  await migrateLegacyScratchpadFileIfNeeded(context, workspaceRoot, scopeState.scope, uri);
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.size <= 0) {
      return undefined;
    }
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString('utf8');
    return buildAiScratchpadExcerpt(content);
  } catch {
    return undefined;
  }
}

async function refreshPanelScratchpadState(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<void> {
  const root = pickWorkspaceRoot(workspaceRoot ?? state.panelWorkspaceRoot);
  if (!root) {
    state.panelScratchpadPreviewLines = [];
    state.panelScratchpadExists = false;
    state.panelScratchpadHasContent = false;
    state.panelScratchpadScopeLabel = undefined;
    return;
  }

  const { uri, scopeState } = resolveScratchpadFileUri(
    context,
    root,
    state.panelSummary?.currentBranch,
  );
  await migrateLegacyScratchpadFileIfNeeded(context, root, scopeState.scope, uri);
  let exists = false;
  let sizeBytes = 0;
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    exists = true;
    sizeBytes = stat.size;
  } catch {
    exists = false;
  }

  let content = '';
  if (exists && sizeBytes <= SCRATCHPAD_PREVIEW_MAX_BYTES) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      content = Buffer.from(bytes).toString('utf8');
    } catch {
      content = '';
    }
  }

  state.panelScratchpadExists = exists;
  state.panelScratchpadHasContent = exists ? sizeBytes > 0 : content.trim().length > 0;
  state.panelScratchpadPreviewLines =
    exists && sizeBytes > SCRATCHPAD_PREVIEW_MAX_BYTES
      ? [
          `Preview unavailable for large scratchpad (${Math.ceil(sizeBytes / 1024)} KB). Open Scratchpad to view.`,
        ]
      : extractScratchpadPreviewLines(content);
  state.panelScratchpadScopeLabel = scratchpadScopeLabel(scopeState);
}

async function openScratchpadCommand(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const { document } = await ensureScratchpadDocument(
    context,
    workspaceRoot,
    state.panelSummary?.currentBranch,
  );
  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: vscode.ViewColumn.Beside,
  });
  recordMetricCounter('scratchpadOpened');
}

function buildScratchpadAppendChunk(rawText: string): string {
  const text = rawText.trim();
  const timestamp = new Date().toLocaleString();
  return `--- ${timestamp} ---\n${text}\n`;
}

async function appendToScratchpadCommand(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const selected =
    vscode.window.activeTextEditor?.document
      .getText(vscode.window.activeTextEditor.selection)
      .trim() ?? '';
  const fallbackClipboard = selected ? '' : (await vscode.env.clipboard.readText()).trim();
  const sourceText = selected || fallbackClipboard;
  if (!sourceText) {
    void vscode.window.showWarningMessage(
      'TaCoS: no selected text or clipboard text found to append to scratchpad.',
    );
    return;
  }
  const sanitizedResult = redactTextWithReport(
    sourceText,
    workspaceRoot,
    getConfig().redactionPatterns,
  );
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const sanitizedSourceText = sanitizedResult.text.trim();
  if (!sanitizedSourceText) {
    void vscode.window.showWarningMessage(
      'TaCoS: scratchpad append text was empty after sanitization.',
    );
    return;
  }

  const { document } = await ensureScratchpadDocument(
    context,
    workspaceRoot,
    state.panelSummary?.currentBranch,
  );
  const existingText = document.getText();
  const prefix = existingText.trim().length > 0 ? '\n' : '';
  const chunk = `${prefix}${buildScratchpadAppendChunk(sanitizedSourceText)}`;
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(existingText.length), chunk);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    void vscode.window.showWarningMessage('TaCoS: failed to append to scratchpad.');
    return;
  }

  await document.save();
  recordMetricCounter('scratchpadAppended');
  await refreshPanelScratchpadState(context, workspaceRoot);
  rerenderPanel();
  const redactionDetail =
    sanitizedResult.report.totalReplacements > 0
      ? ` Removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`
      : '';
  void vscode.window.showInformationMessage(`TaCoS: appended to scratchpad.${redactionDetail}`);
}

async function setScratchpadScopeCommand(
  context: vscode.ExtensionContext,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot(preferredWorkspaceRoot);
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  type ScopePick = vscode.QuickPickItem & { mode: ScratchpadScopeMode };
  const current = getScratchpadScopeMode(context, workspaceRoot);
  const picks: ScopePick[] = [
    {
      mode: 'partition',
      label: 'Task scope (default)',
      detail: 'workspace + branch + task partition',
      description: current === 'partition' ? 'Current' : '',
    },
    {
      mode: 'workspace',
      label: 'Workspace-global',
      detail: 'shared across branches and partitions',
      description: current === 'workspace' ? 'Current' : '',
    },
  ];
  const picked = await vscode.window.showQuickPick(picks, {
    title: 'TaCoS: Set Scratchpad Scope',
    ignoreFocusOut: true,
  });
  if (!picked) {
    return;
  }

  await setScratchpadScopeMode(context, workspaceRoot, picked.mode);
  await refreshPanelScratchpadState(context, workspaceRoot);
  rerenderPanel();
  void vscode.window.showInformationMessage(
    picked.mode === 'workspace'
      ? 'TaCoS: scratchpad scope set to workspace-global.'
      : 'TaCoS: scratchpad scope set to task scope.',
  );
}

function checkpointPromptAtKey(workspaceRoot: string): string {
  return `${KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

async function maybePromptCheckpointOnBlur(
  context: vscode.ExtensionContext,
  now: number,
  workspaceRoot?: string,
): Promise<void> {
  const config = getConfig();
  if (!config.promptCheckpointOnBlur) {
    return;
  }

  const root = pickWorkspaceRoot(workspaceRoot);
  if (!root) {
    return;
  }

  const lastPromptAt = context.workspaceState.get<number>(checkpointPromptAtKey(root), 0);
  const lastSummaryAt = context.workspaceState.get<number>(KEY_LAST_SUMMARY_AT, 0);

  const shouldPrompt = shouldPromptCheckpointOnBlur({
    now,
    lastSummaryAt,
    lastCheckpointPromptAt: lastPromptAt,
    minIdleMinutes: config.minIdleMinutes,
    cooldownMinutes: config.cooldownMinutes,
    promptCooldownMinutes: CHECKPOINT_PROMPT_COOLDOWN_MINUTES,
    meaningfulChangeSinceLastPrompt: state.meaningfulActivitySinceCheckpointPrompt,
  });
  if (!shouldPrompt) {
    return;
  }

  const budgetDecision = await consumeNoiseBudgetSignal(context, root, 'checkpoint-prompt', now);
  if (!budgetDecision.allowed) {
    // Preserve pending activity signal when the prompt is suppressed by budget.
    // This defers the prompt instead of dropping it permanently.
    return;
  }

  await context.workspaceState.update(checkpointPromptAtKey(root), now);
  const action = await vscode.window.showInformationMessage(
    'One-line next step for Future You (optional).',
    'Add note',
    'Disable prompts',
  );
  if (action === 'Disable prompts') {
    await vscode.workspace
      .getConfiguration('tacos')
      .update('promptCheckpointOnBlur', false, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage('TaCoS: future-you blur prompts disabled.');
    state.meaningfulActivitySinceCheckpointPrompt = false;
    return;
  }

  if (action !== 'Add note') {
    state.meaningfulActivitySinceCheckpointPrompt = false;
    return;
  }

  const note = await vscode.window.showInputBox({
    title: 'TaCoS: Future You Checkpoint',
    prompt: 'One-line next step for Future You (optional)',
    placeHolder: 'Example: Fix parser edge case and rerun npm test',
    ignoreFocusOut: false,
  });
  if (!note) {
    state.meaningfulActivitySinceCheckpointPrompt = false;
    return;
  }

  const sanitizedResult = sanitizeCheckpointNoteWithReport(note, root, config.redactionPatterns);
  recordRedactionMetrics(
    sanitizedResult.report.totalReplacements,
    sanitizedResult.report.highRiskDetected,
  );
  const sanitized = sanitizedResult.text;
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: note was empty after sanitization and was not saved.',
    );
    state.meaningfulActivitySinceCheckpointPrompt = false;
    return;
  }

  await appendCheckpointNote(context, root, sanitized, {
    scope: 'partition',
  });
  await refreshPanelCheckpointState(context, root);
  rerenderPanel();
  state.meaningfulActivitySinceCheckpointPrompt = false;
  const redactionDetail =
    sanitizedResult.report.totalReplacements > 0
      ? ` Removed sensitive content (${sanitizedResult.report.totalReplacements} item${sanitizedResult.report.totalReplacements === 1 ? '' : 's'} redacted).`
      : '';
  void vscode.window.showInformationMessage(
    `TaCoS: checkpoint note saved for this task scope.${redactionDetail}`,
  );
}

function setupChecklistCompletedKey(workspaceRoot: string): string {
  return `${KEY_SETUP_CHECKLIST_COMPLETED_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function isSetupChecklistCompleted(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): boolean {
  return context.workspaceState.get<boolean>(setupChecklistCompletedKey(workspaceRoot), false);
}

async function setSetupChecklistCompleted(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  completed: boolean,
): Promise<void> {
  await context.workspaceState.update(
    setupChecklistCompletedKey(workspaceRoot),
    completed ? true : undefined,
  );
}

async function resetSetupChecklist(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  await setSetupChecklistCompleted(context, workspaceRoot, false);
  void vscode.window.showInformationMessage('TaCoS: setup checklist reset for this workspace.');
}

function buildDemoResumeSummary(now = Date.now()): ResumeSummary {
  return {
    intent: 'Stabilize resume flow after interruption',
    inferredIntent: 'Stabilize resume flow after interruption',
    intentOverridden: false,
    nextSteps: [
      'Open the entry file and confirm where you stopped.',
      'Run the smallest safe verification command.',
      'Capture one checkpoint note before the next context switch.',
    ],
    nextStepEvidenceIds: [['git:sample-context'], ['git:sample-diff'], ['branch:sample']],
    lastActionLabel: 'Edited a summary/render helper before switching tasks.',
    lastActionContext: 'Sample data only; not from your workspace.',
    lastActionEvidenceId: 'task:sample',
    doneSinceLastResume: [
      'Refactored panel fragments',
      'Added regression coverage for webview cards',
    ],
    changesSinceLastResume: [
      '2 files touched in sample flow',
      'Unit tests updated for message parsing and render helpers',
    ],
    pendingBlocked: ['No active blocker in sample mode'],
    recommendedFirstAction: 'Open the current task file and validate the next safe step.',
    lowConfidence: false,
    longGap: false,
    resumeGapMinutes: 17,
    candidateIntents: [
      'Finish onboarding polish and docs updates',
      'Validate demo flow before release',
    ],
    mode: 'coding',
    topFiles: [],
    links: [],
    evidenceCatalog: [
      {
        id: 'git:sample-context',
        kind: 'git',
        label: 'Sample context snapshot',
      },
      {
        id: 'git:sample-diff',
        kind: 'git',
        label: 'Sample diff summary',
      },
      {
        id: 'branch:sample',
        kind: 'branch',
        label: 'Sample branch transition',
      },
    ],
    detailsMarkdown: [
      '## Sample Resume Brief',
      '',
      'This is **demo data** to show TaCoS layout and flow.',
      'It does not include files, links, or telemetry from your workspace.',
      '',
      'Use **Show real resume now** to switch to live local context.',
    ].join('\n'),
    codexPrompt:
      'Sample TaCoS prompt: summarize intent, next safe action, blockers, and restore steps.',
    contextHash: DEMO_RESUME_CONTEXT_HASH,
    generatedAt: now,
    source: 'local',
  };
}

async function showDemoResumeCard(context: vscode.ExtensionContext): Promise<void> {
  await showDetailsPanel(context, buildDemoResumeSummary(), {});
}

async function runSetupChecklist(context: vscode.ExtensionContext): Promise<void> {
  const start = await vscode.window.showInformationMessage(
    'TaCoS helps you resume in ~5 seconds with local-first cues. Setup covers privacy defaults, optional AI, and trust controls.',
    'Start setup',
    'Show demo card',
  );
  if (start === 'Show demo card') {
    await showDemoResumeCard(context);
    return;
  }
  if (start !== 'Start setup') {
    return;
  }
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }
  if (isSetupChecklistCompleted(context, workspaceRoot)) {
    const action = await vscode.window.showInformationMessage(
      'TaCoS: setup checklist is already complete for this workspace.',
      'Rerun checklist',
      'Reset completion',
    );
    if (action === 'Reset completion') {
      await setSetupChecklistCompleted(context, workspaceRoot, false);
      void vscode.window.showInformationMessage(
        'TaCoS: setup checklist completion reset for this workspace.',
      );
      return;
    }
    if (action !== 'Rerun checklist') {
      return;
    }
  }

  type PresetPick = vscode.QuickPickItem & {
    id: 'minimal' | 'balanced' | 'max-context' | 'skip';
  };
  const presetPick = await vscode.window.showQuickPick<PresetPick>(
    [
      {
        id: 'minimal',
        label: 'Minimal (Recommended)',
        detail: 'No diff, no terminal/debug history, local summary only.',
      },
      {
        id: 'balanced',
        label: 'Balanced',
        detail: 'Terminal/debug history enabled, no diff, local summary only.',
      },
      {
        id: 'max-context',
        label: 'Max Context',
        detail: 'Terminal/debug + diff enabled, local summary only.',
      },
      {
        id: 'skip',
        label: 'Skip this step',
        detail: 'Keep current privacy preset and continue.',
      },
    ],
    {
      title: 'TaCoS Setup Checklist (1/3): Privacy defaults',
      placeHolder: 'Choose how much local context TaCoS should collect',
      ignoreFocusOut: true,
    },
  );
  if (!presetPick) {
    return;
  }
  if (presetPick.id !== 'skip') {
    await applyPrivacyPreset(presetPick.id, context);
  }

  type ProviderPick = vscode.QuickPickItem & { id: 'local' | 'configure' | 'skip' };
  const providerPick = await vscode.window.showQuickPick<ProviderPick>(
    [
      {
        id: 'local',
        label: 'Keep Local-Only Provider (Recommended)',
        detail: 'Fastest and private by default. No AI payload send.',
      },
      {
        id: 'configure',
        label: 'Configure AI Provider',
        detail: 'Optional. Choose VS Code LM or OpenAI with explicit payload consent.',
      },
      {
        id: 'skip',
        label: 'Skip this step',
        detail: 'Keep current provider setting and continue.',
      },
    ],
    {
      title: 'TaCoS Setup Checklist (2/3): Provider mode',
      placeHolder: 'Local-only is safest and fastest by default',
      ignoreFocusOut: true,
    },
  );
  if (!providerPick) {
    return;
  }
  if (providerPick.id === 'local') {
    await setSummaryProvider('local');
  } else if (providerPick.id === 'configure') {
    await vscode.commands.executeCommand('tacos.configureAiProvider');
  }

  const trustAction = await vscode.window.showInformationMessage(
    'Trust behavior: Restricted Mode disables risky collection/actions. You can pause auto summaries or disable TaCoS at any time.',
    'Open Privacy & Safety',
    'Continue',
  );
  if (trustAction === 'Open Privacy & Safety') {
    await openPrivacySafetyDoc(context);
  }

  await setSetupChecklistCompleted(context, workspaceRoot, true);
  await context.globalState.update(KEY_ONBOARDING_NOTICE_SHOWN, true);
  void vscode.window.showInformationMessage('TaCoS: setup checklist complete for this workspace.');
}

async function maybeShowOnboardingNotice(context: vscode.ExtensionContext): Promise<void> {
  const shown = context.globalState.get<boolean>(KEY_ONBOARDING_NOTICE_SHOWN, false);
  if (shown) {
    return;
  }

  await context.globalState.update(KEY_ONBOARDING_NOTICE_SHOWN, true);
  const action = await vscode.window.showInformationMessage(
    'TaCoS gives a 5-second resume brief from local context by default. AI sends happen only when enabled with consent, and you can pause anytime.',
    'Run Setup Checklist',
    'Show Demo Resume Card',
    'Open Privacy & Safety',
    'Pause Auto Summaries',
  );
  if (action === 'Run Setup Checklist') {
    await runSetupChecklist(context);
    return;
  }

  if (action === 'Show Demo Resume Card') {
    await showDemoResumeCard(context);
    return;
  }

  if (action === 'Open Privacy & Safety') {
    await openPrivacySafetyDoc(context);
    return;
  }

  if (action === 'Pause Auto Summaries') {
    await setPaused(true);
    void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
  }
}

async function openPrivacySafetyDoc(context: vscode.ExtensionContext): Promise<void> {
  const candidates = [
    'docs/PRIVACY_AND_SAFETY.md',
    'docs/privacy-safety.md',
    'README.md',
    'readme.md',
  ];
  try {
    for (const candidate of candidates) {
      try {
        const readmeUri = vscode.Uri.joinPath(context.extensionUri, candidate);
        const doc = await vscode.workspace.openTextDocument(readmeUri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
        });
        return;
      } catch {
        // Try next candidate.
      }
    }

    throw new Error(`privacy docs not found in candidates: ${candidates.join(', ')}`);
  } catch (error) {
    state.output.appendLine(`TaCoS: failed to open privacy docs: ${(error as Error).message}`);
    void vscode.window.showWarningMessage('TaCoS: unable to open privacy docs.');
  }
}

interface PersistedActivitySnapshot {
  workspaceRoot: string;
  storageKey: string;
  usedLegacyGlobalState: boolean;
  raw: PersistedActivityState;
  sanitized: PersistedActivityState;
}

function getPersistedStringArray(
  context: vscode.ExtensionContext,
  key: string,
  fallback: string[] = [],
): string[] {
  const stored = context.globalState.get<unknown>(key, fallback);
  if (!Array.isArray(stored)) {
    return [...fallback];
  }

  return stored.filter((value): value is string => typeof value === 'string');
}

function getWorkspacePersistedStringArray(
  stored: Record<string, unknown>,
  key: keyof PersistedActivityState,
): string[] {
  const value = stored[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readScopedActivityState(
  context: vscode.ExtensionContext,
  storageKey: string,
): PersistedActivityState {
  const raw = context.workspaceState.get<unknown>(storageKey);
  if (!raw || typeof raw !== 'object') {
    return {
      recentFiles: [],
      recentTerminal: [],
      recentDebug: [],
      recentUrls: [],
      doneItems: [],
      lastFailingCommand: undefined,
    };
  }

  const stored = raw as Record<string, unknown>;
  return {
    recentFiles: getWorkspacePersistedStringArray(stored, 'recentFiles'),
    recentTerminal: getWorkspacePersistedStringArray(stored, 'recentTerminal'),
    recentDebug: getWorkspacePersistedStringArray(stored, 'recentDebug'),
    recentUrls: getWorkspacePersistedStringArray(stored, 'recentUrls'),
    doneItems: getWorkspacePersistedStringArray(stored, 'doneItems'),
    lastFailingCommand:
      typeof stored.lastFailingCommand === 'string' ? stored.lastFailingCommand : undefined,
  };
}

function readLegacyGlobalActivityState(context: vscode.ExtensionContext): PersistedActivityState {
  return {
    recentFiles: getPersistedStringArray(context, KEY_RECENT_FILES),
    recentTerminal: getPersistedStringArray(context, KEY_RECENT_TERMINAL),
    recentDebug: getPersistedStringArray(context, KEY_RECENT_DEBUG),
    recentUrls: getPersistedStringArray(context, KEY_RECENT_URLS),
    doneItems: getPersistedStringArray(context, KEY_DONE_ITEMS),
    lastFailingCommand: context.globalState.get<string>(KEY_LAST_FAILING_COMMAND),
  };
}

function isEmptyActivityState(activity: PersistedActivityState): boolean {
  return (
    activity.recentFiles.length === 0 &&
    activity.recentTerminal.length === 0 &&
    activity.recentDebug.length === 0 &&
    activity.recentUrls.length === 0 &&
    activity.doneItems.length === 0 &&
    !activity.lastFailingCommand?.trim()
  );
}

function scopedActivityStorageKey(context: vscode.ExtensionContext, workspaceRoot: string): string {
  const branch = resolveScopeBranch(context, workspaceRoot);
  const taskPartition = resolveTaskPartitionKey(context, workspaceRoot, branch);
  const scope = buildPartitionScope(workspaceRoot, branch, taskPartition);
  const normalizedScope = scope.trim() || '__no_workspace__';
  return `${KEY_ACTIVITY_STORAGE_PREFIX}.${Buffer.from(normalizedScope).toString('base64url')}`;
}

function loadPersistedActivitySnapshot(
  context: vscode.ExtensionContext,
): PersistedActivitySnapshot {
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const storageKey = scopedActivityStorageKey(context, workspaceRoot);
  const scopedRaw = readScopedActivityState(context, storageKey);
  const legacyRaw = readLegacyGlobalActivityState(context);
  const usedLegacyGlobalState = isEmptyActivityState(scopedRaw) && !isEmptyActivityState(legacyRaw);
  const raw = usedLegacyGlobalState ? legacyRaw : scopedRaw;

  const config = getConfig();
  const sanitized = sanitizeActivityForPersistence(raw, workspaceRoot, config.redactionPatterns);
  return {
    workspaceRoot,
    storageKey,
    usedLegacyGlobalState,
    raw,
    sanitized,
  };
}

function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function didPersistedActivityChange(
  raw: PersistedActivityState,
  sanitized: PersistedActivityState,
): boolean {
  return (
    !sameStringList(raw.recentFiles, sanitized.recentFiles) ||
    !sameStringList(raw.recentTerminal, sanitized.recentTerminal) ||
    !sameStringList(raw.recentDebug, sanitized.recentDebug) ||
    !sameStringList(raw.recentUrls, sanitized.recentUrls) ||
    !sameStringList(raw.doneItems, sanitized.doneItems) ||
    (raw.lastFailingCommand ?? '') !== (sanitized.lastFailingCommand ?? '')
  );
}

async function migrateLegacyPersistedActivityIfNeeded(
  context: vscode.ExtensionContext,
  snapshot: PersistedActivitySnapshot,
): Promise<void> {
  if (
    !snapshot.usedLegacyGlobalState &&
    !didPersistedActivityChange(snapshot.raw, snapshot.sanitized)
  ) {
    return;
  }

  await context.workspaceState.update(snapshot.storageKey, snapshot.sanitized);

  await Promise.all([
    context.globalState.update(KEY_RECENT_FILES, undefined),
    context.globalState.update(KEY_RECENT_TERMINAL, undefined),
    context.globalState.update(KEY_RECENT_DEBUG, undefined),
    context.globalState.update(KEY_RECENT_URLS, undefined),
    context.globalState.update(KEY_DONE_ITEMS, undefined),
    context.globalState.update(KEY_LAST_FAILING_COMMAND, undefined),
  ]);

  state.output.appendLine(
    `TaCoS: migrated legacy persisted activity to workspace-scoped sanitized storage (${snapshot.storageKey}).`,
  );
}

// SECURITY INVARIANT:
// ONLY this function may persist activity-derived state.
// It must redact before writing and must write only to workspaceState scoped storage.
async function persistActivity(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const persisted = sanitizeActivityForPersistence(
    {
      recentFiles: state.recentFiles.values(),
      recentTerminal: state.recentTerminal.values(),
      recentDebug: state.recentDebug.values(),
      recentUrls: state.recentUrls.values(),
      doneItems: state.doneItems.values(),
      lastFailingCommand: state.lastFailingCommand,
    },
    workspaceRoot,
    config.redactionPatterns,
  );

  const storageKey = scopedActivityStorageKey(context, workspaceRoot);
  await context.workspaceState.update(storageKey, persisted);
  await touchWorkspaceActivity(context, workspaceRoot);
}

function extensionVersion(): string {
  const extension = vscode.extensions.getExtension('jkordish.vscode-tacos');
  const version = extension?.packageJSON?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : 'unknown';
}

async function copyDiagnosticsBundle(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  const metrics = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  const diagnostics = buildDiagnosticsText({
    generatedAt: Date.now(),
    extensionVersion: extensionVersion(),
    vscodeVersion: vscode.version,
    workspaceTrusted: vscode.workspace.isTrusted,
    summaryProvider: config.summaryProvider,
    uiSurface: config.uiSurface,
    companionRuntimeMode: resolveCompanionRuntimeMode(config),
    metricsEnabled: config.metricsEnabled,
    recentMetrics: metrics,
    performanceCounters: {
      focusHandling: summarizePerformanceCounter(state.perfFocusHandling),
      focusSummary: summarizePerformanceCounter(state.perfFocusSummary),
      panelRerender: summarizePerformanceCounter(state.perfPanelRerender),
      webviewRender: summarizePerformanceCounter(state.perfWebviewRender),
    },
  });
  await vscode.env.clipboard.writeText(diagnostics);
  void vscode.window.showInformationMessage('TaCoS: diagnostics copied to clipboard.');
}

async function copyMetricsBaselineSnapshot(context: vscode.ExtensionContext): Promise<void> {
  const metrics = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  if (metrics.length === 0) {
    void vscode.window.showInformationMessage(
      'TaCoS: no local metrics found yet. Run a few sessions first, then try again.',
    );
    return;
  }

  const markdown = buildMetricsBaselineSnapshotMarkdown(metrics, {
    generatedAt: Date.now(),
  });
  await vscode.env.clipboard.writeText(markdown);
  void vscode.window.showInformationMessage(
    'TaCoS: metrics baseline snapshot copied to clipboard.',
  );
}

async function maybeFinalizeMetric(context: vscode.ExtensionContext): Promise<void> {
  if (!state.metricSession) {
    return;
  }

  const hasEdit = state.metricSession.firstMeaningfulEditLagMs !== undefined;
  const hasRun = state.metricSession.firstRunLagMs !== undefined;

  if (!hasEdit && !hasRun) {
    return;
  }

  if (!hasEdit || !hasRun) {
    return;
  }

  await finalizeCurrentMetric(context);
}

async function finalizeCurrentMetric(context: vscode.ExtensionContext): Promise<void> {
  if (!state.metricSession) {
    return;
  }

  if (!hasAnyRecordedMetric(state.metricSession)) {
    state.metricSession = undefined;
    return;
  }

  const history = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  history.unshift(state.metricSession);
  if (history.length > 200) {
    history.length = 200;
  }

  await context.workspaceState.update(KEY_METRIC_HISTORY, history);
  state.metricSession = undefined;
}
