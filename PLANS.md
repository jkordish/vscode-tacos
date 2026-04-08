# PLANS.md

Status vocabulary used in this file:

- `queued`: sequenced but not started
- `doing`: actively in progress
- `blocked`: waiting on external input/decision
- `done`: completed and merged

## Current Execution Ledger

### P1. Docs/control-plane bootstrap

- status: `done`
- why: keep behavior contracts, execution sequencing, and contribution hygiene explicit.
- scope: top-level operating docs, templates, and canonical privacy/design docs.
- dependencies: none.
- recent progress:
  - completed docs consistency sweep across `README`, `SPECS.md`, `CHANGELOG`, `PLANS.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`, `docs/PRIVACY_AND_SAFETY.md`, and `CONTRIBUTING.md`.
  - corrected `README` command title drift (`Show Last Summary`).
  - stamped `[Unreleased]` → `[0.9.0] - 2026-04-02` in `CHANGELOG`.
  - bumped `package.json` version to `0.9.0` to match release.
  - verified all commands/settings in manifest match docs and runtime registrations.
  - verified CI workflow gates (`format → lint → typecheck → unit → integration → package`) are stable and intentional.
  - verified trust/privacy boundary docs match implementation (`Restricted Mode`, AI payload paths, redaction, consent).
  - confirmed 388 unit tests pass clean; test coverage is comprehensive across all domain modules.
  - documented internal runtime commands (`tacos.resumeSafetyRunVerifyAction`, `tacos.openCompanionActions`) as intentionally absent from manifest in design doc.
- risks/rollback:
  - risk: doc drift from rapid feature iteration.
  - rollback: narrow doc-only corrective PR.
- links:
  - `AGENTS.md`
  - `SPECS.md`

### P2. Build/tooling cleanup

- status: `queued`
- why: preserve fast iteration and predictable packaging output.
- scope: verify script contract alignment, CI gate clarity, packaging includes.
- dependencies: P1.
- immediate next actions:
  - confirm `verify:quick` and `verify` semantics stay stable.
  - verify VSIX contents remain intentional.
- risks/rollback:
  - risk: script churn causing local/CI mismatch.
  - rollback: restore previous aliases while retaining bundled build.
- links:
  - `package.json`
  - `.github/workflows/ci.yml`

### P2a. Resume Safety Check v1

- status: `done`
- why: reduce wrong first actions immediately after resumption without expanding TaCoS into a second summary system.
- scope: add a temporary post-resume `State / Risk / Verify` annunciator, deterministic mismatch detection, a manual command, narrow strict-mode warnings, scoped persistence, and local-only evaluation counters.
- dependencies: P1, P4.
- recent progress:
  - added `src/resumeSafety.ts` for deterministic eligibility, mismatch detection, persistence normalization, and strict-warning decisions.
  - wired Resume Safety Check into manual/focus/startup resume flows in `src/extension.ts` with a 10-second status-bar surface, one-click verify action, and scoped `workspaceState` persistence.
  - added settings/manifest wiring for `tacos.resumeSafety.enabled`, `tacos.resumeSafety.idleMinutes`, and `tacos.resumeSafety.strict`, plus the `TaCoS: Show Resume Safety Check` command.
  - extended local metrics/docs/tests with resume-safety counters and first-action lag capture.
- risks/rollback:
  - risk: mismatch heuristics may feel noisy if they expand beyond strong branch/scope drift.
  - rollback: disable auto surfacing via `tacos.resumeSafety.enabled` or remove the isolated resume-safety runtime path without destabilizing summary generation.
- links:
  - `src/resumeSafety.ts`
  - `src/extension.ts`
  - `docs/metrics.md`

### P3. Trust/privacy/AI boundary audit

- status: `queued`
- why: TaCoS handles local context and optional provider boundaries.
- scope: restricted-mode gates, consent boundaries, sanitizer fail-closed behavior, diagnostics safety wording.
- dependencies: P1.
- immediate next actions:
  - audit trust-sensitive commands for explicit guard messaging.
  - cross-check docs against actual provider payload behavior.
- risks/rollback:
  - risk: silent trust regressions in edge flows.
  - rollback: force-disable affected path and patch quickly.
- links:
  - `docs/PRIVACY_AND_SAFETY.md`
  - `src/extension.ts`

### P4. Test hardening

- status: `queued`
- why: preserve confidence in deterministic logic and command wiring.
- scope: add/maintain coverage for trust gates, retention pruning, provider fallback/parsing, scoped note/scratchpad behavior.
- dependencies: P2, P3.
- immediate next actions:
  - identify highest-risk untested edge cases from recent changes.
  - add narrow deterministic tests before behavior expansion.
- risks/rollback:
  - risk: integration flakiness increases CI time.
  - rollback: keep critical-path integration suites mandatory, move non-critical to scheduled runs.
- links:
  - `test/`
  - `docs/integration-test-harness.md`

### P5. Package/release readiness

- status: `queued`
- why: each tag should be reliably packageable and release artifacts should be reproducible.
- scope: release workflow, artifact checks, publish prerequisites documentation.
- dependencies: P2.
- immediate next actions:
  - keep tag workflow artifact generation green.
  - document Marketplace publish prerequisite (`VSCE_PAT`) and current posture.
- risks/rollback:
  - risk: release-day secret/config drift.
  - rollback: ship VSIX artifact-only release and postpone publish.
- links:
  - `.github/workflows/release-vsix.yml`
  - `README.md`

### P6. First recommended feature slice after stabilization

- status: `done`
- why: deliver user-facing improvement without destabilizing trust/privacy boundaries.
- scope: adaptive-surface dynamic-percolation slice for Epic `#226` (status semantics, surface broker, Companion slot policy, single-primary CTA arbitration, and emphasis tokens).
- dependencies: P3, P4.
- recent progress:
  - completed DP-202 panel section emphasis behavior (badge + accent only) with stable ordering and persisted disclosure state.
  - hardened DP-202 with follow-up fixes: snapshot section-order parsing now reads rendered disclosures only, and emphasis focus avoids hidden timeline sections when `tacos.showTimeline` is off.
  - completed DP-238 compact status-bar semantics with policy-driven class/reason labels, deterministic quiet-hours suppression cues, and rare active-mode elevation for high-risk blocked states.
  - completed DP-239 notification decision broker with deterministic `none/statusbar/panel/notification` surface arbitration, explicit reason enums, high-value actionable notification gating, and per-surface metrics counters.
  - completed DP-236 Companion Home slot policy wiring with deterministic source classes mapped into fixed `Now/Next/Blocked/Restore` slots.
  - completed DP-240 central single-primary CTA arbitration (`Next` vs `Blocked`) with advisory demotion and single-count primary CTA impression semantics.
  - completed DP-241 adaptive emphasis tokens (`PRIMARY`/`ADVISORY`/`SUPPRESSED`) with reduced-motion and forced-colors-safe presentation.
  - merged final Epic `#226` PR and closed Epic `#226` with completed child issues.
- risks/rollback:
  - risk: over-aggressive suppression hides useful cues.
  - rollback: revert to previous ranking/suppression default behavior.
- links:
  - `docs/ux/dynamic-percolation-mockups.md`
  - `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
  - https://github.com/jkordish/vscode-tacos/issues/237
  - https://github.com/jkordish/vscode-tacos/issues/236
  - https://github.com/jkordish/vscode-tacos/issues/238
  - https://github.com/jkordish/vscode-tacos/issues/239
  - https://github.com/jkordish/vscode-tacos/issues/240
  - https://github.com/jkordish/vscode-tacos/issues/241
  - https://github.com/jkordish/vscode-tacos/pull/267

### P7. Trust/privacy explainability drill-down

- status: `done`
- why: preserve trust by making surfaced-decision rationale available immediately from Companion Home.
- scope: Epic `#227` completion for core `v0.8.0` items (DP-301 through DP-304).
- dependencies: P3, P4.
- recent progress:
  - completed DP-301 / `#242` (`Why am I seeing this?` one-click top-card path) and marked epic checklist progress.
  - completed DP-302 / `#243` (grouped evidence tray with one-click Companion Home open path, safe affordance semantics, and hidden-group regression hardening).
  - completed DP-303 / `#244` (privacy/trust tray posture rows + payload preview + consent revoke controls + trust-tray open metric hook) in PR `#272`.
  - completed DP-304 / `#245` (Restricted Mode rendering + explicit suppression/explainability copy pass) and merged follow-up fixes.
- immediate next actions:
  - monitor follow-on trust/privacy polish after DP-305 (`#246`) closure and keep restricted/trust copy concise.
- risks/rollback:
  - risk: restricted-mode copy can become too verbose and overpower primary resume guidance.
  - rollback: keep suppression semantics/guards intact and revert to shorter copy strings only.
- links:
  - `docs/ux/dynamic-percolation-mockups.md`
  - `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
  - https://github.com/jkordish/vscode-tacos/issues/227
  - https://github.com/jkordish/vscode-tacos/issues/242
  - https://github.com/jkordish/vscode-tacos/issues/243
  - https://github.com/jkordish/vscode-tacos/issues/244
  - https://github.com/jkordish/vscode-tacos/issues/245
  - https://github.com/jkordish/vscode-tacos/pull/272

### P8. Signal normalization and resume semantics hardening

- status: `done`
- why: percolation quality depends on normalized, deterministic signals that are safe across trusted and restricted modes.
- scope: Epic `#228` core signal semantics and ranking-prior upgrades (DP-401 / `#248`, DP-402 / `#249`, DP-403 / `#250`, DP-404 / `#251`) before novelty/hash follow-ons.
- dependencies: P3, P4.
- recent progress:
  - completed DP-401 / `#248` (typed signal bus + trust-aware adapters + cache-miss fallback + reset hygiene).
  - completed DP-402 / `#249` by enriching git semantic adapters with explicit `branch-switch`, `git-commit`, and `git-divergence` signals plus SHA-256/abbrev-safe parsing.
  - completed DP-403 / `#250` by upgrading blocker detection to scored cross-source arbitration with explicit severity/confidence/actionability metadata and blocker-source metric counters.
  - completed DP-404 / `#251` by integrating checkpoint notes, saved corrections, and scratchpad context as deterministic ranking priors with correction-precedence conflict handling and prior-promotion metrics.
  - completed DP-405 / `#252` by upgrading `Changes Since Last Time` precision buckets (`Code`/`Runs`/`Blocker`/`Key files`/`Git`/`References`), adding deterministic summary novelty profiling, feeding novelty into default percolation candidate scoring, and exporting novelty bucket distribution counters in local metrics.
  - completed DP-406 / `#253` by implementing auto-trigger no-change fingerprint v2 (partition-aware payload), partition-scoped nudge/noise-budget suppression memory keys, and explicit suppression-state reset rules when task partitions switch.
- immediate next actions:
  - close Epic `#228` with all child issues complete and keep `verify:quick` + integration suites green on `main`.
- risks/rollback:
  - risk: duplicated or stale signal bundles can skew ranking behavior.
  - rollback: fall back to summary-only signal defaults while preserving adapter tests for incremental reland.
- links:
  - `docs/ux/dynamic-percolation-mockups.md`
  - `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
  - https://github.com/jkordish/vscode-tacos/issues/228
  - https://github.com/jkordish/vscode-tacos/issues/248
  - https://github.com/jkordish/vscode-tacos/issues/249
  - https://github.com/jkordish/vscode-tacos/issues/250
  - https://github.com/jkordish/vscode-tacos/issues/252
  - https://github.com/jkordish/vscode-tacos/issues/253

### P9. Percolation metrics schema and segmentation alignment

- status: `done`
- why: Epic `#229` needs decision-chain metrics parity (`DP-501`) and segmented surface counters that distinguish ambient panel updates from emphasized panel paths.
- scope: add percolation decision-count and confidence-band fields, split panel surface selection into `panel-silent` vs `panel-emphasis`, wire runtime metric recording, and align dictionary/baseline docs/tests.
- dependencies: P6, P8.
- recent progress:
  - added new per-session metric fields (`percolationDecisionCount`, `surfaceSelectionPanelSilent`, `surfaceSelectionPanelEmphasis`, `percolationConfidenceBandLow|Medium|High`) in runtime record types and CSV export.
  - updated summary-presentation metric wiring to record decision count, segmented panel surface class, and per-decision confidence bands.
  - expanded baseline snapshot output to report percolation decision totals, segmented surface totals, and confidence-band distribution.
  - refreshed docs/contracts (`README`, `SPECS`, `docs/metrics.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`, `CHANGELOG`) and unit tests for the schema additions.
- risks/rollback:
  - risk: downstream dashboards/scripts may assume the old fixed column layout.
  - rollback: keep legacy `surfaceSelectionPanel` as compatibility field and remove new columns behind a schema rollback patch if needed.
- links:
  - https://github.com/jkordish/vscode-tacos/issues/229
  - https://github.com/jkordish/vscode-tacos/issues/254
  - https://github.com/jkordish/vscode-tacos/issues/255

### P10. Percolation rollout flags and fallback controls

- status: `done`
- why: Child issue `#258` requires independently switchable percolation stages with a safe rollback path and diagnostic visibility.
- scope: add rollout settings (`policy`, `explainability`, `notification broker`), gate surface/panel/status behavior, preserve legacy `uiSurface` fallback semantics when policy/broker is disabled, and add diagnostics + integration coverage for key flag combinations.
- dependencies: P6, P7, P8, P9.
- recent progress:
  - added manifest/config plumbing for `tacos.percolationPolicyEnabled`, `tacos.percolationExplainabilityEnabled`, and `tacos.percolationNotificationBrokerEnabled`.
  - wired runtime rollout gating in focus presentation, status-bar semantics, percolation memory persistence, and webview explainability affordances.
  - updated diagnostics bundle output to include configured/active rollout state and expanded diagnostics unit coverage.
  - expanded integration matrix assertions for broker-disabled fallback, policy-disabled legacy fallback, and explainability on/off rendering.
  - refreshed behavior docs (`README`, `SPECS`, `docs/DESIGN_AND_IMPLEMENTATION.md`) and release notes (`CHANGELOG`).
- risks/rollback:
  - risk: flag-combination drift can reintroduce inconsistent behavior between panel/status/prompt surfaces.
  - rollback: keep `percolationPolicyEnabled=false` as the single kill-switch path to restore legacy `uiSurface` behavior while iterating.
- links:
  - https://github.com/jkordish/vscode-tacos/issues/229
  - https://github.com/jkordish/vscode-tacos/issues/258
  - https://github.com/jkordish/vscode-tacos/issues/256

### P11. Percolation integration decision matrix coverage

- status: `done`
- why: Child issue `#256` needs a regression-resistant integration matrix that explicitly covers suppression and restricted-path guard behavior alongside single-primary CTA invariants.
- scope: add a dedicated integration matrix suite for ranking/suppression/surface arbitration assertions, wire it into the integration harness, and extend broker unit coverage for additional suppression reason paths.
- dependencies: P6, P7, P8, P10.
- recent progress:
  - added `test/integration/suite/percolationDecisionMatrix.js` to assert high-value notification baseline, suppression downgrades for `quiet-hours`/`cooldown`/`no-change`, restricted execution guard behavior, and single-primary CTA invariant.
  - wired the new suite into `test/integration/runTest.js` so it runs with the standard integration pass.
  - expanded `test/percolationSurfaceBroker.test.ts` with explicit cooldown/no-change suppression reason preservation checks.
  - validated with focused unit execution and full integration harness run.
- risks/rollback:
  - risk: matrix assertions can become brittle if probe payload shapes change without synchronized updates.
  - rollback: keep existing `focusRefreshPresentation`/`resumeFlowCriticalPath` coverage and disable only the dedicated matrix suite while updating probe contracts.
- links:
  - https://github.com/jkordish/vscode-tacos/issues/229
  - https://github.com/jkordish/vscode-tacos/issues/256

### P12. Percolation docs and terminology alignment

- status: `done`
- why: keep v0.8.x validation docs aligned with shipped percolation behavior and reduce trust/privacy/evidence terminology drift across UI + docs.
- scope: child issues `#257` (runbook + acceptance reporting updates) and `#247` (terminology harmonization for Trust/Privacy/Evidence/Restricted Mode language).
- dependencies: P7, P10, P11.
- recent progress:
  - rewrote `docs/manual-smoke-runbook.md` for v0.8.x dynamic percolation coverage (ambient vs escalation paths, suppression checks, restricted explainability, rollout-flag matrix, and required percolation metrics capture fields).
  - refreshed `docs/smoke-report.md` template to mirror the new P/R/F scenario groups and percolation metric gates.
  - appended a `v0.8.x Dynamic Percolation Acceptance Addendum` to `docs/acceptance-report.md` with implemented anchors, acceptance checklist, and manual verification gates.

### P13. Cognitive Observability v1

- status: `done`
- why: turn TaCoS into a serious state-recovery tool for interruption-heavy engineers without breaking its calm, local-first, explainable posture.
- scope: structured task checkpoints, deterministic task-switch detection, resume brief v2 state recovery, on-demand cognitive debrief, local-only evaluation metrics, diagnostics, and required docs/spec/research parity.
- dependencies: P1, P3, P4.
- sub-slices:
  - `P13a` typed task-state schema and local store evolution
  - `P13b` manual structured checkpoint capture/edit/resolve flows
  - `P13c` conservative switch detection + likely-boundary prompting
  - `P13d` resume brief v2 integration with structured task state
  - `P13e` on-demand cognitive debrief
  - `P13f` metrics + diagnostics
  - `P13g` docs/spec/changelog/research updates
  - `P13h` verify/package regression pass
- recent progress:
  - added versioned structured task-state storage (`src/taskState.ts`) keyed to existing workspace/branch/task-partition scope with typed fields for objective, working set, assumptions, blockers, next action, confidence, stale boundary, and last known safe breakpoint.
  - wired `TaCoS: Capture Task Checkpoint`, `TaCoS: Mark Task Resolved`, `TaCoS: Confirm Task Switch`, and `TaCoS: Show Cognitive Debrief`, while keeping legacy checkpoint-note flows as compatibility entrypoints.
  - implemented deterministic switch detection (`src/taskSwitch.ts`) using conservative, explainable signals with `Capture / Skip / Snooze / Dismiss` prompt handling and diagnostics visibility.
  - upgraded Resume Brief v2 with structured recovery sections and added local-only cognitive debrief derivation/rendering.
  - extended metrics, diagnostics, unit coverage, integration coverage, docs/specs, and packaging verification for the new slice.
- risks/rollback:
  - risk: overlapping note/task-state systems could create confusing duplicate sources of truth if compatibility paths are too broad.
  - rollback: keep legacy checkpoint-note flows intact and disable structured prompting while retaining manual structured capture.
- links:
  - `src/taskState.ts`
  - `src/taskSwitch.ts`
  - `src/structuredRecovery.ts`
  - `src/cognitiveDebrief.ts`
  - `src/extension.ts`
  - `README.md`
  - `SPECS.md`
  - `docs/DESIGN_AND_IMPLEMENTATION.md`
  - `docs/references.md`

### P13x. Remaining open-epic closure sweep (`#246`, `#259`)

- status: `done`
- why: finish the final open child issues under Epics `#227` and `#229` with code, docs, onboarding, and metrics parity.
- scope: DP-305 / `#246` (entrypoint-aware AI payload preview deep-links + counters) and DP-506 / `#259` (ambient-vs-deep onboarding and marketplace/readme narrative refresh).
- dependencies: P7, P9, P12.
- recent progress:
  - added one-click AI payload preview deep-links from Companion Home surfaced actions, nested `Why am I seeing this?` details, and Trust Center controls.
  - added strict webview-message parsing for payload-preview entrypoint metadata and routed entrypoint-aware panel status messaging.
  - extended local metrics schema/CSV/baseline/docs with `aiPayloadPreviewOpensTrustCenter`, `aiPayloadPreviewOpensWhySurfaced`, and `aiPayloadPreviewOpensCompanionHome`.
  - refreshed onboarding/setup copy, README/quickstart narrative, and marketplace-facing package description around the ambient -> glanceable -> deep mental model.
  - updated integration + unit coverage for action wiring, payload entrypoint parsing, and metrics schema checks.
- risks/rollback:
  - risk: additional Companion Home action density could increase button noise.
  - rollback: keep Trust Center/Why deep-links and remove Companion Home payload-preview button if usage data shows low value.
- links:
  - https://github.com/jkordish/vscode-tacos/issues/246
  - https://github.com/jkordish/vscode-tacos/issues/259
  - https://github.com/jkordish/vscode-tacos/issues/227
  - https://github.com/jkordish/vscode-tacos/issues/229

### P14. Release workflow policy hardening (`v0.8.x`)

- status: `done`
- why: keep tag-based VSIX releases reliable while deferring Marketplace automation until `v1.0`.
- scope: remove Marketplace publish step from release workflow, and align operator/release docs to explicit pre-`v1.0` no-Marketplace policy.
- dependencies: P1, P5.
- recent progress:
  - removed Marketplace publish step from `.github/workflows/release-vsix.yml` so tag workflow only builds/packages and attaches VSIX to GitHub release.
  - updated operator/release docs (`AGENTS.md`, `CONTRIBUTING.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`) to codify “no Marketplace automation before `v1.0`”.
  - refreshed `CHANGELOG.md` wording to match current release automation posture.
- risks/rollback:
  - risk: future maintainers may reintroduce publish steps without updating policy docs.
  - rollback: reintroduce a publish step only when `v1.0` policy is explicitly approved and docs/contracts are updated in the same PR.
- links:
  - `.github/workflows/release-vsix.yml`
  - `AGENTS.md`
  - `CONTRIBUTING.md`
  - `docs/DESIGN_AND_IMPLEMENTATION.md`
  - `CHANGELOG.md`

### P15. Companion panel UX polish pass

- status: `done`
- why: reduce friction and cognitive overhead during resume flows by improving label clarity, information hierarchy, and progressive disclosure across all companion panel cards.
- scope: `src/webview/panelFragments.ts`, `src/webview/panelCards.ts`, `src/webview/panelStyles.ts`, and aligned test updates.
- recent progress:
  - renamed `Cognitive Debrief` → `Mental Load` with item-count badge in heading; only non-zero counts render; counts prominently styled via `debrief-count`.
  - Notes card heading now shows natural-language count badge (`1 open note` / `N open notes`); button row shortened and reordered.
  - Task State card badges read `{level} confidence` and freshness; switch count suppressed when zero; `Safe breakpoint` uses compact `card-meta` styling; action labels changed to `Update task state` / `Switch task`.
  - Confidence/reorientation card: low-evidence title changed from `Low Confidence` → `What are we doing?`; card gets `card-attention` left-accent border.
  - Companion Nudge heading changed to `Suggestion`; dismiss actions relabeled `Got it` / `Not now`.
  - Resume Path: live progress badge in heading, summary text simplified to `Re-enter the task`, completed steps visually struck through.
  - Session Recap: section headings use `✓ Done` (green) / `⚑ Pending / Blocked` (amber).
  - `Changes Since Last Time` card renamed to `What Changed`.
  - Restore Pack: Restricted Mode notice moved above action grid with left-accent warning style.
  - Status card: `Refresh summary now` → `Refresh`; auto-summary status rendered inline.
  - Added CSS utility classes: `card-attention`, `card-meta`, `badge-done`, `badge-attention`, `badge-confidence`, `badge-freshness`, `debrief-list`, `debrief-count`, `resume-path-item-done`, `status-autosummary-row`, `restricted-mode-note`, `recap-section-done`, `recap-section-pending`.
  - Updated `test/panelFragments.test.ts` and `test/panelCards.test.ts` to match new strings; `verify:quick` exits 0 (56 suites / 388 tests).
- risks/rollback:
  - risk: renaming cards or buttons may require snapshot updates in integration tests if those tests assert exact text.
  - rollback: revert label/class changes; CSS additions are additive and safe to remove without breaking behavior.
- links:
  - `src/webview/panelFragments.ts`
  - `src/webview/panelCards.ts`
  - `src/webview/panelStyles.ts`
  - `CHANGELOG.md`

### P17. v0.99 release preparation

- status: `done`
- why: stamp all docs and version artifacts for the `v0.99.0` milestone — the last pre-`v1.0` feature-complete release.
- scope: `package.json` version bump, `CHANGELOG.md` `[0.99.0]` stamp, `README.md` refresh with accurate feature set (prospective intent capture, full command table, settings tables, Companion panel card inventory), and `PLANS.md` ledger update.
- dependencies: P15, P16.
- recent progress:
  - bumped `package.json` version to `0.99.0`.
  - stamped `CHANGELOG.md` `[Unreleased]` entries as `[0.99.0] - 2026-04-03`; added empty `[Unreleased]` section for next cycle.
  - rewrote `README.md` for v0.99: accurate five-primitive feature summary, full command table, settings tables by category, Companion panel card inventory, prospective intent capture section, research grounding, and updated quick-start.
  - confirmed `.github/workflows/release-vsix.yml` is solid: `v*` tag trigger → `verify:quick` → `package:vsix` → GitHub release artifact upload via `softprops/action-gh-release@v2`. No Marketplace publish (correct pre-v1.0 policy).
- risks/rollback:
  - risk: doc drift from any last-minute v0.99.x patches.
  - rollback: narrow corrective doc PR before tagging.
- links:
  - `package.json`
  - `CHANGELOG.md`
  - `README.md`
  - `.github/workflows/release-vsix.yml`

### P16. Prospective intent capture and cognitive observability loop

- status: `done`
- why: the biggest research-backed gap between automated summaries and real-world resumption is **prospective information** — the intended next step at switch time (ICSE'26 TaCoS paper). IDEAS.md codifies the full evidence-based plan: measure resumption, improve resumption, avoid crutch. This plan slice sequences the next iteration.
- scope: tightening prospective capture at likely-switch moments; local "day view" friction summary; breakpoint-aware checkpoint policy tuning; and validation gates (noise gate + outcome gate).
- dependencies: P13 (Cognitive Observability v1), P15 (UX polish), P8 (signal normalization).
- recent progress:
  - defined gold metric contract: added `prospectiveIntentCaptureCount`, `checkpointPromptSuppressedHighLoad`, and `sessionFrictionSummaryOpened` fields to `MetricRecord`; wired into CSV headers, row builder, `buildMetricsBaselineSnapshotMarkdown`, and `hasAnyRecordedMetric`.
  - added `prospectiveNextVerification` field (max 280 chars, optional) to `StructuredTaskState` and `CreateStructuredTaskStateInput` in `src/taskState.ts`; wired into `normalizeTask()`, `createStructuredTaskState()`, `updateStructuredTaskState()`, completeness scoring (now 9 fields), and `formatStructuredTaskStateForPrompt()`.
  - `TaCoS: Capture Task Checkpoint` now prompts for prospective next verification as a dedicated InputBox step; field counted via `prospectiveIntentCaptureCount`.
  - tightened breakpoint-aware checkpoint prompt policy: `shouldDeferCheckpointPromptHighLoad` in `src/noiseControl.ts` suppresses checkpoint prompts when `lastMeaningfulActivityAt` is within `cooldownMinutes * 60_000` of now; wired into `maybeOfferTaskCheckpointPrompt` with `high-load-deferred` suppression reason and `checkpointPromptSuppressedHighLoad` metric counter.
  - added `TaCoS: Show Session Friction Summary` command: opens a local-only markdown baseline snapshot in `ViewColumn.Beside`; registered in `package.json` with `onCommand:tacos.showSessionFrictionSummary` activation event.
  - 10-case unit test suite for `shouldDeferCheckpointPromptHighLoad`; `packageManifest.test.ts` asserts the new command and activation event; `verify:quick` exits 0 (399 tests, 56 suites).
  - docs parity: `SPECS.md` P16 feature section added; `CHANGELOG.md` `[Unreleased]` entries written; `PLANS.md` ledger updated.
- risks/rollback:
  - risk: new prompts at switch time create the self-interruptions the tool aims to prevent.
  - rollback: increase suppression thresholds and shrink checkpoint prompt window before landing any new capture UI.
- links:
  - `docs/references.md` (refs 9, 14, 15, 16)
  - `src/taskSwitch.ts`
  - `src/taskState.ts`
  - `src/noiseControl.ts`
  - `src/metrics.ts`
  - `src/extension.ts`

### P18. Dialogue UX pass — notification copy and button reduction

- status: `done`
- why: reduce choice paralysis in the main summary notification; remove dead code from a prior redundant button; clean up verbose and inconsistent notification copy.
- scope: `src/extension.ts` summary notification button array, orphaned handler, and success/status toast strings.
- dependencies: P15, P16.
- recent progress:
  - removed `Copy prompt for Codex` button from the `presentSummary()` `showInformationMessage` call (redundant with `Copy + Open Codex`); notification now has 5 buttons instead of 6.
  - removed orphaned `if (choice === 'Copy prompt for Codex')` handler block (dead code).
  - cleaned up `markTaskResolvedCommand` success toast: `"TaCoS: structured task checkpoint resolved."` → `"TaCoS: task marked resolved."`.
  - `tacos.slash` success toast shortened: `"TaCoS: complete summary generated, copied, and opened in a new editor tab."` → `"TaCoS: summary generated, copied, and opened."`.
  - `tacos.showLastSummary` no-cache toast: `"TaCoS: No cached summary yet for this workspace."` → `"TaCoS: no cached summary yet for this workspace."` (consistent lowercase after colon prefix).
  - `verify:quick` exits 0 (56 suites / 403 tests).
- risks/rollback:
  - risk: none; changes are purely reductive (dead button + dead code removed) or copy-only.
  - rollback: reintroduce button and handler if usage data later shows demand for a copy-only Codex prompt flow.
- links:
  - `src/extension.ts`
  - `CHANGELOG.md`

### P19. Resume tab cockpit layout — no-scroll combination cue

- status: `done`
- why: the TaCoS ICSE'26 paper's strongest finding is that a **combination cue** (summary + prospective next step + most recent timeline entry, expandable) produces the best task success rates. The current Resume card stack requires scrolling and does not privilege prospective/verify-first fields as first-class visible elements. This is the highest-leverage UI alignment gap between the research and the shipped product.
- scope: restructure the Resume tab panel in `panelFragments.ts` and `panelCards.ts` so that above the fold (no scroll required in the common case) users see: (1) `Verify first` — inline editable single-line field; (2) `Next step` — inline editable single-line field; (3) `Blocker` — collapsible, only shown when non-empty; (4) `Recent anchors` — top 3 evidence items pulled from timeline, each expandable; (5) a compact action row: `Capture checkpoint` / `Mark resolved`. Everything else moves behind expanders or to other tabs.
- dependencies: P15 (UX polish), P16 (prospective intent), P18 (dialogue UX).
- recent progress:
  - added `renderResumeCockpitCard()` to `src/webview/panelCards.ts` — accepts `ResumeCockpitCardInput` with `verifyFirst`, `nextStep`, `blocker?`, `anchors[]` (max 3), `actionButtonsTrustedHtml`; renders `.cockpit-card` with inline editable inputs, collapsible blocker, anchor badges, and `aria-live="polite"` autosave region.
  - added `CockpitField` type and `updateProspective` message variant + parser to `src/webviewMessages.ts` (field validated as `verifyFirst | nextStep`, value clamped to 280 chars).
  - added cockpit CSS block and compact density mode (`[data-density='compact']`) to `src/webview/panelStyles.ts`.
  - wired debounced 600 ms `input` handlers for `#cockpit-verify-first` / `#cockpit-next-step` in `src/webview/panelClientScript.ts`; `Enter` key flushes immediately and advances focus to next field; autosave indicator updates via `#cockpit-save-state` live region.
  - all tests pass clean; typecheck and lint clean.
- risks/rollback:
  - risk: inline editing in the webview introduces save-state complexity that could silently drop prospective fields on panel reload.
  - rollback: revert to read-only cockpit display with an `Edit` button that opens the existing `InputBox` flow; safe and already tested.
- links:
  - `src/webview/panelFragments.ts`
  - `src/webview/panelCards.ts`
  - `src/webview/panelStyles.ts`
  - `src/webview/panelClientScript.ts`
  - `src/taskState.ts` (prospectiveNextVerification field)
  - `deep-research-report.md` (§ "Make Resume a no-scroll cockpit")
  - https://github.com/jkordish/vscode-tacos/issues/309

### P20. Provenance header badges — always-visible local/AI status

- status: `queued`
- why: "AI optional" is a core product promise, but users only trust it if the UI has **always-visible provenance**. Currently the privacy preset exists in settings, but the webview header does not surface a persistent badge showing current data posture. Without it, users assume AI is running even when it isn't, and conversely may not realize when it is. The TaCoS research grounding and `docs/PRIVACY_AND_SAFETY.md` demand this for first-class trust.
- scope: add a persistent provenance badge row to the `panelFragments.ts` header fragment that renders: `● Local-only` (default) or `● AI used · <provider> · <model> · payload: <field list>` when AI is active. Add a `Preview payload` affordance (link/button) that opens the existing AI payload preview. Badge updates on every webview state push.
- dependencies: P15, P7 (explainability), P13x (payload preview deep-links).
- immediate next actions:
  - add `provenanceBadge` field to webview bindings type (the object passed to `renderWebviewDocument`).
  - render badge in header fragment with two variants: `local-only` class and `ai-active` class; style in `panelStyles.ts` with `badge-local` (green) and `badge-ai` (amber) visual tokens.
  - wire state push in `extension.ts` to always include current privacy preset + active provider identity in bindings.
  - add unit test in `panelFragments.test.ts` asserting badge renders in both variants.
  - update `docs/PRIVACY_AND_SAFETY.md` to document the always-visible provenance badge as a shipped UI guarantee.
- risks/rollback:
  - risk: badge adds visual noise in the header and competes with primary resume content for attention.
  - rollback: collapse badge to a small icon-only indicator with tooltip; keep the data wiring in place.
- links:
  - `src/webview/panelFragments.ts`
  - `src/webview/panelStyles.ts`
  - `src/extension.ts`
  - `docs/PRIVACY_AND_SAFETY.md`
  - `deep-research-report.md` (§ "Provenance badges everywhere")
  - https://github.com/jkordish/vscode-tacos/issues/310

### P21. Evidence tab — recent anchors default with grouping and expand

- status: `queued`
- why: the TaCoS paper found timeline cues produced the highest task success but were also frequently described as **noisy and overwhelming**. Participants explicitly requested grouping, collapsing, filtering, and granularity controls. The current Evidence tab renders timeline as a flat list, which replicates the overwhelm problem the paper documented. Fixing this is directly research-mandated, not taste.
- scope: restructure the Evidence tab panel to default to a `Recent anchors` view (last 5–10 min, top 10 events, grouped by file). Add toggle controls: `By time / By file / By action`. Provide an `Expand full timeline` affordance that reveals the full log in collapsible sections. Add optional granularity slider (coarse/medium/fine) as a setting (`tacos.evidence.granularity`).
- dependencies: P15, P19 (cockpit anchors slot pulls from same data).
- immediate next actions:
  - define `groupTimelineByFile(entries, windowMs)` and `groupTimelineByTimeBucket(entries, bucketSizeMs)` pure functions in `src/timeline.ts` (fully unit-testable).
  - define `selectRecentAnchors(entries, count, windowMs)` for the top-N recent anchors used by both the cockpit (P19) and the Evidence tab.
  - add `EvidenceGroupMode` type (`'recent' | 'by-file' | 'by-time' | 'by-action'`) to `src/types.ts` and thread through webview bindings.
  - render grouped evidence card in `panelCards.ts` with collapsible file groups and `expand full timeline` toggle.
  - add `tacos.evidence.granularity` setting (`coarse` / `medium` / `fine`) to `package.json` manifest and wire into `selectRecentAnchors` window.
  - update unit tests for grouping/anchor-selection pure functions.
  - update integration coverage for Evidence tab rendering with grouped output.
  - update `SPECS.md` and `docs/DESIGN_AND_IMPLEMENTATION.md` with Evidence tab behavior contract.
- risks/rollback:
  - risk: grouping logic that buckets events incorrectly could hide relevant context during a resumed session.
  - rollback: revert Evidence tab to flat list (current behavior) and keep grouping behind a new `tacos.evidence.grouping` flag while iterating.
- links:
  - `src/timeline.ts`
  - `src/types.ts`
  - `src/webview/panelCards.ts`
  - `src/webview/panelFragments.ts`
  - `package.json`
  - `SPECS.md`
  - `deep-research-report.md` (§ "Evidence tab: default to Recent with grouping")
  - https://github.com/jkordish/vscode-tacos/issues/311

### P22. Inline editing with autosave indicator and undo for destructive actions

- status: `queued`
- why: cognitive recovery is a trust-sensitive workflow. Silent data loss after a destructive action (deleting a note, clearing a field) is catastrophic — it undermines user confidence and causes churn. The product promises "local-first" and "no hidden behavior," but without visible save state and reversible deletes, users cannot verify those promises in-the-moment. This is also demanded by the research: TaCoS participants used manual notes for prospective next steps (80/87 notes contained an immediate next step), making note fidelity safety-critical.
- scope:
  - **Autosave indicator**: scratchpad, verify-first, and next-step fields in the cockpit (P19) show `Saved • HH:MM` after debounced save; transient `Unsaved…` state during edit; rendered in a persistent `aria-live="polite"` region so keyboard-only users receive confirmation.
  - **Undo toast for note deletion**: deleting a checkpoint note or scratchpad item shows a `Note deleted · Undo` toast (5–10s timeout); `Undo` posts `undoDeleteNote` message back to extension and re-inserts the item; metric counter `noteDeleteUndoCount` added to `MetricRecord`.
  - **Undo toast for task resolve**: `Mark resolved` shows `Task marked resolved · Undo` toast with a narrow 15s window; undo re-opens the task in active state.
- dependencies: P19 (cockpit inline fields), P15.
- immediate next actions:
  - implement `showToast(message, { actionText, onAction, timeoutMs })` helper in `panelClientScript.ts` using a persistent toast region in the webview DOM.
  - wire `onInputDebounced()` for verify-first and next-step cockpit fields; post `updateProspective` on flush; update save-state indicator.
  - wire `deleteNote` action to toast + undo via `undoDeleteNote` message; add extension-side undo buffer (last deleted note, TTL 30s).
  - add `noteDeleteUndoCount` to `src/metrics.ts` schema and test suite.
  - update `panelClientScript.test.ts` for save-state indicator state machine.
  - add integration assertion: delete note → toast visible → undo → note re-appears.
- risks/rollback:
  - risk: undo buffer in extension state could grow unbounded if users rapidly delete many notes.
  - rollback: cap undo buffer at 1 item with a clear TTL; no persistence across panel sessions.
- links:
  - `src/webview/panelClientScript.ts`
  - `src/webview/panelFragments.ts`
  - `src/checkpoint.ts`
  - `src/metrics.ts`
  - `src/extension.ts`
  - `deep-research-report.md` (§ "Save/undo semantics")
  - https://github.com/jkordish/vscode-tacos/issues/312

### P23. ARIA completion — full keyboard navigation, tab focus, and live regions

- status: `queued`
- why: the extension targets developers who may rely on keyboard navigation or assistive technologies. The current tab strip has partial ARIA, but the deep research report identified gaps in keyboard focus management (`tabindex="-1"` on inactive tabs, `ArrowLeft/Right/Home/End` tab switching, focus return to the active panel after switching). Additionally, save-state announcements (from P22) require `aria-live` regions to be meaningful for non-visual users.
- scope:
  - Tab strip: inactive tabs get `tabindex="-1"`; active tab gets `tabindex="0"`; `ArrowLeft` / `ArrowRight` cycle focus through tabs; `Home` / `End` jump to first/last tab; `Enter` / `Space` activate; focus moves to the first focusable element in the newly activated panel.
  - Save state: `aria-live="polite"` region for `Saved • HH:MM` / `Unsaved…` announcements (shared with P22).
  - Toast region: `aria-live="assertive"` for undo toasts (time-sensitive) (shared with P22).
  - Confirm all tab panels have correct `role="tabpanel"`, `aria-labelledby`, `hidden` attribute toggling.
  - Run `panelA11y.test.ts` extended assertions for all new ARIA attributes and keyboard interaction contract.
- dependencies: P19 (cockpit panel), P22 (save state / toast regions).
- immediate next actions:
  - audit `panelClientScript.ts` current tab keyboard handler and identify gaps vs. ARIA APG Tabs pattern.
  - update tab strip keyboard handler to emit full `ArrowLeft/Right/Home/End` navigation with focus management.
  - add `aria-live="polite"` save-state region and `aria-live="assertive"` toast region to `panelFragments.ts` header/footer.
  - extend `panelA11y.test.ts` unit assertions for `tabindex`, `aria-selected`, `role`, `aria-labelledby`, and panel `hidden` state across all tab combinations.
  - manual smoke check per `docs/manual-smoke-runbook.md` with keyboard-only navigation.
- risks/rollback:
  - risk: focus management changes can create focus traps in edge cases (e.g. panel content is empty or not yet rendered).
  - rollback: revert keyboard handler to current behavior and ship ARIA attribute fixes independently as a safe subset.
- links:
  - `src/webview/panelClientScript.ts`
  - `src/webview/panelFragments.ts`
  - `test/panelA11y.test.ts`
  - `docs/manual-smoke-runbook.md`
  - `deep-research-report.md` (§ "ARIA tweaks for tabs and announcements")
  - https://github.com/jkordish/vscode-tacos/issues/313

### P24. Task/checkpoint naming rationalization and schema v2 migration

- status: `queued`
- why: the deep research report identifies "checkpoint vs task" ontology confusion as a pure adoption blocker. Internally the split is meaningful (`taskState` = rich structured state, `checkpoint` = note/annotation layer), but externally users see both terms used interchangeably across commands, cards, and docs. This creates confusion about what to capture, when, and why. Additionally, the data model is ready for a `schemaVersion: 2` bump that formalizes `tasks` as the top-level concept with `notes` as a child collection — consistent with what `src/taskState.ts` already models internally.
- scope:
  - **User-facing copy**: converge all user-visible strings on `task state` (not `structured task checkpoint`) and `task notes` (not `checkpoint notes`). Commands: `Capture task state`, `Update task state`, `Task notes`. Cards: `Task State`, `Task Notes`.
  - **Schema v2**: introduce `schemaVersion: 2` key in `workspaceState`. Write a `migrateV1toV2()` function in `src/taskState.ts` that reads legacy `checkpoints` key and writes normalized `tasks` shape. Keep compat read for one release cycle. Write only new keys after migration.
  - **Storage key audit**: enumerate all `context.workspaceState.get/update` call sites for checkpoint/task keys across `src/checkpoint.ts`, `src/taskState.ts`, `src/extension.ts` and confirm migration covers all of them.
  - **Docs**: update `SPECS.md`, `README.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`, `CHANGELOG.md` with new user-facing terminology and schema v2 contract.
- dependencies: P15, P19, P22 (all depend on stable card/field naming).
- immediate next actions:
  - enumerate all user-facing strings containing `checkpoint` (case-insensitive) across `src/webview/*`, `src/extension.ts`, `package.json` (command titles), and `README.md`.
  - define migration contract: `schemaVersion` key, `migrateV1toV2()` signature, compat read window.
  - implement migration in `src/taskState.ts` with full unit test coverage (idempotent, handles missing fields, handles empty store).
  - update command titles in `package.json` and all string literals in the webview layer.
  - update `panelFragments.test.ts`, `panelCards.test.ts`, and `taskState.test.ts` for new strings and migration behavior.
  - update all affected docs in a single PR.
- risks/rollback:
  - risk: storage key migration could lose task state if a user downgrades the extension between schema v1 and v2 write cycles.
  - rollback: keep compat read for both key shapes for two releases; never delete v1 key until v2 is confirmed present.
- links:
  - `src/taskState.ts`
  - `src/checkpoint.ts`
  - `src/extension.ts`
  - `src/webview/panelFragments.ts`
  - `src/webview/panelCards.ts`
  - `package.json`
  - `README.md`
  - `SPECS.md`
  - `deep-research-report.md` (§ "Rename checkpoint notes → task notes" and § "Migration plan")
  - https://github.com/jkordish/vscode-tacos/issues/314

### P25. Evidence as feature-traceability matrix in docs/references.md

- status: `queued`
- why: `docs/references.md` is currently a literature anchor only — it lists the TaCoS paper and adjacent work but does not map research findings to shipped features or outstanding gaps. The deep research report calls this out explicitly: without a traceability matrix, it is impossible to audit whether the product's UI/UX decisions are actually grounded in the cited evidence. This is low-effort but high documentation value, especially as the project approaches v1.0.
- scope: extend `docs/references.md` with a **Feature Traceability Matrix** section that maps each key TaCoS research finding to: (a) the shipped TaCoS feature implementing it, (b) the PLANS.md item that delivered it, and (c) any remaining gap or aspiration. Findings to map: combination cue recommendation, timeline noise findings, prospective intent value, manual note proximity value, nested/hierarchical task future direction.
- dependencies: P19, P21 (gaps being closed by those items should be reflected).
- immediate next actions:
  - draft traceability table in `docs/references.md` under a new `## Feature Traceability` section.
  - cross-reference each finding against current SPECS.md feature list, PLANS.md items, and `deep-research-report.md` gap analysis.
  - mark findings as `✓ Implemented`, `⚑ Partial`, or `○ Aspirational` with links to relevant source files or plan items.
  - no code changes required; doc-only PR.
- risks/rollback:
  - risk: traceability table drifts from implementation as new features ship.
  - rollback: none needed; keep table behind a clearly dated heading (`As of v0.99`) and update with each release cycle.
- links:
  - `docs/references.md`
  - `deep-research-report.md` (§ "Alignment with research and gaps")
  - `SPECS.md`
  - https://github.com/jkordish/vscode-tacos/issues/315

### P26. Hierarchical / nested task support — research-grounded future direction

- status: `queued`
- why: the TaCoS ICSE'26 paper's discussion section explicitly calls out "nested and interdependent tasks" as a direction future systems should address. Real-world engineering work — especially for Staff+ engineers and on-call responders — involves a tree of tasks (e.g. investigating an incident triggers a sub-task to check a service, which triggers another to read a runbook). The current TaCoS model treats task state as flat (one active structured task per partition). This plan item sequences the design and prototyping work.
- scope: this is a design-first item before any code. Deliverables: (a) a `docs/task-hierarchy-design.md` spike document exploring the data model extension (parent/child task IDs, lineage chain, sub-task promotion/demotion), (b) user story sketches for the two primary use cases (incident investigation, PR review with sub-tasks), (c) an assessment of which existing storage/rendering surfaces need to change, and (d) a go/no-go recommendation for including in v1.x.
- dependencies: P24 (schema v2 must be stable before extending the task model further).
- immediate next actions:
  - draft `docs/task-hierarchy-design.md` covering: data model extension sketch, UI surface implications (how would the cockpit P19 render a task tree?), migration path from flat to hierarchical, and open questions.
  - review against `src/taskState.ts` current shape and identify minimal schema additions.
  - circulate for review before any implementation work begins.
- risks/rollback:
  - risk: hierarchical tasks add significant model complexity that could destabilize the clean local-first single-task mental model that makes TaCoS approachable.
  - rollback: keep as a design spike only; do not merge any code changes until the design doc is approved.
- links:
  - `src/taskState.ts`
  - `docs/references.md` (TaCoS paper nested-tasks direction)
  - `deep-research-report.md` (§ "Hierarchical / nested dependent tasks")
  - https://github.com/jkordish/vscode-tacos/issues/316

### P27. v1.0 release preparation

- status: `queued`
- why: `v0.99.0` is the last pre-v1.0 feature-complete milestone. P19–P25 represent the final research-alignment and UX polish work required to reach a v1.0 quality bar. P27 sequences the release prep after those items land.
- scope: version bump to `1.0.0`, `CHANGELOG.md` `[1.0.0]` stamp, final `README.md` refresh, `docs/quickstart.md` accuracy check, Marketplace publish prerequisite documentation and decision point (does `VSCE_PAT` get added to the release workflow?), final `npm run verify` + `npm run package:vsix` regression pass.
- dependencies: P19, P20, P21, P22, P23, P24, P25 (all research-alignment items done or explicitly deferred to v1.x).
- immediate next actions:
  - confirm all P19–P25 items are `done` or explicitly `blocked`/`deferred` with documented rationale.
  - decide Marketplace publish policy for v1.0 (add `VSCE_PAT` to workflow or remain VSIX-only).
  - run full `npm run verify` + `npm run package:vsix` clean pass.
  - bump `package.json` to `1.0.0` and stamp `CHANGELOG.md`.
- risks/rollback:
  - risk: shipping v1.0 with unresolved ARIA or naming gaps creates a trust deficit with early adopters.
  - rollback: release as `v0.99.x` patch until blocking items are resolved.
- links:
  - `package.json`
  - `CHANGELOG.md`
  - `README.md`
  - `docs/quickstart.md`
  - `.github/workflows/release-vsix.yml`
  - `AGENTS.md`
  - https://github.com/jkordish/vscode-tacos/issues/317

## Blockers

- none currently.
