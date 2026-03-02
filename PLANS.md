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

- status: `doing`
- why: preserve trust by making surfaced-decision rationale available immediately from Companion Home.
- scope: Epic `#227`, currently DP-302 / issue `#243` (grouped evidence tray and one-click tray open path from surfaced top-card context).
- dependencies: P3, P4.
- recent progress:
  - completed DP-301 / `#242` (`Why am I seeing this?` one-click top-card path) and marked epic checklist progress.
  - confirmed current `Evidence` card behavior and safe open/static affordance semantics to preserve during grouping.
- immediate next actions:
  - land DP-302 grouped evidence tray rendering (`surfaced decision`/`other openable`/`context-only`).
  - add one-click Companion Home action to expand `More Context` -> `Evidence`.
  - run unit/integration checks and close issue `#243` once merged.
- risks/rollback:
  - risk: grouping can hide lower-priority evidence if ordering is not obvious.
  - rollback: keep one-click tray open path and revert to flat list rendering while preserving safe affordances.
- links:
  - `docs/ux/dynamic-percolation-v0.8.0-spec.md`
  - `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
  - https://github.com/jkordish/vscode-tacos/issues/227
  - https://github.com/jkordish/vscode-tacos/issues/242
  - https://github.com/jkordish/vscode-tacos/issues/243

## Blockers

- none currently.
