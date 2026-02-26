import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { collectGit, parsePorcelainPaths } from './git';
import { tryGenerateOpenAiSummary } from './llm';
import { redactList, redactText } from './redaction';
import { buildResumeSummary } from './summary';
import type { ExtensionConfig, MetricRecord, ResumeSignals, ResumeSummary, TriggerReason } from './types';

const KEY_LAST_BLUR_AT = 'tacos.lastBlurAt';
const KEY_LAST_SUMMARY_AT = 'tacos.lastSummaryAt';
const KEY_LAST_WORKSPACE_ON_BLUR = 'tacos.lastWorkspaceOnBlur';

const KEY_RECENT_FILES = 'tacos.recentFiles';
const KEY_RECENT_TERMINAL = 'tacos.recentTerminal';
const KEY_RECENT_DEBUG = 'tacos.recentDebug';
const KEY_RECENT_URLS = 'tacos.recentUrls';
const KEY_DONE_ITEMS = 'tacos.doneItems';
const KEY_LAST_FAILING_COMMAND = 'tacos.lastFailingCommand';

const KEY_METRIC_HISTORY = 'tacos.metricHistory';
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

class RingBuffer {
  private valuesList: string[] = [];

  constructor(private readonly max: number, initial: string[] = []) {
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
  panel?: vscode.WebviewPanel;
  panelSummary?: ResumeSummary;
  metricSession?: MetricRecord;
}

let state: RuntimeState;

export function activate(context: vscode.ExtensionContext): void {
  state = {
    output: vscode.window.createOutputChannel('TaCoS'),
    recentFiles: new RingBuffer(15, context.globalState.get<string[]>(KEY_RECENT_FILES, [])),
    recentTerminal: new RingBuffer(15, context.globalState.get<string[]>(KEY_RECENT_TERMINAL, [])),
    recentDebug: new RingBuffer(10, context.globalState.get<string[]>(KEY_RECENT_DEBUG, [])),
    recentUrls: new RingBuffer(5, context.globalState.get<string[]>(KEY_RECENT_URLS, [])),
    doneItems: new RingBuffer(10, context.globalState.get<string[]>(KEY_DONE_ITEMS, [])),
    lastFailingCommand: context.globalState.get<string>(KEY_LAST_FAILING_COMMAND),
  };

  context.subscriptions.push(state.output);

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
      void vscode.window.showInformationMessage('TaCoS: complete summary generated, copied, and opened in a new editor tab.');
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
        void vscode.window.showInformationMessage('TaCoS: No cached summary yet for this workspace.');
        return;
      }

      await presentSummary(context, cached, 'cached');
    }),
    vscode.commands.registerCommand('tacos.pauseSummaries', async () => {
      await setPaused(true);
      void vscode.window.showInformationMessage('TaCoS: auto summaries paused.');
    }),
    vscode.commands.registerCommand('tacos.resumeSummaries', async () => {
      await setPaused(false);
      void vscode.window.showInformationMessage('TaCoS: auto summaries resumed.');
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
      await persistActivity(context);
      void vscode.window.showInformationMessage('TaCoS: URL added to recent context.');
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
    })
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
      await persistActivity(context);
    })
  );

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(async (session) => {
      const label = session?.name ? `${session.type}: ${session.name}` : session.type;
      if (label) {
        state.recentDebug.push(label);
        await persistActivity(context);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (!state.metricSession) {
        return;
      }

      if (state.metricSession.firstMeaningfulEditLagMs !== undefined) {
        return;
      }

      if (event.document.uri.scheme !== 'file') {
        return;
      }

      if (!isMeaningfulChange(event.contentChanges)) {
        return;
      }

      state.metricSession.firstMeaningfulEditLagMs = Date.now() - state.metricSession.startedAt;
      await maybeFinalizeMetric(context);
    })
  );

  registerTerminalHooks(context);

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(async (windowState) => {
      const now = Date.now();
      if (!windowState.focused) {
        await context.workspaceState.update(KEY_LAST_BLUR_AT, now);
        await context.workspaceState.update(KEY_LAST_WORKSPACE_ON_BLUR, pickWorkspaceRoot() ?? '');
        return;
      }

      const config = getConfig();
      if (!config.showOnFocus || config.pauseSummaries) {
        return;
      }

      const root = pickWorkspaceRoot();
      if (!root) {
        return;
      }

      const lastBlurAt = context.workspaceState.get<number>(KEY_LAST_BLUR_AT, now);
      const lastWorkspaceOnBlur = context.workspaceState.get<string>(KEY_LAST_WORKSPACE_ON_BLUR, '');
      const idleMs = now - lastBlurAt;
      const idleThresholdMs = config.idleMinutes * 60_000;
      const projectSwitched = Boolean(lastWorkspaceOnBlur) && lastWorkspaceOnBlur !== root;

      if (!projectSwitched && idleMs < idleThresholdMs) {
        return;
      }

      const lastSummaryAt = context.workspaceState.get<number>(KEY_LAST_SUMMARY_AT, 0);
      if (lastSummaryAt > 0 && now - lastSummaryAt < config.cooldownSeconds * 1000) {
        return;
      }

      await triggerSummary(context, 'focus');
    })
  );

  state.output.appendLine('TaCoS activated.');
}

export function deactivate(): void {
  // No-op.
}

function registerTerminalHooks(context: vscode.ExtensionContext): void {
  const windowAny = vscode.window as unknown as {
    onDidStartTerminalShellExecution?: (listener: (event: any) => unknown) => vscode.Disposable;
    onDidEndTerminalShellExecution?: (listener: (event: any) => unknown) => vscode.Disposable;
  };

  if (!windowAny.onDidStartTerminalShellExecution || !windowAny.onDidEndTerminalShellExecution) {
    state.output.appendLine('Terminal shell integration events are unavailable in this VS Code build.');
    return;
  }

  context.subscriptions.push(
    windowAny.onDidStartTerminalShellExecution(async (event: any) => {
      const command = String(event?.execution?.commandLine?.value ?? '').trim();
      if (!command) {
        return;
      }

      state.recentTerminal.push(command);
      for (const url of extractUrls(command)) {
        state.recentUrls.push(url);
      }

      if (isTestOrBuildCommand(command) && state.metricSession && state.metricSession.firstRunLagMs === undefined) {
        state.metricSession.firstRunLagMs = Date.now() - state.metricSession.startedAt;
        await maybeFinalizeMetric(context);
      }

      await persistActivity(context);
    })
  );

  context.subscriptions.push(
    windowAny.onDidEndTerminalShellExecution(async (event: any) => {
      const command = String(event?.execution?.commandLine?.value ?? '').trim();
      const exitCode: number | undefined = event?.exitCode;
      if (!command) {
        return;
      }

      if (typeof exitCode === 'number' && exitCode !== 0 && isTestOrBuildCommand(command)) {
        state.lastFailingCommand = command;
        await context.globalState.update(KEY_LAST_FAILING_COMMAND, command);
      }

      if (typeof exitCode === 'number' && exitCode === 0 && isTestOrBuildCommand(command)) {
        state.doneItems.push(command);
        const updates: Thenable<unknown>[] = [context.globalState.update(KEY_DONE_ITEMS, state.doneItems.values())];

        if (state.lastFailingCommand === command) {
          state.lastFailingCommand = undefined;
          updates.push(context.globalState.update(KEY_LAST_FAILING_COMMAND, undefined));
        }

        await Promise.all(updates);
      }
    })
  );
}

async function triggerSummary(context: vscode.ExtensionContext, reason: Exclude<TriggerReason, 'cached'>): Promise<void> {
  const root = pickWorkspaceRoot();
  if (!root) {
    void vscode.window.showInformationMessage('TaCoS: Open a workspace folder first.');
    return;
  }

  const { summary, triggerReason } = await generateSummary(context, root, reason);

  await context.workspaceState.update(KEY_LAST_SUMMARY_AT, Date.now());

  await presentSummary(context, summary, triggerReason);
}

async function generateSummary(
  context: vscode.ExtensionContext,
  root: string,
  reason: Exclude<TriggerReason, 'cached'>
): Promise<{ summary: ResumeSummary; triggerReason: TriggerReason }> {
  const config = getConfig();
  const signals = await collectSignals(root, config);
  const generatedLocal = buildResumeSummary(signals);

  const cacheKey = summaryCacheKey(root);
  const cached = context.workspaceState.get<ResumeSummary>(cacheKey);
  const desiredSource: ResumeSummary['source'] = config.summaryProvider === 'openai' ? 'openai' : 'local';
  const cachedSource: ResumeSummary['source'] = cached?.source ?? 'local';
  const hasOpenAiKey = Boolean(config.openaiApiKey.trim() || process.env.OPENAI_API_KEY);
  const canUseCached =
    config.cacheIfContextUnchanged &&
    Boolean(cached) &&
    cached?.contextHash === generatedLocal.contextHash &&
    (cachedSource === desiredSource || (desiredSource === 'openai' && !hasOpenAiKey));

  if (canUseCached && cached) {
    return { summary: cached, triggerReason: 'cached' };
  }

  let summary = generatedLocal;
  if (desiredSource === 'openai') {
    const openAiSummary = await tryGenerateOpenAiSummary(signals, generatedLocal, config, (message) => {
      state.output.appendLine(message);
    });

    if (openAiSummary) {
      summary = openAiSummary;
    }
  }

  await context.workspaceState.update(cacheKey, summary);
  return { summary, triggerReason: reason };
}

async function presentSummary(
  context: vscode.ExtensionContext,
  summary: ResumeSummary,
  triggerReason: TriggerReason
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

  const actionPauseLabel = config.pauseSummaries ? 'Resume auto summaries' : 'Pause auto summaries';
  const choice = await vscode.window.showInformationMessage(
    `TaCoS (${summary.source}): ${summary.intent}`,
    'Open details',
    'Copy prompt for Codex',
    'Copy + Open Codex',
    'Copy next steps',
    'Copy summary',
    actionPauseLabel
  );

  if (choice === 'Open details') {
    showDetailsPanel(summary);
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
    await vscode.env.clipboard.writeText(summary.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'));
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
      !config.pauseSummaries ? 'TaCoS: auto summaries paused.' : 'TaCoS: auto summaries resumed.'
    );
  }
}

function showDetailsPanel(summary: ResumeSummary): void {
  state.panelSummary = summary;

  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel('tacos.details', 'TaCoS Resume Brief', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    state.panel.onDidDispose(() => {
      state.panel = undefined;
      state.panelSummary = undefined;
    });

    state.panel.webview.onDidReceiveMessage(async (message: { type: string; index: number }) => {
      if (message.type !== 'openLink') {
        return;
      }

      const link = state.panelSummary?.links[message.index];
      if (!link) {
        return;
      }

      if (link.kind === 'file') {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(link.target));
        return;
      }

      await vscode.env.openExternal(vscode.Uri.parse(link.target));
    });
  }

  state.panel.title = 'TaCoS Resume Brief';
  state.panel.webview.html = renderWebview(summary);
  state.panel.reveal(vscode.ViewColumn.Beside, true);
}

function renderWebview(summary: ResumeSummary): string {
  const linkItems = summary.links
    .map(
      (link, index) =>
        `<li><a href="#" data-idx="${index}">${escapeHtml(link.label)}</a> <span class="kind">(${escapeHtml(link.kind)})</span></li>`
    )
    .join('');

  const nextSteps = summary.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  const topFiles = summary.topFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join('');
  const detailsHtml = markdownRenderer.render(summary.detailsMarkdown);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 16px;
      }
      .card {
        border: 1px solid rgba(127, 127, 127, 0.35);
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 14px;
      }
      ul {
        padding-left: 20px;
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
        color: #8b8b8b;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h3>Intent</h3>
      <p>${escapeHtml(summary.intent)}</p>
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

    <div class="card">
      <h3>Details</h3>
      <div class="details-markdown">${detailsHtml}</div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      for (const anchor of document.querySelectorAll('a[data-idx]')) {
        anchor.addEventListener('click', (event) => {
          event.preventDefault();
          const idx = Number(anchor.getAttribute('data-idx'));
          vscode.postMessage({ type: 'openLink', index: idx });
        });
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPlainSummary(summary: ResumeSummary): string {
  return [
    `Intent: ${summary.intent}`,
    'Next steps:',
    ...summary.nextSteps.map((step) => `- ${step}`),
    'Top files:',
    ...(summary.topFiles.length > 0 ? summary.topFiles.map((file) => `- ${file}`) : ['- None captured']),
  ].join('\n');
}

async function copyPromptAndOpenCodex(summary: ResumeSummary): Promise<void> {
  await vscode.env.clipboard.writeText(summary.codexPrompt);
  const openedCommand = await tryOpenCodexPanel(getConfig());

  if (openedCommand) {
    void vscode.window.showInformationMessage(`TaCoS: prompt copied and opened Codex via \`${openedCommand}\`.`);
    return;
  }

  await vscode.commands.executeCommand('workbench.action.quickOpen', '>Codex');
  void vscode.window.showWarningMessage(
    'TaCoS: prompt copied. Set `tacos.codexOpenCommand` to your Codex panel command id for one-click opening.'
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

  const candidates = uniqueStrings([configured, ...builtInCandidates, ...inferredCandidates]).filter((id) =>
    knownSet.has(id)
  );

  for (const commandId of candidates) {
    try {
      await vscode.commands.executeCommand(commandId);
      return commandId;
    } catch (error) {
      state.output.appendLine(`Could not execute Codex command ${commandId}: ${(error as Error).message}`);
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

async function setPaused(value: boolean): Promise<void> {
  const scope = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await vscode.workspace.getConfiguration('tacos').update('pauseSummaries', value, scope);
}

function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('tacos');
  return {
    showOnFocus: config.get<boolean>('showOnFocus', true),
    pauseSummaries: config.get<boolean>('pauseSummaries', false),
    idleMinutes: config.get<number>('idleMinutes', 10),
    cooldownSeconds: config.get<number>('cooldownSeconds', 30),
    includeDiff: config.get<boolean>('includeDiff', false),
    maxDiffChars: config.get<number>('maxDiffChars', 6000),
    includeTerminalHistory: config.get<boolean>('includeTerminalHistory', true),
    includeDebugHistory: config.get<boolean>('includeDebugHistory', true),
    cacheIfContextUnchanged: config.get<boolean>('cacheIfContextUnchanged', true),
    redactionPatterns: config.get<string[]>('redactionPatterns', []),
    metricsEnabled: config.get<boolean>('metricsEnabled', true),
    summaryProvider: config.get<'local' | 'openai'>('summaryProvider', 'local'),
    openaiApiKey: config.get<string>('openaiApiKey', ''),
    openaiModel: config.get<string>('openaiModel', 'gpt-4.1-mini'),
    openaiBaseUrl: config.get<string>('openaiBaseUrl', 'https://api.openai.com/v1'),
    openaiTimeoutMs: config.get<number>('openaiTimeoutMs', 15000),
    codexOpenCommand: config.get<string>('codexOpenCommand', ''),
  };
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
    command
  );
}

async function collectSignals(root: string, config: ExtensionConfig): Promise<ResumeSignals> {
  const git = await collectGit(root, config);
  const customPatterns = config.redactionPatterns;

  const openFiles = vscode.workspace.textDocuments
    .filter((document) => document.uri.scheme === 'file')
    .map((document) => toRelativePath(document.uri.fsPath, root));

  const changedFromStatus = parsePorcelainPaths(git.status)
    .map((file) => toRelativePath(path.isAbsolute(file) ? file : path.join(root, file), root));

  const allChangedFiles = [...git.changedFiles, ...changedFromStatus]
    .map((file) => toRelativePath(path.isAbsolute(file) ? file : path.join(root, file), root))
    .filter(Boolean);

  const recentTerminal = config.includeTerminalHistory ? state.recentTerminal.values() : [];
  const recentDebug = config.includeDebugHistory ? state.recentDebug.values() : [];

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
    failingCommand: state.lastFailingCommand
      ? redactText(state.lastFailingCommand, root, customPatterns)
      : undefined,
    doneItems: redactList(state.doneItems.values(), root, customPatterns),
  };
}

function summaryCacheKey(root: string): string {
  return `tacos.summary.${Buffer.from(root).toString('base64url')}`;
}

async function persistActivity(context: vscode.ExtensionContext): Promise<void> {
  const config = getConfig();
  const workspaceRoot = pickWorkspaceRoot() ?? '';
  const redactionPatterns = config.redactionPatterns;

  const recentFiles = redactList(state.recentFiles.values(), workspaceRoot, redactionPatterns);
  const recentTerminal = redactList(state.recentTerminal.values(), workspaceRoot, redactionPatterns);
  const recentDebug = redactList(state.recentDebug.values(), workspaceRoot, redactionPatterns);
  const recentUrls = redactList(state.recentUrls.values(), workspaceRoot, redactionPatterns);
  const doneItems = redactList(state.doneItems.values(), workspaceRoot, redactionPatterns);

  await Promise.all([
    context.globalState.update(KEY_RECENT_FILES, recentFiles),
    context.globalState.update(KEY_RECENT_TERMINAL, recentTerminal),
    context.globalState.update(KEY_RECENT_DEBUG, recentDebug),
    context.globalState.update(KEY_RECENT_URLS, recentUrls),
    context.globalState.update(KEY_DONE_ITEMS, doneItems),
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
    state.metricSession.firstMeaningfulEditLagMs !== undefined || state.metricSession.firstRunLagMs !== undefined;

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
