# Contributing

## Operating Model

This repo is docs-driven:

1. `SPECS.md` defines behavior contracts.
2. `PLANS.md` tracks active execution order and status.
3. code implements those contracts.
4. PRs include docs and test evidence for the behavior changed.

`AGENTS.md` is the operator contract for maintainers and AI coding agents.

## Setup

- Node.js 20.x
- npm (lockfile: `package-lock.json`)

```bash
npm ci
```

## Development Commands

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

## Expected Change Flow

1. If behavior changes, update/add relevant `SPECS.md` section first.
2. Ensure work is tracked in `PLANS.md` (`queued`/`doing`/`blocked`/`done`).
3. Implement code changes with tests.
4. Update docs in the same PR (`README.md`, `docs/*`, and `AGENTS.md` when operator rules/process change).
5. Update `CHANGELOG.md` for user-visible behavior changes.

## Required Updates by Change Type

- command changes: update docs and command wiring tests.
- setting changes: update docs and config behavior tests.
- trust/privacy/AI boundary changes: update `docs/PRIVACY_AND_SAFETY.md`, `SPECS.md`, and tests.
- packaging/release changes: update workflows/docs and run `npm run package:vsix`.
- operator contract/process changes: update `AGENTS.md` and keep `CONTRIBUTING.md` + PR template aligned.

## Pull Requests

Use `.github/PULL_REQUEST_TEMPLATE.md` (or equivalent template path in this repo) and include:

- linked issue/spec and plan item,
- user-visible behavior summary,
- trust/privacy/AI review notes when relevant,
- docs update confirmation,
- tests run,
- VSIX verification when relevant,
- changelog status.

## Release Expectations

- keep `main` verify-clean and packageable,
- keep tag workflow artifact generation working,
- do not wire Marketplace publish automation before `v1.0`; release flow is VSIX artifact + GitHub release only in this phase.
