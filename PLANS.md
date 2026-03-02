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

- status: `doing`
- why: deliver user-facing improvement without destabilizing trust/privacy boundaries.
- scope: one narrow dynamic-percolation slice that improves low-confidence clarification quality and explainability.
- dependencies: P3, P4.
- recent progress:
  - completed DP-202 panel section emphasis behavior (badge + accent only) with stable ordering and persisted disclosure state.
  - hardened DP-202 with follow-up fixes: snapshot section-order parsing now reads rendered disclosures only, and emphasis focus avoids hidden timeline sections when `tacos.showTimeline` is off.
- immediate next actions:
  - land DP-203 policy signal transparency follow-up.
  - continue with DP-204 confidence threshold tuning with deterministic fixtures.
- risks/rollback:
  - risk: over-aggressive suppression hides useful cues.
  - rollback: revert to previous ranking/suppression default behavior.
- links:
  - `docs/ux/dynamic-percolation-v0.8.0-spec.md`
  - `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
  - https://github.com/jkordish/vscode-tacos/issues/237
  - https://github.com/jkordish/vscode-tacos/pull/267

## Blockers

- none currently.
