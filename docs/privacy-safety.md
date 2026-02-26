# TaCoS Privacy & Safety

TaCoS is designed around local-first context resumption with explicit security boundaries.

## Local-First Behavior

- TaCoS generates a useful local summary immediately from IDE/git/task signals.
- AI refinement is optional and asynchronous.
- If AI is unavailable or disabled, TaCoS safely stays local-only.

## What TaCoS Collects

- Recent file activity.
- Git context (trusted workspaces only).
- Terminal shell integration events (trusted workspaces only).
- Debug/task activity.
- User-added URLs.
- Optional checkpoint notes.

## Restricted Mode (Workspace Trust)

In Restricted Mode:

- Git command collection is disabled.
- Terminal command collection is disabled.
- AI refinement is disabled.
- Risky restore actions (task/debug/branch execution) are disabled.
- Local summary remains available.

## Data Persistence

- Activity data is redacted before persistence.
- Raw terminal commands are not persisted; terminal-derived fields are anonymized/fingerprinted.
- API keys are stored in VS Code Secret Storage.

## AI Safety Model

- All model output is treated as untrusted.
- Links are evidence-grounded and validated before rendering and again at click time.
- File links must resolve within workspace root.
- External URLs are limited to `http`/`https`.

## Quick Controls

- Pause auto summaries: `TaCoS: Pause Auto Summaries`
- Resume auto summaries: `TaCoS: Resume Auto Summaries`
- Toggle enablement: `TaCoS: Toggle Summaries Enabled`
- Configure provider: `TaCoS: Configure AI Provider`
