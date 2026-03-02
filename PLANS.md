# PLANS.md

Status markers:

- `[done]` completed and merged
- `[in-progress]` active implementation
- `[next]` queued and sequenced
- `[blocked]` waiting on external input

## Current Initiatives

### I0. Docs-driven operating model bootstrap

Status: `[done]`

Why:

- Establish one canonical flow for specification, execution planning, and contribution hygiene.

Scope:

- Add/refresh `AGENTS.md`, `SPECS.md`, `PLANS.md`, contribution/security/support docs, issue forms, and PR template.
- Add a truthful design/implementation guide.

Dependencies:

- None.

Immediate next actions:

- Enforce this flow in all new issues/PRs.
- Keep command/doc drift checks in PR review.

Risks / rollback:

- Risk: stale docs if commands drift.
- Rollback: revert doc-only files in one commit if critical inaccuracies are found.

Links:

- Spec baseline: `SPECS.md`.
- Existing product docs: `README.md`, `docs/privacy-safety.md`.

### I1. First shippable feature slice: dynamic percolation surfacing (`v0.8`)

Status: `[next]`

Why:

- Improve resume signal quality and reduce cognitive load by prioritizing the most relevant evidence/actions.

Scope:

- Tighten ranking and suppression policy behavior.
- Expose clear per-item explainability in panel surfaces.
- Ship with deterministic policy tests and integration checks.

Dependencies:

- I0 docs model in place.

Immediate next actions:

- Select one narrow vertical slice from roadmap docs.
- Define acceptance criteria in `SPECS.md` update for that slice.
- Implement with unit + integration coverage.

Risks / rollback:

- Risk: aggressive suppression hides needed context.
- Rollback: feature-flag or revert to current surfacing defaults.

Links:

- Roadmap detail: `docs/ux/dynamic-percolation-v0.8.0-spec.md`.
- Candidate issues: `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`.

### I2. Hardening and test quality pass

Status: `[next]`

Why:

- Preserve fast iteration while preventing regressions in trust/safety and panel behavior.

Scope:

- Expand regression coverage around trust gating, restore action guards, and webview state restoration.
- Audit flaky integration assumptions and tighten harness determinism.

Dependencies:

- I1 behavior changes.

Immediate next actions:

- Identify the top 3 uncovered regressions from recent releases.
- Add focused tests and remove redundant cases.

Risks / rollback:

- Risk: longer CI runtime slows feedback.
- Rollback: split slow suites and keep critical-path gates mandatory.

Links:

- Integration harness: `docs/integration-test-harness.md`.
- Manual smoke runbook: `docs/manual-smoke-runbook.md`.

### I3. Release/package readiness and publish prep

Status: `[next]`

Why:

- Keep every release candidate packageable and ready for Marketplace/Open VSX publish enablement.

Scope:

- Ensure bundle/package scripts and CI artifacts stay green.
- Document remaining secret/config requirements for publish.

Dependencies:

- I0 docs and tooling updates.

Immediate next actions:

- Validate VSIX packaging in CI and local verify flow.
- Confirm release checklist references are current.

Risks / rollback:

- Risk: untested publish path on tag day.
- Rollback: ship VSIX artifact only; delay direct publish until credentials are configured.

Links:

- Release workflow: `.github/workflows/release-vsix.yml`.
- Checklists: `docs/release-0.6.0-checklist.md` and subsequent release notes.

## Blockers

- None currently recorded.

## Sequencing Summary

1. Complete I0 (docs-driven contract and templates).
2. Execute one narrow I1 feature slice.
3. Run I2 hardening tied to that slice.
4. Close I3 package/release readiness for tag.
