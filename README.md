# vscode-tacos

TaCoS is a VS Code extension that helps you resume work quickly with an instant local summary, evidence-backed next steps, and optional AI refinement.

## Why TaCoS

TaCoS is built around five non-negotiable principles:

1. Local-first UX: useful summary now, optional AI refinement later.
2. Untrusted model output: links/paths must be evidence-grounded and revalidated at click time.
3. Privacy-first: redact before persistence, avoid storing sensitive command content, use SecretStorage for API keys.
4. Workspace Trust aware: restricted mode disables risky collection/actions.
5. Fast + quiet: cooldowns, debounce, context caching, and bounded expensive operations.

## What TaCoS Does

- Detects resume moments (focus return, workspace switch, meaningful change).
- Builds an evidence catalog from trusted extension-collected context.
- Shows intent, next steps, top files/links, and restore actions.
- Optionally shows a grouped timeline of recent evidence breadcrumbs.
- Lets you add checkpoint notes (“Future You” hints) and reuse them on resume.
- Supports local-only summaries and optional AI refinement (`vscode-lm` / `openai`).

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
- `TaCoS: Add Checkpoint Note from Clipboard`
- `TaCoS: Clear Checkpoint Note`
- `TaCoS: Configure AI Provider`
- `TaCoS: Privacy & Safety`
- `TaCoS: Clear Summary Corrections`
- `TaCoS: Set OpenAI API Key`
- `TaCoS: Clear OpenAI API Key`
- `TaCoS: Export Local Metrics`

## Configuration (`tacos.*`)

- `enabled` (default `true`)
- `showOnFocus` (default `true`)
- `pauseSummaries` (default `false`)
- `showTimeline` (default `true`, rendered collapsed)
- `promptCheckpointOnBlur` (default `false`)
- `minIdleMinutes` (default `10`)
- `cooldownMinutes` (default `5`)
- `idleMinutes` (legacy compatibility)
- `cooldownSeconds` (legacy compatibility)
- `includeDiff` (default `false`)
- `maxDiffChars` (default `6000`)
- `includeTerminalHistory` (default `true`)
- `includeDebugHistory` (default `true`)
- `cacheIfContextUnchanged` (default `true`)
- `redactionPatterns` (default `[]`)
- `metricsEnabled` (default `true`)
- `summaryProvider` (`local` | `vscode-lm` | `openai`, default `local`)
- `openaiApiKey` (deprecated fallback only)
- `openaiModel` (default `gpt-4.1-mini`)
- `openaiBaseUrl` (default `https://api.openai.com/v1`)
- `openaiTimeoutMs` (default `15000`)
- `codexOpenCommand` (optional command id)

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
3. `tacos.openaiApiKey` setting (deprecated fallback)

## Privacy & Safety

### Signals collected

- Editor/workspace signals: open files, recent files, active context metadata.
- Git context (trusted mode only): branch, status, diff stat, optional capped diff/log.
- Terminal shell integration (trusted mode only): recent commands/failures.
- Debug/task context: recent sessions and recent execution hints.
- User-added URLs.
- Optional checkpoint notes entered by the user.

### Persisted locally

- Redacted activity snapshots.
- Workspace summary cache.
- Workspace-scoped checkpoint note.
- Workspace-scoped correction hints keyed by context hash.
- Optional local metrics history.

### Sent to AI

Only if AI provider is enabled:

- Redacted summary context and evidence catalog.
- Structured summarization instructions.
- Optional correction hints.

### Webview and link safety

- Strict nonce-based CSP with default deny policy.
- All model output treated as untrusted.
- Link opens require evidence IDs emitted by TaCoS.
- URLs restricted to `http`/`https`.
- File paths must resolve inside workspace root.
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
npx @vscode/vsce package --no-dependencies
```

Formatting:

```bash
npm run format
```

Integration test harness status:

- Stub plan: `docs/integration-test-harness.md`
- Script placeholder: `npm run test:integration`

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

## License

MIT
