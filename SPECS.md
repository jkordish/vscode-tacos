# SPECS.md

## Product Overview

TaCoS is a desktop-first VS Code extension for interruption-heavy engineers. It reduces interruption recovery cost by preserving and restoring task state with local-first resume briefs, structured task state capture, safe next actions, and explicit retrieval cues.

## Current Scope

- Automatic and manual resume brief generation.
- Resume Safety Check annunciation after meaningful resume events.
- Evidence-backed companion surfaces and restore actions.
- Structured task state capture with typed local task-state storage.
- Deterministic task-switch detection with conservative likely-boundary prompting.
- Resume Brief v2 state recovery that merges task state with current repo/editor evidence.
- On-demand Daily Cognitive Debrief for abandoned, stale, and unresolved threads.
- Ambient-to-deep UX layering (status bar ambient cues, glanceable Companion Home, one-click deep trust/evidence drill-down).
- Privacy and trust controls (redaction, consent, retention, Restricted Mode behavior).
- Optional provider refinement (`local`, `vscode-lm`, `openai`).
- Legacy task notes, scoped scratchpad, task partitions, standup generation.
- Local-only metrics/diagnostics export and support workflows.

## Non-goals

- Browser/web extension runtime support.
- Cloud sync or hosted backend services.
- Generic “AI productivity assistant” positioning.
- Team dashboards, employee surveillance, or productivity scoring.
- Interruptibility prediction based on biometrics or pseudo-scientific signals.
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

## Feature: Resume Safety Check

### Problem

Users can take the wrong first action after resuming because the visible editor, branch, or task context no longer matches the last captured resume context.

### Goals

- Add a subtle, low-friction post-resume state check.
- Reuse existing summary/context signals instead of building a second resume system.
- Prefer deterministic mismatch signals and show only one stale assumption plus one verification action.

### Non-goals

- Full resume UX redesign.
- Broad speculative ranking or confidence-scoring theater.
- Hard-blocking most actions.

### User-facing behavior

- After a meaningful resume event, TaCoS shows a 10-second pilot-style annunciator with `State`, `Risk`, and `Verify`.
- Focus-return and workspace-reopen checks require `tacos.resumeSafety.idleMinutes` of inactivity; the manual command can force-show the check immediately.
- `Risk` shows at most one stale assumption or mismatch. When no strong mismatch exists, TaCoS falls back to a short “no obvious mismatch” posture.
- `Verify` runs one deterministic action such as refreshing the summary, opening the last likely focus file, jumping to the last edit, rerunning the last task, or opening Problems.
- Strict mode shows `Mismatch detected: fix or proceed?` only for the first risky rerun or mismatched file action when the mismatch signal is strong.

### Technical shape / architecture notes

- Resume safety logic is centralized in `src/resumeSafety.ts`.
- `src/extension.ts` builds/persists one scoped resume-safety context alongside the existing summary flow and presents it through a temporary status-bar item.
- Strict-mode warnings reuse existing command/action handlers and verification actions instead of introducing a separate modal workflow engine.

### Settings and commands affected

- Settings: `tacos.resumeSafety.enabled`, `tacos.resumeSafety.idleMinutes`, `tacos.resumeSafety.strict`.
- Commands: `tacos.showResumeSafetyCheck`.

### Acceptance criteria

- Trigger eligibility, mismatch detection, persistence, and strict-warning decisions are deterministic and test-covered.
- The surfaced check uses only already-supported local signals (summary, branch, files, task/debug/problem affordances).
- Strong mismatch warnings stay narrow and default toward fixing context first.
- Feature removal remains low-risk because the runtime path is isolated from core summary generation.

### Risks / failure modes

- Over-eager mismatch detection could feel naggy if branch/focus heuristics are too broad.
- Weak or stale signals could surface noisy verification actions if fallbacks are not kept conservative.

### Open questions

- Should future versions add a branch-change-after-idle trigger when it becomes cheap and reliable enough?

## Feature: Cognitive Observability v1

### Problem

Engineers doing interruption-heavy work lose mental state across branch switches, partition switches, idle gaps, incident pivots, and parallel work. Pure summaries help, but they do not fully preserve prospective intent, blockers, assumptions, and retrieval cues.

### Goals

- Preserve task state before it decays.
- Restore task state with explicit chronology, evidence, and verification cues.
- Keep prompting conservative, explainable, and easy to dismiss.
- Reuse TaCoS primitives instead of creating a second product surface.
- Keep everything local-first and safe-by-default.

### Non-goals

- Generic chatbot workflows.
- Autonomous task execution.
- Hidden surveillance or interruptibility prediction.
- Team dashboards or productivity scoring.

### User-facing behavior

- `TaCoS: Capture Task State` captures structured task state with:
  - `objective`
  - `working set`
  - `assumptions`
  - `blockers`
  - `next action`
  - `confidence`
  - optional `stale after`
  - `last known safe breakpoint`
- `TaCoS: Mark Task Resolved` explicitly closes the active structured task in the current scope.
- `TaCoS: Confirm Task Switch` lets the user confirm a switch boundary and capture task state if needed.
- `TaCoS: Show Cognitive Debrief` surfaces abandoned threads, unresolved blockers, repeated-switch tasks, stale task states, and open assumptions.
- Likely-switch prompting is optional and conservative. It appears only at deterministic likely boundaries and always gives `Capture`, `Skip`, `Snooze`, and `Dismiss`.
- Resume Brief v2 prioritizes:
  - what you were doing
  - what changed since
  - next likely safe move
  - open questions and unresolved blockers
  - timeline, evidence, and retrieval cues
- Companion Home remains ambient -> glanceable -> deep. TaCoS does not become a chat sidebar.

### Technical shape / architecture notes

- `src/taskState.ts` is the typed local structured task-state store.
- `src/taskSwitch.ts` provides deterministic switch-candidate detection and explainability.
- `src/structuredRecovery.ts` merges structured task state into resume summaries.
- `src/cognitiveDebrief.ts` derives debrief sections from structured task state.
- `src/extension.ts` orchestrates capture, prompt gating, panel rendering, task resolution, and diagnostics wiring.
- `src/webview/panelFragments.ts` renders the `Task State` and `Cognitive Debrief` cards.
- Legacy task-note flows remain available for compatibility, but structured task state is now the primary recovery primitive.
- File-cluster drift is supporting evidence only and never a sole switch trigger.
- Restricted Mode remains fail-closed for trust-sensitive signals; branch/debug/task context degrades gracefully when unavailable.

### Settings and commands affected

- Settings:
  - `tacos.taskCheckpoint.enabled`
  - `tacos.taskCheckpoint.promptOnLikelySwitch`
  - `tacos.promptCheckpointOnBlur` remains legacy note-only behavior
  - `tacos.resumeSafety.idleMinutes` is reused as the idle boundary threshold for likely-switch detection
- Commands:
  - `tacos.captureTaskCheckpoint`
  - `tacos.markTaskResolved`
  - `tacos.confirmTaskSwitch`
  - `tacos.showCognitiveDebrief`

### Acceptance criteria

- Structured task state is stored locally in typed, versioned form.
- Manual task state capture is fast and editable later.
- Likely-switch detection is deterministic, conservative, and explainable in diagnostics.
- Resume Brief v2 uses structured task state when present and keeps `next likely safe move` framed as suggestion plus verification.
- Cognitive Debrief remains on-demand, local-only, and non-surveillant.
- Local metrics capture task state capture usage, switch detection, debrief surfacing, and structured-state cohorts without adding remote telemetry.

### Risks / failure modes

- Overlap between legacy task notes and structured task state could confuse users if compatibility copy drifts.
- Aggressive switch detection could feel naggy if supporting signals ever become sole triggers.
- Richer task-state persistence increases the importance of clear privacy copy and explicit workspace forget flows.

### Open questions

- Should future versions support richer task-state editing from the panel card itself without adding modal complexity?
- Should future versions add a scheduled debrief summary, or remain strictly on-demand?

### Research mapping

- Leroy (2009): unfinished-task carryover supports checkpointing and explicit closure.
- Altmann and Trafton (2002, 2007) plus Monk, Trafton, and Boehm-Davis (2008): resumption is a retrieval problem, so TaCoS preserves prospective goal state and recovery cues.
- Adamczyk and Bailey (2004) plus Iqbal and Bailey (2008): prompting belongs at likely boundaries, not arbitrary mid-flow moments.
- Parnin and Rugaber plus DeLine and Parnin (2010): interrupted programming recovery depends on chronology, artifacts, intent, and cues, not summary text alone.
- TaCoS preprint: summaries help, but evidence and timeline cues can outperform summary-only recovery paths.
- Interruptibility replication: TaCoS explicitly avoids biometrics and pseudo-scientific interruptibility prediction.
- Amershi et al. (2019): prompting remains calm, explainable, dismissible, and user-controlled.
- Parasuraman and Riley (1997) plus Parasuraman, Sheridan, and Wickens (2000): TaCoS automates orientation and retrieval, not judgment or execution.

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P13`.
- Research map: `docs/references.md`.

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

### User-facing behavior

- Broker emits one of four surfaces: `none`, `statusbar`, `panel`, `notification`.
- When `tacos.uiSurface=notification`, low-value, missing-primary, or suppressed decisions downgrade to panel/background updates instead of toasts.
- Notification toasts are reserved for high-urgency, high-confidence, actionable candidates.

### Technical shape / architecture notes

- Deterministic broker lives in `src/percolation/surfaceBroker.ts`.
- `presentSummary` consumes broker output and uses explicit reason enums for surface selection classes.
- The summary notification presents 5 actions: `Open Companion`, `Copy Summary`, `Copy + Open Codex`, `Open Standup`, `Refresh`. The formerly separate `Copy prompt for Codex` button was removed as redundant with `Copy + Open Codex`.
- Integration probe command (`tacos.__test.getFocusSurfaceDecision`) and unit tests cover broker outcome matrix.

### Settings and commands affected

- Settings: `tacos.uiSurface`, `tacos.percolationPolicyEnabled`, `tacos.percolationNotificationBrokerEnabled`.
- Commands: no end-user command changes; test harness adds `tacos.__test.getFocusSurfaceDecision`.

### Acceptance criteria

- Surface broker returns deterministic output with explicit reason enum for each path.
- Notification path only occurs for high-value actionable candidates.
- `tacos.uiSurface=statusbar|silent` continues to cap output to ambient/silent behavior.
- Disabling `tacos.percolationNotificationBrokerEnabled` keeps `tacos.uiSurface` behavior but bypasses suppression-aware broker downgrades.
- Disabling `tacos.percolationPolicyEnabled` falls back to legacy `uiSurface` presentation semantics and bypasses percolation suppression/ranking-driven arbitration.

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
- Blocker selection uses a deterministic cross-source arbitration pass (`task failure`, `failing command`, `diagnostics`, `branch context`, `low confidence`, `restricted mode`, `no next steps`) and surfaces `severity`, `confidence`, and `actionability` metadata for the selected blocker.
- Top-card `Why am I seeing this?` action opens `More Context` and expands `Trust Center` explainability in one click.
- Top-card actions include `Review AI payload preview` so the current surfaced decision can deep-link into consent context in one click.
- Top-card `Open evidence tray` action opens `More Context` and expands the `Evidence` tray in one click.
- Evidence tray groups items by relevance: surfaced-decision evidence, other openable evidence, then context-only evidence.

## Feature: Evidence Tab — Grouped Recent Anchors (P21)

### Behavior contract

- The Evidence tab defaults to `recent` group mode on every panel open: top-10 events within the configured granularity window, rendered as a newest-first flat list.
- Four group modes are supported via toggle controls rendered in the Evidence card header:
  - `recent` — `selectRecentAnchors(entries, 10, windowMs, now)`: at most 10 items from within `windowMs` before now, sorted newest-first.
  - `by-file` — `groupTimelineByFile(entries, windowMs, now)`: items within `windowMs` grouped under their file label; non-file items under a bracketed kind key (e.g. `[terminal]`); groups sorted by most-recent row descending.
  - `by-time` — `groupTimelineByTimeBucket(entries, bucketSizeMs, 4, now)`: items slotted into up to 4 equal time buckets; first bucket labelled `Last N min`, subsequent buckets labelled `M–N min ago`; empty buckets omitted.
  - `by-action` — `groupTimelineByAction(entries, windowMs, now)`: items within `windowMs` grouped by action category and rendered via the dedicated action-group renderer.
- `Expand full timeline` affordance is wired into the grouped evidence card and expands the full timeline log in collapsible sections.
- `setEvidenceGroupMode` webview message updates `state.panelEvidenceGroupMode` and triggers a re-render; demo mode ignores this message.
- `tacos.evidence.granularity` setting (`coarse` = 10 min, `medium` = 5 min, `fine` = 2 min) controls the `windowMs` passed to the grouped evidence selectors/renderers. Default is `medium`.

### Type contracts

- `EvidenceGroupMode = 'recent' | 'by-file' | 'by-time' | 'by-action'` exported from `src/timeline.ts`.
- `EvidenceGranularity = 'coarse' | 'medium' | 'fine'` exported from `src/types.ts`.
- `ExtensionConfig.evidenceGranularity: EvidenceGranularity` is read at render time via `getConfig()`.
- `RuntimeState.panelEvidenceGroupMode: EvidenceGroupMode` persists group mode across re-renders within a panel session; resets to `'recent'` on panel open.

### Pure functions (src/timeline.ts)

- `selectRecentAnchors(entries, count, windowMs, now)` — returns `RecentAnchorRow[]` capped at `count`, sorted descending by timestamp, limited to the recent window relative to `now`, including entries at `now`.
- `groupTimelineByFile(entries, windowMs, now)` — returns `EvidenceFileGroup[]` sorted by most-recent row descending; items outside window are excluded.
- `groupTimelineByTimeBucket(entries, bucketSizeMs, bucketCount, now)` — returns `EvidenceTimeBucket[]` with only non-empty buckets; rows within each bucket sorted newest-first.

### Acceptance criteria

- Evidence tab renders in `recent` mode by default on every panel open.
- Toggling any of the four mode buttons updates the tab content without a full extension reload.
- `tacos.evidence.granularity` changes are reflected on the next render; no restart required.
- All three pure functions pass unit tests for: window filtering, count capping, sort order, empty input, and correct bucket label format.
- Empty state is graceful: zero items in any mode renders a `No recent anchors` / `No activity in this window` placeholder rather than an empty container.
- Trust Center exposes a concise Trust & Privacy tray including `privacy preset`, `retention policy`, `AI provider mode`, and consent status for current workspace context.
- Trust Center actions include `Review AI payload preview`, `Revoke AI payload consent`, and `Open Privacy & Safety`; the nested `Why am I seeing this?` panel also includes a direct payload-preview deep-link for that decision context.
- Restricted Mode rendering explicitly marks filtered execution affordances as `SUPPRESSED` and calls out filtered signal classes (`git execution`, `terminal command collection`) in Trust Center/explainability copy.

### Technical shape / architecture notes

- Central arbitration utility in `src/companionPrimaryCta.ts`.
- Blocker model v2 in `src/blockerModel.ts` scores candidate blockers before choosing the primary blocked state (`severityScore`, `confidenceScore`, `actionabilityScore`).
- `renderWebview` in `src/extension.ts` resolves one `CompanionPrimaryCtaDecision` and passes slot source classes + emphasis tokens into `renderResumeStackCard`.
- Primary CTA impression metric remains single-count per context and stores policy source class.
- Metrics capture one blocker-promotion source counter per session (`taskFailure`, `commandFailure`, `diagnostics`, `branchContext`, `lowConfidence`, `restricted`, `noNextSteps`) for post-hoc blocker mix analysis.
- `openWhySurfaced` is handled in `src/webview/panelClientScript.ts` and expands `moreContext`, `trustCenter`, and nested why-surfaced disclosures without bypassing Trust & Privacy guards.
- `openEvidenceTray` is handled in `src/webview/panelClientScript.ts` and expands `moreContext` + `evidence` disclosures while preserving existing click-time evidence target validation.
- `openAiPayloadPreview` and `revokeAiPayloadConsent` are handled via webview message routing in `src/extension.ts`, and Trust Center expansion increments `trustTrayOpens` plus `restrictedTrustTrayOpens` (restricted runtime only) local metric counters.
- AI payload preview opens are locally counted by entrypoint (`trust-center`, `why-surfaced`, `companion-home`) to validate drill-down adoption without adding remote telemetry.

### Settings and commands affected

- Settings: `tacos.percolationExplainabilityEnabled`.
- No end-user command changes; integration snapshot command includes CTA/token diagnostics for test assertions.

### Acceptance criteria

- Exactly one primary CTA marker is emitted across `Next` and `Blocked`.
- Companion Home slot source classes map deterministically from policy/arbitration output.
- Advisory-only rows are clearly labeled when no executable primary CTA exists.
- Disabling `tacos.percolationExplainabilityEnabled` hides top-card and Trust Center `Why am I seeing this?` explainability affordances while preserving core resume guidance/actions.

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

## Feature: Task Notes

### Problem

Users need short memory anchors between task switches.

### Goals

- Support scoped sticky notes with lifecycle actions.
- Integrate notes into resume and standup flows safely.

### Non-goals

- Full knowledge base workflows.

### User-facing behavior

- Add/list/clear task note lifecycle commands.
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
- Diagnostics snapshot includes configured and active percolation rollout flag state (`policy`, `explainability`, `notification broker`).
- Metrics CSV/baseline snapshot include percolation decision-chain fields (`percolationDecisionCount`, segmented surface selections including `panel-silent`/`panel-emphasis`, and confidence-band counters).

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

## Feature: Percolation Signal Normalization Adapters

### Problem

Percolation ranking depends on multiple runtime inputs (git/task/debug/trust/privacy), but without a single normalized signal bundle per trigger, policy behavior is harder to reason about and test.

### Goals

- Normalize trigger-time runtime context into typed percolation signals.
- Feed ranked percolation decisions from adapter output instead of ad hoc defaults.
- Keep trust-sensitive signal adapters filtered in Restricted Mode.
- Apply user-authored ranking priors (task notes, saved corrections, scratchpad context) with deterministic precedence and suppression behavior.

### Non-goals

- Learned or opaque ranking heuristics.
- New remote telemetry pipelines.

### User-facing behavior

- Percolation ranking decisions are driven by a deterministic signal bundle on each summary trigger.
- Restricted Mode does not promote trust-sensitive branch/task failure adapters as runtime signals.
- Trust/Privacy mode transitions surface through explicit normalized trust/privacy signals.
- Git semantic adapters explicitly capture branch switch, recent commit checkpoint, and upstream divergence signals when trusted git context is available.
- Ranking includes deterministic user-prior promotion/suppression metadata; saved corrections can suppress conflicting checkpoint/scratchpad promotions.
- No-change auto-trigger fingerprinting includes partition scope (`v2`) so task-partition transitions do not inherit stale no-change suppression.
- Partition switches reset suppression memory for destination scope (`lastSummaryContextUnchanged`, nudge cooldown memory, and noise-budget memory).

### Technical shape / architecture notes

- Signal adapter layer in `src/percolation/signals.ts`.
- Trigger orchestration records per-context normalized bundles in `src/extension.ts`.
- Ranking input (`createPercolationPolicyInput`) consumes adapted signal bundles when available.
- Ranking input normalizes user-prior hints through `PercolationUserPriors` and annotates candidate metadata (`priorPromotion`, `priorSuppression`, source flags) for policy scoring and metrics.
- Auto-trigger fingerprinting in `src/extension.ts` uses a structured `v2` payload (`scope`, active file, top activity snapshots, counters) hashed for deterministic significant-change checks.
- Suppression-memory keys for nudge cooldown and noise-budget windows are partition-scoped and reset on explicit task-partition switches.

### Settings and commands affected

- No new settings.
- No new commands.

### Acceptance criteria

- Every trigger path has a normalized signal bundle available for ranking.
- Adapter outputs are deterministic and covered by trusted/restricted unit tests.
- Policy input receives explicit git semantic signal records (`branch-switch`, `git-commit`, `git-divergence`) when those semantics are present.
- Prior precedence and conflict resolution are deterministic across checkpoint/correction/scratchpad inputs and covered by unit tests.
- No-change and suppression-memory checks do not carry across task-partition transitions.

### Risks / failure modes

- Duplicate or stale signal bundles can bias ranking output if context cache handling regresses.

### Open questions

- Should optional per-signal debug counters be exposed in local diagnostics in a future slice?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P8`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/248
- Issue: https://github.com/jkordish/vscode-tacos/issues/249
- Issue: https://github.com/jkordish/vscode-tacos/issues/251
- Issue: https://github.com/jkordish/vscode-tacos/issues/253

## Feature: Changes Precision and Novelty Profiling

### Problem

`Changes Since Last Time` was useful but coarse, and percolation novelty scoring relied on static defaults instead of a structured summary signal.

### Goals

- Improve change-card precision across code deltas, runs, blockers, key files, git context, and references.
- Produce a deterministic novelty profile (`score` + `low`/`medium`/`high` bucket) directly from summary signals.
- Feed novelty profile values into default percolation candidate novelty fields.
- Record local novelty bucket distribution counters in metrics exports.

### Non-goals

- Learned novelty tuning.
- Networked telemetry.

### User-facing behavior

- `Changes Since Last Time` now renders precision buckets:
  - `Code`, `Runs`, `Blocker`, `Key files`, `Git`, and `References` (when present).
- Session recap includes explicit novelty profile labeling (`low`, `medium`, or `high` with deterministic score).
- Candidate novelty for default percolation surfaced items adapts to summary novelty profile instead of using static constants.

### Technical shape / architecture notes

- `src/summary.ts` computes structured precision signals and a `SummaryNoveltyProfile`.
- `ResumeSummary` includes optional `noveltyProfile` payload (`src/types.ts`).
- `src/percolation/types.ts` consumes summary novelty profile to set default candidate novelty values and metadata.
- `src/extension.ts` records one novelty bucket counter per metric session.
- `src/metrics.ts` exports and summarizes novelty bucket counters in CSV/baseline outputs.

### Settings and commands affected

- No new settings.
- No new commands.

### Acceptance criteria

- Precision buckets are deterministic for the same signal input.
- Summary novelty profile is always present on locally generated summaries.
- Default candidate novelty values increase/decrease with novelty profile score.
- Metrics CSV/header + baseline snapshot include novelty bucket counters.

### Risks / failure modes

- Overweighting novelty can degrade continuity if profile scoring drifts.
- Noisy terminal or git context can inflate novelty if precision parsing regresses.

### Open questions

- Should novelty profile details be surfaced in diagnostics payloads by default?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P8`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/252

## Feature: Prospective Intent Capture and Cognitive Observability Loop (P16)

### Problem

Automated summaries reliably capture what happened but miss **prospective information** — the intended next step and verification action that existed in the engineer's working memory at the moment of the context switch. The ICSE'26 TaCoS research paper identifies this as the primary remaining gap between automated resumption support and manual-note quality. Additionally, checkpoint prompts firing during peak edit activity create the self-interruption the tool is meant to prevent, and there is no local visibility into per-session interruption cost trends.

### Goals

- Capture prospective intent (next verification action) at checkpoint time before context switches.
- Suppress task state capture prompts when the user is actively working (high-load window) to avoid self-interruption.
- Surface a local-only session friction summary so engineers can observe their own interruption cost trends.
- Record gold-metric contract fields (prospective capture count, high-load suppression count, friction summary opens) in local metrics without adding remote telemetry.

### Non-goals

- AI-generated prospective intent suggestions.
- Automatic task state capture prompting at arbitrary intervals.
- Remote or team-level friction dashboards.
- Hard-blocking execution on missing prospective intent.

### User-facing behavior

- `TaCoS: Capture Task State` now includes a `Prospective next verification (optional)` InputBox step — a single short line (max 280 chars) for the intended next verification action.
- Checkpoint prompt is suppressed when `lastMeaningfulActivityAt` is within the cooldown window of the current time (`shouldDeferCheckpointPromptHighLoad`). Suppression reason is recorded as `high-load-deferred`.
- `TaCoS: Show Session Friction Summary` opens a local markdown document in a side panel with prompt-per-hour, suppression health, and mismatch rate from workspace metric history. Requires at least one metric session to exist.
- Structured task state with a filled `prospectiveNextVerification` field is surfaced to AI refinement flows immediately after the objective/next-action/confidence triad.

### Technical shape / architecture notes

- `prospectiveNextVerification?: string` added to `StructuredTaskState` and `CreateStructuredTaskStateInput` in `src/taskState.ts`.
- `normalizeTask()`, `createStructuredTaskState()`, and `updateStructuredTaskState()` handle the field with `patchHasOwn` guard for correct patch-clear semantics.
- `computeCheckpointFieldCompleteness()` now scores 9 fields (was 8); `prospectiveNextVerification` presence is a strong signal.
- `shouldDeferCheckpointPromptHighLoad(input: CheckpointHighLoadDeferralInput): boolean` in `src/noiseControl.ts` returns `true` when `activityAgeMs` is non-negative and within `highLoadWindowMs`.
- High-load deferral is wired into `maybeOfferTaskCheckpointPrompt` in `src/extension.ts` after the existing budget check, using `config.cooldownMinutes * 60_000` as the window.
- `showSessionFrictionSummaryCommand` in `src/extension.ts` reads `MetricRecord[]` from `workspaceState`, calls `buildMetricsBaselineSnapshotMarkdown`, and opens the result as a `markdown` text document in `ViewColumn.Beside`.
- Three new `MetricRecord` fields: `prospectiveIntentCaptureCount`, `checkpointPromptSuppressedHighLoad`, `sessionFrictionSummaryOpened`. All wired into CSV headers, `buildMetricsCsv` row builder, `buildMetricsBaselineSnapshotMarkdown`, and `hasAnyRecordedMetric`.
- Command `tacos.showSessionFrictionSummary` is registered in `package.json` with `onCommand:tacos.showSessionFrictionSummary` activation event.

### Settings and commands affected

- No new settings.
- Commands:
  - `tacos.captureTaskCheckpoint` — extended with `prospectiveNextVerification` capture step.
  - `tacos.showSessionFrictionSummary` — new command.

### Acceptance criteria

- `prospectiveNextVerification` is stored, normalized, and surfaced in prompt context deterministically.
- Checkpoint completeness score reflects 9 fields with `prospectiveNextVerification` as a positive signal.
- `shouldDeferCheckpointPromptHighLoad` is deterministic, unit-tested (10 cases), and wired into the checkpoint prompt flow.
- `showSessionFrictionSummaryCommand` renders the baseline snapshot markdown and opens it beside the current editor.
- Three new metric fields appear in CSV export headers, row builder, and baseline snapshot output.
- `tacos.showSessionFrictionSummary` is declared in `package.json` contributes and activationEvents.
- All 399 unit tests pass; `verify:quick` exits 0.

### Risks / failure modes

- Prospective intent prompt adds one extra step to task state capture flow — keep it optional and fast to skip.
- High-load suppression window uses `cooldownMinutes` as a proxy; too large a value could suppress task state capture prompts entirely in busy sessions.

### Open questions

- Should prospective intent be editable from the Task State panel card without reopening the full checkpoint capture flow?
- Should the friction summary auto-refresh, or remain strictly on-demand?

### Research mapping

- ICSE'26 TaCoS preprint: prospective information is the primary gap between automated and manual-note resumption quality.
- Altmann and Trafton (2002, 2007): prospective goal encoding at interruption time is the key to reliable resumption.
- Adamczyk and Bailey (2004) / Iqbal and Bailey (2008): high-load suppression aligns with prompting at breakpoints, not mid-activity.

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P16`.
- Research map: `docs/references.md`.

## Feature: Provenance Header Badges (P20)

### Problem

Users cannot tell at a glance whether the currently displayed Companion panel content was produced purely by local deterministic logic or by an AI provider. Without a persistent, always-visible indicator the privacy/trust posture of the active surface is invisible between interactions with Trust Center.

### Goals

- Render an always-visible, non-interactive status badge in the Companion panel header that communicates the current provenance posture.
- Distinguish two states: **Local-only** (no AI provider active) and **AI used** (provider active, with optional one-click payload preview deep-link).
- Integrate cleanly with existing Trust Center and AI Payload Preview flows.
- Keep the indicator cost-free: no network, no new settings, no new commands.

### Non-goals

- Per-card or per-section provenance granularity.
- Historical provenance audit log.
- New settings or commands for badge visibility.
- Any remote telemetry from badge interactions.

### User-facing behavior

- A provenance badge row appears in the Companion panel header, beneath the title row and above action buttons.
- **Local-only state**: `● Local-only` badge in green — rendered when demo mode is active, the provider mode is `restricted` or `disabled`, or the active AI provider for consent is `local`.
- **AI-used state**: `● AI used · <provider> · <model> · payload: <field list>` badge in amber — rendered in all other active-provider states. `<model>` is the active vscode-lm model label or openai model name; `<field list>` enumerates the fields included in the AI prompt (e.g. `summary`, `notes`, `scratchpad`).
- When AI is active, a `Preview payload ↗` link appears inline beside the badge. Clicking it opens the AI Payload Preview panel (same flow as the Trust Center deep-link).
- The badge is always visible; it does not require any user interaction to appear and cannot be dismissed.

### Technical shape / architecture notes

- `ProvenanceBadgeInput` interface and `renderProvenanceBadge(input: ProvenanceBadgeInput): string` added to `src/webview/panelFragments.ts`.
- `provenanceBadgeTrustedHtml?: TrustedHtml` added to `PageHeaderInput` in `src/webview/panelFragments.ts`; `renderPageHeader()` inserts the badge row between the title row and the actions row.
- `provenanceIsLocal` is computed in `renderWebview()` in `src/extension.ts`:
  `demoMode || companionRuntimeMode === 'restricted' || companionRuntimeMode === 'disabled' || activeAiProviderForConsent === 'local'`.
- Badge CSS (`.header-provenance`, `.badge-local`, `.badge-ai`, `.provenance-preview-link`) added to `src/webview/panelStyles.ts`.
- `provenance-badge` entrypoint added to the valid-entrypoints guard in the `openAiPayloadPreview` handler in `src/webview/panelClientScript.ts`.
- The `Preview payload` button uses `data-action="openAiPayloadPreview" data-ai-payload-entrypoint="provenance-badge"` — consistent with the existing Trust Center and Why-surfaced entrypoint pattern. Local AI payload preview open counts are incremented by entrypoint for adoption tracking without remote telemetry.

### Settings and commands affected

- No new settings.
- No new commands.
- Existing command affected: `tacos.openAiPayloadPreview` (reachable via badge preview link when AI is active).

### Acceptance criteria

- Badge renders deterministically in both local and AI-used states for all valid `ProvenanceBadgeInput` combinations.
- XSS injection in `providerLabel`, `modelLabel`, and each `payloadFields` entry is escaped before render.
- `renderPageHeader` includes the badge row when `provenanceBadgeTrustedHtml` is provided.
- `provenance-badge` is accepted as a valid entrypoint in the `openAiPayloadPreview` handler.
- CSS classes `.badge-local` and `.badge-ai` are present in `panelStyles.ts`.
- `renderProvenanceBadge` and `renderPageHeader` badge-row behavior are covered by unit tests.
- All `verify:quick` gates pass (lint, typecheck, format check, unit tests).

### Risks / failure modes

- Badge could drift out of sync with actual provider state if `provenanceIsLocal` logic is not updated when new provider modes are added.
- `showPreviewLink` flag must remain false in local-only state to avoid surfacing a non-functional link.

### Open questions

- Should future versions track per-entrypoint payload preview open counts in the diagnostics snapshot by default?
- Should the badge become interactive (toggle Trust Center) in a future slice?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P20`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/310

## Feature: Inline Editing with Autosave Indicator and Undo for Destructive Actions (P22)

### Problem

Cognitive recovery is a trust-sensitive workflow. Silent data loss after a destructive action (deleting a note, resolving a task) undermines user confidence in the "local-first" and "no hidden behavior" promises. Without visible save state and reversible actions, users cannot verify those promises in the moment. TaCoS research found 80/87 manual notes contained an immediate next step, making note fidelity safety-critical.

### Goals

- Show users when a field save is pending and when it completed.
- Make note deletion and task resolution reversible for a short window.
- Keep toast behavior deterministic and test-covered.
- Add a local metric counter for undo usage.

### Non-goals

- Server-side or cross-session undo history.
- Undo for non-destructive actions (view changes, navigation).
- Persistent undo buffer beyond a single in-flight operation.

### User-facing behavior

- **Autosave indicator**: while typing in `#cockpit-verify-first` or `#cockpit-next-step`, the `#cockpit-save-state` element shows `Saving…`; after the 600 ms debounce flushes and `updateProspective` is posted, it shows `Saved • HH:MM`. The region is `aria-live="polite"` so screen reader users receive the confirmation without interruption.
- **Note deletion undo**: clicking `checkpointDismiss` on a note with a `data-note-id` attribute shows a `Note dismissed.` toast with an `Undo` button; TTL is 30 s. Clicking `Undo` posts `undoDeleteNote` back to the extension.
- **Task resolve undo**: clicking `taskStateResolve` shows a `Task state marked resolved.` toast; TTL is 5 s. No undo action is attached (the short TTL is the signal that this is a softer destructive action).
- Toasts self-dismiss after their TTL; a new toast replaces any existing one.

### Technical shape / architecture notes

- `showToast(message, opts)` helper added to the generated script in `src/webview/panelClientScript.ts`; `opts.actionText` / `opts.onAction` wires the optional undo button; `opts.timeoutMs` controls TTL.
- `setCockpitSaveState(message)` helper applies a 15 ms announce-timer before setting `textContent` so the same flush cycle that triggers the live region does not race with DOM layout.
- `undoDeleteNote` message variant (`{ type: 'undoDeleteNote', noteId: string }`) added to the `WebviewMessage` union type and `parseWebviewMessage` validator in `src/webviewMessages.ts`.
- `noteDeleteUndoCount` counter field added to `MetricRecord` in `src/metrics.ts`; included in CSV headers, row builder, `buildMetricsBaselineSnapshotMarkdown`, and `hasAnyRecordedMetric`.

### Settings and commands affected

- No new settings.
- No new commands.

### Acceptance criteria

- `#cockpit-save-state` shows `Saving…` within 20 ms of an `input` event on `#cockpit-verify-first` or `#cockpit-next-step`.
- `#cockpit-save-state` shows `Saved •` after the 600 ms debounce + 15 ms announce timer.
- `updateProspective` message is posted with the correct `field` after the debounce.
- `checkpointDismiss` with a `data-note-id` shows a toast containing `Note dismissed` with an `Undo` button that posts `undoDeleteNote`.
- Toast auto-clears after its TTL.
- `taskStateResolve` shows a toast containing `Task state marked resolved`.
- `noteDeleteUndoCount` appears in CSV headers and markdown baseline snapshot.
- All 4 new state-machine tests pass; `npm test` exits 0 (464 tests).

### Risks / failure modes

- Undo buffer capped at 1 item with a clear TTL; rapid note deletion can only undo the most recent dismiss.
- `setCockpitSaveState` uses a 15 ms `setTimeout` to defer the live-region update; tests must advance fake timers past this threshold before asserting `textContent`.

### Open questions

- Should a future slice add extension-side note restoration logic when `undoDeleteNote` is received, or is the toast sufficient as a visible affordance placeholder?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P22`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/312

## Feature: ARIA Completion — Full Keyboard Navigation, Tab Focus, and Live Regions (P23)

### Problem

The companion panel tab strip had partial ARIA support: roving `tabindex` and keyboard arrow navigation existed, but activating a tab with `Enter` or `Space` did not transfer keyboard focus into the newly visible panel. Screen reader users and keyboard-only users could activate tabs but would be stranded at the tab strip rather than landing on the panel's first interactive element. Save-state and toast live regions existed in the DOM but had no unit coverage asserting their presence, roles, or attributes.

### Goals

- Complete the ARIA APG Tabs keyboard contract: `Enter`/`Space` activate a tab **and** transfer focus to the first focusable element in the newly activated panel.
- Confirm all tab panels carry correct `role`, `aria-labelledby`, and `hidden`-toggling attributes via explicit unit assertions.
- Confirm `aria-live="polite"` save-state region and `aria-live="assertive"` toast region attributes via explicit unit assertions.
- Add keyboard/ARIA smoke checks to the manual runbook.

### Non-goals

- New focus-trap logic inside panels.
- Changes to the underlying tabbed-panel HTML structure.
- Screen reader end-to-end automation tests (covered manually per runbook).

### User-facing behavior

- Pressing `Enter` or `Space` on a focused tab activates the tab and moves keyboard focus to the first interactive element inside the newly visible panel (`button`, `a[href]`, `input`, `select`, `textarea`, or `[tabindex]:not([tabindex="-1"])`). If no such element exists, focus falls back to the panel container (which is given `tabindex="-1"` to remain focusable).
- `ArrowLeft` / `ArrowRight` cycle focus through tabs in the tab strip (wrapping).
- `Home` / `End` jump focus to the first / last tab in the strip.
- Inactive tabs carry `tabindex="-1"`; the active tab carries `tabindex="0"`.
- Each tab panel carries `role="tabpanel"`, `aria-labelledby="<tabId>"`, and a `hidden` attribute that is added/removed on tab switch.
- The `#cockpit-save-state` element carries `aria-live="polite"` so `Saved • HH:MM` / `Saving…` confirmations are announced without interruption.
- The `#toast-region` element carries `role="alert"`, `aria-live="assertive"`, and `aria-atomic="true"` so undo toasts are announced immediately.

### Technical shape / architecture notes

- `focusFirstPanelElement(tabId)` helper in `src/webview/panelClientScript.ts` locates the first focusable descendant of the panel identified by `tabId` and focuses it; falls back to focusing the panel container after setting `tabindex="-1"`.
- The `Enter` / `Space` branch in the ARIA Tabs keydown listener calls `switchToTab(targetTabId)` and then `focusFirstPanelElement(targetTabId)`.
- Existing `ArrowLeft` / `ArrowRight` / `Home` / `End` logic is unchanged.
- `test/panelA11y.test.ts` carries four describe blocks: axe clean pass for card layout, axe clean pass for tabbed panel layout, tab-strip ARIA attribute assertions, tab-panel attribute assertions, and live-region attribute assertions.

### Settings and commands affected

- No new settings.
- No new commands.

### Acceptance criteria

- axe-core reports zero violations for both the standard card layout and the full tabbed panel layout.
- All rendered tab elements have `role="tab"`, `aria-selected`, `aria-controls`, and correct `tabindex` (`"0"` for active, `"-1"` for others).
- All rendered panel elements have `role="tabpanel"`, `aria-labelledby`, and `hidden` attribute on inactive panels.
- `#cockpit-save-state` carries `aria-live="polite"`.
- `#toast-region` carries `role="alert"`, `aria-live="assertive"`, and `aria-atomic="true"`.
- `Enter` / `Space` on a tab activates it and transfers focus into the panel.
- Manual smoke checks K1–K4 in `docs/manual-smoke-runbook.md` pass.

### Risks / failure modes

- Focus transfer on `Enter`/`Space` could strand focus if a panel's content is not yet rendered. Mitigated by falling back to panel container focus with `tabindex="-1"`.
- `aria-live` region changes can cause double-announcement if the region text and the region container are both observed by the screen reader; kept minimal with text-only updates.

### Open questions

- Should a future slice add `aria-orientation="horizontal"` to the `tablist` element explicitly (currently implied by horizontal layout)?

### Links to plan items / issues / PRs

- Plan: `PLANS.md` item `P23`.
- Issue: https://github.com/jkordish/vscode-tacos/issues/313
