# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- No notable changes yet.

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
- Resume panel now shows the Scratchpad card only when scoped scratchpad content exists.
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
  - `docs/metrics-baseline.md` dogfooding baseline template
  - `scripts/metrics-summary.mjs` local markdown summary helper
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
