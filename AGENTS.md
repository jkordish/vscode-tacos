# AGENTS.md

## Purpose

`vscode-tacos` is a VS Code extension that helps users resume interrupted work with local-first summaries, safe next actions, and optional AI refinement.

This file is the operator contract for anyone changing this repository (humans and AI agents).

## Repo Map

- `src/` extension runtime and feature modules.
- `src/webview/` panel rendering and webview client script.
- `test/` unit tests (`*.test.ts`) and VS Code integration suites (`test/integration`).
- `docs/` product, safety, testing, and release documentation.
- `.github/` CI workflows, issue forms, PR template, ownership metadata.
- `scripts/` build/report helpers.

## Canonical Commands

- Install: `npm ci`
- Build bundle: `npm run build`
- Watch build: `npm run build:watch`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format check: `npm run format:check`
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- Quick verify gate: `npm run verify:quick`
- Full verify gate: `npm run verify`
- Package VSIX: `npm run package:vsix`

## Rules For Code Changes

- Keep behavior local-first and safe-by-default.
- Treat model output as untrusted; never bypass evidence/path/url validation.
- Do not add networked behavior without explicit spec coverage and consent UX.
- Keep restricted-mode behavior safe: risky collection and execution actions must remain gated.
- Preserve deterministic unit-testable logic for core decision engines.
- Avoid tool sprawl: one lint path, one format path, one unit-test path.

## When `SPECS.md` Must Be Updated

Update `SPECS.md` when a change does any of the following:

- adds, removes, or materially changes user-visible behavior,
- changes safety/privacy/trust boundaries,
- changes acceptance criteria for a feature,
- introduces a new feature slice or retires one.

## When `PLANS.md` Must Be Updated

Update `PLANS.md` when:

- work starts, pauses, or completes on an initiative,
- sequencing/dependencies change,
- a new blocker appears or clears,
- immediate next actions change,
- release readiness or rollback posture changes.

## Documentation Update Triggers

Update docs in the same PR when changing:

- commands/configuration (`README.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`),
- trust/privacy/sanitization behavior (`docs/privacy-safety.md`, `SPECS.md`),
- test strategy or harness behavior (`docs/integration-test-harness.md`),
- release/package flow (`README.md`, `PLANS.md`, release docs as needed).

## Testing Expectations Before Merge

Minimum for behavior changes:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`

Also run `npm run test:integration` when command wiring, activation behavior, workspace trust behavior, webview interactions, or restore actions are touched. If skipped, explain why in the PR.

## Release / Publish Expectations

- `main` must stay packageable (`npm run package:vsix`).
- Tag-based workflow attaches a VSIX artifact.
- Marketplace publish is intentionally separate; maintainers must provide publish credentials/secrets before enabling automated publish.

## Guardrails For Humans And AI Agents

- No silent behavior changes: update specs/plans/docs in the same PR.
- No secret material in tests/docs/issues.
- Do not claim web extension support unless runtime architecture is updated for browser constraints.
- Prefer small, reviewable commits that preserve passing gates.
