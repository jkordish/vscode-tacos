import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import {
  persistTerminalCommandForStorage,
  sanitizeActivityForPersistence,
  type PersistedActivityState,
} from './activityPersistence';
import { checkpointStorageKey, sanitizeCheckpointNote } from './checkpoint';
import { decideEditActivity } from './editActivity';
import { isSummaryLinkEvidenceGrounded } from './evidenceSafety';
import { collectGit, parsePorcelainPaths } from './git';
import { tryGenerateOpenAiSummary } from './llm';
import { shouldAutoTriggerSummary, shouldPromptCheckpointOnBlur } from './noiseControl';
import {
  isPathWithinWorkspaceRoot,
  normalizeHttpUrl,
  resolveFileTargetInWorkspace,
} from './pathSafety';
import { redactList, redactText } from './redaction';
import { isRefinementActiveForSummary } from './refinement';
import { computeRestoreAvailability } from './restoreSafety';
import { buildResumeSummary } from './summary';
import { buildTimelineGroups } from './timeline';
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

const KEY_RECENT_FILES = 'tacos.recentFiles';
const KEY_RECENT_TERMINAL = 'tacos.recentTerminal';
const KEY_RECENT_DEBUG = 'tacos.recentDebug';
const KEY_RECENT_URLS = 'tacos.recentUrls';
const KEY_DONE_ITEMS = 'tacos.doneItems';
const KEY_LAST_FAILING_COMMAND = 'tacos.lastFailingCommand';
const KEY_RESTRICTED_MODE_NOTICE_SHOWN = 'tacos.restrictedModeNoticeShown';
const KEY_SUMMARY_CORRECTIONS_PREFIX = 'tacos.summaryCorrections';
const KEY_VSCODE_LM_SELECTOR = 'tacos.vscodeLmSelector';
const KEY_ONBOARDING_NOTICE_SHOWN = 'tacos.onboardingNoticeShown';
const KEY_LAST_CHECKPOINT_PROMPT_AT_PREFIX = 'tacos.lastCheckpointPromptAt';
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
  recentTerminal: RingBuffer;
  recentDebug: RingBuffer;
  recentUrls: RingBuffer;
  doneItems: RingBuffer;
  lastFailingCommand?: string;
  lastFailingCommandRaw?: string;
  scratchSummary?: ResumeSummary;
  panel?: vscode.WebviewPanel;
  panelSummary?: ResumeSummary;
  panelWorkspaceRoot?: string;
  displayedCheckpointNote?: { workspaceRoot: string; value: string; persisted: boolean };
  lastTaskName?: string;
  lastTaskWorkspaceRoot?: string;
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
  vscodeLmModel?: VscodeLmModelLike;
  vscodeLmSelector?: VscodeLmModelSelector;
  vscodeLmUnavailableNotified: boolean;
}

let state: RuntimeState;

interface PresentSummaryOptions {
  autoOpenDetails?: boolean;
  workspaceRoot?: string;
  checkpointNote?: string;
}

export function activate(context: vscode.ExtensionContext): void {
  const persistedActivity = loadPersistedActivitySnapshot(context);
  state = {
    output: vscode.window.createOutputChannel('TaCoS'),
    recentFiles: new RingBuffer(15, persistedActivity.sanitized.recentFiles),
    recentTerminal: new RingBuffer(15, persistedActivity.sanitized.recentTerminal),
    recentDebug: new RingBuffer(10, persistedActivity.sanitized.recentDebug),
    recentUrls: new RingBuffer(5, persistedActivity.sanitized.recentUrls),
    doneItems: new RingBuffer(10, persistedActivity.sanitized.doneItems),
    lastFailingCommand: persistedActivity.sanitized.lastFailingCommand,
    lastFailingCommandRaw: undefined,
    scratchSummary: undefined,
    workspaceTrusted: vscode.workspace.isTrusted,
    terminalHooks: [],
    refinementSequence: 0,
    activeRefinementContextHash: undefined,
    autoSummaryInFlight: false,
    lastAutoFocusTriggerAt: 0,
    meaningfulActivitySinceCheckpointPrompt: false,
    pauseUntilRestart: false,
    vscodeLmSelector: context.globalState.get<VscodeLmModelSelector | undefined>(
      KEY_VSCODE_LM_SELECTOR,
    ),
    vscodeLmUnavailableNotified: false,
  };

  context.subscriptions.push(state.output);
  void migrateLegacyPersistedActivityIfNeeded(context, persistedActivity);

  context.subscriptions.push(
    vscode.commands.registerCommand('tacos.showNow', async () => {
      await triggerSummary(context, 'manual');
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
    vscode.commands.registerCommand('tacos.pauseSummaries', async () => {
      await setPaused(true);
      void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
    }),
    vscode.commands.registerCommand('tacos.resumeSummaries', async () => {
      await setPaused(false);
      void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
    }),
    vscode.commands.registerCommand('tacos.toggleEnabled', async () => {
      const config = getConfig();
      await setEnabled(!config.enabled);
      void vscode.window.showInformationMessage(
        !config.enabled
          ? 'TaCoS: automatic summaries enabled.'
          : 'TaCoS: automatic summaries disabled.',
      );
    }),
    vscode.commands.registerCommand('tacos.pauseUntilRestart', async () => {
      state.pauseUntilRestart = true;
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

      const note = await vscode.window.showInputBox({
        title: 'TaCoS: Add Checkpoint Note',
        prompt: 'One-line next step for future you',
        placeHolder: 'Example: Fix failing parser test and rerun npm test',
        ignoreFocusOut: true,
      });
      if (!note) {
        return;
      }

      const sanitized = sanitizeCheckpointNote(note, root, getConfig().redactionPatterns);
      if (!sanitized) {
        void vscode.window.showWarningMessage(
          'TaCoS: note was empty after sanitization and was not saved.',
        );
        return;
      }

      await context.workspaceState.update(checkpointStorageKey(root), sanitized);
      void vscode.window.showInformationMessage('TaCoS: checkpoint note saved for this workspace.');
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
      const outputPath = path.join(outputDir, 'metrics.json');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2), 'utf8');
      void vscode.window.showInformationMessage(`TaCoS: Exported metrics to ${outputPath}`);
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
      state.lastTaskName = task.name;
      state.lastTaskWorkspaceRoot =
        task.scope && typeof task.scope === 'object' && 'uri' in task.scope
          ? task.scope.uri.fsPath
          : pickWorkspaceRoot();
      markMeaningfulActivity();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const decision = decideEditActivity({
        documentScheme: event.document.uri.scheme,
        hasMeaningfulChange: isMeaningfulChange(event.contentChanges),
        hasMetricSession: Boolean(state.metricSession),
        hasCapturedFirstMeaningfulEdit: state.metricSession?.firstMeaningfulEditLagMs !== undefined,
      });
      if (!decision.shouldMarkMeaningfulActivity) {
        return;
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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        !event.affectsConfiguration('tacos.enabled') &&
        !event.affectsConfiguration('tacos.pauseSummaries') &&
        !event.affectsConfiguration('tacos.showTimeline')
      ) {
        return;
      }

      rerenderPanel();
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
    state.recentTerminal.push(sanitizedCommand);
    markMeaningfulActivity();
    for (const url of extractUrls(command)) {
      state.recentUrls.push(url);
    }

    if (
      isTestOrBuildCommand(command) &&
      state.metricSession &&
      state.metricSession.firstRunLagMs === undefined
    ) {
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

    if (typeof exitCode === 'number' && exitCode !== 0 && isTestOrBuildCommand(command)) {
      state.lastFailingCommandRaw = command;
      state.lastFailingCommand = sanitizedCommand;
      await persistActivity(context);
    }

    if (typeof exitCode === 'number' && exitCode === 0 && isTestOrBuildCommand(command)) {
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

  clearTerminalHooks();
  if (isTrusted) {
    state.terminalHooks = registerTerminalHooks(context);
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

  if (config.metricsEnabled) {
    await finalizeCurrentMetric(context);
    const root = pickWorkspaceRoot() ?? '';
    state.metricSession = {
      startedAt: Date.now(),
      workspaceRoot: root,
      trigger: triggerReason,
    };
  }

  updateSummaryScratchpad(summary, options.workspaceRoot);

  if (options.autoOpenDetails) {
    await showDetailsPanel(context, summary, options);
    return;
  }

  if (config.autoRefreshInBackground) {
    const statusMessage = state.panel
      ? `TaCoS (${summary.source}): summary refreshed in details panel.`
      : `TaCoS (${summary.source}): summary refreshed in background scratch pad.`;
    void vscode.window.setStatusBarMessage(statusMessage, 3500);
    return;
  }

  const actionPauseLabel = config.pauseSummaries ? 'Resume auto summaries' : 'Pause auto summaries';
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
    await showDetailsPanel(context, summary, options);
    return;
  }

  if (choice === 'Copy prompt for Codex') {
    await vscode.env.clipboard.writeText(summary.codexPrompt);
    void vscode.window.showInformationMessage('TaCoS: Codex-ready prompt copied to clipboard.');
    return;
  }

  if (choice === 'Copy + Open Codex') {
    await copyPromptAndOpenCodex(summary);
    return;
  }

  if (choice === 'Copy next steps') {
    await vscode.env.clipboard.writeText(
      summary.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    );
    void vscode.window.showInformationMessage('TaCoS: next steps copied to clipboard.');
    return;
  }

  if (choice === 'Copy summary') {
    await vscode.env.clipboard.writeText(formatPlainSummary(summary));
    void vscode.window.showInformationMessage('TaCoS: summary copied to clipboard.');
    return;
  }

  if (choice === actionPauseLabel) {
    await setPaused(!config.pauseSummaries);
    void vscode.window.showInformationMessage(
      !config.pauseSummaries ? 'TaCoS: auto summaries paused.' : 'TaCoS: auto summaries resumed.',
    );
  }
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

      if (message.type === 'copyNextSteps') {
        if (!state.panelSummary) {
          return;
        }

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

        await vscode.env.clipboard.writeText(formatPlainSummary(state.panelSummary));
        void vscode.window.showInformationMessage('TaCoS: summary copied to clipboard.');
        return;
      }

      if (message.type === 'copyPromptAndOpenCodex') {
        if (!state.panelSummary) {
          return;
        }

        await copyPromptAndOpenCodex(state.panelSummary);
        return;
      }

      if (message.type === 'refreshSummary') {
        const workspaceRoot = state.panelWorkspaceRoot ?? pickWorkspaceRoot();
        if (!workspaceRoot) {
          void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
          return;
        }

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

        const wasPaused = config.pauseSummaries || state.pauseUntilRestart;
        if (wasPaused) {
          state.pauseUntilRestart = false;
          await setPaused(false);
          void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
        } else {
          await setPaused(true);
          void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
        }

        rerenderPanel();
        return;
      }

      if (message.type === 'blockedLink') {
        void vscode.window.showWarningMessage(
          'TaCoS blocked a link that was not part of the validated summary link list.',
        );
        return;
      }

      if (message.type === 'restoreReopenFiles') {
        const opened = await reopenSummaryFiles(state.panelSummary, 6, state.panelWorkspaceRoot);
        if (opened === 0) {
          void vscode.window.showInformationMessage('TaCoS: no recent files available to reopen.');
        }
        return;
      }

      if (message.type === 'restoreOpenChangedFiles') {
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
        await rerunLastTask();
        return;
      }

      if (message.type === 'restoreRerunDebug') {
        await rerunLastDebugSession();
        return;
      }

      if (message.type === 'restoreCheckoutPreviousBranch') {
        await checkoutPreviousBranch(state.panelSummary, state.panelWorkspaceRoot);
        return;
      }

      if (message.type === 'restoreCopyFailingCommand') {
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

          await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(safeTarget));
          return;
        }

        const safeUrl = normalizeHttpUrl(evidence.target ?? '');
        if (!safeUrl) {
          void vscode.window.showWarningMessage('TaCoS blocked an unsafe evidence URL.');
          return;
        }

        await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
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

        await vscode.env.openExternal(vscode.Uri.parse(safeUrl));
      }
    });
  }

  rerenderPanel();
  state.panel.reveal(vscode.ViewColumn.Beside, true);
}

function updateSummaryScratchpad(summary: ResumeSummary, workspaceRoot?: string): void {
  state.scratchSummary = summary;

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
  const linkItems = summary.links
    .map(
      (link, index) =>
        `<li><a href="#" data-action="openLink" data-link-index="${index}">${escapeHtml(link.label)}</a> <span class="kind">(${escapeHtml(link.kind)})</span></li>`,
    )
    .join('');

  const nextSteps = summary.nextSteps
    .map((step, index) => {
      const evidenceIds = summary.nextStepEvidenceIds?.[index] ?? [];
      const badges = evidenceIds
        .map((evidenceId) => renderStepEvidenceBadge(evidenceId, evidenceById.get(evidenceId)))
        .join('');
      const badgeRow = badges ? `<div class="step-evidence">${badges}</div>` : '';
      return `<li>${escapeHtml(step)}${badgeRow}</li>`;
    })
    .join('');
  const topFiles = summary.topFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join('');
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
  const mode = summary.mode ?? 'coding';
  const trusted = vscode.workspace.isTrusted;
  const availability = computeRestoreAvailability({
    trusted,
    hasLastTask: Boolean(state.lastTaskName),
    hasLastDebug: Boolean(state.lastDebugConfigName),
    hasFailingCommand: Boolean(getCopyableFailingCommand()),
    currentBranch: summary.currentBranch,
    previousBranch: summary.previousBranch,
  });
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

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${cspMetaTag}
    <style nonce="${nonce}">
      body {
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        padding: 16px;
      }
      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 14px;
        background: var(--vscode-editorWidget-background);
      }
      ul {
        padding-left: 20px;
      }
      h3 {
        margin-top: 0;
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
        font-weight: 600;
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
        color: var(--vscode-descriptionForeground);
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

    ${checkpointCard}
    <div class="card">
      <h3>Intent</h3>
      <p>${escapeHtml(summary.intent)}</p>
      <p class="mode">Mode: ${escapeHtml(mode)}</p>
    </div>

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
        <button type="button" data-action="copyPromptAndOpenCodex">Copy prompt + open Codex</button>
      </div>
    </div>

    <div class="card">
      <h3>Restore Pack</h3>
      <div class="restore-grid">
        <button type="button" data-action="restoreReopenFiles">Reopen files</button>
        <button type="button" data-action="restoreOpenChangedFiles">Open changed files</button>
        <button type="button" data-action="restoreRerunTask" ${availability.canRerunTask ? '' : 'disabled'}>Rerun last task</button>
        <button type="button" data-action="restoreRerunDebug" ${availability.canRerunDebug ? '' : 'disabled'}>Rerun debug config</button>
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
        'copyNextSteps',
        'copySummary',
        'copyPromptAndOpenCodex',
        'refreshSummary',
        'toggleAutoSummaries',
        'restoreReopenFiles',
        'restoreOpenChangedFiles',
        'restoreRerunTask',
        'restoreRerunDebug',
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

function taskWorkspaceRoot(task: vscode.Task): string | undefined {
  const scope = task.scope;
  if (scope && typeof scope === 'object' && 'uri' in scope) {
    return scope.uri.fsPath;
  }

  return undefined;
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
  const knownSet = new Set(knownCommands);

  const configured = config.codexOpenCommand.trim();
  const builtInCandidates = [
    // Official OpenAI Codex extension commands.
    'chatgpt.openSidebar',
    'chatgpt.newCodexPanel',
    'chatgpt.newChat',

    'openai.codex.open',
    'openai.codex.openPanel',
    'openai.codex.focus',
    'openai.codex.showPanel',
    'codex.open',
    'codex.focus',
    'codex.show',
    'codex.openPanel',
  ];

  const inferredCandidates = knownCommands
    .filter((id) => /codex/i.test(id))
    .filter((id) => /(open|show|focus|panel|view)/i.test(id))
    .slice(0, 12);

  const candidates = uniqueStrings([
    configured,
    ...builtInCandidates,
    ...inferredCandidates,
  ]).filter((id) => knownSet.has(id));

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
}

async function setEnabled(value: boolean): Promise<void> {
  const scope = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await vscode.workspace.getConfiguration('tacos').update('enabled', value, scope);
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
    includeDiff: config.get<boolean>('includeDiff', false),
    maxDiffChars: config.get<number>('maxDiffChars', 6000),
    includeTerminalHistory: config.get<boolean>('includeTerminalHistory', true),
    includeDebugHistory: config.get<boolean>('includeDebugHistory', true),
    cacheIfContextUnchanged: config.get<boolean>('cacheIfContextUnchanged', true),
    redactionPatterns: config.get<string[]>('redactionPatterns', []),
    metricsEnabled: config.get<boolean>('metricsEnabled', true),
    autoRefreshInBackground: config.get<boolean>('autoRefreshInBackground', true),
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
  );
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

function loadPersistedActivitySnapshot(
  context: vscode.ExtensionContext,
): PersistedActivitySnapshot {
  const raw: PersistedActivityState = {
    recentFiles: getPersistedStringArray(context, KEY_RECENT_FILES),
    recentTerminal: getPersistedStringArray(context, KEY_RECENT_TERMINAL),
    recentDebug: getPersistedStringArray(context, KEY_RECENT_DEBUG),
    recentUrls: getPersistedStringArray(context, KEY_RECENT_URLS),
    doneItems: getPersistedStringArray(context, KEY_DONE_ITEMS),
    lastFailingCommand: context.globalState.get<string>(KEY_LAST_FAILING_COMMAND),
  };

  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const sanitized = sanitizeActivityForPersistence(raw, workspaceRoot, config.redactionPatterns);
  return { raw, sanitized };
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
  if (!didPersistedActivityChange(snapshot.raw, snapshot.sanitized)) {
    return;
  }

  await Promise.all([
    context.globalState.update(KEY_RECENT_FILES, snapshot.sanitized.recentFiles),
    context.globalState.update(KEY_RECENT_TERMINAL, snapshot.sanitized.recentTerminal),
    context.globalState.update(KEY_RECENT_DEBUG, snapshot.sanitized.recentDebug),
    context.globalState.update(KEY_RECENT_URLS, snapshot.sanitized.recentUrls),
    context.globalState.update(KEY_DONE_ITEMS, snapshot.sanitized.doneItems),
    context.globalState.update(KEY_LAST_FAILING_COMMAND, snapshot.sanitized.lastFailingCommand),
  ]);

  state.output.appendLine('TaCoS: migrated legacy persisted activity to sanitized storage.');
}

// SECURITY INVARIANT:
// ONLY this function may persist activity-derived string keys:
// KEY_RECENT_FILES, KEY_RECENT_TERMINAL, KEY_RECENT_DEBUG, KEY_RECENT_URLS, KEY_DONE_ITEMS, KEY_LAST_FAILING_COMMAND.
// It must redact before writing to storage.
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

  await Promise.all([
    context.globalState.update(KEY_RECENT_FILES, persisted.recentFiles),
    context.globalState.update(KEY_RECENT_TERMINAL, persisted.recentTerminal),
    context.globalState.update(KEY_RECENT_DEBUG, persisted.recentDebug),
    context.globalState.update(KEY_RECENT_URLS, persisted.recentUrls),
    context.globalState.update(KEY_DONE_ITEMS, persisted.doneItems),
    context.globalState.update(KEY_LAST_FAILING_COMMAND, persisted.lastFailingCommand),
  ]);
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

  const hasAnyMetric =
    state.metricSession.firstMeaningfulEditLagMs !== undefined ||
    state.metricSession.firstRunLagMs !== undefined;

  if (!hasAnyMetric) {
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
