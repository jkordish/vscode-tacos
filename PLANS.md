# PLANS.md

Status vocabulary used in this file:

- `queued`: sequenced but not started
- `doing`: actively in progress
- `blocked`: waiting on external input/decision
- `done`: completed and merged

## Current Execution Ledger

### P1. Docs/control-plane bootstrap

- status: `doing`
- why: keep behavior contracts, execution sequencing, and contribution hygiene explicit.
- scope: top-level operating docs, templates, and canonical privacy/design docs.
- dependencies: none.
- immediate next actions:
  - finish docs consistency sweep (`README`, specs, privacy, templates).
  - ensure command/settings/trust docs match manifest and runtime behavior.
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
  - `docs/ux/dynamic-percolation-v0.8.0-spec.md`
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
  - `docs/ux/dynamic-percolation-v0.8.0-spec.md`
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
  - `docs/ux/dynamic-percolation-v0.8.0-spec.md`
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
  - standardized Trust & Privacy tray terminology in key docs (`README`, `SPECS`, `docs/DESIGN_AND_IMPLEMENTATION.md`, `docs/metrics.md`, `CHANGELOG`) and aligned panel/status semantics with updated copy.
  - added/updated string assertions in `test/panelCards.test.ts` for Trust & Privacy tray and emphasis badge copy.
- risks/rollback:
  - risk: operator workflows may still reference historical v0.6/v0.7 smoke expectations.
  - rollback: restore prior runbook/report templates from git history while keeping v0.8 addendum content in a separate doc.
- links:
  - https://github.com/jkordish/vscode-tacos/issues/257
  - https://github.com/jkordish/vscode-tacos/issues/247
  - https://github.com/jkordish/vscode-tacos/issues/229
  - https://github.com/jkordish/vscode-tacos/issues/227

### P13. Remaining open-epic closure sweep (`#246`, `#259`)

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

## Blockers

- none currently.
