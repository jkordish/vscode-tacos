# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

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
