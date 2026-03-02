# AGENTS.md

## Repo Identity

`vscode-tacos` is a TypeScript VS Code extension (`TaCoS Resume Brief`) that helps developers resume work after interruptions with local-first resume briefs, safe next actions, and optional AI refinement.

TaCoS is desktop-first today. Do not claim browser/web extension support unless runtime architecture is intentionally split and validated.

## Repo Map

- `src/extension.ts`: activation, orchestration, command wiring, trust gates, provider selection.
- `src/*`: deterministic domain logic (summary, redaction, trust cues, restore safety, metrics, partitions, notes, scratchpad).
- `src/webview/*`: companion panel HTML/CSS/client behavior.
- `test/*.test.ts`: unit tests.
- `test/integration/*`: VS Code extension integration harness (`@vscode/test-electron`).
- `docs/*`: user-facing and operator documentation.
- `.github/*`: CI, release workflows, issue forms, PR template, ownership.
- `scripts/*`: build and local report helpers.

## Canonical Commands

- `npm ci`
- `npm run build`
- `npm run build:watch`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:integration`
- `npm run verify:quick`
- `npm run verify`
- `npm run package:vsix`

## Change Rules

- Keep behavior local-first and safe-by-default.
- Treat model output as untrusted; never bypass evidence/path/url validation.
- Preserve Restricted Mode trust boundaries for risky collection and execution actions.
- Do not add hidden networked behavior or telemetry pipelines.
- Keep deterministic logic unit-testable and covered.

## Required Updates By Change Type

If you change user-visible behavior:

- update `SPECS.md`, `README.md`, and `CHANGELOG.md`.
- update `PLANS.md` status/sequence when work starts, pauses, or completes.
- update `docs/DESIGN_AND_IMPLEMENTATION.md` when panel/runtime behavior changes.

If you add/change a command:

- update command docs (`README.md`, `docs/DESIGN_AND_IMPLEMENTATION.md`).
- add/update unit or integration coverage for command wiring/behavior.

If you add/change a setting:

- update docs (`README.md`, `SPECS.md`, design doc).
- add/update tests for config wiring and behavior toggles.

If you change privacy/trust/AI payload behavior:

- update `docs/PRIVACY_AND_SAFETY.md`, `SPECS.md`, and tests in the same PR.
- verify consent boundaries remain explicit and fail-closed behavior is preserved.

If you change packaging/release behavior:

- update `AGENTS.md`, workflow files, and release docs together.
- verify `npm run package:vsix` and CI packaging smoke steps still pass.

If you change operator process, guardrails, or canonical command contracts:

- update `AGENTS.md` in the same PR.
- keep `.github/PULL_REQUEST_TEMPLATE.md` and `CONTRIBUTING.md` aligned with those changes.

## Testing Expectations Before Merge

Minimum for most changes:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`

Also run `npm run test:integration` when touching activation, commands, settings wiring, webview flows, trust gates, restore flows, or provider behavior.

Run `npm run package:vsix` when touching packaging, manifest metadata, workflow/release paths, or build outputs.

## Docs and Planning Expectations

- `SPECS.md` is the canonical behavior contract.
- `PLANS.md` is the active execution ledger (`queued`, `doing`, `blocked`, `done`).
- Active TODOs belong in `PLANS.md` or relevant spec sections, not a floating `TODO.md`.
- Do not mark work complete until docs parity is met for the change:
  - behavior/spec: `SPECS.md`
  - operator contract/process: `AGENTS.md`
  - user and architecture docs: `README.md` and `docs/*`
  - execution ledger: `PLANS.md`
  - release notes: `CHANGELOG.md` for user-visible changes

## Release and Publish Expectations

- `main` must remain verify-clean and packageable.
- Tag workflow must produce a VSIX artifact.
- Marketplace publish is optional and credential-gated (`VSCE_PAT`), with explicit docs for missing config.

## Guardrails For Humans and AI Agents

- No silent behavior changes.
- No secrets in docs/tests/issues.
- No large refactor churn without explicit plan/spec updates.
- Keep changes reviewable and tightly scoped.
