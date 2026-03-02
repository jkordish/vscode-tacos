# vscode-tacos

`vscode-tacos` (`TaCoS Resume Brief`) is a TypeScript VS Code extension that helps developers quickly resume work after interruptions.

TaCoS generates local-first resume briefs, highlights safe next actions, and supports optional AI refinement when explicitly enabled.

## Why Use TaCoS

- recover context quickly after focus switches,
- keep resume guidance grounded in local evidence,
- preserve privacy with redaction, retention controls, and trust-aware behavior,
- keep AI optional (`local`, `vscode-lm`, `openai`) instead of required.

## Core Features

- focus-triggered and manual resume summaries,
- companion panel with evidence-backed actions,
- stable disclosure layout with policy-driven emphasis badges (no auto-expand/reorder churn),
- long-gap orientation hints and low-confidence clarification behavior,
- checkpoint notes and scoped scratchpad,
- restore working set actions with trust-sensitive guards,
- standup update generation,
- task partition switching,
- pause/snooze/quiet-hours controls,
- local metrics export and diagnostics copy,
- Codex handoff (`Copy Prompt and Open Codex`).

## Install and Quick Start

1. Install the extension.
2. Open a workspace and run `TaCoS: Show Resume Brief Now`.
3. Optional: run `TaCoS: Configure AI Provider` if you want provider refinement.
4. Optional: run `TaCoS: Set Privacy Preset` and `TaCoS: Set Retention Policy`.

Quickstart guide:

- [Quickstart](https://github.com/jkordish/vscode-tacos/blob/main/docs/quickstart.md)

## Privacy and Safety Summary

- Local-first baseline summary generation.
- Redaction before persistence/provider boundaries.
- Explicit consent boundaries for AI payload send.
- Restricted Mode blocks trust-sensitive collection/actions.
- Metrics and diagnostics are local unless user explicitly shares them.

Canonical privacy doc:

- [PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)

## Restricted Mode Summary

TaCoS declares `untrustedWorkspaces: limited`.

In Restricted Mode:

- git command collection is disabled,
- terminal command collection is disabled,
- AI refinement is disabled,
- execution-style restore actions are disabled,
- local summary remains available.

## Runtime Compatibility

TaCoS is desktop-first today. It runs in the Node-hosted VS Code extension runtime and does not currently declare a browser entrypoint.

## Panel Disclosure Behavior

- Disclosure section order is stable across refreshes.
- User-expanded/collapsed state is persisted.
- Policy emphasis can add badge/accent cues to collapsed sections (`Trust Center`, `Timeline`, `Evidence`, `Details`, `More Context`) without auto-expanding them.
- Emphasis targets only visible sections under current settings (for example, no timeline focus when `tacos.showTimeline` is disabled).

## Commands Overview

### Resume and context

- `TaCoS: Resume Summary Quick`
- `TaCoS: Show Resume Brief Now`
- `TaCoS: Show Last Summary`
- `TaCoS: Copy Prompt and Open Codex`
- `TaCoS: Jump to Last Edit`

### Restore and workflow

- `TaCoS: Restore Working Set`
- `TaCoS: Set Restore Search Query`
- `TaCoS: Switch Task Partition`
- `TaCoS: Generate Standup Update`

### Notes and scratchpad

- `TaCoS: Add Checkpoint Note`
- `TaCoS: Add Checkpoint Note from Clipboard`
- `TaCoS: Add Checkpoint from Selection`
- `TaCoS: Add Quick Checkpoint Note`
- `TaCoS: List Checkpoint Notes`
- `TaCoS: Clear Checkpoint Notes in Current Task Scope`
- `TaCoS: Open Scratchpad`
- `TaCoS: Append to Scratchpad`
- `TaCoS: Set Scratchpad Scope`

### Controls and privacy

- `TaCoS: Pause Auto Summaries`
- `TaCoS: Resume Auto Summaries`
- `TaCoS: Snooze Auto Summaries`
- `TaCoS: Quiet Now (1 hour)`
- `TaCoS: Configure Summary Quiet Hours`
- `TaCoS: Toggle Summaries Enabled`
- `TaCoS: Pause Summaries Until Restart`
- `TaCoS: Set Privacy Preset`
- `TaCoS: Set Retention Policy`
- `TaCoS: Forget This Workspace Now`
- `TaCoS: Revoke AI Payload Consent`
- `TaCoS: Privacy & Safety`
- `TaCoS: Clear Summary Corrections`

### Providers, metrics, diagnostics

- `TaCoS: Configure AI Provider`
- `TaCoS: Set OpenAI API Key`
- `TaCoS: Clear OpenAI API Key`
- `TaCoS: Test Sanitizer`
- `TaCoS: Export Local Metrics`
- `TaCoS: Copy Metrics Baseline Snapshot`
- `TaCoS: Copy Diagnostics`

## Key Settings Overview (`tacos.*`)

- trigger and cadence: `showOnFocus`, `minIdleMinutes`, `longGapMinutes`, `cooldownMinutes`, `summaryQuietHours`
- context depth: `includeDiff`, `maxDiffChars`, `includeTerminalHistory`, `includeDebugHistory`, `cacheIfContextUnchanged`
- privacy and retention: `redactionPatterns`, `privacyPreset`, `retentionPolicy`
- UI behavior: `uiSurface`, `pauseSummaries`, `showTimeline`
- nudges: `companionNudgesEnabled`, `companionNudgeAggressiveness`, `companionNudgeQuietHours`, `companionNudgeCooldownMinutes`
- providers: `summaryProvider`, `openaiModel`, `openaiBaseUrl`, `openaiTimeoutMs`, `aiIncludeCheckpointNotes`, `aiIncludeScratchpad`
- operational: `metricsEnabled`, `codexOpenCommand`

## AI Provider Setup

- `local`: default; no provider network call.
- `vscode-lm`: uses VS Code LM model selection and falls back safely on failures.
- `openai`: uses configured endpoint/model with strict payload shaping and validation.

OpenAI API key resolution order:

1. VS Code SecretStorage via `TaCoS: Set OpenAI API Key`.
2. `OPENAI_API_KEY` environment variable.

## Development Workflow

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Test Workflow

```bash
npm run verify:quick
npm run test:integration
```

## Packaging and Release Workflow

```bash
npm run package:vsix
npm run verify
```

GitHub Actions:

- `ci.yml`: install, format/lint/typecheck/unit, integration, VSIX smoke package.
- `release-vsix.yml`: tag-triggered VSIX packaging and release artifact attach.

Marketplace publish note:

- repository is publish-ready, but direct publish requires maintainers to configure `VSCE_PAT`.

## Troubleshooting

- no summary appears: confirm extension is enabled and not paused/snoozed; check `tacos.showOnFocus` and idle/cooldown settings.
- AI refinement missing: check provider mode, trust state, consent status, and API key configuration.
- restore actions disabled: verify workspace trust and prerequisites (task/debug history/branch context).
- diagnostics for bug reports: run `TaCoS: Copy Diagnostics`.
- local metrics export: run `TaCoS: Export Local Metrics`.

## Operator Docs

- [AGENTS.md](https://github.com/jkordish/vscode-tacos/blob/main/AGENTS.md)
- [SPECS.md](https://github.com/jkordish/vscode-tacos/blob/main/SPECS.md)
- [PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md)
- [DESIGN_AND_IMPLEMENTATION.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/DESIGN_AND_IMPLEMENTATION.md)
- [PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)

## License

MIT
