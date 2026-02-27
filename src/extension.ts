import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { buildAiPayloadPreviewMarkdown } from './aiPayloadPreview';
import { type CompanionNudgeDecision, chooseCompanionNudges } from './companionNudges';
import {
  persistTerminalCommandForStorage,
  sanitizeActivityForPersistence,
  type PersistedActivityState,
} from './activityPersistence';
import { checkpointStorageKey, sanitizeCheckpointNote } from './checkpoint';
import { resolveCodexOpenCommandCandidates } from './codexInterop';
import {
  captureEditLocation,
  decideEditActivity,
  pushRecentEditLocation,
  type EditLocation,
} from './editActivity';
import { isSummaryLinkEvidenceGrounded } from './evidenceSafety';
import { collectGit, parsePorcelainPaths } from './git';
import { tryGenerateOpenAiSummary } from './llm';
import { buildMetricsCsv, hasAnyRecordedMetric } from './metrics';
import { shouldAutoTriggerSummary, shouldPromptCheckpointOnBlur } from './noiseControl';
import { buildNextStepActions } from './nextStepActions';
import {
  isPathWithinWorkspaceRoot,
  normalizeHttpUrl,
  resolveFileTargetInWorkspace,
} from './pathSafety';
import { isInQuietHours } from './quietHours';
import { redactList, redactText } from './redaction';
import { isRefinementActiveForSummary } from './refinement';
import { computeRestoreAvailability } from './restoreSafety';
import { buildResumeSummary } from './summary';
import { buildStandupUpdate } from './standup';
import { buildTimelineGroups } from './timeline';
import { buildTrustCue } from './trustCue';
import type {
  ExtensionConfig,
  MetricRecord,
  ResumeSignals,
  ResumeSummary,
  SummaryEvidenceItem,
  SummaryProvider,
  TriggerReason,
  VscodeLmModelSelector,
} from './types';
import { tryGenerateVscodeLmSummary, type VscodeLmModelLike } from './vscodeLm';
import { parseWebviewMessage } from './webviewMessages';
import { buildWebviewCspMetaTag, escapeHtml } from './webviewSecurity';

const KEY_LAST_BLUR_AT = 'tacos.lastBlurAt';
const KEY_LAST_SUMMARY_AT = 'tacos.lastSummaryAt';
const KEY_LAST_WORKSPACE_ON_BLUR = 'tacos.lastWorkspaceOnBlur';
const KEY_LAST_AUTO_TRIGGER_FINGERPRINT = 'tacos.lastAutoTriggerFingerprint';
const KEY_SUMMARY_SNOOZE_UNTIL = 'tacos.summarySnoozeUntil';

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
const KEY_ACTIVITY_STORAGE_PREFIX = 'tacos.activityScoped';
const KEY_RESTRICTED_MODE_NOTICE_SHOWN = 'tacos.restrictedModeNoticeShown';
const KEY_SUMMARY_CORRECTIONS_PREFIX = 'tacos.summaryCorrections';
const KEY_VSCODE_LM_SELECTOR = 'tacos.vscodeLmSelector';
const KEY_ONBOARDING_NOTICE_SHOWN = 'tacos.onboardingNoticeShown';
const KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX = 'tacos.lastCheckpointPromptAt';
const KEY_LAST_NUDGE_AT_PREFIX = 'tacos.lastNudgeAt';
const KEY_WORKSPACE_ACTIVITY_AT_PREFIX = 'tacos.workspaceActivityAt';
const KEY_AI_PAYLOAD_CONSENT_PREFIX = 'tacos.aiPayloadConsent';
const SECRET_OPENAI_API_KEY = 'tacos.openaiApiKey';

const KEY_METRIC_HISTORY = 'tacos.metricHistory';
const CHECKPOINT_PROMPT_COOLDOWN_MINUTES = 45;
const FOCUS_TRIGGER_DEBOUNCE_MS = 1200;
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
  activeNudges?: {
    contextHash: string;
    decision: CompanionNudgeDecision;
  };
  panel?: vscode.WebviewPanel;
  panelSummary?: ResumeSummary;
  panelWorkspaceRoot?: string;
  displayedCheckpointNote?: { workspaceRoot: string; value: string; persisted: boolean };
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
  meaningfulActivitySinceCheckpointPrompt: boolean;
  pauseUntilRestart: boolean;
  snoozeUntil: number;
  vscodeLmModel?: VscodeLmModelLike;
  vscodeLmSelector?: VscodeLmModelSelector;
  vscodeLmUnavailableNotified: boolean;
  applyingPrivacyPreset: boolean;
}

let state: RuntimeState;

interface PresentSummaryOptions {
  autoOpenDetails?: boolean;
  workspaceRoot?: string;
  checkpointNote?: string;
}

type SummaryPresentationMode = 'auto-open-details' | 'background' | 'prompt' | 'silent';
type CompanionRuntimeMode = 'active' | 'paused' | 'restricted' | 'disabled';

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

export function activate(context: vscode.ExtensionContext): void {
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
    activeNudges: undefined,
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
    meaningfulActivitySinceCheckpointPrompt: false,
    pauseUntilRestart: false,
    snoozeUntil: context.workspaceState.get<number>(KEY_SUMMARY_SNOOZE_UNTIL, 0),
    vscodeLmSelector: context.globalState.get<VscodeLmModelSelector | undefined>(
      KEY_VSCODE_LM_SELECTOR,
    ),
    vscodeLmUnavailableNotified: false,
    applyingPrivacyPreset: false,
  };

  state.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  state.statusBar.name = 'TaCoS Companion';
  state.statusBar.command = 'tacos.openCompanionActions';
  state.statusBar.show();
  context.subscriptions.push(state.statusBar);

  context.subscriptions.push(state.output);
  void migrateLegacyPersistedActivityIfNeeded(context, persistedActivity);
  void applyRetentionPolicy(context, initialWorkspaceRoot);

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
    vscode.commands.registerCommand('tacos.__test.getStatusBarSnapshot', async () => {
      return {
        text: state.statusBar?.text ?? '',
        tooltip: typeof state.statusBar?.tooltip === 'string' ? state.statusBar.tooltip : '',
        mode: resolveCompanionRuntimeMode(getConfig()),
      };
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

      const cached = context.workspaceState.get<ResumeSummary>(summaryCacheKey(root));
      if (!cached) {
        void vscode.window.showInformationMessage(
          'TaCoS: No cached summary yet for this workspace.',
        );
        return;
      }

      await presentSummary(context, cached, 'cached', {
        autoOpenDetails: true,
        workspaceRoot: root,
        checkpointNote: getCheckpointNote(context, root),
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
    vscode.commands.registerCommand('tacos.jumpToLastEdit', async () => {
      await jumpToRecentEdit(context);
    }),
    vscode.commands.registerCommand('tacos.setPrivacyPreset', async () => {
      await promptAndApplyPrivacyPreset(context);
    }),
    vscode.commands.registerCommand('tacos.setRetentionPolicy', async () => {
      await promptAndSetRetentionPolicy(context);
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
    vscode.commands.registerCommand('tacos.resumeSummaries', async () => {
      state.pauseUntilRestart = false;
      state.snoozeUntil = 0;
      await context.workspaceState.update(KEY_SUMMARY_SNOOZE_UNTIL, undefined);
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
      await promptAndSaveCheckpointNote(context, root);
    }),
    vscode.commands.registerCommand('tacos.addCheckpointNoteFromClipboard', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      const clipboardValue = (await vscode.env.clipboard.readText()).trim();
      if (!clipboardValue) {
        void vscode.window.showWarningMessage(
          'TaCoS: clipboard is empty; no checkpoint note was saved.',
        );
        return;
      }

      const sanitized = sanitizeCheckpointNote(clipboardValue, root, getConfig().redactionPatterns);
      if (!sanitized) {
        void vscode.window.showWarningMessage(
          'TaCoS: clipboard note was empty after sanitization and was not saved.',
        );
        return;
      }

      await context.workspaceState.update(checkpointStorageKey(root), sanitized);
      void vscode.window.showInformationMessage('TaCoS: checkpoint note saved from clipboard.');
    }),
    vscode.commands.registerCommand('tacos.clearCheckpointNote', async () => {
      const root = pickWorkspaceRoot();
      if (!root) {
        void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
        return;
      }

      await clearCheckpointNote(context, root);
      void vscode.window.showInformationMessage(
        'TaCoS: checkpoint note cleared for this workspace.',
      );
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
    vscode.tasks.onDidStartTaskProcess((event) => {
      const task = event.execution.task;
      recordFirstActionLag();
      state.lastTaskName = task.name;
      state.lastTaskWorkspaceRoot = taskWorkspaceRoot(task) ?? pickWorkspaceRoot();
      markMeaningfulActivity();
    }),
  );

  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess(async (event) => {
      const task = event.execution.task;
      const exitCode = typeof event.exitCode === 'number' ? event.exitCode : undefined;
      state.lastTaskName = task.name;
      state.lastTaskWorkspaceRoot = taskWorkspaceRoot(task) ?? pickWorkspaceRoot();
      if (typeof exitCode === 'number') {
        state.lastTaskExitCode = exitCode;
        state.lastTaskEndedAt = Date.now();
      }

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

      const workspaceRoot =
        vscode.workspace.getWorkspaceFolder(event.document.uri)?.uri.fsPath ?? pickWorkspaceRoot();
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

      if (affectsNudges && state.scratchSummary) {
        await updateActiveNudges(
          context,
          state.scratchSummary,
          state.panelWorkspaceRoot ?? pickWorkspaceRoot(),
          getConfig(),
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

      if (
        state.autoSummaryInFlight ||
        now - state.lastAutoFocusTriggerAt < FOCUS_TRIGGER_DEBOUNCE_MS
      ) {
        return;
      }

      const config = getConfig();
      if (
        !config.enabled ||
        state.pauseUntilRestart ||
        !config.showOnFocus ||
        config.pauseSummaries
      ) {
        return;
      }

      await clearExpiredSnoozeIfNeeded(context, now);
      if (state.snoozeUntil > now) {
        return;
      }

      if (isInQuietHours(now, config.summaryQuietHours)) {
        return;
      }

      const root = pickWorkspaceRoot();
      if (!root) {
        return;
      }

      const lastBlurAt = context.workspaceState.get<number>(KEY_LAST_BLUR_AT, now);
      const lastWorkspaceOnBlur = context.workspaceState.get<string>(
        KEY_LAST_WORKSPACE_ON_BLUR,
        '',
      );
      const projectSwitched = Boolean(lastWorkspaceOnBlur) && lastWorkspaceOnBlur !== root;
      const lastSummaryAt = context.workspaceState.get<number>(KEY_LAST_SUMMARY_AT, 0);
      const fingerprint = computeAutoTriggerFingerprint(root);
      const lastFingerprint = context.workspaceState.get<string>(
        autoTriggerFingerprintKey(root),
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
      });
      if (!shouldTrigger) {
        return;
      }

      state.lastAutoFocusTriggerAt = now;
      state.autoSummaryInFlight = true;
      await context.workspaceState.update(autoTriggerFingerprintKey(root), fingerprint);
      try {
        await triggerSummary(context, 'focus');
      } finally {
        state.autoSummaryInFlight = false;
      }
    }),
  );

  void maybeShowOnboardingNotice(context);
  updateCompanionStatusBar();
  state.output.appendLine('TaCoS activated.');
}

export function deactivate(): void {
  // No-op.
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

    if (
      config.includeTerminalHistory &&
      typeof exitCode === 'number' &&
      exitCode !== 0 &&
      isTestOrBuildCommand(command)
    ) {
      state.lastFailingCommandRaw = command;
      state.lastFailingCommand = sanitizedCommand;
      await persistActivity(context);
    }

    if (
      config.includeTerminalHistory &&
      typeof exitCode === 'number' &&
      exitCode === 0 &&
      isTestOrBuildCommand(command)
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
): Promise<void> {
  const root = preferredWorkspaceRoot ?? pickWorkspaceRoot();
  if (!root) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  state.activeRefinementSequence = undefined;
  state.activeRefinementContextHash = undefined;
  const prepared = await prepareTriggerSummary(context, root, reason);

  await context.workspaceState.update(KEY_LAST_SUMMARY_AT, Date.now());
  await touchWorkspaceActivity(context, root);

  await presentSummary(context, prepared.summary, prepared.triggerReason, {
    autoOpenDetails: reason === 'manual',
    workspaceRoot: root,
    checkpointNote: getCheckpointNote(context, root),
  });
  state.meaningfulActivitySinceCheckpointPrompt = false;

  if (prepared.shouldRefineWithAi) {
    void refineSummaryInBackground(context, prepared);
  }
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
  const signals = await collectSignals(root, config);
  const localSummary = await applyBranchHistory(context, root, buildResumeSummary(signals));
  const corrections = getSummaryCorrectionsForContext(context, root, localSummary.contextHash);
  localSummary.userCorrections = corrections;
  localSummary.correctionsFingerprint = summarizeCorrectionsFingerprint(corrections);
  const cacheKey = summaryCacheKey(root);
  const cached = context.workspaceState.get<ResumeSummary>(cacheKey);
  const correctionsUnchanged =
    (cached?.correctionsFingerprint ?? '') === (localSummary.correctionsFingerprint ?? '');
  const providerCompatibleWithCache =
    !cached || providerPlan.activeProvider !== 'local' || cached.source === 'local';
  const contextUnchanged =
    config.cacheIfContextUnchanged &&
    Boolean(cached) &&
    cached?.contextHash === localSummary.contextHash &&
    correctionsUnchanged &&
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

  await context.workspaceState.update(prepared.cacheKey, refined);
  return {
    summary: refined,
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
      prepared.localSummary,
      prepared.config,
      prepared.providerPlan.openAiApiKey ?? '',
      log,
    );
  }

  if (prepared.providerPlan.activeProvider === 'vscode-lm' && prepared.providerPlan.vscodeLmModel) {
    return tryGenerateVscodeLmSummary(
      prepared.signals,
      prepared.localSummary,
      prepared.providerPlan.vscodeLmModel,
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
  const presentationMode = resolveSummaryPresentationMode(config, options);

  if (config.metricsEnabled) {
    await finalizeCurrentMetric(context);
    const root = pickWorkspaceRoot() ?? '';
    state.metricSession = {
      startedAt: Date.now(),
      workspaceRoot: root,
      trigger: triggerReason,
      uiSurface: config.uiSurface,
      interruptionEvent: triggerReason === 'focus' && config.uiSurface === 'notification' ? 1 : 0,
    };
  }

  const workspaceRoot = options.workspaceRoot ?? pickWorkspaceRoot();
  await updateActiveNudges(context, summary, workspaceRoot, config);
  updateSummaryScratchpad(summary, options.workspaceRoot);

  if (presentationMode === 'auto-open-details') {
    await showDetailsPanel(context, summary, options);
    return;
  }

  if (presentationMode === 'background') {
    return;
  }

  if (presentationMode === 'silent') {
    return;
  }

  const actionPauseLabel = config.pauseSummaries ? 'Resume auto summaries' : 'Pause auto summaries';
  recordCompanionPromptImpression();
  const choice = await vscode.window.showInformationMessage(
    `TaCoS (${summary.source}): ${summary.intent}`,
    'Open details',
    'Copy prompt for Codex',
    'Copy + Open Codex',
    'Copy next steps',
    'Copy summary',
    actionPauseLabel,
  );

  if (choice === 'Open details') {
    recordCompanionForcedOpenDetailsClick();
    await showDetailsPanel(context, summary, options);
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

async function updateActiveNudges(
  context: vscode.ExtensionContext,
  summary: ResumeSummary,
  workspaceRoot: string | undefined,
  config: ExtensionConfig,
): Promise<void> {
  if (!workspaceRoot) {
    state.activeNudges = undefined;
    return;
  }

  const decision = chooseCompanionNudges({
    summary,
    provider: config.summaryProvider,
    mode: resolveCompanionRuntimeMode(config),
    now: Date.now(),
    enabled: config.companionNudgesEnabled,
    aggressiveness: config.companionNudgeAggressiveness,
    quietHours: config.companionNudgeQuietHours,
    cooldownMinutes: config.companionNudgeCooldownMinutes,
    lastShownAt: context.workspaceState.get<number>(nudgeShownAtKey(workspaceRoot), 0),
  });
  state.activeNudges = {
    contextHash: summary.contextHash,
    decision,
  };

  if (!decision.primary) {
    return;
  }

  await context.workspaceState.update(nudgeShownAtKey(workspaceRoot), Date.now());
  recordCompanionNudgeImpression();
}

function resolveSummaryPresentationMode(
  config: ExtensionConfig,
  options: Pick<PresentSummaryOptions, 'autoOpenDetails'>,
): SummaryPresentationMode {
  if (options.autoOpenDetails) {
    return 'auto-open-details';
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

function recordMetricCounter(
  field: 'pauseActions' | 'snoozeActions' | 'disableActions',
): void {
  if (!state.metricSession) {
    return;
  }

  state.metricSession[field] = (state.metricSession[field] ?? 0) + 1;
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
  void vscode.window.showInformationMessage(`TaCoS: helpfulness rating saved (${picked.rating}/5).`);
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

function describeNudgeSuppression(decision: CompanionNudgeDecision | undefined): string {
  if (!decision?.suppressedReason || decision.suppressedReason === 'no-candidate') {
    return '';
  }

  if (decision.suppressedReason === 'disabled') {
    return 'Companion nudges are disabled in settings.';
  }
  if (decision.suppressedReason === 'inactive-mode') {
    return 'Nudges are hidden while companion mode is paused or restricted.';
  }
  if (decision.suppressedReason === 'quiet-hours') {
    return 'Nudges are currently in your configured quiet hours window.';
  }
  if (decision.suppressedReason === 'cooldown') {
    return decision.nextEligibleAt
      ? `Nudges are cooling down until ${formatTimestamp(decision.nextEligibleAt)}.`
      : 'Nudges are cooling down before the next reminder.';
  }
  return '';
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

function updateCompanionStatusBar(): void {
  if (!state.statusBar) {
    return;
  }

  const config = getConfig();
  const mode = resolveCompanionRuntimeMode(config);
  const summary = state.scratchSummary;
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
  const statusHeadline =
    mode === 'active'
      ? summarizeForStatusBar(summary?.intent ?? '')
      : mode === 'restricted'
        ? 'restricted mode'
        : mode === 'paused'
          ? 'paused'
          : 'disabled';
  const topStep = summary?.nextSteps[0]?.trim();
  const blockerCount = summary?.lastFailingCommand ? 1 : 0;
  const blockerSuffix = blockerCount > 0 ? ` · ${blockerCount} blocker` : '';
  const trustCue = buildTrustCue(summary);
  state.statusBar.text = `${modeIcon} TaCoS: ${statusHeadline}${blockerSuffix}`;
  state.statusBar.backgroundColor =
    mode === 'restricted'
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : mode === 'paused' || mode === 'disabled'
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : undefined;
  state.statusBar.tooltip = [
    'TaCoS Companion',
    `Mode: ${modeLabel}`,
    `Surface: ${config.uiSurface}`,
    `Provider: ${describeProvider(config.summaryProvider)}`,
    `Privacy preset: ${PRIVACY_PRESET_LABELS[config.privacyPreset]}`,
    `Retention: ${RETENTION_POLICY_LABELS[config.retentionPolicy]}`,
    `Summary quiet hours: ${config.summaryQuietHours || 'off'}`,
    state.snoozeUntil > Date.now()
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
    | 'showLast'
    | 'standup'
    | 'restoreWorkingSet'
    | 'jumpLastEdit'
    | 'copyPrompt'
    | 'togglePause'
    | 'snoozeAuto'
    | 'enable'
    | 'openPrivacy'
    | 'configureProvider'
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
      id: 'configureProvider',
      label: 'Configure AI provider',
      detail: 'Switch between local, VS Code LM, and OpenAI providers.',
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
  } else if (picked.id === 'showLast') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.showLastSummary');
  } else if (picked.id === 'standup') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.generateStandupUpdate');
  } else if (picked.id === 'restoreWorkingSet') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.restoreWorkingSet');
  } else if (picked.id === 'jumpLastEdit') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.jumpToLastEdit');
  } else if (picked.id === 'copyPrompt') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.copyPromptAndOpenCodex');
  } else if (picked.id === 'snoozeAuto') {
    recordCompanionQuickAction();
    await promptAndSetAutoSummarySnooze(context);
  } else if (picked.id === 'configureProvider') {
    recordCompanionQuickAction();
    await vscode.commands.executeCommand('tacos.configureAiProvider');
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
  options: Pick<PresentSummaryOptions, 'workspaceRoot' | 'checkpointNote'> = {},
): Promise<void> {
  const workspaceRoot = options.workspaceRoot ?? pickWorkspaceRoot();
  const checkpointNote = options.checkpointNote;
  updateSummaryScratchpad(summary, workspaceRoot);
  state.panelSummary = summary;
  state.panelWorkspaceRoot = workspaceRoot;

  if (checkpointNote && workspaceRoot) {
    state.displayedCheckpointNote = {
      workspaceRoot,
      value: checkpointNote,
      persisted: false,
    };
    await context.workspaceState.update(checkpointStorageKey(workspaceRoot), undefined);
  } else {
    state.displayedCheckpointNote = undefined;
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
      state.displayedCheckpointNote = undefined;
    });

    state.panel.webview.onDidReceiveMessage(async (rawMessage: unknown) => {
      const message = parseWebviewMessage(rawMessage);
      if (!message) {
        return;
      }

      if (message.type === 'fixSummary') {
        await captureSummaryCorrection(context);
        return;
      }

      if (message.type === 'checkpointKeep') {
        if (!state.displayedCheckpointNote) {
          return;
        }

        await context.workspaceState.update(
          checkpointStorageKey(state.displayedCheckpointNote.workspaceRoot),
          state.displayedCheckpointNote.value,
        );
        state.displayedCheckpointNote.persisted = true;
        state.meaningfulActivitySinceCheckpointPrompt = false;
        void vscode.window.showInformationMessage(
          'TaCoS: checkpoint note kept for the next resume.',
        );
        return;
      }

      if (message.type === 'checkpointClear') {
        if (!state.displayedCheckpointNote) {
          return;
        }

        await context.workspaceState.update(
          checkpointStorageKey(state.displayedCheckpointNote.workspaceRoot),
          undefined,
        );
        state.displayedCheckpointNote = undefined;
        rerenderPanel();
        void vscode.window.showInformationMessage('TaCoS: checkpoint note cleared.');
        return;
      }

      if (message.type === 'sessionAddCheckpoint') {
        const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        const firstAction = state.panelSummary?.recommendedFirstAction?.trim();
        const seededValue = firstAction ? `Next: ${firstAction}` : undefined;
        await promptAndSaveCheckpointNote(context, workspaceRoot, {
          title: 'TaCoS: Capture Session Checkpoint',
          prompt: 'Save a one-line checkpoint for your next resume.',
          placeHolder: 'Example: Continue from parser error and rerun npm test',
          initialValue: seededValue,
        });
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
        return;
      }

      if (message.type === 'copySummary') {
        if (!state.panelSummary) {
          return;
        }

        recordCompanionQuickAction();
        await vscode.env.clipboard.writeText(formatPlainSummary(state.panelSummary));
        void vscode.window.showInformationMessage('TaCoS: summary copied to clipboard.');
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
        const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

        recordCompanionQuickAction();
        await triggerSummary(context, 'manual', workspaceRoot);
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

      if (message.type === 'rateHelpfulness') {
        recordCompanionQuickAction();
        await promptSummaryHelpfulnessRating();
        return;
      }

      if (message.type === 'runNextStepAction') {
        if (!state.panelSummary) {
          return;
        }

        recordCompanionQuickAction();
        await runNextStepAction(
          state.panelSummary,
          message.stepIndex,
          state.panelWorkspaceRoot,
        );
        return;
      }

      if (message.type === 'blockedLink') {
        void vscode.window.showWarningMessage(
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
        await openProblemsView();
        return;
      }

      if (message.type === 'restoreOpenDiagnosticFile') {
        recordCompanionQuickAction();
        await openPrimaryDiagnosticFile(state.panelWorkspaceRoot);
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
        await rerunLastTask();
        return;
      }

      if (message.type === 'restoreRerunDebug') {
        recordCompanionQuickAction();
        await rerunLastDebugSession();
        return;
      }

      if (message.type === 'restoreCheckoutPreviousBranch') {
        recordCompanionQuickAction();
        await checkoutPreviousBranch(state.panelSummary, state.panelWorkspaceRoot);
        return;
      }

      if (message.type === 'restoreCopyFailingCommand') {
        recordCompanionQuickAction();
        await copyFailingCommand();
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
          const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
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
        const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
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
        const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
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
  return summary.source === 'local' ? 'TaCoS Resume Brief' : 'TaCoS Resume Brief (Refined)';
}

function rerenderPanel(): void {
  if (!state.panel || !state.panelSummary) {
    return;
  }

  state.panel.title = titleForSummary(state.panelSummary);
  state.panel.webview.html = renderWebview(
    state.panel.webview,
    state.panelSummary,
    state.displayedCheckpointNote?.value,
  );
}

function renderWebview(
  webview: vscode.Webview,
  summary: ResumeSummary,
  checkpointNote?: string,
): string {
  const nonce = createNonce();
  const cspMetaTag = buildWebviewCspMetaTag(webview.cspSource, nonce);
  const config = getConfig();
  const evidenceById = new Map(
    (summary.evidenceCatalog ?? []).map((item) => [item.id, item] as const),
  );
  const timelineGroups = config.showTimeline
    ? buildTimelineGroups(summary.evidenceCatalog ?? [], Date.now())
    : [];
  const checkpointCard = checkpointNote
    ? `<div class="card">
      <h3>Your Note</h3>
      <p>${escapeHtml(checkpointNote)}</p>
      <div class="note-actions">
        <button type="button" data-action="checkpointKeep">Keep</button>
        <button type="button" data-action="checkpointClear">Clear now</button>
      </div>
    </div>`
    : '';
  const candidateIntentItems = (summary.candidateIntents ?? [])
    .map((candidate) => `<li>${escapeHtml(candidate)}</li>`)
    .join('');
  const confidenceCard = summary.lowConfidence
    ? `<div class="card">
      <h3>Low Confidence</h3>
      <p class="muted">Unclear intent (low evidence). Add one line of context before continuing.</p>
      <ul class="compact-list">${candidateIntentItems || '<li>No strong candidates captured.</li>'}</ul>
      <button type="button" class="secondary" data-action="sessionAddCheckpoint">Add one-line checkpoint</button>
    </div>`
    : '';
  const linkItems = summary.links
    .map(
      (link, index) =>
        `<li><a href="#" data-action="openLink" data-link-index="${index}">${escapeHtml(link.label)}</a> <span class="kind">(${escapeHtml(link.kind)})</span></li>`,
    )
    .join('');

  const mode = summary.mode ?? 'coding';
  const trusted = vscode.workspace.isTrusted;
  const availability = computeRestoreAvailability({
    trusted,
    hasLastTask: Boolean(state.lastTaskName),
    hasLastDebug: Boolean(state.lastDebugConfigName),
    hasFailingCommand: Boolean(getCopyableFailingCommand()),
    hasRecentEditLocation: state.recentEditLocations.length > 0,
    currentBranch: summary.currentBranch,
    previousBranch: summary.previousBranch,
  });
  const diagnostics = collectWorkspaceDiagnostics(state.panelWorkspaceRoot ?? pickWorkspaceRoot());
  const hasFailingTask =
    Boolean(state.lastTaskName) &&
    Number.isInteger(state.lastTaskExitCode) &&
    (state.lastTaskExitCode ?? 0) !== 0;
  const canOpenProblems = diagnostics.errorCount > 0 || diagnostics.warningCount > 0;
  const canOpenDiagnosticFile = Boolean(diagnostics.top);
  const trustCue = buildTrustCue(summary);
  const nextStepActions = buildNextStepActions({
    summary,
    canRerunTask: availability.canRerunTask,
    canRerunDebug: availability.canRerunDebug,
    canCopyFailingCommand: availability.canCopyFailingCommand,
  });
  const nextSteps = summary.nextSteps
    .map((step, index) => {
      const evidenceIds = summary.nextStepEvidenceIds?.[index] ?? [];
      const badges = evidenceIds
        .map((evidenceId) => renderStepEvidenceBadge(evidenceId, evidenceById.get(evidenceId)))
        .join('');
      const action = nextStepActions[index];
      const actionButton = action
        ? `<button type="button" class="secondary step-action" data-action="runNextStepAction" data-step-index="${index}">${escapeHtml(action.label)}</button>`
        : '';
      const badgeRow = badges ? `<div class="step-evidence">${badges}</div>` : '';
      const actionRow = actionButton ? `<div class="step-actions">${actionButton}</div>` : '';
      return `<li>${escapeHtml(step)}${badgeRow}${actionRow}</li>`;
    })
    .join('');
  const topFiles = summary.topFiles
    .map(
      (file, index) =>
        `<li><a href="#" data-action="openTopFile" data-top-file-index="${index}">${escapeHtml(file)}</a></li>`,
    )
    .join('');
  const evidenceItems = (summary.evidenceCatalog ?? [])
    .map((item, index) => {
      const target = item.target
        ? ` <span class="evidence-target">${escapeHtml(item.target)}</span>`
        : '';
      const hiddenClass = index >= 5 ? 'extra-evidence' : '';
      return `<li class="${hiddenClass}"><span class="evidence-kind">[${escapeHtml(item.kind)}]</span> ${escapeHtml(item.label)} <code>${escapeHtml(item.id)}</code>${target}</li>`;
    })
    .join('');
  const hasExtraEvidence = (summary.evidenceCatalog?.length ?? 0) > 5;
  const companionNextSteps = summary.nextSteps
    .slice(0, 3)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('');
  const recapDoneItems = summary.doneSinceLastResume?.slice(0, 3) ?? [];
  const recapPendingItems = summary.pendingBlocked?.slice(0, 3) ?? [];
  const recapFirstAction = summary.recommendedFirstAction?.trim() ?? summary.nextSteps[0] ?? '';
  const recapDoneList = recapDoneItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const recapPendingList = recapPendingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const activeNudgeDecision =
    state.activeNudges?.contextHash === summary.contextHash
      ? state.activeNudges.decision
      : undefined;
  const primaryNudge = activeNudgeDecision?.primary;
  const secondaryNudge = activeNudgeDecision?.secondary;
  const nudgeSuppressionLabel = describeNudgeSuppression(activeNudgeDecision);
  const switchedBranches =
    Boolean(summary.currentBranch) &&
    Boolean(summary.previousBranch) &&
    summary.currentBranch !== summary.previousBranch;

  let blockerTitle = 'No active blocker';
  let blockerDetail = 'Continue with the first suggested next step.';
  let blockerActionLabel: string | undefined;
  let blockerAction: string | undefined;
  let blockerActionDisabled = false;

  if (!trusted) {
    blockerTitle = 'Workspace is in Restricted Mode';
    blockerDetail =
      'Task/debug reruns and branch checkout are disabled until workspace trust is granted.';
  } else if (summary.lowConfidence) {
    blockerTitle = 'Low-confidence resume context';
    blockerDetail = 'Evidence is sparse. Add a one-line checkpoint before taking risky actions.';
    blockerActionLabel = 'Add checkpoint';
    blockerAction = 'sessionAddCheckpoint';
  } else if (hasFailingTask) {
    blockerTitle = 'Last task failed';
    blockerDetail = `${state.lastTaskName} exited with code ${state.lastTaskExitCode}.`;
    blockerActionLabel = 'Rerun last task';
    blockerAction = 'restoreRerunTask';
    blockerActionDisabled = !availability.canRerunTask;
  } else if (summary.lastFailingCommand) {
    blockerTitle = 'Last command failed';
    blockerDetail = summary.lastFailingCommand;
    if (availability.canRerunTask) {
      blockerActionLabel = 'Rerun last task';
      blockerAction = 'restoreRerunTask';
    } else if (availability.canCopyFailingCommand) {
      blockerActionLabel = 'Copy failing command';
      blockerAction = 'restoreCopyFailingCommand';
    }
  } else if (diagnostics.errorCount > 0) {
    blockerTitle = 'Diagnostics need attention';
    blockerDetail = diagnostics.top
      ? `${diagnostics.errorCount} error(s). First at ${diagnostics.top.path}:${diagnostics.top.line + 1}.`
      : `${diagnostics.errorCount} error(s) in Problems view.`;
    blockerActionLabel = diagnostics.top ? 'Open diagnostic file' : 'Open Problems';
    blockerAction = diagnostics.top ? 'restoreOpenDiagnosticFile' : 'restoreOpenProblems';
    blockerActionDisabled = diagnostics.top ? !canOpenDiagnosticFile : !canOpenProblems;
  } else if (switchedBranches) {
    blockerTitle = 'Branch context changed';
    blockerDetail = `You moved from ${summary.previousBranch} to ${summary.currentBranch}.`;
    blockerActionLabel = 'Checkout previous branch';
    blockerAction = 'restoreCheckoutPreviousBranch';
    blockerActionDisabled = !availability.canCheckoutPreviousBranch;
  } else if (summary.nextSteps.length === 0) {
    blockerTitle = 'No next steps available';
    blockerDetail = 'Refresh summary to regenerate guidance.';
    blockerActionLabel = 'Refresh summary';
    blockerAction = 'refreshSummary';
  }

  const blockerActionHtml =
    blockerAction && blockerActionLabel
      ? `<button type="button" class="secondary" data-action="${escapeHtml(blockerAction)}" ${blockerActionDisabled ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(blockerActionLabel)}</button>`
      : '';

  const companionRestoreButtons = [
    '<button type="button" data-action="restoreWorkingSet">Restore working set</button>',
    `<button type="button" data-action="restoreJumpToLastEdit" ${availability.canJumpToLastEdit ? '' : 'disabled aria-disabled="true"'}>Jump to last edit</button>`,
    '<button type="button" data-action="restoreReopenFiles">Reopen files</button>',
    '<button type="button" data-action="restoreOpenChangedFiles">Open changed files</button>',
    `<button type="button" data-action="restoreRerunTask" ${availability.canRerunTask ? '' : 'disabled aria-disabled="true"'}>Rerun task</button>`,
    `<button type="button" data-action="restoreRerunDebug" ${availability.canRerunDebug ? '' : 'disabled aria-disabled="true"'}>Rerun debug</button>`,
    `<button type="button" data-action="restoreOpenProblems" ${canOpenProblems ? '' : 'disabled aria-disabled="true"'}>Open Problems</button>`,
    `<button type="button" data-action="restoreOpenDiagnosticFile" ${canOpenDiagnosticFile ? '' : 'disabled aria-disabled="true"'}>Open diagnostic file</button>`,
  ].join('');

  const detailsHtml = markdownRenderer.render(summary.detailsMarkdown);
  const sourceLabel =
    summary.source === 'local' ? 'Local summary (instant)' : 'Refined summary (AI)';
  const generatedAtLabel = formatTimestamp(summary.generatedAt);
  const localGeneratedAtLabel = summary.localGeneratedAt
    ? formatTimestamp(summary.localGeneratedAt)
    : undefined;
  const refinementActive = isRefinementActiveForSummary(
    state.activeRefinementContextHash,
    summary.contextHash,
  );
  const statusHint =
    summary.source === 'local'
      ? refinementActive
        ? 'AI refinement in progress.'
        : 'Running local-only summary.'
      : localGeneratedAtLabel
        ? `Started local at ${localGeneratedAtLabel}.`
        : 'AI refinement complete.';
  const autoSummariesDisabled = !config.enabled;
  const autoSummariesPaused =
    !autoSummariesDisabled && (config.pauseSummaries || state.pauseUntilRestart);
  const companionRuntimeMode = resolveCompanionRuntimeMode(config);
  const trustTrackingLabel =
    companionRuntimeMode === 'restricted'
      ? 'restricted'
      : companionRuntimeMode === 'paused'
        ? 'paused'
        : companionRuntimeMode === 'disabled'
          ? 'disabled'
          : 'on';
  const sentToAiLabel =
    config.summaryProvider === 'local'
      ? 'Nothing (local-only mode).'
      : companionRuntimeMode === 'restricted'
        ? 'Nothing while Restricted Mode is active.'
        : 'Redacted summary context and evidence when AI refinement runs.';
  const storedLocallyLabel =
    'Redacted activity snapshots, summary cache, checkpoint notes, and local metrics.';
  const trustCueDetails = trustCue.details.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const autoSummaryStatusLabel = autoSummariesDisabled
    ? 'Auto summaries disabled'
    : autoSummariesPaused
      ? 'Auto summaries paused'
      : 'Auto summaries active';
  const autoSummaryStatusDetail = autoSummariesDisabled
    ? 'Enable tacos.enabled in settings to restore automatic summaries.'
    : state.pauseUntilRestart
      ? 'Paused until restart.'
      : config.pauseSummaries
        ? 'Paused in settings.'
        : 'Runs on focus after idle and cooldown checks.';
  const autoSummaryToggleLabel = autoSummariesPaused
    ? 'Resume auto summaries'
    : 'Pause auto summaries';
  const autoSummaryToggleDisabledAttr = autoSummariesDisabled
    ? 'disabled aria-disabled="true"'
    : '';
  const timelineGroupsHtml = timelineGroups
    .map((group) => {
      const items = group.rows
        .map((row) => {
          const label = row.clickable
            ? `<a href="#" data-action="openEvidence" data-evidence-id="${escapeHtml(row.evidenceId)}">${escapeHtml(row.label)}</a>`
            : `<span>${escapeHtml(row.label)}</span>`;
          const detail = row.detail
            ? `<span class="timeline-detail">${escapeHtml(row.detail)}</span>`
            : '';
          return `<li><span class="timeline-time">${escapeHtml(row.relativeTime)}</span><div class="timeline-row">${label}${detail}</div></li>`;
        })
        .join('');
      return `<section class="timeline-group"><h4>${escapeHtml(group.label)}</h4><ul>${items}</ul></section>`;
    })
    .join('');
  const timelineCard = config.showTimeline
    ? `<div class="card">
      <h3>Timeline</h3>
      <button type="button" class="secondary" data-action="toggleTimeline" aria-expanded="false" aria-controls="timeline-content">Show timeline</button>
      <div id="timeline-content" hidden>
        ${timelineGroupsHtml || '<p class="muted">No timeline entries captured yet.</p>'}
      </div>
    </div>`
    : '';
  const recapCard =
    recapDoneItems.length > 0 || recapPendingItems.length > 0 || Boolean(recapFirstAction)
      ? `<div class="card recap-card">
      <h3>Session Recap</h3>
      <div class="recap-grid">
        <section>
          <h4>Done since last resume</h4>
          <ul class="compact-list">${recapDoneList || '<li>None captured yet.</li>'}</ul>
        </section>
        <section>
          <h4>Pending / blocked</h4>
          <ul class="compact-list">${recapPendingList || '<li>No blocker captured.</li>'}</ul>
        </section>
        <section>
          <h4>Recommended first action</h4>
          <p class="companion-primary">${escapeHtml(recapFirstAction || 'Refresh summary to regenerate first-action guidance.')}</p>
          <div class="status-actions">
            <button type="button" data-action="copyNextSteps">Copy next steps</button>
            <button type="button" class="secondary" data-action="sessionAddCheckpoint">Save checkpoint</button>
          </div>
        </section>
      </div>
    </div>`
      : '';
  const changesSinceItems = (summary.changesSinceLastResume ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const changesSinceCard = `<div class="card">
      <h3>Changes Since Last Time</h3>
      <ul class="compact-list">${changesSinceItems || '<li>No changes captured.</li>'}</ul>
    </div>`;
  const nudgeCard =
    primaryNudge || secondaryNudge || nudgeSuppressionLabel
      ? `<div class="card">
      <h3>Companion Nudge</h3>
      ${
        primaryNudge
          ? `<p class="companion-primary">${escapeHtml(primaryNudge.title)}</p>
      <p class="muted">${escapeHtml(primaryNudge.detail)}</p>
      <div class="status-actions">
        <button type="button" data-action="${escapeHtml(primaryNudge.action)}">${escapeHtml(nudgeActionLabel(primaryNudge.action))}</button>
      ${
        secondaryNudge
          ? `<button type="button" class="secondary" data-action="${escapeHtml(secondaryNudge.action)}">${escapeHtml(nudgeActionLabel(secondaryNudge.action))}</button>`
          : ''
      }
      </div>`
          : ''
      }
      ${
        !primaryNudge && nudgeSuppressionLabel
          ? `<p class="muted">${escapeHtml(nudgeSuppressionLabel)}</p>`
          : ''
      }
    </div>`
      : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${cspMetaTag}
    <style nonce="${nonce}">
      :root {
        --surface-bg: var(--vscode-editorWidget-background);
        --surface-border: var(--vscode-panel-border);
        --surface-muted: var(--vscode-descriptionForeground);
        --surface-strong: var(--vscode-foreground);
        --accent: var(--vscode-focusBorder);
      }
      body {
        color: var(--surface-strong);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        line-height: 1.5;
        padding: 16px;
        animation: panel-refresh 180ms ease-out;
      }
      @media (prefers-reduced-motion: reduce) {
        body {
          animation: none;
        }
      }
      @keyframes panel-refresh {
        from {
          opacity: 0.92;
          transform: translateY(2px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .card {
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 14px;
        background: var(--surface-bg);
      }
      ul {
        padding-left: 20px;
      }
      h3 {
        margin-top: 0;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      h3::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--accent);
      }
      h4 {
        margin-bottom: 8px;
      }
      a {
        color: var(--vscode-textLink-foreground);
      }
      a:hover {
        color: var(--vscode-textLink-activeForeground);
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .details-markdown {
        line-height: 1.45;
      }
      .details-markdown > :first-child {
        margin-top: 0;
      }
      .details-markdown > :last-child {
        margin-bottom: 0;
      }
      .details-markdown p,
      .details-markdown li {
        overflow-wrap: anywhere;
      }
      .details-markdown code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      }
      .kind {
        color: var(--vscode-descriptionForeground);
      }
      .mode {
        color: var(--vscode-descriptionForeground);
        font-size: 13px;
      }
      .status-label {
        font-weight: 700;
        font-size: 13px;
      }
      .status-detail {
        margin-top: 6px;
      }
      .status-actions {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .step-evidence {
        margin-top: 6px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .step-actions {
        margin-top: 8px;
      }
      .step-action {
        padding: 4px 10px;
        font-size: 12px;
      }
      .badge {
        display: inline-block;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 12px;
        text-decoration: none;
        color: inherit;
      }
      .badge.clickable {
        cursor: pointer;
      }
      .badge.kind-url {
        border-color: var(--vscode-textLink-foreground);
      }
      .badge.kind-file {
        border-color: var(--vscode-charts-green);
      }
      .evidence-kind {
        color: var(--vscode-descriptionForeground);
      }
      .evidence-target {
        color: var(--vscode-descriptionForeground);
      }
      .extra-evidence {
        display: none;
      }
      .evidence-list.show-more .extra-evidence {
        display: list-item;
      }
      details summary {
        cursor: pointer;
      }
      .show-more-btn {
        margin-top: 8px;
      }
      .muted {
        color: var(--surface-muted);
      }
      .restore-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
      }
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 8px;
        padding: 8px 10px;
      }
      button:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      button.secondary {
        background: transparent;
        color: var(--vscode-editor-foreground);
        border-color: var(--vscode-widget-border);
      }
      .restore-grid button {
        text-align: left;
        cursor: pointer;
      }
      .restore-grid button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .restore-note {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        margin-top: 8px;
      }
      .note-actions {
        display: flex;
        gap: 8px;
      }
      .note-actions button {
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
      }
      .timeline-group ul {
        margin-top: 0;
      }
      .timeline-group li {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 8px;
        margin-bottom: 6px;
      }
      .timeline-time {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        padding-top: 2px;
      }
      .timeline-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .timeline-detail {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .quick-actions button {
        min-width: 180px;
      }
      .companion-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .companion-block {
        border: 1px solid var(--vscode-widget-border);
        border-radius: 10px;
        padding: 12px;
        background: var(--vscode-editor-background);
        box-shadow: inset 0 1px 0 var(--vscode-widget-border);
      }
      .companion-block h4 {
        margin-top: 0;
        margin-bottom: 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--surface-muted);
      }
      .companion-primary {
        margin: 0 0 8px 0;
        font-weight: 700;
        line-height: 1.4;
      }
      .compact-list {
        margin: 0 0 10px 0;
        padding-left: 18px;
      }
      .companion-restore-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .companion-restore-grid button {
        text-align: left;
      }
      .trust-row {
        margin-bottom: 8px;
      }
      .trust-key {
        font-weight: 600;
      }
      .recap-card .recap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
      }
      .recap-card h4 {
        margin-top: 0;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h3>Status</h3>
      <div class="status-label">${escapeHtml(sourceLabel)} · ${escapeHtml(generatedAtLabel)}</div>
      <div class="status-detail muted">${escapeHtml(statusHint)}</div>
      <div class="status-detail"><strong>${escapeHtml(autoSummaryStatusLabel)}</strong></div>
      <div class="status-detail muted">${escapeHtml(autoSummaryStatusDetail)}</div>
      <div class="status-actions">
        <button type="button" data-action="refreshSummary">Refresh summary now</button>
        <button type="button" class="secondary" data-action="toggleAutoSummaries" ${autoSummaryToggleDisabledAttr}>${escapeHtml(autoSummaryToggleLabel)}</button>
      </div>
    </div>

    <div class="card">
      <h3>Trust Center</h3>
      <div class="trust-row"><span class="trust-key">Tracking:</span> ${escapeHtml(trustTrackingLabel)}</div>
      <div class="trust-row"><span class="trust-key">Stored locally:</span> ${escapeHtml(storedLocallyLabel)}</div>
      <div class="trust-row"><span class="trust-key">Sent to AI:</span> ${escapeHtml(sentToAiLabel)}</div>
      <div class="trust-row"><span class="trust-key">Based on:</span> ${escapeHtml(trustCue.headline.replace('Based on: ', ''))}</div>
      <details>
        <summary><strong>Why am I seeing this?</strong></summary>
        <ul class="compact-list">${trustCueDetails || '<li>No evidence counts yet.</li>'}</ul>
      </details>
      <div class="status-actions">
        <button type="button" class="secondary" data-action="toggleAutoSummaries" ${autoSummaryToggleDisabledAttr}>${escapeHtml(autoSummaryToggleLabel)}</button>
        <button type="button" class="secondary" data-action="openPrivacySafety">Open Privacy & Safety</button>
      </div>
    </div>

    ${checkpointCard}
    ${recapCard}
    ${changesSinceCard}
    ${nudgeCard}
    <div class="card">
      <h3>Companion Home</h3>
      <div class="companion-grid">
        <section class="companion-block">
          <h4>Now</h4>
          <p class="companion-primary">${escapeHtml(summary.intent)}</p>
          <p class="muted">Mode: ${escapeHtml(mode)}</p>
        </section>
        <section class="companion-block">
          <h4>Next</h4>
          <ul class="compact-list">${companionNextSteps || '<li>No next steps captured yet.</li>'}</ul>
          <button type="button" class="secondary" data-action="copyNextSteps">Copy next steps</button>
        </section>
        <section class="companion-block">
          <h4>Blocked</h4>
          <p class="companion-primary">${escapeHtml(blockerTitle)}</p>
          <p class="muted">${escapeHtml(blockerDetail)}</p>
          ${blockerActionHtml}
        </section>
        <section class="companion-block">
          <h4>Restore</h4>
          <div class="companion-restore-grid">${companionRestoreButtons}</div>
        </section>
      </div>
    </div>

    <div class="card">
      <h3>Intent</h3>
      <p>${escapeHtml(summary.intent)}</p>
      <p class="mode">Mode: ${escapeHtml(mode)}</p>
    </div>

    ${confidenceCard}

    <div class="card">
      <h3>Next Steps</h3>
      <ul>${nextSteps}</ul>
    </div>

    <div class="card">
      <h3>Top Files</h3>
      <ul>${topFiles || '<li>None captured</li>'}</ul>
    </div>

    <div class="card">
      <h3>Top Links / Files</h3>
      <ul>${linkItems || '<li>None captured</li>'}</ul>
    </div>

    ${timelineCard}

    <div class="card">
      <h3>Quick Actions</h3>
      <div class="quick-actions">
        <button type="button" data-action="copyNextSteps">Copy next steps</button>
        <button type="button" data-action="copySummary">Copy summary</button>
        <button type="button" data-action="rateHelpfulness">Rate helpfulness</button>
        <button type="button" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
      </div>
    </div>

    <div class="card">
      <h3>Restore Pack</h3>
      <div class="restore-grid">
        <button type="button" data-action="restoreWorkingSet">Restore working set</button>
        <button type="button" data-action="restoreJumpToLastEdit" ${availability.canJumpToLastEdit ? '' : 'disabled'}>Jump to last edit</button>
        <button type="button" data-action="restoreReopenFiles">Reopen files</button>
        <button type="button" data-action="restoreOpenChangedFiles">Open changed files</button>
        <button type="button" data-action="restoreRerunTask" ${availability.canRerunTask ? '' : 'disabled'}>Rerun last task</button>
        <button type="button" data-action="restoreRerunDebug" ${availability.canRerunDebug ? '' : 'disabled'}>Rerun debug config</button>
        <button type="button" data-action="restoreOpenProblems" ${canOpenProblems ? '' : 'disabled'}>Open Problems</button>
        <button type="button" data-action="restoreOpenDiagnosticFile" ${canOpenDiagnosticFile ? '' : 'disabled'}>Open diagnostic file</button>
        <button type="button" data-action="restoreCheckoutPreviousBranch" ${availability.canCheckoutPreviousBranch ? '' : 'disabled'}>Checkout previous branch</button>
        <button type="button" data-action="restoreCopyFailingCommand" ${availability.canCopyFailingCommand ? '' : 'disabled'}>Copy failing command</button>
      </div>
      ${
        trusted
          ? ''
          : '<div class="restore-note">Restricted Mode: task/debug/branch execution actions are disabled.</div>'
      }
    </div>

    <div class="card">
      <h3>Summary Feedback</h3>
      <button type="button" data-action="fixSummary">Fix summary</button>
    </div>

    <div class="card">
      <details>
        <summary><strong>Evidence</strong></summary>
        <ul class="evidence-list" id="evidence-list">${evidenceItems || '<li>None captured</li>'}</ul>
        ${
          hasExtraEvidence
            ? '<button type="button" class="show-more-btn" data-action="toggleEvidenceMore">Show more</button>'
            : ''
        }
      </details>
    </div>

    <div class="card">
      <h3>Details</h3>
      <div class="details-markdown">${detailsHtml}</div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const hostActions = new Set([
        'fixSummary',
        'checkpointKeep',
        'checkpointClear',
        'sessionAddCheckpoint',
        'copyNextSteps',
        'copySummary',
        'copyPromptAndOpenCodex',
        'refreshSummary',
        'toggleAutoSummaries',
        'openPrivacySafety',
        'rateHelpfulness',
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
        'restoreCopyFailingCommand'
      ]);

      function parseDatasetInteger(rawValue) {
        if (typeof rawValue !== 'string') {
          return undefined;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
          return undefined;
        }
        return parsed;
      }

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const actionElement = target.closest('[data-action]');
        if (actionElement instanceof HTMLElement) {
          event.preventDefault();
          const action = actionElement.dataset.action;
          if (typeof action !== 'string' || !action) {
            vscode.postMessage({ type: 'blockedLink' });
            return;
          }

          if (action === 'toggleEvidenceMore') {
            const list = document.getElementById('evidence-list');
            if (list) {
              const expanded = list.classList.toggle('show-more');
              actionElement.textContent = expanded ? 'Show less' : 'Show more';
            }
            return;
          }

          if (action === 'toggleTimeline') {
            const timeline = document.getElementById('timeline-content');
            if (timeline) {
              const isHidden = timeline.hasAttribute('hidden');
              if (isHidden) {
                timeline.removeAttribute('hidden');
                actionElement.textContent = 'Hide timeline';
                actionElement.setAttribute('aria-expanded', 'true');
              } else {
                timeline.setAttribute('hidden', 'true');
                actionElement.textContent = 'Show timeline';
                actionElement.setAttribute('aria-expanded', 'false');
              }
            }
            return;
          }

          if (action === 'openEvidence') {
            const evidenceId = actionElement.dataset.evidenceId?.trim();
            if (!evidenceId) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openEvidence', evidenceId });
            return;
          }

          if (action === 'openLink') {
            const index = parseDatasetInteger(actionElement.dataset.linkIndex);
            if (index === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openLink', index });
            return;
          }

          if (action === 'openTopFile') {
            const index = parseDatasetInteger(actionElement.dataset.topFileIndex);
            if (index === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'openTopFile', index });
            return;
          }

          if (action === 'runNextStepAction') {
            const stepIndex = parseDatasetInteger(actionElement.dataset.stepIndex);
            if (stepIndex === undefined) {
              vscode.postMessage({ type: 'blockedLink' });
              return;
            }
            vscode.postMessage({ type: 'runNextStepAction', stepIndex });
            return;
          }

          if (hostActions.has(action)) {
            vscode.postMessage({ type: action });
            return;
          }

          vscode.postMessage({ type: 'blockedLink' });
          return;
        }

        const anchor = target.closest('a');
        if (anchor) {
          event.preventDefault();
          vscode.postMessage({ type: 'blockedLink' });
        }
      });
    </script>
  </body>
</html>`;
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

function renderStepEvidenceBadge(evidenceId: string, evidence?: SummaryEvidenceItem): string {
  if (!evidence) {
    return `<span class="badge">${escapeHtml(evidenceId)}</span>`;
  }

  const label = `[${evidence.kind}] ${evidence.label}`;
  if (evidence.kind === 'file' || evidence.kind === 'url') {
    return `<a href="#" class="badge clickable kind-${escapeHtml(evidence.kind)}" data-action="openEvidence" data-evidence-id="${escapeHtml(evidenceId)}">${escapeHtml(label)}</a>`;
  }

  return `<span class="badge">${escapeHtml(label)}</span>`;
}

function markMeaningfulActivity(): void {
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
  await vscode.env.clipboard.writeText(summary.codexPrompt);
  const openedCommand = await tryOpenCodexPanel(getConfig());

  if (openedCommand) {
    void vscode.window.showInformationMessage(
      `TaCoS: prompt copied and opened Codex via \`${openedCommand}\`.`,
    );
    return;
  }

  await vscode.commands.executeCommand('workbench.action.quickOpen', '>Codex');
  void vscode.window.showWarningMessage(
    'TaCoS: prompt copied. Set `tacos.codexOpenCommand` to your Codex panel command id for one-click opening.',
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

async function generateStandupUpdateCommand(context: vscode.ExtensionContext): Promise<void> {
  const root = pickWorkspaceRoot();
  if (!root) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const cached = context.workspaceState.get<ResumeSummary>(summaryCacheKey(root));
  const summary = cached ?? (await generateSummary(context, root, 'manual')).summary;
  const standup = buildStandupUpdate(summary, path.basename(root), Date.now());
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
    nextValue
      ? 'TaCoS: restore search query saved.'
      : 'TaCoS: restore search query cleared.',
  );
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
    context.workspaceState.get<ResumeSummary>(summaryCacheKey(workspaceRoot));
  if (!summary) {
    void vscode.window.showInformationMessage('TaCoS: no summary context available to restore yet.');
    return;
  }

  const filesToOpen = uniqueStrings([...(summary.recentFilesSnapshot ?? []), ...summary.topFiles]).slice(
    0,
    6,
  );
  const diffTarget = summary.topFiles[0];
  const terminalCwd = state.lastTerminalCwd?.trim() || undefined;
  const searchQuery = readPersistedRestoreSearchQuery(context, workspaceRoot);
  const preview = [
    `files: ${filesToOpen.length}`,
    `diff target: ${diffTarget ? 'yes' : 'none'}`,
    `terminal cwd: ${terminalCwd ? terminalCwd : 'none'}`,
    `search query: ${searchQuery ? 'yes' : 'none'}`,
  ].join(' • ');

  const choice = await vscode.window.showInformationMessage(
    `TaCoS restore preview (${preview})`,
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

  let openedTerminal = false;
  if (terminalCwd) {
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

  let restoredSearch = false;
  if (searchQuery) {
    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query: searchQuery,
      triggerSearch: true,
    });
    restoredSearch = true;
  }

  void vscode.window.showInformationMessage(
    `TaCoS: restored ${openedFiles} files${openedDiff ? ', diff target' : ''}${openedTerminal ? ', terminal cwd' : ''}${restoredSearch ? ', and search query' : ''}. Missing resources were skipped safely.`,
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
  const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
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
      if (!top || diagnosticSeverityRank(candidate.severity) < diagnosticSeverityRank(top.severity)) {
        top = candidate;
      }
    }
  }

  return { errorCount, warningCount, top };
}

async function openProblemsView(): Promise<void> {
  await vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function openPrimaryDiagnosticFile(preferredWorkspaceRoot?: string): Promise<void> {
  const diagnostics = collectWorkspaceDiagnostics(preferredWorkspaceRoot);
  if (!diagnostics.top) {
    void vscode.window.showInformationMessage('TaCoS: no active diagnostics are available.');
    return;
  }

  const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage(
      'TaCoS blocked diagnostic navigation because no workspace root is available.',
    );
    return;
  }

  if (!isPathWithinWorkspaceRoot(workspaceRoot, diagnostics.top.absolutePath)) {
    void vscode.window.showWarningMessage('TaCoS blocked an unsafe diagnostic file target.');
    return;
  }

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(diagnostics.top.absolutePath));
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false,
  });
  const position = new vscode.Position(diagnostics.top.line, diagnostics.top.character);
  const range = new vscode.Range(position, position);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

async function runNextStepAction(
  summary: ResumeSummary,
  stepIndex: number,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= summary.nextSteps.length) {
    void vscode.window.showWarningMessage('TaCoS blocked an invalid next-step action target.');
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
  const actions = buildNextStepActions({
    summary,
    canRerunTask: availability.canRerunTask,
    canRerunDebug: availability.canRerunDebug,
    canCopyFailingCommand: availability.canCopyFailingCommand,
  });
  const action = actions[stepIndex];
  if (!action) {
    void vscode.window.showInformationMessage(
      'TaCoS: this step has no verified clickable action yet. Use evidence links to continue.',
    );
    return;
  }

  const evidence = (summary.evidenceCatalog ?? []).find((item) => item.id === action.evidenceId);
  if (!evidence) {
    void vscode.window.showWarningMessage('TaCoS blocked a stale next-step action.');
    return;
  }

  if (action.kind === 'copyFailingCommand') {
    await copyFailingCommand();
    return;
  }

  if (action.kind === 'rerunTask') {
    await rerunLastTask();
    return;
  }

  if (action.kind === 'rerunDebug') {
    await rerunLastDebugSession();
    return;
  }

  if (action.kind === 'openFile') {
    const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage(
        'TaCoS blocked file action because no workspace root is available for validation.',
      );
      return;
    }

    const safeTarget = resolveFileTargetInWorkspace(evidence.target ?? '', workspaceRoot);
    if (!safeTarget || !isPathWithinWorkspaceRoot(workspaceRoot, safeTarget)) {
      void vscode.window.showWarningMessage('TaCoS blocked an unsafe next-step file target.');
      return;
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
    return;
  }

  if (action.kind === 'openUrl') {
    const safeUrl = normalizeHttpUrl(evidence.target ?? '');
    if (!safeUrl) {
      void vscode.window.showWarningMessage('TaCoS blocked an unsafe next-step URL.');
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
  }
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
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
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
  const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
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
  const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
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
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  if (!workspaceRoot) {
    return;
  }

  const taskName = state.lastTaskName?.trim();
  if (!taskName || !Number.isInteger(state.lastTaskExitCode) || !Number.isFinite(state.lastTaskEndedAt)) {
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

async function rerunLastTask(): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('TaCoS: rerun task is disabled in Restricted Mode.');
    return;
  }

  if (!state.lastTaskName) {
    void vscode.window.showInformationMessage(
      'TaCoS: no recent VS Code task is available to rerun.',
    );
    return;
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
    void vscode.window.showWarningMessage(
      `TaCoS: could not find task "${state.lastTaskName}" to rerun.`,
    );
    return;
  }

  await vscode.tasks.executeTask(match);
  void vscode.window.showInformationMessage(`TaCoS: reran task "${state.lastTaskName}".`);
}

async function rerunLastDebugSession(): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('TaCoS: rerun debug is disabled in Restricted Mode.');
    return;
  }

  if (!state.lastDebugConfigName) {
    void vscode.window.showInformationMessage('TaCoS: no recent debug configuration is available.');
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.find(
    (entry) => entry.uri.fsPath === state.lastDebugWorkspaceRoot,
  );
  const started = await vscode.debug.startDebugging(folder, state.lastDebugConfigName);
  if (!started) {
    void vscode.window.showWarningMessage(
      `TaCoS: failed to start debug configuration "${state.lastDebugConfigName}".`,
    );
    return;
  }

  void vscode.window.showInformationMessage(
    `TaCoS: started debug configuration "${state.lastDebugConfigName}".`,
  );
}

async function checkoutPreviousBranch(
  summary: ResumeSummary | undefined,
  preferredWorkspaceRoot?: string,
): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('TaCoS: checkout branch is disabled in Restricted Mode.');
    return;
  }

  const previousBranch = summary?.previousBranch?.trim() ?? '';
  const currentBranch = summary?.currentBranch?.trim() ?? '';
  if (!previousBranch || !currentBranch || previousBranch === currentBranch) {
    void vscode.window.showInformationMessage(
      'TaCoS: no previous branch is available to checkout.',
    );
    return;
  }

  const workspaceRoot = preferredWorkspaceRoot ?? pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showWarningMessage('TaCoS: open a workspace folder to checkout a branch.');
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Checkout previous branch "${previousBranch}"?`,
    { modal: true },
    'Checkout',
  );
  if (choice !== 'Checkout') {
    return;
  }

  try {
    await execFileAsync('git', ['-C', workspaceRoot, 'checkout', previousBranch], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    void vscode.window.showInformationMessage(`TaCoS: checked out "${previousBranch}".`);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `TaCoS: failed to checkout "${previousBranch}": ${(error as Error).message}`,
    );
  }
}

async function copyFailingCommand(): Promise<void> {
  const command = getCopyableFailingCommand();
  if (!command) {
    void vscode.window.showInformationMessage(
      'TaCoS: no copyable failing command is available (raw commands are not persisted).',
    );
    return;
  }

  await vscode.env.clipboard.writeText(command);
  void vscode.window.showInformationMessage('TaCoS: failing command copied to clipboard.');
}

function getCopyableFailingCommand(): string | undefined {
  const raw = state.lastFailingCommandRaw?.trim();
  return raw || undefined;
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
  const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
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
      config.update('includeDebugHistory', profile.includeDebugHistory, vscode.ConfigurationTarget.Global),
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
  resetRuntimeWorkspaceState();
  rerenderPanel();
  updateCompanionStatusBar();
  void vscode.window.showInformationMessage('TaCoS: forgot workspace-scoped data.');
}

function aiPayloadConsentKey(workspaceRoot: string): string {
  return `${KEY_AI_PAYLOAD_CONSENT_PREFIX}.${Buffer.from(workspaceRoot).toString('base64url')}`;
}

function hasAiPayloadConsent(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): boolean {
  return context.workspaceState.get<boolean>(aiPayloadConsentKey(workspaceRoot), false);
}

async function setAiPayloadConsent(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  allowed: boolean,
): Promise<void> {
  await context.workspaceState.update(aiPayloadConsentKey(workspaceRoot), allowed ? true : undefined);
}

async function revokeAiPayloadConsent(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = pickWorkspaceRoot();
  if (!workspaceRoot) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  await setAiPayloadConsent(context, workspaceRoot, false);
  void vscode.window.showInformationMessage('TaCoS: AI payload consent revoked for this workspace.');
}

async function ensureAiPayloadConsent(
  context: vscode.ExtensionContext,
  prepared: PreparedTriggerSummary,
): Promise<boolean> {
  if (hasAiPayloadConsent(context, prepared.root)) {
    return true;
  }

  const previewMarkdown = buildAiPayloadPreviewMarkdown({
    provider: prepared.providerPlan.activeProvider,
    workspaceName: path.basename(prepared.root),
    generatedAt: Date.now(),
    signals: prepared.signals,
    summary: {
      intent: prepared.localSummary.intent,
      nextSteps: prepared.localSummary.nextSteps,
      topFiles: prepared.localSummary.topFiles,
      links: prepared.localSummary.links,
      evidenceCatalog: prepared.localSummary.evidenceCatalog,
    },
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

  if (picked.id === 'always') {
    await setAiPayloadConsent(context, prepared.root, true);
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

function pickWorkspaceRoot(): string | undefined {
  const active = vscode.window.activeTextEditor?.document?.uri;
  if (active) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(active);
    if (workspaceFolder) {
      return workspaceFolder.uri.fsPath;
    }
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
    failingCommand,
    doneItems: redactList(state.doneItems.values(), root, customPatterns),
  };
}

function summaryCacheKey(root: string): string {
  return `tacos.summary.${Buffer.from(root).toString('base64url')}`;
}

function branchStateKey(root: string): string {
  return `tacos.branch.${Buffer.from(root).toString('base64url')}`;
}

function autoTriggerFingerprintKey(root: string): string {
  return `${KEY_LAST_AUTO_TRIGGER_FINGERPRINT}.${Buffer.from(root).toString('base64url')}`;
}

function workspaceActivityKey(root: string): string {
  return `${KEY_WORKSPACE_ACTIVITY_AT_PREFIX}.${Buffer.from(root).toString('base64url')}`;
}

async function touchWorkspaceActivity(
  context: vscode.ExtensionContext,
  workspaceRoot?: string,
): Promise<void> {
  const root = workspaceRoot ?? pickWorkspaceRoot();
  if (!root) {
    return;
  }

  await context.workspaceState.update(workspaceActivityKey(root), Date.now());
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
    if (key === KEY_LAST_SUMMARY_AT || key === KEY_LAST_BLUR_AT || key === KEY_LAST_WORKSPACE_ON_BLUR) {
      return true;
    }

    if (key === KEY_SUMMARY_SNOOZE_UNTIL) {
      return true;
    }

    if (key === KEY_METRIC_HISTORY) {
      return true;
    }

    return (
      matchesEncodedWorkspaceKey(key, 'tacos.summary', workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, 'tacos.branch', workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_AUTO_TRIGGER_FINGERPRINT, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_RECENT_EDIT_LOCATIONS_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_TASK_META_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_TERMINAL_CWD_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_RESTORE_SEARCH_QUERY_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_SUMMARY_CORRECTIONS_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_LAST_NUDGE_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_WORKSPACE_ACTIVITY_AT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_AI_PAYLOAD_CONSENT_PREFIX, workspaceRoot, false) ||
      matchesEncodedWorkspaceKey(key, KEY_ACTIVITY_STORAGE_PREFIX, workspaceRoot, true) ||
      matchesEncodedWorkspaceKey(key, 'tacos.checkpointNote', workspaceRoot, false)
    );
  });
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
  state.snoozeUntil = 0;
  state.displayedCheckpointNote = undefined;
  state.activeNudges = undefined;
  state.scratchSummary = undefined;
  if (state.panel) {
    state.panel.dispose();
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
  if (lastActivityAt > 0 && lastActivityAt < cutoffAt) {
    await clearWorkspaceScopedState(context, workspaceRoot);
    resetRuntimeWorkspaceState();
    return;
  }

  const recentEditLocations = readRecentEditLocations(context, workspaceRoot);
  const prunedEditLocations = recentEditLocations.filter((entry) => entry.timestamp >= cutoffAt);
  if (prunedEditLocations.length !== recentEditLocations.length) {
    await context.workspaceState.update(recentEditLocationsStorageKey(workspaceRoot), prunedEditLocations);
    if ((state.panelWorkspaceRoot ?? pickWorkspaceRoot()) === workspaceRoot) {
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

  const cachedSummary = context.workspaceState.get<ResumeSummary | undefined>(summaryCacheKey(workspaceRoot));
  if (cachedSummary && cachedSummary.generatedAt < cutoffAt) {
    await context.workspaceState.update(summaryCacheKey(workspaceRoot), undefined);
  }

  const metricHistory = context.workspaceState.get<MetricRecord[]>(KEY_METRIC_HISTORY, []);
  const prunedMetrics = metricHistory.filter((metric) => metric.startedAt >= cutoffAt);
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

function getCheckpointNote(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): string | undefined {
  return context.workspaceState.get<string>(checkpointStorageKey(workspaceRoot));
}

async function clearCheckpointNote(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): Promise<void> {
  await context.workspaceState.update(checkpointStorageKey(workspaceRoot), undefined);
  if (state.displayedCheckpointNote?.workspaceRoot === workspaceRoot) {
    state.displayedCheckpointNote = undefined;
  }
}

interface CheckpointPromptOptions {
  title?: string;
  prompt?: string;
  placeHolder?: string;
  initialValue?: string;
  successMessage?: string;
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

  const sanitized = sanitizeCheckpointNote(note, workspaceRoot, getConfig().redactionPatterns);
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: note was empty after sanitization and was not saved.',
    );
    return false;
  }

  await context.workspaceState.update(checkpointStorageKey(workspaceRoot), sanitized);
  void vscode.window.showInformationMessage(
    options.successMessage ?? 'TaCoS: checkpoint note saved for this workspace.',
  );
  return true;
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

  const root = workspaceRoot ?? pickWorkspaceRoot();
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

  const sanitized = sanitizeCheckpointNote(note, root, config.redactionPatterns);
  if (!sanitized) {
    void vscode.window.showWarningMessage(
      'TaCoS: note was empty after sanitization and was not saved.',
    );
    state.meaningfulActivitySinceCheckpointPrompt = false;
    return;
  }

  await context.workspaceState.update(checkpointStorageKey(root), sanitized);
  state.meaningfulActivitySinceCheckpointPrompt = false;
  void vscode.window.showInformationMessage('TaCoS: checkpoint note saved for this workspace.');
}

async function maybeShowOnboardingNotice(context: vscode.ExtensionContext): Promise<void> {
  const shown = context.globalState.get<boolean>(KEY_ONBOARDING_NOTICE_SHOWN, false);
  if (shown) {
    return;
  }

  await context.globalState.update(KEY_ONBOARDING_NOTICE_SHOWN, true);
  const action = await vscode.window.showInformationMessage(
    'TaCoS collects local editor/git/terminal context. AI receives redacted context only when an AI provider is enabled.',
    'Open Privacy & Safety',
    'Pause Auto Summaries',
  );
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
  const candidates = ['docs/privacy-safety.md', 'README.md', 'readme.md'];
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
  const branch = context.workspaceState.get<string>(branchStateKey(workspaceRoot), '').trim();
  const scope = branch ? `${workspaceRoot}::${branch}` : workspaceRoot;
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
  if (!snapshot.usedLegacyGlobalState && !didPersistedActivityChange(snapshot.raw, snapshot.sanitized)) {
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
