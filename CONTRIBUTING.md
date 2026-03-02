# Contributing

## Working Model

This repository uses a docs-driven flow:

1. `SPECS.md` defines expected behavior.
2. `PLANS.md` defines execution order and current status.
3. Code changes implement those contracts.
4. PRs include test evidence and doc updates.

If your change affects behavior and there is no matching spec section, add/update `SPECS.md` first.

## Setup

- Node.js 20.x
- npm (lockfile is `package-lock.json`)

Install dependencies:

```bash
npm ci
```

## Development Commands

- Build extension bundle: `npm run build`
- Watch build: `npm run build:watch`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format check: `npm run format:check`
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- Full verify + package smoke: `npm run verify`

## Change Expectations

- Keep changes scoped and reviewable.
- Preserve local-first behavior and trust/safety boundaries.
- Add or update tests for changed logic.
- Update docs in the same PR for behavior/config/process changes.

Required doc updates when applicable:

- `SPECS.md` for behavior/safety contract changes.
- `PLANS.md` for active work status or sequencing changes.
- `README.md` and `docs/DESIGN_AND_IMPLEMENTATION.md` for command/architecture/runtime changes.

## Pull Request Expectations

Use `.github/pull_request_template.md` and include:

- linked spec and plan sections,
- risk and rollback notes,
- test command evidence,
- screenshots/GIFs for UI changes.

## Release and Packaging

- Ensure `npm run verify` passes.
- Validate VSIX packaging via `npm run package:vsix`.
- Tag-based GitHub workflow attaches VSIX artifacts.
- Marketplace/Open VSX publish requires maintainer-managed credentials and is intentionally separate.
