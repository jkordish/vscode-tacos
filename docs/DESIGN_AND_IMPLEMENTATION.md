# TaCoS Design and Implementation Guide

## Purpose and UX Philosophy

TaCoS helps developers recover task context quickly after interruptions.

Principles:

- local-first by default,
- evidence-backed and safe actions,
- explicit trust/privacy boundaries,
- low-friction controls for pause/snooze/quiet behavior.

## Activation Model

- Extension entrypoint: `src/extension.ts`.
- Activation events: startup + command-based activation from `package.json`.
- Runtime orchestrates focus-based triggers and manual command flows.

## Runtime Boundaries

### Activation / orchestration

- Registers commands, event listeners, and UI surfaces.
- Coordinates summary generation, caching, provider refinement, and panel rendering.

### Context collectors

- Workspace/editor signals, git snapshot, optional terminal/debug traces, URLs.
- Collection is bounded by settings and trust state.

### Sanitization / privacy filtering

- Redaction utilities sanitize persisted and provider-bound content.
- Strict sanitizer can block high-risk payload sends.

### Summary provider abstraction

- `local`: deterministic summary.
- `vscode-lm`: optional refinement using VS Code LM.
- `openai`: optional refinement using OpenAI-compatible API.

### Storage / retention / metrics

- Workspace/global state for scoped context.
- SecretStorage for provider credentials.
- Local file exports for metrics snapshots.
- Retention pruning + explicit forget/revoke paths.

### UI surfaces and commands

- Companion webview panel (primary detail/action UI).
- Status bar and notification prompts.
- Command palette and keybinding surfaces.
- Collapsible panel sections keep stable order and persisted expansion state; policy emphasis is conveyed via summary badges/accent instead of auto-expansion or reordering.

### Trust / restricted-mode guards

- Restricted Mode disables trust-sensitive collectors and execution-style restore actions.
- UI and diagnostics explain guarded states.

### Restore / standup / task partition workflows

- Restore plans/actions are guard-aware.
- Standup generation builds deterministic local text.
- Task partitions scope notes/summaries/restore context.

## Data Flow (High-Level)

1. Trigger occurs (focus-return or command).
2. Runtime resolves workspace/trust/scope and loads config.
3. Context collection runs with trust/privacy constraints.
4. Local summary is generated, validated, and rendered.
5. Optional provider refinement runs if enabled/allowed.
6. UI actions revalidate evidence before opening/running targets.
7. Metrics/diagnostics remain local unless user explicitly exports/shares.

## Command Surfaces

Key capability clusters:

- resume: show now, show last, copy prompt + open Codex,
- controls: pause/resume/snooze/quiet/toggle,
- notes/scratchpad: checkpoint and scratchpad commands,
- execution helpers: restore working set, restore query capture, jump to last edit,
- workflow: standup generation, task partition switching,
- safety/admin: privacy preset, retention, diagnostics, sanitizer test, forget workspace, consent revoke.

## Settings Model

`package.json` contributes the `tacos.*` configuration surface for:

- trigger timing and presentation,
- context depth and privacy,
- nudge suppression and quiet windows,
- provider mode and OpenAI endpoint/model/timeout,
- metrics enablement.

Settings with trust-sensitive impact are constrained via manifest restricted configuration handling.

## Storage and State

Primary stores:

- `workspaceState`: scoped activity, summaries, notes, partitions, nudge state, metrics records.
- `globalState`: cross-workspace helper state where needed.
- `SecretStorage`: OpenAI API key.
- local files: `.tacos/metrics.json` and `.tacos/metrics.csv` exports.
- extension storage scratchpad files scoped by workspace/partition context.

Retention:

- controlled by `tacos.retentionPolicy`.
- explicit `Forget This Workspace Now` clears scoped state.

## Restore Flows

- Restore actions are presented as safe plans first.
- Trust-sensitive actions (rerun task/debug/checkout) are blocked in Restricted Mode.
- Guard reasons are surfaced to users.

## Diagnostics and Metrics

- `TaCoS: Copy Diagnostics` emits privacy-safe environment/mode context.
- `TaCoS: Export Local Metrics` writes local artifacts only.
- Metrics are not auto-uploaded by TaCoS.

## What Is Intentionally Local-Only

- baseline summary generation,
- workspace state persistence,
- checkpoint/scratchpad storage,
- metrics and diagnostics collection/export.

## What Can Leave the Machine

Only provider payloads when all are true:

- provider is `vscode-lm` or `openai`,
- trust state allows provider path,
- payload path is consented,
- strict sanitizer permits send.

## Restricted in Untrusted Workspaces

- git command collection,
- terminal command collection,
- AI refinement,
- execution-style restore actions.

Local summary and core orientation remain available.

## Desktop-only Status

TaCoS is desktop-first currently because runtime depends on Node-hosted capabilities (`child_process`, filesystem, host integration). No browser entrypoint is declared.

## Testing Strategy

- unit: deterministic domain logic (`jest` + `@swc/jest`).
- integration: extension host behavior (`@vscode/test-electron`).

Quality gates:

- `npm run verify:quick`
- `npm run test:integration`
- `npm run package:vsix` for packaging-impacting changes.

## Packaging and Release Flow

- `npm run build` bundles extension to `dist/extension.js`.
- `npm run package:vsix` produces VSIX using `vsce`.
- CI validates formatting/lint/typecheck/unit/integration/package smoke.
- Tag workflow attaches VSIX artifacts.
- Marketplace publish is credential-gated and documented as optional (`VSCE_PAT`).
