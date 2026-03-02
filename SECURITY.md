# Security Policy

## Supported Versions

Current `main` branch is the supported security baseline.

## Reporting a Vulnerability

For suspected vulnerabilities, do not open a public issue.

Use one of the following:

1. GitHub Security Advisory (preferred):
   - `Security` tab -> `Report a vulnerability`
2. If advisory flow is unavailable, open a minimal issue without exploit details and request a private channel.

Include:

- affected version/commit,
- impact summary,
- reproduction steps,
- proof-of-concept artifacts with secrets removed.

## Security Boundaries In This Repo

- Workspace trust mode gates risky collection/actions.
- AI payloads are sanitized and consent-gated.
- API keys are stored in VS Code SecretStorage.
- URLs and file paths are validated before action execution.

Changes that modify these boundaries must update `SPECS.md`, `PLANS.md`, and relevant safety docs in the same PR.
