# SPECS.md

## Product Overview

TaCoS is a VS Code extension for interruption recovery. It builds a local resume brief from workspace activity, presents safe next actions, and optionally refines summary text with AI under explicit consent and strict sanitization.

## Current Scope

In scope:

- focus/manual resume summary generation,
- companion panel with evidence-backed actions,
- optional AI refinement (`vscode-lm` and OpenAI-compatible API),
- privacy/safety controls (redaction, consent, trust gating, retention),
- local metrics export and diagnostics,
- deterministic unit/integration test coverage for critical behavior.

Out of scope for current architecture:

- browser/web extension runtime,
- cloud sync/backends,
- autonomous execution without explicit user action.

## Constraints

- Local-first response must work without network access.
- Restricted Mode must disable risky collection/execution paths.
- Untrusted model output must be validated against local evidence before actions can run.
- Storage must remain scoped and pruneable by retention policy.
- Secrets must use VS Code `SecretStorage`.

## Major Architectural Decisions

1. Desktop extension host only
   Reason: runtime requires Node APIs (`child_process`, `fs`, `http/https`) and workspace process access.

2. Local summary first, AI second
   Reason: reliable and privacy-preserving baseline behavior regardless provider availability.

3. Evidence-grounded action model
   Reason: links/paths/actions must map to verified local evidence and be revalidated on click.

4. Trust-aware behavior gating
   Reason: workspace trust mode must be an explicit safety boundary, not a best-effort hint.

5. Deterministic core logic
   Reason: ranking/suppression/safety decisions must be unit-testable and regression-resistant.

## Known Non-Goals

- Real-time collaborative state sharing.
- Full agentic automation of tasks/debug/git actions.
- Telemetry streaming to remote services.
- Marketed web extension support without architectural rewrite.

## Feature Spec: Resume Brief Engine

### Problem

Users lose working context after interruptions and need fast, low-risk reorientation.

### Goals

- Produce a useful summary immediately from local signals.
- Surface likely next actions with supporting evidence.
- Avoid noisy or ill-timed interruptions.

### Non-goals

- Predictive planning beyond available evidence.
- Rich NLP generation when local provider mode is selected.

### User-facing Behavior

- Auto-summary on focus-return when gating conditions pass.
- Manual summary via `TaCoS: Show Resume Brief Now`.
- Stable summary cache reuse when context is unchanged.

### Technical Shape / Architecture Notes

- Entry orchestration in `src/extension.ts`.
- Summary construction and intent shaping in `src/summary.ts` and related modules.
- Noise/timing suppression in `src/noiseControl.ts`.

### Acceptance Criteria

- Local summary renders without network access.
- Suppression reasons are deterministic and test-covered.
- Manual command always produces a best-effort local output.

### Risks / Failure Modes

- Over-triggering (notification fatigue).
- Under-triggering (missed help moments).
- Stale cache reuse under edge context changes.

### Open Questions

- Should trigger thresholds adapt per workspace over time?

### Links To Plan Items And Issues

- Plan: `PLANS.md` initiative `I1` and `I2`.
- Backlog context: `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`.

## Feature Spec: Companion Panel And Restore Actions

### Problem

Users need a clear "what next" path that is safe, actionable, and trust-aware.

### Goals

- Show concise `Now / Next / Blocked / Restore` surfaces.
- Provide one-click actions only when prerequisites are safe and available.
- Preserve panel interaction state across rerenders.

### Non-goals

- General-purpose dashboard for arbitrary project analytics.
- Running destructive actions without explicit user invocation.

### User-facing Behavior

- Companion panel shows current summary, evidence, and actions.
- Restore actions expose unavailable reasons when gated.
- Restricted Mode disables task/debug/branch execution actions.

### Technical Shape / Architecture Notes

- Webview HTML/CSP/rendering in `src/webview/*` and `src/webviewSecurity.ts`.
- Action safety checks in `src/restoreSafety.ts` and related guard logic.

### Acceptance Criteria

- Webview uses strict CSP and nonce-based script/style execution.
- Unsafe action paths are blocked with clear UI messaging.
- Integration tests cover critical panel action flows.

### Risks / Failure Modes

- UI bloat reducing scan speed.
- Action guard regressions causing broken/no-op behavior.

### Open Questions

- Which restore presets should be default in future versions?

### Links To Plan Items And Issues

- Plan: `PLANS.md` initiative `I1` and `I2`.
- Legacy design context: `docs/companion-v1-spec.md`.

## Feature Spec: Optional AI Refinement

### Problem

Some users want richer summary phrasing while retaining strict local safety boundaries.

### Goals

- Keep AI fully optional and explicit.
- Sanitize payloads before provider boundary.
- Fail closed on high-risk payload detection.

### Non-goals

- Background autonomous model calls.
- Hidden provider usage or silent data transfer.

### User-facing Behavior

- Local summary appears first.
- AI refinement updates in place when enabled and consented.
- Users can revoke provider consent and API key at any time.

### Technical Shape / Architecture Notes

- Provider wiring in `src/llm.ts` and `src/vscodeLm.ts`.
- Sanitization/redaction in `src/redaction.ts` and payload preview paths.
- OpenAI key in VS Code SecretStorage.

### Acceptance Criteria

- High-risk payloads are blocked before send.
- No AI call occurs when provider is `local` or trust is restricted.
- Model output parsing/validation is deterministic and tested.

### Risks / Failure Modes

- Sanitizer false negatives (data leakage risk).
- Sanitizer false positives (feature usability friction).
- Provider response schema drift.

### Open Questions

- Should provider-specific retry policies be configurable?

### Links To Plan Items And Issues

- Plan: `PLANS.md` initiative `I2`.
- Safety reference: `docs/privacy-safety.md`.

## Template For Future Specs

Use this section shape for all new feature entries:

- Problem
- Goals
- Non-goals
- User-facing behavior
- Technical shape / architecture notes
- Acceptance criteria
- Risks / failure modes
- Open questions
- Links to plan items and issues
