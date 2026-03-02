# Security Policy

## Reporting Security or Privacy Issues

Do not report sensitive vulnerabilities in public issues.

Preferred path:

1. GitHub Security Advisory (`Security` -> `Report a vulnerability`).
2. If unavailable, open a minimal public issue requesting a private channel (without exploit details).

Include:

- affected version/commit,
- impact and attack surface,
- reproducible steps,
- sanitized proof artifacts.

## What Is Security/Privacy Sensitive Here

Given TaCoS handles local context and optional AI payloads, sensitive areas include:

- trust/restricted-mode guard bypasses,
- redaction/sanitization failures,
- provider payload consent boundary regressions,
- secret handling/storage regressions,
- unsafe file/url/action validation bypasses,
- diagnostics/metrics leaking unexpected sensitive data.

## Supported Version Policy

`main` is the active supported security baseline.

## Maintainer Handling Expectations

For security/privacy-impacting changes, update in the same PR:

- `SPECS.md`
- `docs/PRIVACY_AND_SAFETY.md`
- relevant tests
- `CHANGELOG.md` when user-visible behavior changes
