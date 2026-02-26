# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

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
- Configure AI Provider flow includes clearer privacy/trust guidance.
- Git snapshot collection uses bounded command timeouts and caching to reduce repeated cost.
- CI quality gates now enforce compile, lint, format-check, unit/integration tests, and VSIX packaging.

### Security

- Webview click handling now uses explicit `data-action` routing and strict host-side message parsing.
- Unsafe links and malformed webview messages are blocked/no-op by default.
- Persisted terminal-derived fields are anonymized/fingerprinted to avoid storing raw commands.
- Legacy persisted activity is migrated to sanitized/fingerprinted storage at startup.
- Privacy & Safety command opens a dedicated markdown document shipped with the extension.

## [0.0.3] - 2026-02-25

- Initial public baseline for TaCoS Resume Brief.
