# TaCoS Privacy and Safety

This document describes TaCoS privacy boundaries and safety behavior as implemented in this repository.

## User Mental Model

- TaCoS is local-first: it can generate useful summaries without network access.
- AI refinement is optional and explicit.
- Trust mode matters: Restricted Mode disables trust-sensitive behavior.
- Metrics and diagnostics are local artifacts unless the user explicitly shares them.

## Context TaCoS Can Collect

Potential sources include:

- editor/workspace activity,
- git status/log/diff metadata (trusted workspaces only),
- terminal shell-integration events (trusted workspaces only),
- debug/task activity,
- user-added URLs,
- checkpoint notes,
- scoped scratchpad content.

Collection depth is influenced by settings such as privacy preset and include flags.

## Defaults and Opt-in Behavior

Default posture is conservative:

- `tacos.summaryProvider = local`
- `tacos.privacyPreset = minimal`
- checkpoint/scratchpad AI inclusion flags disabled by default
- trust-sensitive features gated in Restricted Mode.

## What Stays Local

By default and design:

- summary generation in local mode,
- workspace/global extension state,
- checkpoint/scratchpad storage,
- metrics records and diagnostics generation,
- local export files (`.tacos/metrics.json`, `.tacos/metrics.csv`).

TaCoS does not implement an automatic remote telemetry pipeline.

## AI Payload Boundaries

Data can leave the machine only in provider modes that require model calls (`vscode-lm`, `openai`) and only when consented.

Provider-bound payloads are:

- redacted/sanitized,
- previewed for user review,
- gated by consent and trust status,
- blocked when strict sanitizer detects high-risk patterns.

Checkpoint note and scratchpad inclusion are separately controlled and default-off for AI payloads.

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

Local summary and basic orientation remain available.

## Diagnostics and Metrics Boundaries

### Local metrics/state

- kept in extension state and local export artifacts.
- used for local analysis and manual sharing when user chooses.

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
