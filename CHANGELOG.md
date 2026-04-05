# Changelog

All notable changes to this project are documented in this file.

## [0.99.2] - 2026-04-05

### Changed

- UX polish rounds 6–10 (branch `fix/ux-ui-polish`):
  - Companion grid slot-token `<span>` elements now carry `aria-hidden="true"` so screen readers skip decorative emphasis glyphs (`✓` / `~` / `–`).
  - Resume Path progress badge copy simplified: "All steps complete ✓" → "All steps complete" (decorative checkmark removed; badge label is now plain text).
  - Companion grid Blocked section: `blockerTitle` and `blockerDetail` paragraphs are suppressed when `hasBlocker` is false — the state-caption "Status: No blocker" is sufficient and avoids rendering empty content areas.
  - `panelStyles.ts`: `.companion-block p:not(.state-caption):not(.companion-primary) { margin: 0 }` resets browser-default paragraph margins inside tight grid cells without overriding explicit spacing on `.state-caption` and `.companion-primary` elements (previously the broad `.companion-block p` rule incorrectly zeroed those margins); `.companion-block .status-actions { margin-top: var(--space-2) }` keeps the action row consistently spaced; `.companion-block .compact-list { padding-left: 12px }` tightens list indent inside grid cells.
  - `getResumeFlowSnapshot` instrumentation payload: `hasCompanionHomeCard` renamed to `hasResumeBriefCard`; `isCompanionHomeFirstCard` renamed to `isResumeBriefFirstCard` to match the current card title "Resume Brief".
  - `hasCognitiveDebriefCard` in `getResumeFlowSnapshot` now checks for `<h3>Mental Load</h3>` (current card title) OR `<h3>Cognitive Debrief</h3>` (backwards-compatibility fallback).
  - Integration test `resumeFlowCriticalPath.js` updated to assert `hasResumeBriefCard` and `isResumeBriefFirstCard` (was `hasCompanionHomeCard` / `isCompanionHomeFirstCard`).
  - README: "Companion Home" terminology updated to "Resume Brief" in two locations (interaction model bullet and Companion Panel section slot-token description).

## [0.99.1] - 2026-04-04

### Fixed

- Badge class no longer produces trailing whitespace when `badge-attention` modifier is absent (`panelFragments.ts`).
- Removed duplicate `font-size` and `letter-spacing` declarations in h3 CSS block (`panelStyles.ts`).
- Fixed misleading comment at `maybeOfferTaskCheckpointPrompt` — clarifies why `beginEphemeralMetricSession` is called before suppression paths.
- Fixed trigger misclassification in `beginEphemeralMetricSession`: function now accepts an optional `TriggerReason` parameter (default `'manual'`); call-site derives `'focus'` vs `'manual'` from `reasonCodes` so focus-driven checkpoint prompt events are no longer silently misclassified.
- Fixed stale checkpoint overlay in `panelBaseSummary`: `refinedPanelBaseSummary` is now a clean baseline (raw AI output + intentOverride only); checkpoint and taskState overlays are applied separately on the cached/displayed summary path, preventing stale checkpoint guidance from persisting after note resolution.
- Removed redundant `if (ephemeralCreated)` guard in `showSessionFrictionSummaryCommand` — `finalizeEphemeralMetricSession` already no-ops when not created.
- Updated broken internal doc references to deleted files: `docs/metrics-baseline.md` references replaced with `docs/metrics.md`; `docs/ux/dynamic-percolation-v0.8.0-spec.md` references replaced with `docs/ux/dynamic-percolation-mockups.md` in `README.md`, `CHANGELOG.md`, `PLANS.md`, `docs/metrics.md`, and `docs/manual-smoke-runbook.md`.

### Added

- P16 Prospective Intent Capture — cognitive observability loop tightening:
  - `prospectiveNextVerification` field added to `StructuredTaskState` and `CreateStructuredTaskStateInput` (max 280 chars, optional). Captures the intended next verification action at checkpoint time before context switches.
  - `TaCoS: Capture Task Checkpoint` now prompts for prospective next verification as a dedicated step; field is recorded in structured task state and counted in local metrics via `prospectiveIntentCaptureCount`.
  - Checkpoint completeness scoring now uses 9 fields (was 8); `prospectiveNextVerification` presence is a strong completeness signal.
  - `formatStructuredTaskStateForPrompt()` surfaces prospective intent immediately after the core objective/next-action/confidence triad so AI refinement paths see it in context.
  - `shouldDeferCheckpointPromptHighLoad` policy: checkpoint prompt is suppressed when the user is in an active work window (`lastMeaningfulActivityAt` within `cooldownMinutes` of now), avoiding self-interruption at the worst moment. Suppression events are counted via `checkpointPromptSuppressedHighLoad`.
  - `TaCoS: Show Session Friction Summary` command opens a local-only markdown document in a side panel summarizing prompt-per-hour, suppression health, and mismatch rate from the workspace metric history.
  - Three new local-only `MetricRecord` fields: `prospectiveIntentCaptureCount`, `checkpointPromptSuppressedHighLoad`, `sessionFrictionSummaryOpened`. All included in CSV export and baseline snapshot.

## [0.99.0] - 2026-04-03

### Added

- P16 Prospective intent capture (ICSE'26 TaCoS research gap — generated summaries lacked "prospective information" present in manual notes):
  - Added `prospectiveNextVerification` field to `StructuredTaskState` and `CreateStructuredTaskStateInput` (max 280 chars, optional).
  - Wired into `normalizeTask()`, `createStructuredTaskState()`, and `updateStructuredTaskState()` with `patchHasOwn` guard for correct patch-clear semantics.
  - Checkpoint completeness scoring now uses 9 fields (was 8); `prospectiveNextVerification` presence is a strong completeness signal.
  - `formatStructuredTaskStateForPrompt()` now surfaces prospective intent immediately after the core objective/next-action/confidence triad.

### Changed

- UX polish pass 2 — quieter, more intelligent defaults across all companion panel surfaces:
  - Companion Home slot-token labels simplified to `✓` / `~` / `–` (was uppercase `PRIMARY`/`ADVISORY`/`SUPPRESSED`); CSS data-attributes still drive visual treatment so semantics are unchanged.
  - `renderCompanionNextSteps` non-actionable step rows: removed `Advisory:` prefix label — the advisory text now stands alone without the unnecessary header.
  - `renderIntentEditor` label in editable mode shortened from `"Intent (editable)"` → `"Intent"` — the field being editable is self-evident from the presence of the input.
  - `renderScratchpadCard` empty state copy cleaned up: `"Scratchpad has content, but no preview lines were detected."` → `"Scratchpad has content."` (removes internal debug language).
  - `renderConfidenceCard` reorientation copy softened: `"You've been away a while — reorient before executing anything risky."` → `"You've been away a while. Take a moment to reorient before acting."` and `"Intent is unclear. Add one line of context before continuing."` → `"Intent is unclear. A quick one-liner will help."` (less preachy, less alarming).
  - `renderCheckpointCard` add-note button label changed from `"+ Add"` → `"Add note"` (clearer verb-noun pattern, consistent with rest of button vocabulary).
  - `renderEvidenceCard` empty-state list item now carries `class="muted"` (was bare `<li>None captured</li>`, now `<li class="muted">No evidence captured yet.</li>`).

- UX cleanup and bug fixes across the companion panel:
  - All interactive buttons now show `cursor: pointer` (was missing from base `button` style, making buttons look non-interactive in some VS Code themes).
  - `.companion-primary` bottom margin removed (flex gap handles spacing); eliminates double-gap in companion grid blocks.
  - `.compact-list` bottom margin reduced to `var(--space-2)` and cleared when the list is the last child in its container.
  - `.companion-block h4` top/bottom margins removed (layout gap handles vertical rhythm consistently).
  - `.intent-editor input` border-radius aligned to `var(--radius-1)` design token (was hardcoded `6px`).
  - `.note-actions button` redundant `border-radius` override removed (inherits from base `button` consistently).
  - Advisory reason copy in next-steps list shortened: `"Advisory only: no safe one-click action is available"` → `"No safe one-click action available for this step."`, etc.
  - `renderConfidenceCard` long-gap list item label renamed from `"Next safe action:"` to `"Next step:"` to match companion grid rename.
  - `renderCompanionNudgeCard` empty-card guard fixed: previously a card with only `nudgeExplainabilityTrustedHtml` (and no nudge and no suppression label) would render an empty `<h3>Suggestion</h3>` shell; guard now checks all three content sources before rendering.
  - `renderTitledListCard` empty fallback `<li>` now carries `class="muted"` for visual consistency with other empty-state patterns across the panel.

- Companion panel UX polish pass (P15):
  - Notes card heading now shows count as a badge (`1 open note` / `N open notes`) and button row trimmed to `Mark done`, `Pin/Unpin`, `Dismiss`, `All notes`, `+ Add`.
  - Task State card badges now read `{level} confidence` and `{freshness}` with zero-suppressed switch count; `Safe breakpoint` and stale label use smaller `card-meta` styling; action buttons renamed to `Update task state` and `Switch task` for clarity.
  - Mental Load card (formerly `Cognitive Debrief`) shows item count badge in heading and only renders non-zero counts, with counts styled prominently via `debrief-count`.
  - Confidence/reorientation card title for low-evidence state changed to `What are we doing?`; card gets a left-accent border via `card-attention` to draw the eye without alarming the user.
  - Companion Nudge card heading changed to `Suggestion`; dismiss actions relabeled `Got it` / `Not now` to reduce ambiguity.
  - Resume Path heading now shows live progress badge (`0 of 3 steps done` → `All steps complete ✓`); summary text simplified to `Re-enter the task`; completed steps are visually struck through.
  - Session Recap section headings now show `✓ Done` (green) and `⚑ Pending / Blocked` (amber) to improve at-a-glance scanability.
  - `Changes Since Last Time` card renamed to `What Changed`.
  - Restore Pack card now surfaces Restricted Mode notice above the action grid rather than below, using a left-accent warning style.
  - Status card `Refresh summary now` button shortened to `Refresh`; auto-summary status rendered inline.
  - Keyboard shortcut list entries shortened for compact display.
  - Added CSS utilities: `card-attention`, `card-meta`, `card-meta-label`, `card-stale-label`, `badge-done`, `badge-attention`, `badge-confidence`, `badge-freshness`, `debrief-list`, `debrief-count`, `resume-path-item-done`, `status-autosummary-row`, `restricted-mode-note`, `recap-section-done`, `recap-section-pending`.

## [0.9.0] - 2026-04-02

### Added

- Cognitive Observability v1:
  - structured task checkpoints with typed local task-state storage
  - deterministic likely-switch detection with explainable `Capture / Skip / Snooze / Dismiss` prompting
  - `TaCoS: Capture Task Checkpoint`, `TaCoS: Mark Task Resolved`, `TaCoS: Confirm Task Switch`, and `TaCoS: Show Cognitive Debrief`
  - Resume Brief v2 recovery sections (`what you were doing`, `what changed`, `next likely safe move`, `open questions`, `timeline/evidence cues`)
  - on-demand local Cognitive Debrief for abandoned threads, stale task state, unresolved blockers, repeated-switch tasks, and open assumptions
  - local-only metrics and diagnostics for checkpoint adoption, switch detection, structured-state usage, and debrief surfacing

### Changed

- TaCoS is now documented and surfaced as a state-recovery tool for interruption-heavy engineers rather than a generic productivity assistant.
- Companion panel now prefers a `Task State` card when structured task state exists and keeps legacy checkpoint notes as compatibility behavior.
- Legacy `tacos.promptCheckpointOnBlur` is now documented as a separate note-only flow from structured task checkpoints.

## [0.8.1] - 2026-03-07

### Added

- Docs-driven operating model docs: `AGENTS.md`, `SPECS.md`, `PLANS.md`.
- Canonical design/implementation guide: `docs/DESIGN_AND_IMPLEMENTATION.md`.
- Canonical privacy/safety guide: `docs/PRIVACY_AND_SAFETY.md` with compatibility redirect from `docs/privacy-safety.md`.
- HCI/UX research reference map for percolation and interruption-design rationale: `docs/references.md`.
- Repository governance docs: `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `.github/CODEOWNERS`.
- Docs-driven GitHub issue forms (`01-bug`, `02-feature`, `03-spec`) and stricter PR template contract.
- Bundled build script (`scripts/build.mjs`) using `esbuild`.
- Explicit manifest runtime posture via `extensionKind: [\"workspace\"]`.
- Policy-driven panel section emphasis hints (badge + accent only) for collapsed sections, with stable layout and persisted expansion behavior.
- Resume Safety Check: a 10-second post-resume `State / Risk / Verify` annunciator with a manual command (`TaCoS: Show Resume Safety Check`) and scoped persisted context.

### Changed

- Build pipeline now separates bundling (`npm run build`) from static type checks (`npm run typecheck`).
- Verification and CI workflows now run format/lint/typecheck/unit gates before integration/package checks.
- Release workflow now focuses on tag-based VSIX artifact + GitHub release creation; Marketplace publish automation is disabled before `v1.0`.
- README is now a concise landing page; detailed behavior/contracts are linked to focused docs in `docs/*`.
- README/operator docs now align with current Trust/Privacy/provider boundaries and troubleshooting flow.
- Panel-emphasis policy now avoids targeting hidden `Timeline` sections when `tacos.showTimeline` is disabled, and integration snapshot section-order parsing now reads rendered disclosure markup only.
- Status bar now uses compact policy-driven class/reason semantics with deterministic quiet-hours suppression labeling and rare active-mode elevation for high-risk blocked states.
- Status bar quiet-window labeling now takes precedence over generic suppression reasons in active mode (including temporary quiet windows), and paused labels reflect their actual pause source.
- Focus-triggered surface arbitration now runs through a deterministic notification broker (`none`/`statusbar`/`panel`/`notification`) with explicit reason enums and high-value-actionable notification gating; `tacos.uiSurface` remains a hard cap.
- Companion Home now resolves policy output into fixed `Now/Next/Blocked/Restore` slots with deterministic single-primary CTA arbitration across `Next` and `Blocked`.
- Companion `Next`/`Blocked` status captions now include explicit emphasis tokens (`PRIMARY`/`ADVISORY`/`SUPPRESSED`) with reduced-motion-safe transitions and forced-colors safeguards.
- Companion Home now exposes a one-click `Why am I seeing this?` action that opens the Trust Center explainability trail (`More Context` → `Trust Center` → nested decision details).
- Evidence tray now supports one-click opening from Companion Home and groups entries into surfaced-decision evidence, other openable evidence, and context-only evidence while preserving safe open/static affordances.
- Trust Center now includes a concise Trust & Privacy tray with privacy preset, retention, provider mode, consent status, and one-click actions for AI payload preview and consent revocation.
- Completed DP-305 / `#246`: AI payload preview deep-links are now entrypoint-aware from surfaced guidance (`Companion Home`, nested `Why am I seeing this?`, and `Trust Center`), with local-only counters by entrypoint.
- Restricted Mode panel copy now explicitly calls out filtered signal classes, adds suppressed-execution guidance in Blocked/restore affordances, and records restricted trust-tray drill-down opens in local metrics.
- Percolation ranking now consumes a trigger-time normalized signal bundle (new adapter layer) with explicit trusted-vs-restricted signal filtering and deterministic adapter tests.
- Percolation signal adapters now include explicit git semantics (`branch-switch`, `git-commit`, `git-divergence`) using trusted branch/commit/divergence metadata, with deterministic parser coverage and cache-reset integration checks.
- Blocker detection now uses scored v2 cross-source arbitration (`task`, `command`, `diagnostics`, `branch`, `low-confidence`, `restricted`, `no-next-steps`) with explicit severity/confidence/actionability metadata and per-session blocker-promotion source counters in local metrics.
- Percolation ranking now applies normalized user-authored priors from checkpoint notes, saved corrections, and scratchpad context, with deterministic correction-precedence conflict resolution and per-session prior-promotion metrics (`checkpoint`, `corrections`, `scratchpad`).
- `Changes Since Last Time` now uses precision buckets (`Code`, `Runs`, `Blocker`, `Key files`, `Git`, `References`) plus deterministic novelty profiling, and default percolation candidate novelty now adapts to that profile with new local novelty-bucket metrics counters (`low`, `medium`, `high`).
- Auto-trigger no-change fingerprinting now uses a partition-aware `v2` payload, and task-partition switches reset destination-scope suppression memory (`no-change`, nudge cooldown, and noise-budget windows) to avoid stale suppression carryover.
- Metrics exports now include percolation decision-chain counters (`percolationDecisionCount`, segmented panel surface classes `panel-silent`/`panel-emphasis`, and low/medium/high primary-confidence bands), and the metrics dictionary/baseline snapshot include those fields.
- Resume Safety Check now reuses the existing summary/context pipeline, surfaces deterministic mismatch examples (branch drift, focus drift, scope drift, failing-command recheck), and records local-only counters plus `resumeSafetyFirstActionLagMs` for evaluation.
- Added narrow strict mode for Resume Safety Check via `tacos.resumeSafety.strict`; it warns before the first risky rerun or mismatched file action when TaCoS sees a strong deterministic mismatch and biases the user toward fixing context first.
- Added staged percolation rollout flags (`tacos.percolationPolicyEnabled`, `tacos.percolationExplainabilityEnabled`, `tacos.percolationNotificationBrokerEnabled`) with safe legacy `uiSurface` fallback behavior and diagnostics bundle visibility for configured vs active rollout state.
- Completed DP-506 / `#259`: onboarding and docs copy now teach the ambient-vs-glanceable-vs-deep model explicitly in first-run prompts, quickstart guidance, and README/marketplace-facing metadata.

## [0.7.0] - 2026-03-01

### Added

- Details panel accessibility baseline upgrades:
  - semantic webview document shell (`lang`, title, viewport, color-scheme)
  - skip link + `main` landmark navigation and live status region announcements
  - stronger keyboard discoverability with in-panel shortcut help and improved focus visibility
  - automated axe-core accessibility regression coverage for generated panel HTML
- Responsive and scan-friendly panel structure:
  - prioritized Companion Home layout for narrow split panes
  - persistent progressive disclosure with a `More Context` section
  - improved evidence/timeline affordances and non-color state cues for critical states
- State resilience and regression hardening:
  - persisted section expansion, evidence expansion, scroll, and focused-control restoration
  - compatibility fixes for encoded focus tokens across URL/file evidence IDs
  - guardrails/tests for scroll+focus restoration behavior across rerenders

### Changed

- Details panel interaction model now emphasizes a 5-second resume path (`what was I doing` and `what should I do next`) across narrow and wide layouts.
- Restore-action unavailable messaging now distinguishes trust restrictions from missing history to reduce misleading remediation guidance.
- Manual QA runbook and acceptance report were expanded for v0.7.0 UI/a11y/reflow sign-off and release gating.

## [0.6.1] - 2026-02-28

### Added

- Cognitive Resume Kit for fast interruption recovery:
  - explicit `Last action` retrieval cue in Companion Home
  - single primary `Next safe action` CTA with evidence/rationale
  - `Resume Path` 3-step checklist with per-scope persistence
  - blocker-first recovery card with one-click safe unblock actions
- Opportune timing and noise controls:
  - boundary-aware focus trigger gating
  - typing deferral on focus regain to avoid mid-chunk interruption
  - unified noise budget across summaries, nudges, and checkpoint prompts
  - expanded suppression/gating integration coverage
- Companion IA overhaul:
  - composable webview rendering modules
  - single resume card stack with progressive disclosure defaults
  - accessibility pass for controls/keyboard flow
  - timeline/evidence scannability improvements
- Local-only proof and release discipline upgrades:
  - metrics baseline/targets and friction scoring updates
  - expanded integration harness + snapshot/unit coverage for panel surfaces
  - focus-path performance guardrails and release runbook/checklist docs
- Onboarding polish:
  - sample/demo resume card command and onboarding entry point
  - read-only sample mode behavior hardening and dedicated integration tests

### Changed

- Setup and onboarding copy now emphasizes local-first defaults, consented AI refinement, and pause/quiet controls.
- Trust, evidence, and restore affordances are more explicit while preserving strict local safety boundaries.

### Notes

- `v0.6.1` is the first published tag in the `v0.6.x` line for this repository. A public `v0.6.0` tag was not published.

## [0.5.0] - 2026-02-27

### Added

- Security-first sanitization and trust controls for notes/scratchpad AI flows:
  - Redaction engine v2 with mode-aware sanitization and structured redaction reporting.
  - Strict AI-boundary sanitizer with fail-closed high-risk detection across provider send paths.
  - Safe-by-default AI inclusion settings (`tacos.aiIncludeCheckpointNotes=false`, `tacos.aiIncludeScratchpad=false`).
  - `TaCoS: Test Sanitizer` local-only command for transparent sanitizer validation.
  - Aggregate-only local metrics counters for sanitizer events and blocked/allowed AI sends.
  - Privacy-safe issue templates for sanitization bugs and AI opt-in trust UX feedback.

### Changed

- AI payload preview now explicitly shows checkpoint/scratchpad inclusion flags plus redaction report summary.
- AI payload consent is signature-scoped to provider and inclusion choices to prevent silent scope expansion.
- Checkpoint note and scratchpad flows now surface redaction-change notifications without exposing secret values.

### Security

- AI send/copy boundaries now enforce strict sanitization and block high-risk payloads before provider/paste boundaries.
- Custom `tacos.redactionPatterns` handling now applies bounded guardrails with validation reporting.

## [0.4.0] - 2026-02-27

### Added

- Checkpoint Notes v2:
  - Multi-note storage with lifecycle (`open`, `done`, `dismissed`)
  - `updatedAt` lifecycle timestamp tracking for note updates
  - Partition-aware default scope (`workspace + branch + task partition`)
  - Legacy single-note migration into pinned open note format
- New checkpoint commands:
  - `TaCoS: List Checkpoint Notes`
  - `TaCoS: Add Checkpoint from Selection`
  - `TaCoS: Add Quick Checkpoint Note`
- Scratchpad quick actions in Companion surfaces:
  - `Open Scratchpad`, `Append`, and `Set Scope` buttons in the panel scratchpad card
  - Scratchpad and checkpoint-note management entries in `TaCoS Companion` quick actions
- Resume panel notes card with actions for `Mark done`, `Pin/Unpin`, `Dismiss`, and `Add note`.
- Sticky notes/scratchpad QA matrix doc for v0.4.0 edge-case validation:
  - `docs/sticky-notes-qa-matrix.md`
  - `docs/sticky-notes-qa-signoff-template.md`

### Changed

- Pinned/newest open checkpoint note now overrides `recommendedFirstAction` on resume.
- Low-confidence card is suppressed when an open checkpoint note exists.
- Standup `Next` section now includes the active checkpoint note when available.
- AI payload preview now explicitly labels whether checkpoint notes are included.
- Retention policy now prunes old closed checkpoint notes (`done`/`dismissed`) while keeping open notes sticky.
- Resume panel now shows the Scratchpad card when a scoped scratchpad exists/has been created.
- Local metrics now track checkpoint events (`noteCreated`, `noteMarkedDone`, `notePinned`) and
  resume lag cohorts (`resumeWithNote` vs without).

## [0.3.0] - 2026-02-27

### Added

- Guided first-run setup flow:
  - `TaCoS: Run Setup Checklist`
  - `TaCoS: Reset Setup Checklist`
- Selective restore presets with dry-run confirmation for working set restore:
  - `Files only`
  - `Files + terminal`
  - `Full restore`
- `TaCoS: Copy Metrics Baseline Snapshot` command for privacy-safe local markdown summaries.
- Companion nudge explainability in the panel:
  - `Why this nudge?` rationale when nudges appear
  - `Why no nudge right now?` suppression rationale when nudges are hidden
- `v0.3.0` release checklist document (`docs/release-0.3.0-checklist.md`).

### Changed

- Metrics baseline docs now include an explicit post-implementation snapshot section and updated generation flow.
- Metrics docs and README command lists include the new baseline snapshot command.

## [0.2.1] - 2026-02-27

### Added

- Action safety matrix documentation (`docs/action-safety-matrix.md`) and deterministic integration coverage for missing-prerequisite no-op paths.
- Execution-action guard coverage for trusted/restricted behavior across rerun task/debug and checkout flows.
- Expanded companion nudge suppression tests (mode gating, quiet-hours parsing/windows, cooldown boundary behavior, deterministic ranking).
- 5-minute quickstart documentation with local-only setup, optional AI consent flow, and privacy preset guidance.
- Metrics documentation bundle:
  - `docs/metrics.md` data dictionary and export workflow
  - `scripts/metrics-summary.mjs` local markdown summary helper (use `TaCoS: Copy Metrics Baseline Snapshot` to generate; paste into an issue comment or release PR)
- Privacy-safe diagnostics workflow:
  - `TaCoS: Copy Diagnostics` command
  - Bug/UX/metrics issue templates under `.github/ISSUE_TEMPLATE/`
- `v0.3.0` roadmap rubric and candidate issue set (`docs/roadmap-0.3.0.md`, issues `#90`-`#93`).
- `v0.2.1` stabilization ship checklist (`docs/release-0.2.1-checklist.md`).

### Changed

- Companion panel readability pass:
  - action surfaces regrouped by intent (copy/feedback/restore categories)
  - duplicate low-signal cards removed
  - evidence/timeline expansion state persists across rerenders to reduce UI jump
- README now includes prominent Start Here guidance and links to quickstart/privacy/metrics docs.

## [0.2.0] - 2026-02-27

### Added

- Companion nudge engine with deterministic ranking, cooldown suppression, and quiet-hours controls.
- Session Recap card (`Done since last resume`, `Pending / blocked`, `Recommended first action`).
- One-click checkpoint capture from recap.
- Companion metrics CSV export at `.tacos/metrics.csv` alongside JSON export.
- Companion panel visual polish pass (stronger hierarchy, theme-aware tokens, and reduced-motion-safe refresh animation).
- Status bar Resume pill default surface with trust cues and quick-open behavior.
- Jump-to-last-edit location capture and restore actions (file + line + timestamp).
- Clickable next-step actions for open file/range, rerun task/test, open link, and debug actions.
- Blocker-first section with failing task/diagnostic recovery actions.
- Privacy presets (`Minimal`, `Balanced`, `Max context`) with retention controls and `Forget workspace now`.
- AI payload preview/consent gate before network send.
- Low-confidence ambiguity mode with candidate intents and safe fallback next steps.
- Standup mode command (`Done / Next / Blockers`) with copy/open flows.
- Task partition switching by workspace + branch + optional task key.
- Working set restore pack with preview and selective restore actions.

### Changed

- Focus refresh defaults to silent background scratch-pad updates with panel-in-place refresh.
- Companion actions now capture follow-through and first-action latency metrics in local workspace state.
- Manual smoke runbook and privacy docs now include companion friction metrics guidance.
- OpenAI extension interop now prioritizes `chatgpt.openSidebar`, `chatgpt.newCodexPanel`, and `chatgpt.newChat`.
- Details webview renders actionable HTML lists and routes link/file actions via postMessage handlers.
- LLM refinement path now handles structured output compatibility/refusal/parsing failures with robust local fallback.
- Metrics capture expanded for resumption/action lag and optional quick helpfulness scoring.

### Removed

- Deprecated compatibility settings paths (`tacos.idleMinutes`, `tacos.cooldownSeconds`, `tacos.openaiApiKey` setting fallback).

## [0.1.0] - 2026-02-26

### Added

- Evidence-grounded links that only open validated `file`/`url` targets.
- Restore Pack actions for reopening files and resuming common task/debug flows.
- Timeline mode in the details panel (grouped evidence breadcrumbs, collapsed by default).
- Optional Future Me checkpoint capture via blur prompt (opt-in) and clipboard command.
- One-time onboarding notice and Privacy & Safety command.
- Webview CSP hardening with nonce-restricted scripts/styles and strict blocked defaults.
- Expanded safety-focused unit tests (webview security, timeline grouping, message validation, path/link safety).
- VS Code integration harness with fixture workspace (`npm run test:integration`).

### Changed

- Summary panel now surfaces local/refined status with generation times.
- Summary panel status now updates live during AI refinement and when pause/timeline settings change.
- AI refinement status is now scoped to the active summary context to avoid cross-workspace status bleed.
- Configure AI Provider flow includes clearer privacy/trust guidance.
- Git snapshot collection uses bounded command timeouts and caching to reduce repeated cost.
- CI quality gates now enforce compile, lint, format-check, unit/integration tests, and VSIX packaging.
- Added `npm run verify` and `npm run verify:quick` scripts for consistent local release gating.
- Integration runner now cleans up temporary isolated-profile test directories after each run.
- Meaningful edit activity tracking now updates independently of metric-session state for reliable blur checkpoint prompts.

### Security

- Webview click handling now uses explicit `data-action` routing and strict host-side message parsing.
- Unsafe links and malformed webview messages are blocked/no-op by default.
- Summary link clicks now require click-time evidence grounding (target must match validated evidence catalog).
- Privacy doc open failures now report accurate “privacy docs” messaging in logs/errors.
- Persisted terminal-derived fields are anonymized/fingerprinted to avoid storing raw commands.
- Legacy persisted activity is migrated to sanitized/fingerprinted storage at startup.
- Privacy & Safety command opens a dedicated markdown document shipped with the extension.

## [0.0.3] - 2026-02-25

- Initial public baseline for TaCoS Resume Brief.
