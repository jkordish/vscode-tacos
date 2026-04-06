# TaCoS Design and Implementation Guide

## Purpose and UX Philosophy

TaCoS helps interruption-heavy engineers recover task context quickly after interruptions.

Principles:

- local-first by default,
- evidence-backed and safe actions,
- explicit trust/privacy boundaries,
- low-friction controls for pause/snooze/quiet behavior,
- preserve mental state instead of pretending the AI should do all the thinking,
- prefer deterministic cues over speculative intelligence theater.

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
- Cognitive Observability v1 adds a typed structured task-state collector that captures objective, working set, assumptions, blockers, next action, confidence, stale boundary, and last known safe breakpoint.
- Deterministic task-switch detection uses bounded, inspectable signals: focus-return after idle, workspace root changes, task partition changes, trusted branch changes, manual confirmation, and file-cluster drift as supporting evidence only.
- Percolation signal adapters normalize trigger-time runtime state into typed policy signals (`src/percolation/signals.ts`) for deterministic ranking input.
- Git semantic enrichment captures branch-switch, recent-commit checkpoint, and upstream divergence metadata from trusted git snapshots before policy ranking.
- Summary generation computes precision `Changes Since Last Time` buckets (`Code`, `Runs`, `Blocker`, `Key files`, `Git`, `References`) plus a deterministic novelty profile (`score` + `low`/`medium`/`high`) consumed by ranking defaults.
- Focus auto-trigger significant-change checks use a structured no-change fingerprint `v2` payload that includes partition scope, so partition transitions do not inherit stale no-change state.
- Percolation ranking normalizes user-authored priors (checkpoint note, saved corrections, scratchpad excerpt/content) and applies deterministic promotion/suppression with corrections precedence when priors conflict.

### Sanitization / privacy filtering

- Redaction utilities sanitize persisted and provider-bound content.
- Strict sanitizer can block high-risk payload sends.

### Summary provider abstraction

- `local`: deterministic summary.
- `vscode-lm`: optional refinement using VS Code LM.
- `openai`: optional refinement using OpenAI-compatible API.

### Storage / retention / metrics

- Workspace/global state for scoped context.
- Structured task state is stored in versioned local workspace state keyed by workspace root, branch, and task partition scope.
- SecretStorage for provider credentials.
- Local file exports for metrics snapshots.
- Retention pruning + explicit forget/revoke paths.

### UI surfaces and commands

- Companion webview panel (primary detail/action UI).
- Status bar and notification prompts.
- Structured checkpoint capture/edit/resolve commands keep state capture manual-first and lightweight.
- Likely-switch prompting uses conservative, explainable notification prompts with `Capture`, `Skip`, `Snooze`, and `Dismiss`.
- Resume Safety Check uses a second short-lived status-bar annunciator so `State / Risk / Verify` can appear without forcing a new panel or modal flow.
- Status bar semantics are compact and policy-driven (`class + reason`) so ambient state remains stable; active-mode elevation is reserved for rare high-risk blocked states.
- Focus-triggered summary presentation now runs through a deterministic surface broker (`none` vs `statusbar` vs `panel` vs `notification`) with explicit reason enums; `tacos.uiSurface` remains a hard cap/user override.
- The summary notification presents 5 actions (`Open Companion`, `Copy Summary`, `Copy + Open Codex`, `Open Standup`, `Refresh`); the previously separate `Copy prompt for Codex` action was removed as redundant with `Copy + Open Codex`.
- Companion Home keeps fixed `Now/Next/Blocked/Restore` slot order while a central CTA arbiter enforces one primary action across `Next` and `Blocked`; emphasis tokens (`PRIMARY`/`ADVISORY`/`SUPPRESSED`) are motion-safe and a11y-aware.
- Blocker detection uses a scored v2 arbitration pass (`src/blockerModel.ts`) across task/command/diagnostic/branch/confidence/trust signals and returns explicit severity/confidence/actionability metadata.
- Companion Home includes a one-click `Why am I seeing this?` action that expands `More Context` and the nested Trust Center explainability disclosure.
- Companion Home includes a one-click `Review AI payload preview` deep-link for the currently surfaced context.
- Companion Home includes a one-click `Open evidence tray` action; Evidence now groups rows by surfaced-decision relevance while retaining the existing safe open/static affordance semantics.
- Trust Center includes a compact Trust & Privacy tray (preset, retention, provider mode, consent status) with one-click payload preview and consent-revoke entrypoints; nested `Why am I seeing this?` details include the same payload-preview deep-link for decision-specific auditability.
- Restricted Mode copy explicitly calls out filtered signal classes and marks execution-style affordances as suppressed with clear trust-enable reasons.
- Resume Brief v2 prioritizes `what you were doing`, `what changed since`, `next likely safe move`, `open questions`, and `timeline/evidence/retrieval cues`.
- The panel now prefers a `Task State` card over the legacy note card when structured task state exists, and adds an on-demand `Cognitive Debrief` card that surfaces stale or abandoned threads without becoming a generic chat surface.
- Command palette and keybinding surfaces.
- Collapsible panel sections keep stable order and persisted expansion state; policy emphasis is conveyed via summary badges/accent instead of auto-expansion or reordering, and only targets sections currently rendered by settings/trust mode.

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
4. Structured task state for the active scope is loaded and any likely switch candidate is evaluated with deterministic explainability.
5. Local summary is generated, then structured task state is merged in to produce Resume Brief v2 recovery sections.
6. Optional provider refinement runs if enabled/allowed, and structured task state is re-applied to preserve local recovery cues.
7. UI actions revalidate evidence before opening/running targets.
8. Metrics/diagnostics remain local unless user explicitly exports/shares.

## Command Surfaces

Key capability clusters:

- resume: show now, show last, copy prompt + open Codex,
- controls: pause/resume/snooze/quiet/toggle,
- state capture: structured checkpoint capture, task resolution, manual task-switch confirmation, cognitive debrief,
- notes/scratchpad: legacy checkpoint-note compatibility flows and scratchpad commands,
- execution helpers: restore working set, restore query capture, jump to last edit,
- workflow: standup generation, task partition switching,
- safety/admin: privacy preset, retention, diagnostics, sanitizer test, forget workspace, consent revoke.

### Internal Runtime Commands

A small set of commands are registered at runtime but intentionally absent from `package.json` `contributes.commands`:

- `tacos.resumeSafetyRunVerifyAction`: invoked by the Resume Safety Check status-bar item's action button; not a user-discoverable command.
- `tacos.openCompanionActions`: internal quick-pick handler for the Companion status-bar item click; not surfaced in the command palette.
- `tacos.__test.*`: integration test probe commands registered only in the test environment.

These commands are not listed in the manifest because they are either internal action triggers (not user-initiated) or test-only probes.

## Settings Model

`package.json` contributes the `tacos.*` configuration surface for:

- trigger timing and presentation,
- structured checkpoint enablement and likely-switch prompting,
- percolation rollout controls (policy engine, explainability affordances, notification broker),
- context depth and privacy,
- nudge suppression and quiet windows,
- provider mode and OpenAI endpoint/model/timeout,
- metrics enablement.

Settings with trust-sensitive impact are constrained via manifest restricted configuration handling.

## Storage and State

Primary stores:

- `workspaceState`: scoped activity, summaries, notes, partitions, nudge state, metrics records.
- `workspaceState`: also stores the latest scoped Resume Safety Check context (`sharedState`, `staleAssumption`, `nextVerificationAction`, plus lightweight provenance).
- `workspaceState`: also stores structured task-state records, checkpoint-prompt snoozes, and dismissed switch-candidate hashes.
- `globalState`: cross-workspace helper state where needed.
- `SecretStorage`: OpenAI API key.
- local files: `.tacos/metrics.json` and `.tacos/metrics.csv` exports.
- Metrics schema includes blocker-promotion source counters (`taskFailure`, `commandFailure`, `diagnostics`, `branchContext`, `lowConfidence`, `restricted`, `noNextSteps`) for per-session blocker-mix analysis.
- Metrics schema also includes prior-driven promotion counters (`priorPromotionCheckpoint`, `priorPromotionCorrections`, `priorPromotionScratchpad`) for ranking-prior attribution.
- Metrics schema includes novelty bucket distribution counters (`noveltyScoreBucketLow`, `noveltyScoreBucketMedium`, `noveltyScoreBucketHigh`) for per-session percolation novelty analysis.
- Metrics schema includes percolation decision-chain counters (`percolationDecisionCount`, segmented surface selections including `panel-silent`/`panel-emphasis`, and confidence-band counters) for policy-outcome analysis.
- Metrics schema includes AI payload-preview entrypoint counters (`aiPayloadPreviewOpensTrustCenter`, `aiPayloadPreviewOpensWhySurfaced`, `aiPayloadPreviewOpensCompanionHome`) so trust-drill-down adoption can be measured locally.
- Metrics schema includes Resume Safety Check counters (`resumeSafetyShown`, `resumeSafetyDismissed`, `resumeSafetyActionClicks`, `resumeSafetyMismatchDetected`, `resumeSafetyStrictWarnings`) plus `resumeSafetyFirstActionLagMs`.
- Metrics schema now also includes structured checkpoint counters, task-switch counters, debrief counters, and cohort fields for `resumeWithStructuredTaskState`, `taskSwitchSessionClass`, and `resumeTaskStateFreshness`.
- Suppression memory for nudge cooldown windows and noise-budget windows is partition-scoped; explicit task-partition switches clear destination-scope suppression memory.
- Structured checkpoint prompt snoozes and switch dismissals are also workspace-scoped and explainable.
- extension storage scratchpad files scoped by workspace/partition context.

Retention:

- controlled by `tacos.retentionPolicy`.
- explicit `Forget This Workspace Now` clears scoped state.

## Restore Flows

- Restore actions are presented as safe plans first.
- Trust-sensitive actions (rerun task/debug/checkout) are blocked in Restricted Mode.
- Guard reasons are surfaced to users.

## Diagnostics and Metrics

- `TaCoS: Copy Diagnostics` emits privacy-safe environment/mode context plus active percolation rollout flag state.
- Diagnostics now include structured checkpoint enablement, active structured-task freshness/class counts, and the latest likely-switch explainability/suppression state.
- `TaCoS: Export Local Metrics` writes local artifacts only.
- Resume Safety Check evaluation uses local-only counters and lag metrics; no remote telemetry path was added.
- Cognitive Observability evaluation remains local-only and focuses on recovery-support signals, not performance surveillance.
- Metrics are not auto-uploaded by TaCoS.

## What Is Intentionally Local-Only

- baseline summary generation,
- workspace state persistence,
- structured task-state, checkpoint-note, and scratchpad storage,
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
- Marketplace publish automation is intentionally disabled before `v1.0`; release flow remains VSIX artifact + GitHub release.
