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

- `/tacos`
- `TaCoS: Show Resume Brief Now`
- `TaCoS: Copy Prompt and Open Codex`
- `TaCoS: Show Last Summary`
- `TaCoS: Pause Auto Summaries`
- `TaCoS: Resume Auto Summaries`
- `TaCoS: Add Recent URL`
- `TaCoS: Export Local Metrics`

`/tacos` runs the full flow behind the scenes: generate the complete summary response, copy it, and open a new untitled editor tab prefilled with that summary.

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
- `openaiApiKey` (default `""`, falls back to `OPENAI_API_KEY`)
- `openaiModel` (default `gpt-4.1-mini`)
- `openaiBaseUrl` (default `https://api.openai.com/v1`)
- `openaiTimeoutMs` (default `15000`)
- `codexOpenCommand` (default `""`, optional command id to open Codex panel)

## Development

```bash
npm install
npm run compile
npm test
```

Run extension host with `F5` in VS Code.
