# vscode-tacos

TaCoS is a VS Code extension that helps you resume work quickly with a local-first summary, evidence-backed next steps, and optional AI refinement.

## What TaCoS Does

- Detects likely resume moments (focus return, workspace switch, meaningful change).
- Builds an evidence catalog from trusted extension-collected signals.
- Shows a concise resume brief with intent, next steps, links, and restore actions.
- Renders immediately from local/cached context, then optionally refines asynchronously with AI.
- Lets you correct bad summaries so future summaries for the same context improve.

## Commands

- `TaCoS: Resume Summary Quick`
- `TaCoS: Show Resume Brief Now`
- `TaCoS: Copy Prompt and Open Codex`
- `TaCoS: Show Last Summary`
- `TaCoS: Pause Auto Summaries`
- `TaCoS: Resume Auto Summaries`
- `TaCoS: Toggle Summaries Enabled`
- `TaCoS: Pause Summaries Until Restart`
- `TaCoS: Add Recent URL`
- `TaCoS: Add Checkpoint Note`
- `TaCoS: Clear Checkpoint Note`
- `TaCoS: Configure AI Provider`
- `TaCoS: Clear Summary Corrections`
- `TaCoS: Set OpenAI API Key`
- `TaCoS: Clear OpenAI API Key`
- `TaCoS: Export Local Metrics`

## Configuration

Settings namespace: `tacos`

- `enabled` (default `true`)
- `showOnFocus` (default `true`)
- `pauseSummaries` (default `false`)
- `minIdleMinutes` (default `10`)
- `cooldownMinutes` (default `5`)
- `idleMinutes` (legacy, default `10`)
- `cooldownSeconds` (legacy, default `30`)
- `includeDiff` (default `false`)
- `maxDiffChars` (default `6000`)
- `includeTerminalHistory` (default `true`)
- `includeDebugHistory` (default `true`)
- `cacheIfContextUnchanged` (default `true`)
- `redactionPatterns` (default `[]`)
- `metricsEnabled` (default `true`)
- `summaryProvider` (`local`, `vscode-lm`, or `openai`; default `local`)
- `openaiApiKey` (deprecated fallback only)
- `openaiModel` (default `gpt-4.1-mini`)
- `openaiBaseUrl` (default `https://api.openai.com/v1`)
- `openaiTimeoutMs` (default `15000`)
- `codexOpenCommand` (optional command id)

## AI Providers

TaCoS supports three provider modes:

- `local`: no external model call.
- `vscode-lm`: uses a VS Code Language Model selected via `TaCoS: Configure AI Provider`.
- `openai`: uses direct OpenAI API calls with strict JSON schema validation.

Provider behavior:

- Summaries appear immediately from local/cached context.
- If `vscode-lm` or `openai` is configured and available, TaCoS refines in the background.
- If configured AI is unavailable, TaCoS falls back to `local` safely.

### OpenAI API Key Resolution Order

1. VS Code Secret Storage (`TaCoS: Set OpenAI API Key`) (recommended)
2. `OPENAI_API_KEY` environment variable
3. `tacos.openaiApiKey` setting (deprecated fallback)

## Security & Privacy

### Signals Collected

- Editor/workspace signals: open files, recent files, active context metadata.
- Git context (trusted workspaces only): branch, status, diff stat, optional capped diff/log.
- Terminal shell integration signals (trusted workspaces only): recent commands and failures.
- Debug/task context: recent debug sessions and last task/debug configuration names.
- User-added URLs from `TaCoS: Add Recent URL`.

Terminal capture depends on VS Code shell integration support.

### What Is Persisted Locally

- Redacted activity snapshots: recent files/terminal/debug/URLs, done items, last failing command.
- Resume summary cache per workspace root.
- Workspace-scoped checkpoint note (one-line “future me” note).
- Workspace-scoped summary corrections keyed by context hash.
- Optional local metrics history.

### What Is Sent to AI

Only when an AI provider is enabled:

- Redacted context summary and evidence catalog.
- Structured prompt instructions and correction hints (if present).

No telemetry is emitted by TaCoS.

### Link and File Open Safety

- All model output is treated as untrusted input.
- Model links are grounded to extension-generated evidence IDs.
- External URLs are allowlisted to `http`/`https` only.
- File paths are resolved and must stay inside a workspace root.
- Unsafe paths/protocols are dropped during validation and refused again at click time.

## Workspace Trust (Restricted Mode)

TaCoS declares `untrustedWorkspaces: limited`.

In Restricted Mode:

- Git CLI collection is disabled.
- Terminal shell command collection is disabled.
- Risky restore actions that execute tooling are disabled.
- Safe local summary behavior remains available.

When trust is granted, TaCoS re-enables full trusted behavior at runtime.

## Manual Verification Checklist

- Trusted workspace:
  - make edits, run tests/tasks, run debug
  - trigger resume and confirm immediate local summary
  - confirm optional AI refinement updates in place
  - verify evidence and restore actions work
- Restricted Mode:
  - confirm no git execution and no terminal scraping
  - confirm safe-mode summary still works
  - confirm risky restore actions are disabled
- Safety:
  - verify unsafe protocols/paths are blocked
  - verify only workspace-contained file links are openable

## Development

```bash
npm ci
npm run compile
npm test
npx @vscode/vsce package --no-dependencies
```

Run extension host with `F5` in VS Code.
