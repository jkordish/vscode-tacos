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

## Feature: Panel Disclosure Emphasis and Stability

### Problem

Users can miss high-signal context when panel sections are collapsed, but auto-expanding or reordering sections causes disorientation and layout jitter.

### Goals

- Keep disclosure section order stable across resume generations.
- Preserve user-expanded/collapsed section state.
- Surface urgency with non-disruptive emphasis cues.

### Non-goals

- Automatic section expansion.
- Dynamic section reordering.

### User-facing behavior

- TaCoS can show policy-driven emphasis badges/accent on collapsed sections.
- Emphasis applies to `Trust Center`, `Timeline`, `Evidence`, `Details`, and `More Context` wrapper.
- Existing expansion state persistence behavior remains unchanged.

### Technical shape / architecture notes

- Emphasis policy resolution happens in `src/extension.ts`.
- Disclosure rendering uses shared emphasis helpers in `src/webview/panelCards.ts`.
- Styling is centralized in `src/webview/panelStyles.ts`.

### Settings and commands affected

- No new settings.
- No new commands.

### Acceptance criteria

- Emphasis metadata renders deterministically for policy-selected sections.
- Section order and persisted disclosure state remain stable.
- No section is auto-expanded by emphasis rules.
- Emphasis policy does not target sections hidden by current settings (for example `Timeline` when `tacos.showTimeline` is disabled).

### Risks / failure modes

- Over-emphasis can reduce signal quality if policy thresholds are too broad.
- Rendering helper drift could create inconsistent emphasis markup if reused incorrectly.

### Open questions

- Should emphasis source classes be surfaced in diagnostics by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/237
- PR: https://github.com/jkordish/vscode-tacos/pull/267

## Feature: Compact Status Bar Percolation Semantics

### Problem

Status bar text previously mirrored long-form summary headlines, which increased jitter and made ambient state harder to scan quickly.

### Goals

- Keep status bar semantics compact and policy-driven.
- Reflect the currently selected percolation state class in one glance.
- Reserve visual elevation for rare, high-risk active states.

### Non-goals

- Replacing panel or notification surfaces.
- Introducing new user settings for status formatting.

### User-facing behavior

- Active mode uses compact status classes (`next`, `blocked`, `clarify`, `evidence`, `trust`, `restore`, `status`, `calm`).
- Status text includes concise reason suffixes (for example `quiet window`, `policy action`, `failing command`).
- Active-mode background elevation is reserved for high-risk blocked states; paused/disabled/restricted modes keep explicit mode elevation.

### Technical shape / architecture notes

- Status semantics are resolved centrally in `updateCompanionStatusBar` in `src/extension.ts`.
- Percolation suppression + ranked primary kind determine status class and reason.
- Integration test snapshot includes status class/reason metadata via `tacos.__test.getStatusBarSnapshot`.

### Settings and commands affected

- Settings: `tacos.summaryQuietHours`, `tacos.enabled`, `tacos.pauseSummaries`.
- Commands: no new commands; existing `tacos.openCompanionActions` surface remains unchanged.

### Acceptance criteria

- Status text reflects the top percolated state class in active mode.
- Quiet-hours suppression yields a deterministic compact `calm` status class and reason.
- Temporary quiet state reason (`quiet window`) takes precedence over generic suppression labels (for example `no-change`) in active mode.
- Paused mode reason reflects the active pause source (`snoozed`, `until restart`, or `settings pause`).
- Repeated reads under unchanged conditions keep stable compact status text.

### Risks / failure modes

- Over-compression can reduce clarity if reason labels drift from actual policy outputs.
- Over-eager elevation could reintroduce ambient noise.

### Open questions

- Should the status class/reason be exported in diagnostics by default for support bundles?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/238

## Feature: Notification Surface Decision Broker

### Problem

Focus-triggered summary prompting relied primarily on static `tacos.uiSurface` configuration and simple focus context, which could over-notify on low-value cases.

### Goals

- Route focus summaries through a deterministic broker that chooses the minimum required surface.
- Allow notifications only when the top surfaced candidate is high-value and actionable.
- Preserve `tacos.uiSurface` as a hard cap/user override.

### Non-goals

- Adaptive/learned ranking.
- New notification settings.

### User-facing behavior

- Broker emits one of four surfaces: `none`, `statusbar`, `panel`, `notification`.
- When `tacos.uiSurface=notification`, low-value, missing-primary, or suppressed decisions downgrade to panel/background updates instead of toasts.
- Notification toasts are reserved for high-urgency, high-confidence, actionable candidates.

### Technical shape / architecture notes

- Deterministic broker lives in `src/percolation/surfaceBroker.ts`.
- `presentSummary` consumes broker output and uses explicit reason enums for surface selection classes.
- Integration probe command (`tacos.__test.getFocusSurfaceDecision`) and unit tests cover broker outcome matrix.

### Settings and commands affected

- Settings: `tacos.uiSurface`.
- Commands: no end-user command changes; test harness adds `tacos.__test.getFocusSurfaceDecision`.

### Acceptance criteria

- Surface broker returns deterministic output with explicit reason enum for each path.
- Notification path only occurs for high-value actionable candidates.
- `tacos.uiSurface=statusbar|silent` continues to cap output to ambient/silent behavior.

### Risks / failure modes

- Threshold tuning too strict can over-suppress useful notifications.
- Threshold tuning too loose can regress interruption calmness.

### Open questions

- Should broker reason classes be exported in diagnostics snapshots by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/239

## Feature: Companion Home Slot Policy and Single-Primary CTA Arbitration

### Problem

Companion Home top-card content and CTA priority were previously composed from separate local checks, which could produce inconsistent emphasis between `Next` and `Blocked`.

### Goals

- Keep slot placement stable while mapping policy output into fixed `Now/Next/Blocked/Restore` lanes.
- Enforce exactly one primary CTA marker across `Next` and `Blocked` per rendered context.
- Keep advisory-only states explicit when no executable CTA is available.

### Non-goals

- Dynamic card reordering.
- New action types.

### User-facing behavior

- Companion Home remains fixed-order: `Now`, `Next`, `Blocked`, `Restore`.
- Primary CTA precedence is deterministic (`blocked` actionable > `next` actionable > none).
- Demoted/non-primary actions remain visible as secondary/advisory controls.
- Advisory-only labeling is explicit when no safe primary action is available.
- Top-card `Why am I seeing this?` action opens `More Context` and expands `Trust Center` explainability in one click.

### Technical shape / architecture notes

- Central arbitration utility in `src/companionPrimaryCta.ts`.
- `renderWebview` in `src/extension.ts` resolves one `CompanionPrimaryCtaDecision` and passes slot source classes + emphasis tokens into `renderResumeStackCard`.
- Primary CTA impression metric remains single-count per context and stores policy source class.
- `openWhySurfaced` is handled in `src/webview/panelClientScript.ts` and expands `moreContext`, `trustCenter`, and nested why-surfaced disclosures without bypassing trust/privacy guards.

### Settings and commands affected

- No new settings.
- No end-user command changes; integration snapshot command includes CTA/token diagnostics for test assertions.

### Acceptance criteria

- Exactly one primary CTA marker is emitted across `Next` and `Blocked`.
- Companion Home slot source classes map deterministically from policy/arbitration output.
- Advisory-only rows are clearly labeled when no executable primary CTA exists.

### Risks / failure modes

- Blocker precedence could hide useful next-step affordances if secondary presentation regresses.
- Metric drift if primary CTA source class is not set consistently.

### Open questions

- Should CTA arbitration reason classes be exposed in diagnostics snapshots by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
- Issues:
  - https://github.com/jkordish/vscode-tacos/issues/236
  - https://github.com/jkordish/vscode-tacos/issues/240

## Feature: Adaptive Emphasis Tokens and Motion-Safe Companion Transitions

### Problem

Policy emphasis shifts were mostly implied by content changes, which made glanceability weaker and reduced explicit state signaling.

### Goals

- Apply explicit emphasis tokens to Companion `Next` and `Blocked` state captions.
- Keep transitions subtle and disabled under reduced-motion preferences.
- Preserve accessibility under forced-colors/high-contrast modes.

### Non-goals

- Large animation systems.
- Layout movement based on token state.

### User-facing behavior

- Companion state captions display one of `PRIMARY`, `ADVISORY`, or `SUPPRESSED`.
- Token styling uses calm, low-motion state changes.
- Reduced-motion environments disable token/disclosure transitions.

### Technical shape / architecture notes

- Token markup is rendered in `src/resumeStackCard.ts`.
- Token styling and motion guards live in `src/webview/panelStyles.ts`.
- Unit coverage includes style guard assertions in `test/panelStyles.test.ts`.

### Settings and commands affected

- No new settings.
- No command changes.

### Acceptance criteria

- Token classes/attributes are applied from policy output.
- Reduced-motion media query disables token/disclosure transitions.
- Forced-colors mode keeps tokens legible with automatic system color mapping.

### Risks / failure modes

- Overly strong token palette could create visual noise.
- Incomplete motion guards could regress a11y expectations.

### Open questions

- Should token state be included in diagnostics snapshots for support/debug export?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P6`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/241

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
