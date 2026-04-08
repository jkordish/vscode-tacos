# TaCoS Privacy and Safety

This document describes TaCoS privacy boundaries and safety behavior as implemented in this repository.

## User Mental Model

- TaCoS is local-first: it can generate useful summaries without network access.
- AI refinement is optional and explicit.
- Trust mode matters: Restricted Mode disables trust-sensitive behavior.
- Metrics and diagnostics are local artifacts unless the user explicitly shares them.
- Cognitive Observability is about state recovery, not surveillance.

## Context TaCoS Can Collect

Potential sources include:

- editor/workspace activity,
- git status/log/diff metadata (trusted workspaces only),
- terminal shell-integration events (trusted workspaces only),
- debug/task activity,
- user-added URLs,
- structured task checkpoints and legacy checkpoint notes,
- scoped scratchpad content.

Structured task checkpoints can include:

- objective
- working set
- assumptions
- blockers
- next action
- confidence
- optional stale boundary
- last known safe breakpoint

Collection depth is influenced by settings such as privacy preset and include flags.

TaCoS may also derive deterministic switch candidates from:

- focus return after idle threshold,
- workspace root changes,
- task partition changes,
- trusted branch changes,
- manual task-switch confirmation,
- file-cluster drift as supporting evidence only.

## Defaults and Opt-in Behavior

Default posture is conservative:

- `tacos.summaryProvider = local`
- `tacos.privacyPreset = minimal`
- `tacos.taskCheckpoint.enabled = true`
- `tacos.taskCheckpoint.promptOnLikelySwitch = true`
- checkpoint/scratchpad AI inclusion flags disabled by default
- trust-sensitive features gated in Restricted Mode.

## What Stays Local

By default and design:

- summary generation in local mode,
- structured task-state storage and cognitive debrief derivation,
- workspace/global extension state,
- checkpoint/scratchpad storage,
- metrics records and diagnostics generation,
- local export files (`.tacos/metrics.json`, `.tacos/metrics.csv`).

TaCoS does not implement an automatic remote telemetry pipeline.

## Always-Visible Provenance Badge

The Companion panel header displays a **persistent provenance badge** on every render:

- `● Local-only` (green) — when the active provider is local, Restricted Mode is active, or companion surfacing is disabled.
- `● AI used · <provider>` (amber) — when an AI provider (`vscode-lm` or `openai`) is active. Includes a `Preview payload` affordance that opens the AI payload preview directly.

The badge is always visible without scrolling and updates on every webview state push. It is the canonical in-panel confirmation of the current data-posture. Users who see `● Local-only` can be certain no data is being sent to an AI provider for that session.

## AI Payload Boundaries

Data can leave the machine only in provider modes that require model calls (`vscode-lm`, `openai`) and only when consented.

Provider-bound payloads are:

- redacted/sanitized,
- previewed for user review (with one-click deep-links from the provenance badge, surfaced Companion guidance, Why Surfaced details, and the Trust & Privacy tray),
- gated by consent and trust status,
- blocked when strict sanitizer detects high-risk patterns.

Checkpoint note and scratchpad inclusion are separately controlled and default-off for AI payloads.

When AI checkpoint inclusion is enabled, TaCoS may include the active structured task checkpoint as redacted, reviewable context. This payload remains optional, consented, and untrusted.

## Redaction and Sanitization

- Redaction runs before persistence and before provider payload send.
- Custom `tacos.redactionPatterns` are applied with guardrails.
- High-risk detection triggers fail-closed behavior on provider send paths.

## Retention and Pruning

- `tacos.retentionPolicy` controls pruning windows (`1d`, `7d`, `30d`, `forever`).
- Retention applies to scoped extension state and metrics retention paths.

## Forget and Revoke Flows

- `TaCoS: Forget This Workspace Now` clears workspace-scoped TaCoS state and scoped scratchpad artifacts.
- `TaCoS: Revoke AI Payload Consent` clears stored consent state so provider sends require renewed consent.

## Workspace Trust / Restricted Mode

In Restricted Mode:

- git command collection is disabled,
- terminal command collection is disabled,
- AI refinement is disabled,
- execution-style restore actions are disabled.
- trusted branch/debug/task signals used for richer switch explanations may be unavailable or degraded,
- local structured task checkpoints still work, but trust-sensitive context enrichment stays off.

Local summary and basic orientation remain available.

## What TaCoS Does Not Do

TaCoS does not implement:

- hidden telemetry
- cloud sync or hosted backend state
- keystroke logging
- desktop surveillance
- biometrics or psycho-physiological sensing
- emotion detection
- calendar ingestion
- productivity scoring
- manager dashboards or reporting

## Diagnostics and Metrics Boundaries

### Local metrics/state

- kept in extension state and local export artifacts.
- used for local analysis and manual sharing when user chooses.
- include checkpoint, switch-detection, resume-state, and debrief counters for local evaluation only.

### Remote telemetry

- not implemented as an automatic product pipeline in TaCoS.

### AI payloads

- separate from telemetry,
- explicit provider calls with consent and sanitizer gates.

## API Key Handling

- OpenAI API key is stored in VS Code SecretStorage (preferred).
- `OPENAI_API_KEY` environment variable can also be used when present.

## Safety Notes for Maintainers

When changing trust/privacy/provider behavior:

- update `SPECS.md`, `AGENTS.md`, and this document in the same PR,
- add/update tests for guard paths and payload boundaries,
- include changelog notes for user-visible behavior changes.
