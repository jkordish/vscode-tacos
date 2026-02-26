# vscode-tacos

TaCoS is a VS Code extension scaffold that auto-generates a resume brief when you return to the editor.

## What it does

- Triggers on VS Code focus regain (`onDidChangeWindowState`) after idle or workspace switch.
- Collects local context: git status/diff/log, open files, recent files, terminal commands, debug sessions, recent URLs.
- Applies redaction before composing a summary prompt.
- Shows a summary notification with actions:
  - Open details panel
  - Copy prompt for Codex
  - Copy + open Codex panel (single action)
  - Copy next steps
  - Copy summary
  - Pause/resume auto summaries
- Supports two summary providers:
  - `local` heuristic summary (default)
  - `openai` direct API summary with strict JSON schema and local fallback
- Caches summaries when context has not changed.
- Tracks local metrics for resumption lag and edit/run lag.

## Commands

- `TaCoS: Resume Summary Quick`
- `TaCoS: Show Resume Brief Now`
- `TaCoS: Copy Prompt and Open Codex`
- `TaCoS: Show Last Summary`
- `TaCoS: Pause Auto Summaries`
- `TaCoS: Resume Auto Summaries`
- `TaCoS: Add Recent URL`
- `TaCoS: Set OpenAI API Key`
- `TaCoS: Clear OpenAI API Key`
- `TaCoS: Export Local Metrics`

`TaCoS: Resume Summary Quick` runs the full flow behind the scenes: generate the complete summary response, copy it, and open a new untitled editor tab prefilled with that summary.

## Configuration

Settings namespace: `tacos`

- `showOnFocus` (default `true`)
- `pauseSummaries` (default `false`)
- `idleMinutes` (default `10`)
- `cooldownSeconds` (default `30`)
- `includeDiff` (default `false`)
- `maxDiffChars` (default `6000`)
- `includeTerminalHistory` (default `true`)
- `includeDebugHistory` (default `true`)
- `cacheIfContextUnchanged` (default `true`)
- `redactionPatterns` (default `[]`)
- `metricsEnabled` (default `true`)
- `summaryProvider` (`local` or `openai`, default `local`)
- `openaiApiKey` (default `""`, deprecated fallback; prefer Secret Storage command)
- `openaiModel` (default `gpt-4.1-mini`)
- `openaiBaseUrl` (default `https://api.openai.com/v1`)
- `openaiTimeoutMs` (default `15000`)
- `codexOpenCommand` (default `""`, optional command id to open Codex panel)

## Provider Behavior

- `Source: local` means TaCoS generated the summary with built-in local heuristics (no OpenAI API call).
- `Source: openai` means TaCoS successfully generated the summary via the OpenAI API.
- If `summaryProvider` is set to `openai` but the request fails (for example missing key, timeout, or request error), TaCoS falls back to `local`.
- Fallback details are logged in the `TaCoS` output channel.

## Enabling OpenAI Summaries

Preferred key setup:

1. Run `TaCoS: Set OpenAI API Key` to store the key in VS Code Secret Storage.
2. Set `tacos.summaryProvider` to `openai`.
3. Optionally set `tacos.openaiModel`.

Key resolution order:
1. Secret Storage (`TaCoS: Set OpenAI API Key`)
2. `OPENAI_API_KEY` environment variable
3. Deprecated `tacos.openaiApiKey` setting

## Security & Privacy

- Signals collected:
  - Local editor/workspace signals like open files, recent files, debug sessions, and optional git snapshots.
  - Terminal command history only when shell integration is available and the workspace is trusted.
  - User-added URLs from `TaCoS: Add Recent URL`.
- Persisted locally:
  - Recent files, terminal/debug/url history, done items, last failing command, summary cache, and optional local metrics.
  - Activity persistence is redacted before storage.
- Sent to OpenAI (only when `summaryProvider` is `openai`):
  - Redacted summary context text (intent evidence, git/editor signals, recent activity) and schema instructions.
  - No telemetry is emitted by the extension.
- Link opening restrictions:
  - External links are limited to `http`/`https`.
  - File links are resolved and validated to remain within the active workspace root.
  - Unsafe links are blocked.
- Workspace Trust behavior:
  - In Restricted Mode (untrusted workspace), TaCoS does not run git commands and does not collect terminal shell command signals.
  - Trust changes are handled at runtime, re-enabling full collection once trusted.
- OpenAI key storage:
  - Recommended: use `TaCoS: Set OpenAI API Key` (Secret Storage).
  - You can clear it anytime with `TaCoS: Clear OpenAI API Key`.
  - The settings-based key is supported only as a backward-compatible fallback.

## Development

```bash
npm install
npm run compile
npm test
npm run package:vsix
```

Run extension host with `F5` in VS Code.

Jest upgrade roadmap: [docs/jest-modernization-plan.md](docs/jest-modernization-plan.md).
