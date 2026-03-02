# Design and Implementation Guide

## Project Shape and Boundaries

TaCoS is a VS Code extension focused on interruption recovery.

Boundaries:

- Local extension host logic owns context collection, summarization, safety checks, and action orchestration.
- Webview UI renders summary/companion views and sends explicit user actions back to host.
- AI providers are optional refinement backends; they do not own core behavior.

## Runtime Architecture

Primary entrypoint:

- `src/extension.ts` initializes state, registers commands, collects signals, and coordinates summary/render pipelines.

Supporting modules:

- Summary/intent/action logic: `src/summary.ts`, `src/nextStepActions.ts`, `src/noiseControl.ts`, `src/percolation/*`.
- Safety/trust/privacy: `src/redaction.ts`, `src/pathSafety.ts`, `src/evidenceSafety.ts`, `src/restoreSafety.ts`.
- Provider adapters: `src/llm.ts`, `src/vscodeLm.ts`.
- Persistence/scoping: checkpoint/scratchpad/partition/resume-path modules.
- Webview rendering and client behavior: `src/webview/*`, `src/webviewSecurity.ts`.

## Extension Architecture and Activation Model

Activation:

- Declared by startup and command-based activation events in `package.json`.
- Primary activation occurs on startup and command invocation.

Contribution points:

- Commands (`tacos.*`) for summaries, restore flows, notes, scratchpad, privacy/safety, diagnostics, and provider control.
- Configuration (`tacos.*`) for timing, privacy, provider choice, and UI behavior.
- Keybindings for common resume actions.

Why a webview exists:

- The companion resume card stack requires richer stateful UI than native status/notification surfaces alone.
- Native surfaces are still used for lightweight affordances (status bar and notifications).

## Commands, Settings, and User-facing Surfaces

User-facing surfaces:

- Companion webview panel (primary detail/action surface).
- Status bar companion state/action affordance.
- Optional notification-mode prompting.
- Commands exposed in the command palette.

Canonical command/settings references live in:

- `README.md`
- `package.json` (`contributes.commands`, `contributes.configuration`)

## Storage and State Model

Primary stores:

- `workspaceState`: scoped activity, summary cache, notes, percolation memory, runtime flags.
- `globalState`: small cross-workspace values where appropriate.
- `SecretStorage`: OpenAI API key.
- Local files: exported metrics under workspace `.tacos/`; extension-managed scratchpad files under extension storage.

State principles:

- Persist sanitized data only.
- Keep scope explicit (workspace + branch + optional partition/task context).
- Retention pruning controlled by `tacos.retentionPolicy`.

## Trust and Security Model

Workspace Trust posture:

- Extension declares `untrustedWorkspaces.supported = limited`.
- Restricted Mode disables risky collection/actions (git execution, terminal collection, AI refinement, execution-style restore actions).

Webview security:

- Nonce-based strict CSP with default-deny policy.
- Host validates all webview messages and action payloads.

Evidence/action safety:

- File actions must resolve inside workspace boundaries.
- URL actions restricted to `http`/`https`.
- Link/action evidence is validated before render and revalidated on invocation.

AI safety posture:

- Local summary always available.
- AI is opt-in and consent-gated.
- Strict sanitizer can block payload send (fail closed).
- Model output is parsed and schema-validated before application.

## Telemetry Decision

- No outbound product telemetry pipeline is implemented.
- Metrics are local-only and user-exported on demand (`.tacos/metrics.json` and `.tacos/metrics.csv`).
- This is an intentional privacy posture.

## Desktop-only vs Web-capable

Current status: desktop extension only.

Why:

- Runtime depends on Node APIs and host process capabilities (`child_process`, filesystem, HTTP modules, git/task/debug integration).
- No `browser` entrypoint is defined in the extension manifest.

What would be required for web support:

- Browser-compatible extension entrypoint and architecture split.
- Replacement/removal of Node/process-dependent features.
- Separate test matrix for browser host behavior.

## Testing Strategy

Test layers:

- Unit tests: deterministic logic in `test/*.test.ts` via Jest.
- Integration tests: VS Code extension host behavior via `@vscode/test-electron` (`test/integration`).

Quality gates:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:integration` (required for command/activation/webview/trust changes)

## Build, Packaging, and Release Flow

Build flow:

- `npm run build` uses esbuild to bundle `src/extension.ts` to `dist/extension.js`.
- `npm run typecheck` uses `tsc --noEmit` for static type safety.

Packaging:

- `npm run package:vsix` creates a VSIX via `vsce`.
- `.vscodeignore` defines package include/exclude behavior.

CI:

- CI workflow runs format, lint, typecheck, unit tests, integration tests, and package smoke check.
- Release workflow packages VSIX artifacts on version tags.

Publish readiness:

- Repository is package-ready.
- Automated direct marketplace publish remains gated on maintainer-provided secrets/credentials.
