# vscode-tacos

TaCoS is a VS Code extension that helps you resume work quickly with an instant local summary, evidence-backed next steps, and optional AI refinement.

## Start Here

- [5-minute Quickstart](docs/quickstart.md)
- [Privacy & Safety](docs/privacy-safety.md)

## Why TaCoS

TaCoS is built around five non-negotiable principles:

1. Local-first UX: useful summary now, optional AI refinement later.
2. Untrusted model output: links/paths must be evidence-grounded and revalidated at click time.
3. Privacy-first: redact before persistence, never persist raw terminal commands, use SecretStorage for API keys.
4. Workspace Trust aware: restricted mode disables risky collection/actions.
5. Fast + quiet: cooldowns, debounce, context caching, and bounded expensive operations.

## What TaCoS Does

- Detects resume moments (focus return, workspace switch, meaningful change).
- Builds an evidence catalog from trusted extension-collected context.
- Shows intent, next steps, top files/links, and restore actions.
- Adds a companion home card (`Now`, `Next`, `Blocked`, `Restore`) for quick resume orientation.
- Shows a status bar companion entry with quick actions.
- Adds panel status controls to refresh immediately and pause/resume auto summaries.
- Includes a Trust Center card that summarizes tracking mode and privacy posture.
- Adds trust cues (`Based on: X files • Y runs • branch Z`) with a "Why am I seeing this?" drill-down.
- Adds a session recap card (`Done`, `Pending/blocked`, `Recommended first action`) with one-click checkpoint capture.
- Adds a compact `Changes Since Last Time` card (diffstat, runs, blockers, key files/links).
- Shows confidence-gated companion nudges with cooldown/quiet-hours suppression plus acknowledge/dismiss controls for the current context.
- Optionally shows a grouped timeline of recent evidence breadcrumbs.
- Lets you capture sticky checkpoint notes (multi-note, scoped, pinned, done/dismissed) and reuse them on resume.
- Adds a scoped persistent scratchpad in a real editor tab so running thoughts survive reloads/restarts.
- Adds restore presets with a dry-run plan before executing working-set restore actions.
- Supports local-only summaries and optional AI refinement (`vscode-lm` / `openai`).
- Marks low-confidence context explicitly and suggests safe clarification steps.

## Commands

- `TaCoS: Resume Summary Quick`
- `TaCoS: Show Resume Brief Now`
- `TaCoS: Copy Prompt and Open Codex`
- `TaCoS: Show Last Summary`
- `TaCoS: Generate Standup Update`
- `TaCoS: Restore Working Set`
- `TaCoS: Set Restore Search Query`
- `TaCoS: Switch Task Partition`
- `TaCoS: Jump to Last Edit`
- `TaCoS: Set Privacy Preset`
- `TaCoS: Set Retention Policy`
- `TaCoS: Run Setup Checklist`
- `TaCoS: Reset Setup Checklist`
- `TaCoS: Forget This Workspace Now`
- `TaCoS: Revoke AI Payload Consent`
- `TaCoS: Rate Summary Helpfulness`
- `TaCoS: Pause Auto Summaries`
- `TaCoS: Snooze Auto Summaries`
- `TaCoS: Quiet Now (1 hour)`
- `TaCoS: Configure Summary Quiet Hours`
- `TaCoS: Resume Auto Summaries`
- `TaCoS: Toggle Summaries Enabled`
- `TaCoS: Pause Summaries Until Restart`
- `TaCoS: Add Recent URL`
- `TaCoS: Add Checkpoint Note`
- `TaCoS: Add Checkpoint Note from Clipboard`
- `TaCoS: Add Checkpoint from Selection`
- `TaCoS: Add Quick Checkpoint Note`
- `TaCoS: List Checkpoint Notes`
- `TaCoS: Clear Checkpoint Notes in Current Task Scope`
- `TaCoS: Open Scratchpad`
- `TaCoS: Append to Scratchpad`
- `TaCoS: Set Scratchpad Scope`
- `TaCoS: Configure AI Provider`
- `TaCoS: Privacy & Safety`
- `TaCoS: Clear Summary Corrections`
- `TaCoS: Set OpenAI API Key`
- `TaCoS: Clear OpenAI API Key`
- `TaCoS: Export Local Metrics`
- `TaCoS: Copy Metrics Baseline Snapshot`
- `TaCoS: Copy Diagnostics`

## Keyboard Shortcuts (Default Chords)

These low-conflict defaults speed up the top resume actions without overriding common single-key editor shortcuts. You can override any of them in VS Code Keyboard Shortcuts.

| Action                     | Windows/Linux                   | macOS                         |
| -------------------------- | ------------------------------- | ----------------------------- |
| Show Resume Brief Now      | `Ctrl+Alt+T`, then `Ctrl+Alt+S` | `Cmd+Alt+T`, then `Cmd+Alt+S` |
| Copy Prompt and Open Codex | `Ctrl+Alt+T`, then `Ctrl+Alt+P` | `Cmd+Alt+T`, then `Cmd+Alt+P` |
| Add Quick Checkpoint Note  | `Ctrl+Alt+T`, then `Ctrl+Alt+K` | `Cmd+Alt+T`, then `Cmd+Alt+K` |
| Jump to Last Edit          | `Ctrl+Alt+T`, then `Ctrl+Alt+J` | `Cmd+Alt+T`, then `Cmd+Alt+J` |
| Restore Working Set        | `Ctrl+Alt+T`, then `Ctrl+Alt+R` | `Cmd+Alt+T`, then `Cmd+Alt+R` |

### Codex / ChatGPT Interop

`TaCoS: Copy Prompt and Open Codex` now tries known OpenAI ChatGPT extension commands first:

1. `chatgpt.newCodexPanel`
2. `chatgpt.openSidebar`
3. `chatgpt.newChat`

Then it falls back to `tacos.codexOpenCommand`, then legacy/inferred Codex command IDs.

## Configuration (`tacos.*`)

- `enabled` (default `true`)
- `showOnFocus` (default `true`)
- `pauseSummaries` (default `false`)
- `showTimeline` (default `true`, rendered collapsed)
- `promptCheckpointOnBlur` (default `false`)
- `minIdleMinutes` (default `10`)
- `cooldownMinutes` (default `5`)
- `summaryQuietHours` (default `""`, optional `HH:MM-HH:MM` quiet window for auto summaries)
- `includeDiff` (default `false`)
- `maxDiffChars` (default `6000`)
- `includeTerminalHistory` (default `false`)
- `includeDebugHistory` (default `false`)
- `cacheIfContextUnchanged` (default `true`)
- `redactionPatterns` (default `[]`)
- `privacyPreset` (`minimal` | `balanced` | `max-context`, default `minimal`)
- `retentionPolicy` (`1d` | `7d` | `30d` | `forever`, default `7d`)
- `metricsEnabled` (default `true`)
- `uiSurface` (`statusbar` | `notification` | `silent`, default `statusbar`)
- `autoRefreshInBackground` (legacy compatibility toggle; prefer `uiSurface`)
- `companionNudgesEnabled` (default `true`)
- `companionNudgeAggressiveness` (`low` | `balanced` | `high`, default `balanced`)
- `companionNudgeQuietHours` (default `""`, optional `HH:MM-HH:MM`)
- `companionNudgeCooldownMinutes` (default `20`)
- `summaryProvider` (`local` | `vscode-lm` | `openai`, default `local`)
- `openaiModel` (default `gpt-4.1-mini`)
- `openaiBaseUrl` (default `https://api.openai.com/v1`)
- `openaiTimeoutMs` (default `15000`)
- `codexOpenCommand` (optional command id)

## Companion Metrics (Local Only)

Run `TaCoS: Export Local Metrics` to write:

- `.tacos/metrics.json` (raw session records)
- `.tacos/metrics.csv` (dashboard-friendly fields + derived rates)

Run `TaCoS: Copy Metrics Baseline Snapshot` to copy a markdown baseline report (lag p50/p95, prompt/nudge/forced-open rates, dogfooding gate status) for issue comments or `docs/metrics-baseline.md`.

Docs:

- `docs/metrics.md` (data dictionary + export workflow)
- `docs/metrics-baseline.md` (dogfooding baseline template)

Key companion fields:

- `companionPromptImpressions`: prompt fallback impressions per session.
- `companionForcedOpenDetailsClicks`: forced-click count when prompt mode is used.
- `companionQuickActionsTaken`: panel/status-bar follow-through actions.
- `companionFirstActionLagMs`: ms from summary display to first companion action.
- `firstActionLagMs`: ms from summary display to first task/test/debug/companion action.
- `interruptionEvent`: `1` for focus-triggered notification-mode prompts; else `0`.
- `helpfulnessRating`: optional local user rating (`1`-`5`) via command.
- `pauseActions` / `snoozeActions` / `summaryQuietActions` / `disableActions`: local opt-out interaction counters.
- `companionActionFollowThroughRate` (CSV): quick actions ÷ prompt impressions.
- `companionForcedOpenRate` (CSV): forced opens ÷ prompt impressions.
- `noteCreated` / `noteMarkedDone` / `notePinned`: checkpoint note lifecycle counters.
- `resumeWithNote`: session indicator for note-guided resume (`1` or `0`).
- `scratchpadOpened` / `scratchpadAppended`: scratchpad usage counters.

## Provider Modes

- `local`: deterministic local summary only (no model call).
- `vscode-lm`: optional async refinement through VS Code LM.
- `openai`: optional async refinement through OpenAI-compatible API.

Behavior:

- TaCoS renders local/cached summary immediately.
- If AI mode is enabled and available, refinement updates in-place.
- If AI is unavailable, TaCoS safely falls back to local summary.

OpenAI API key resolution order:

1. VS Code Secret Storage (`TaCoS: Set OpenAI API Key`) (recommended)
2. `OPENAI_API_KEY` environment variable

## Privacy & Safety

### Signals collected

- Editor/workspace signals: open files, recent files, active context metadata.
- Git context (trusted mode only): branch, status, diff stat, optional capped diff/log.
- Terminal shell integration (trusted mode only): recent commands/failures.
- Debug/task context: recent sessions and recent execution hints.
- User-added URLs.
- Optional checkpoint notes entered by the user.

### Persisted locally

- Redacted activity snapshots (workspace + branch scoped; never raw terminal command lines).
- Workspace summary cache.
- Scoped checkpoint note lists (task scope by default, optional workspace-global).
- Workspace-scoped correction hints keyed by context hash.
- Optional local metrics history.
- Workspace-scoped retention metadata and task blocker metadata.

Retention + forget controls:

- `tacos.retentionPolicy` prunes stale workspace data (`1d`, `7d`, `30d`, `forever`).
- `TaCoS: Forget This Workspace Now` clears workspace-scoped TaCoS state immediately.

### Sent to AI

Only if AI provider is enabled:

- Redacted summary context and evidence catalog.
- Structured summarization instructions.
- Optional correction hints.
- Optional checkpoint notes if included via consent flow.
- Scratchpad content is excluded by default.
- Payload preview + explicit consent (`Send once` / `Always allow in workspace`) are required before send.

### Privacy Doc

- `TaCoS: Privacy & Safety` opens `docs/privacy-safety.md` in-editor.

### Webview and link safety

- Strict nonce-based CSP with default deny policy.
- All model output treated as untrusted.
- Link opens require evidence IDs emitted by TaCoS.
- URLs restricted to `http`/`https`.
- File paths must resolve inside workspace root.
- Summary link targets must also match evidence catalog entries at click time.
- Validation happens during provider parsing and again at click time.

## Timeline Mode

When `tacos.showTimeline` is enabled, details panel includes a collapsed timeline grouped by:

- files
- terminal
- debug/tasks
- urls
- git

Only file/url evidence rows are clickable; other rows are informational.

## Workspace Trust (Restricted Mode)

TaCoS declares `untrustedWorkspaces: limited`.

In Restricted Mode:

- git CLI collection is disabled
- terminal command collection is disabled
- AI refinement is disabled
- risky restore actions (task/debug/checkout) are disabled
- safe local summary still works

When trust is granted, full behavior is re-enabled safely.

## Development

```bash
npm ci
npm run compile
npm run lint
npm run format:check
npm test
npm run test:integration
npx @vscode/vsce package --no-dependencies
```

One-command gate:

```bash
npm run verify
```

Formatting:

```bash
npm run format
```

Integration test harness status:

- Runbook: `docs/integration-test-harness.md`
- Command: `npm run test:integration`
- Full phase-to-file acceptance mapping: `docs/acceptance-report.md`
- Companion v1 design and rollout spec: `docs/companion-v1-spec.md`

## Manual Smoke Checklist

Trusted workspace:

- edit files, run test/task, and trigger summary
- confirm immediate local summary appears
- confirm AI refinement updates in place (if enabled)
- confirm evidence links open safely
- confirm Restore Pack actions work as expected

Restricted Mode:

- confirm no git execution and no terminal scraping
- confirm risky restore actions are disabled
- confirm local summary still works

Pedantic step-by-step runbook:

- `docs/manual-smoke-runbook.md`
- `docs/release-0.6.0-checklist.md`

## License

MIT
