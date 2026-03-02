# SPECS.md

## Product Overview

TaCoS is a desktop-first VS Code extension that reduces interruption recovery cost by generating local-first resume briefs and safe next actions when users return to work.

## Current Scope

- Automatic and manual resume brief generation.
- Evidence-backed companion surfaces and restore actions.
- Privacy and trust controls (redaction, consent, retention, Restricted Mode behavior).
- Optional provider refinement (`local`, `vscode-lm`, `openai`).
- Checkpoint notes, scoped scratchpad, task partitions, standup generation.
- Local-only metrics/diagnostics export and support workflows.

## Non-goals

- Browser/web extension runtime support.
- Cloud sync or hosted backend services.
- Autonomous destructive execution without explicit user action.
- Background remote telemetry streaming.

## Core Architecture Decisions

1. Desktop-first Node extension host
   Reason: TaCoS depends on Node/runtime features (git process execution, filesystem, and host integration).

2. Local summary baseline before AI
   Reason: deterministic fallback and privacy-first UX.

3. Evidence-grounded action model
   Reason: file/url/action targets must remain validated and revalidated.

4. Restricted Mode as a hard trust boundary
   Reason: untrusted workspaces must disable risky collection/actions.

5. Local metrics, explicit export
   Reason: support product iteration without hidden remote telemetry.

## Data Handling Principles

- Persist only redacted/sanitized context.
- Never persist raw terminal command text in workspace state.
- Use SecretStorage for provider credentials.
- Respect retention pruning and explicit forget/revoke commands.
- Treat model output as untrusted until validated.

## Trust / Privacy Model

- `capabilities.untrustedWorkspaces.supported = limited`.
- Restricted Mode disables trust-sensitive collection/actions.
- Privacy presets control collection richness.
- AI payload send is explicit and consent-gated.
- Diagnostics and metrics are local-only artifacts unless the user chooses to share.

## AI Provider Model

- `local`: deterministic local summary only.
- `vscode-lm`: optional asynchronous refinement via VS Code LM APIs.
- `openai`: optional asynchronous refinement via OpenAI-compatible endpoint with strict payload shaping/validation.

Provider calls are optional, user-controlled, and fail back to local summaries on provider failure/unavailability.

## Feature Spec Template

Use this shape for new feature sections:

- Problem
- Goals
- Non-goals
- User-facing behavior
- Technical shape / architecture notes
- Settings and commands affected
- Acceptance criteria
- Risks / failure modes
- Open questions
- Links to plan items / issues / PRs

## Feature: Resume Brief Generation

### Problem

Users lose task context after focus switches and interruptions.

### Goals

- Generate useful orientation quickly on resume.
- Support both focus-triggered and manual summary flows.
- Reuse cached summaries when context is unchanged.

### Non-goals

- Perfect intent inference from sparse evidence.

### User-facing behavior

- Focus-triggered summaries honor idle/cooldown/quiet/snooze/pause gates.
- Manual `TaCoS: Show Resume Brief Now` always provides best-effort output.
- Long-gap mode prioritizes retrieval cues and safe-first actions.

### Technical shape / architecture notes

- `src/extension.ts` orchestrates trigger and presentation flow.
- `src/noiseControl.ts` applies timing and suppression logic.
- `src/summary.ts` builds deterministic local summary.

### Settings and commands affected

- Settings: `tacos.showOnFocus`, `tacos.minIdleMinutes`, `tacos.longGapMinutes`, `tacos.cooldownMinutes`, `tacos.summaryQuietHours`, `tacos.cacheIfContextUnchanged`, `tacos.uiSurface`.
- Commands: `tacos.showNow`, `tacos.showLastSummary`, `tacos.pauseSummaries`, `tacos.resumeSummaries`, `tacos.snoozeAutoSummaries`, `tacos.quietNow`, `tacos.pauseUntilRestart`, `tacos.toggleEnabled`.

### Acceptance criteria

- Focus-trigger suppression reasons are deterministic and test-covered.
- Manual trigger works in trusted and restricted mode.
- Cache reuse never bypasses safety validation.

### Risks / failure modes

- Prompt fatigue from over-triggering.
- Stale context from over-aggressive caching.

### Open questions

- Should thresholds adapt per workspace over time?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.

## Feature: Context Collection

### Problem

Resume quality depends on accurate local context collection with bounded cost.

### Goals

- Gather relevant context from editor/git/tasks/debug/URLs.
- Bound expensive operations and payload sizes.

### Non-goals

- Deep historical analytics across long periods.

### User-facing behavior

- Optional diff, terminal history, and debug history controls.
- Collection respects trust state and privacy preset.

### Technical shape / architecture notes

- Git collector in `src/git.ts`.
- Activity persistence/sanitization in `src/activityPersistence.ts`.
- Root/scope helpers in `src/workspaceRoot.ts` and `src/scopeBranch.ts`.

### Settings and commands affected

- Settings: `tacos.includeDiff`, `tacos.maxDiffChars`, `tacos.includeTerminalHistory`, `tacos.includeDebugHistory`, `tacos.privacyPreset`.
- Commands: `tacos.addVisitedUrl`.

### Acceptance criteria

- Trust-sensitive collectors are disabled in Restricted Mode.
- Diff and history collection respect configuration limits.

### Risks / failure modes

- Over-collection hurting readability or privacy expectations.

### Open questions

- None currently.

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3`.

## Feature: Redaction and Sanitization

### Problem

Collected context can include sensitive strings.

### Goals

- Redact sensitive content before persistence and provider boundaries.
- Fail closed when high-risk payload is detected for provider send.

### Non-goals

- Perfect PII detection for every custom token format.

### User-facing behavior

- Redaction applies to activity, notes, scratchpad append/copy paths, and provider payload previews.
- Sanitizer test command provides local validation workflow.

### Technical shape / architecture notes

- Core redaction logic: `src/redaction.ts`.
- Provider strict context shaping: `src/llm.ts`, `src/vscodeLm.ts`.

### Settings and commands affected

- Settings: `tacos.redactionPatterns`, `tacos.aiIncludeCheckpointNotes`, `tacos.aiIncludeScratchpad`.
- Commands: `tacos.testSanitizer`, `tacos.revokeAiPayloadConsent`.

### Acceptance criteria

- High-risk payloads are blocked before network send.
- Redaction report metadata is available for diagnostics and user messaging.

### Risks / failure modes

- False negatives (privacy risk).
- False positives (usability friction).

### Open questions

- Should redaction rule sets support named profiles?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3`.

## Feature: Privacy Presets and Retention

### Problem

Users need explicit control over context depth and persistence lifespan.

### Goals

- Provide understandable privacy presets.
- Prune stale state by retention policy.
- Support immediate workspace-state removal.

### Non-goals

- Cross-device policy syncing.

### User-facing behavior

- Preset and retention commands update behavior immediately.
- Forget action clears scoped extension data for the workspace.

### Technical shape / architecture notes

- Config/profile wiring and pruning in `src/extension.ts`.
- Metric pruning helpers in `src/metrics.ts`.

### Settings and commands affected

- Settings: `tacos.privacyPreset`, `tacos.retentionPolicy`.
- Commands: `tacos.setPrivacyPreset`, `tacos.setRetentionPolicy`, `tacos.forgetWorkspaceNow`.

### Acceptance criteria

- Retention policies prune expected records.
- Forget flow clears workspace-scoped TaCoS state and scratchpad data.

### Risks / failure modes

- Over-pruning removing useful context unexpectedly.

### Open questions

- Should users get per-category retention controls later?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3`.

## Feature: Workspace Trust / Restricted Mode

### Problem

Untrusted workspace inputs must not drive risky collection or execution actions.

### Goals

- Disable trust-sensitive capabilities when workspace trust is restricted.
- Keep local summary UX useful in Restricted Mode.

### Non-goals

- Full parity between trusted and restricted capabilities.

### User-facing behavior

- Trust-sensitive actions display unavailable/gated messaging.
- AI refinement is disabled in Restricted Mode.

### Technical shape / architecture notes

- Trust checks and guard branches in `src/extension.ts` and `src/restoreSafety.ts`.
- UI rationale surfaced via blocker and explainability modules.

### Settings and commands affected

- Settings: restricted configurations in manifest capabilities.
- Commands affected by gating: restore/task/debug/checkout flows and provider actions.

### Acceptance criteria

- Restricted mode guard tests remain green.
- No trust-sensitive action executes while trust is restricted.

### Risks / failure modes

- Silent partial execution in restricted mode.

### Open questions

- Can we improve discoverability of trust limitations in command palette metadata?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3`.

## Feature: AI Provider Selection and Consent Boundaries

### Problem

Provider behavior and consent must be explicit and reversible.

### Goals

- Keep `local`, `vscode-lm`, `openai` semantics clear.
- Require explicit consent for network payload send.
- Maintain robust local fallback behavior.

### Non-goals

- Live-model integration tests.

### User-facing behavior

- Provider can be configured via settings/command.
- OpenAI API key can be set/cleared via commands.
- Consent can be revoked per workspace.

### Technical shape / architecture notes

- Provider selection + key management in `src/extension.ts`.
- Payload shaping/validation in `src/llm.ts` and `src/vscodeLm.ts`.

### Settings and commands affected

- Settings: `tacos.summaryProvider`, `tacos.openaiModel`, `tacos.openaiBaseUrl`, `tacos.openaiTimeoutMs`, consent-related inclusion flags.
- Commands: `tacos.configureAiProvider`, `tacos.setOpenAiApiKey`, `tacos.clearOpenAiApiKey`, `tacos.revokeAiPayloadConsent`.

### Acceptance criteria

- Provider failures fall back safely to local summary.
- Consent scope is explicit and revocable.

### Risks / failure modes

- Ambiguous consent state after configuration changes.

### Open questions

- Should consent prompts surface more provider-specific language?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3`.

## Feature: Checkpoint Notes

### Problem

Users need short memory anchors between task switches.

### Goals

- Support scoped sticky notes with lifecycle actions.
- Integrate notes into resume and standup flows safely.

### Non-goals

- Full knowledge base workflows.

### User-facing behavior

- Add/list/clear/checkpoint lifecycle commands.
- Notes can influence recommended next action text.

### Technical shape / architecture notes

- Note model/sanitization in `src/checkpoint.ts`.
- Command/state wiring in `src/extension.ts`.

### Settings and commands affected

- Settings: `tacos.promptCheckpointOnBlur`.
- Commands: `tacos.addCheckpointNote`, `tacos.addCheckpointNoteFromClipboard`, `tacos.addCheckpointFromSelection`, `tacos.addQuickCheckpointNote`, `tacos.listCheckpointNotes`, `tacos.clearCheckpointNote`.

### Acceptance criteria

- Scope rules and lifecycle transitions are deterministic and tested.

### Risks / failure modes

- Note scope confusion across branch/partition context.

### Open questions

- Should note lifecycle include archive history views?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P4`.

## Feature: Scratchpad

### Problem

Users need persistent short-form context not tied to one summary run.

### Goals

- Provide scoped persistent scratchpad with safe defaults.
- Integrate append/open/scope controls in panel and commands.

### Non-goals

- Collaborative or synced notebook behavior.

### User-facing behavior

- Open scratchpad, append sanitized text, set scope mode.

### Technical shape / architecture notes

- Scope and file layout helpers in `src/scratchpadStorage.ts`.
- Command integration in `src/extension.ts`.

### Settings and commands affected

- Commands: `tacos.openScratchpad`, `tacos.appendToScratchpad`, `tacos.setScratchpadScope`.

### Acceptance criteria

- Scratchpad files are scoped and redaction-aware where applicable.

### Risks / failure modes

- Unexpected scope mode leading to wrong context reuse.

### Open questions

- Should scope defaults become partition-specific by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P4`.

## Feature: Restore Working Set

### Problem

Users need safe re-entry actions after interruption without blindly running risky actions.

### Goals

- Offer restore presets and guarded execution actions.
- Show clear unavailable reasons in unsafe contexts.

### Non-goals

- Autonomous task execution.

### User-facing behavior

- Restore action supports safe reopen flows and guarded rerun actions.
- Restore search query can be captured and reused.

### Technical shape / architecture notes

- Guard logic in `src/restoreSafety.ts`.
- Orchestration in `src/extension.ts`.

### Settings and commands affected

- Commands: `tacos.restoreWorkingSet`, `tacos.captureRestoreSearchQuery`, `tacos.jumpToLastEdit`.

### Acceptance criteria

- Restricted mode prevents risky restore execution actions.
- Restore plan messaging remains deterministic and test-covered.

### Risks / failure modes

- User confusion between unavailable vs missing-history states.

### Open questions

- Should restore presets be user-configurable beyond current options?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3` and `P4`.

## Feature: Standup Generation

### Problem

Users need concise rollups of done/next/blockers during resume.

### Goals

- Generate deterministic standup text from local context.

### Non-goals

- Team-wide aggregation.

### User-facing behavior

- Standup command copies/shows structured update text.

### Technical shape / architecture notes

- Formatter logic in `src/standup.ts`.
- Invocation in `src/extension.ts`.

### Settings and commands affected

- Commands: `tacos.generateStandupUpdate`.

### Acceptance criteria

- Output includes `Done`, `Next`, and `Blockers` sections consistently.

### Risks / failure modes

- Low-evidence sessions producing weak updates.

### Open questions

- None currently.

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.

## Feature: Task Partitions

### Problem

Single-branch work can still contain multiple concurrent task threads.

### Goals

- Scope context, notes, and summaries by optional task partition key.

### Non-goals

- External issue tracker synchronization.

### User-facing behavior

- Users can switch task partition and view partition-aware summaries/actions.

### Technical shape / architecture notes

- Partition resolution in `src/partitionScope.ts`.
- Runtime storage keying in `src/extension.ts`.

### Settings and commands affected

- Commands: `tacos.switchTaskPartition`.

### Acceptance criteria

- Partition switches isolate relevant scoped data and tests validate boundaries.

### Risks / failure modes

- Partition leakage between scopes.

### Open questions

- Should partition hints be surfaced more prominently in UI?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P4`.

## Feature: Local Metrics and Diagnostics

### Problem

Maintainers need actionable debug/product signals without hidden telemetry.

### Goals

- Keep metrics local and user-exported.
- Provide privacy-safe diagnostics output for bug reports.

### Non-goals

- Automatic remote metrics upload.

### User-facing behavior

- Metrics export commands write local files.
- Diagnostics copy command emits trust/provider/surface context snapshot.

### Technical shape / architecture notes

- Metrics shaping in `src/metrics.ts` and `scripts/metrics-summary.mjs`.
- Diagnostics in `src/diagnostics.ts` and command wiring in `src/extension.ts`.

### Settings and commands affected

- Settings: `tacos.metricsEnabled`.
- Commands: `tacos.exportMetrics`, `tacos.copyMetricsBaselineSnapshot`, `tacos.copyDiagnostics`.

### Acceptance criteria

- Exported artifacts contain local-only data.
- Diagnostics avoid raw secret content.

### Risks / failure modes

- Misinterpretation of local metrics as remote telemetry.

### Open questions

- Should diagnostics include a stricter redact-on-export mode toggle?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P3` and `P4`.

## Feature: Companion Nudges / Quiet Hours / Pause Controls

### Problem

Resume prompts and nudges can become disruptive without timing controls.

### Goals

- Provide bounded nudges with quiet-hours and cooldown suppression.
- Let users pause/snooze/quiet behavior rapidly.

### Non-goals

- Always-on interruption prompts.

### User-facing behavior

- Companion nudges surface when confidence and policy thresholds pass.
- Quiet hours and pause/snooze commands suppress interruptions.

### Technical shape / architecture notes

- Nudge ranking/suppression in `src/companionNudges.ts` and `src/percolation/*`.
- Timing controls in `src/noiseControl.ts` and extension runtime state.

### Settings and commands affected

- Settings: `tacos.companionNudgesEnabled`, `tacos.companionNudgeAggressiveness`, `tacos.companionNudgeQuietHours`, `tacos.companionNudgeCooldownMinutes`, `tacos.summaryQuietHours`, `tacos.pauseSummaries`.
- Commands: `tacos.pauseSummaries`, `tacos.resumeSummaries`, `tacos.snoozeAutoSummaries`, `tacos.quietNow`, `tacos.configureSummaryQuietHours`.

### Acceptance criteria

- Suppression reasons are deterministic and surfaced for debugging.
- Users can reliably pause/resume and observe mode changes.

### Risks / failure modes

- Over-suppression reducing utility.
- Under-suppression increasing friction.

### Open questions

- Should suppression explainability be shown in more surfaces by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
