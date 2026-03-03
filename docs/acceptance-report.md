# TaCoS Must-Have Epic Acceptance Report

Parent epic: [#27](https://github.com/jkordish/vscode-tacos/issues/27)  
PR: [#36](https://github.com/jkordish/vscode-tacos/pull/36)  
Branch: `feature/epic-must-have-tracking`

This report maps the original phase requirements to concrete implementation files and tests.

## Phase 0 - Repo Recon + Baseline

Status: Implemented

- Baseline commands executed and passing:
  - `npm ci`
  - `npm run compile`
  - `npm test`
  - `npx @vscode/vsce package --no-dependencies`
- Smoke protocol documented:
  - `docs/manual-smoke-runbook.md`
  - `docs/smoke-report.md`
- Integration harness added for repeatable extension-host verification:
  - `test/integration/runTest.js`
  - `test/integration/suite/trusted.js`
  - `test/integration/suite/isolatedProfileLocal.js`
  - `docs/integration-test-harness.md`

## Phase 1 - Webview Security Hardening (CSP) + HTML Escaping

Status: Implemented

- Strict nonce-based CSP and deny-by-default policy:
  - `src/webviewSecurity.ts`
  - `src/extension.ts` (`renderWebview`)
- HTML escaping and rendering safety:
  - `src/webviewSecurity.ts` (`escapeHtml`)
  - `src/extension.ts` (escaped fields for intent/steps/links/evidence/timeline)
- Defensive message parsing and no-op on invalid messages:
  - `src/webviewMessages.ts`
  - `src/extension.ts` (`onDidReceiveMessage`)
- Blocked-link fallback path for unexpected/invalid clicks:
  - `src/extension.ts` (webview click handler + `blockedLink` case)
- Tests:
  - `test/webviewSecurity.test.ts`
  - `test/webviewMessages.test.ts`

## Phase 2 - Timeline Mode

Status: Implemented

- Timeline grouping/sorting/relative-time logic:
  - `src/timeline.ts`
- Webview timeline UI (collapsed toggle + grouped sections):
  - `src/extension.ts` (`renderWebview`)
- Config flag:
  - `package.json` (`tacos.showTimeline`, default `true`, collapsed in UI)
- Click safety constraints (only `file`/`url` clickable):
  - `src/timeline.ts` (`isEvidenceTimelineClickable`)
  - `src/extension.ts` (`openEvidence` safety checks)
- Tests:
  - `test/timeline.test.ts`

## Phase 3 - Auto Future Me Capture

Status: Implemented

- Optional blur-triggered checkpoint prompt with cooldown and gating:
  - `src/noiseControl.ts` (`shouldPromptCheckpointOnBlur`)
  - `src/extension.ts` (`maybePromptCheckpointOnBlur`)
  - `package.json` (`tacos.promptCheckpointOnBlur`, default `false`)
- Clipboard checkpoint command:
  - `src/extension.ts` (`tacos.addCheckpointNoteFromClipboard`)
  - `package.json` command contribution
- Workspace-scoped checkpoint persistence:
  - `src/checkpoint.ts`
  - `src/extension.ts` (`workspaceState` + root-scoped keys)
- Tests:
  - `test/noiseControl.test.ts`
  - `test/checkpoint.test.ts`

## Phase 4 - Safety + Provider Coverage

Status: Implemented

- Path safety:
  - `src/pathSafety.ts`
  - `test/pathSafety.test.ts`
- LLM provider validation and grounded links:
  - `src/llm.ts`
  - `test/llm.test.ts`
- Redaction and persistence sanitization (no raw terminal persistence):
  - `src/redaction.ts`
  - `src/activityPersistence.ts`
  - `src/extension.ts` (startup migration of legacy persisted activity into sanitized form)
  - `test/redaction.test.ts`
  - `test/activityPersistence.test.ts`
- Noise control/cooldown behavior:
  - `src/noiseControl.ts`
  - `test/noiseControl.test.ts`
- Restricted restore-action gating:
  - `src/restoreSafety.ts`
  - `test/restoreSafety.test.ts`
- Integration harness:
  - `test/integration/runTest.js`
  - `test/integration/suite/trusted.js`
  - `test/integration/suite/isolatedProfileLocal.js`

## Phase 5 - CI/CD + Marketplace Readiness

Status: Implemented

- CI workflow with compile/lint/format-check/test/integration/package + VSIX artifact:
  - `.github/workflows/ci.yml`
- ESLint + Prettier setup and scripts:
  - `.eslintrc.cjs`
  - `.prettierignore`
  - `package.json` scripts
- Marketplace readiness:
  - `LICENSE`
  - `CHANGELOG.md`
  - `assets/icon.png`
  - `package.json` metadata (`repository`, `bugs`, `homepage`, `categories`, `keywords`, `icon`)
  - `.vscodeignore`

## Phase 6 - Must-Have Polish

Status: Implemented

- First-run onboarding notice:
  - `src/extension.ts` (`maybeShowOnboardingNotice`)
- Provider configuration guided flow:
  - `src/extension.ts` (`configureAiProvider`)
- Privacy & safety command/doc:
  - `src/extension.ts` (`tacos.openPrivacySafety`, `openPrivacySafetyDoc`)
  - `docs/privacy-safety.md`
- Native-feel webview theming + status indicator:
  - `src/extension.ts` (`renderWebview`)
- Performance safeguards:
  - `src/git.ts` (cached non-blocking collection)
  - `src/extension.ts` (focus debounce + in-flight guard)

## Remaining Human Verification

Status: Pending manual sign-off

- Interactive trusted/restricted smoke execution in VS Code UI:
  - `docs/manual-smoke-runbook.md`
- Tracking issue kept open until manual run is completed:
  - [#35](https://github.com/jkordish/vscode-tacos/issues/35)

## v0.7.0 UI/A11y/Reflow Acceptance Addendum

Status: In progress (manual v0.7.0 QA sign-off pending)

Tracking epics:

- [#190](https://github.com/jkordish/vscode-tacos/issues/190) Webview Foundation & Accessibility Baseline
- [#191](https://github.com/jkordish/vscode-tacos/issues/191) Responsive Layout & Visual Hierarchy
- [#192](https://github.com/jkordish/vscode-tacos/issues/192) Interaction Patterns, Discoverability & Input Ergonomics
- [#193](https://github.com/jkordish/vscode-tacos/issues/193) UI Performance, State Resilience & Regression Testing

### Implemented baseline in this stream

- Semantic webview shell and landmarks:
  - `src/webview/panelFragments.ts`
  - `test/panelFragments.test.ts`
- Disclosure affordance and summary semantics:
  - `src/webview/panelCards.ts`
  - `src/webview/panelStyles.ts`
  - `test/panelCards.test.ts`
- Keyboard/focus/live status and section persistence:
  - `src/webview/panelClientScript.ts`
  - `src/webviewMessages.ts`
  - `test/panelClientScript.test.ts`
  - `test/webviewMessages.test.ts`
- Companion Home responsive hierarchy + progressive “More Context” disclosure:
  - `src/resumeStackCard.ts`
  - `src/extension.ts`

### v0.7.0 acceptance criteria

- [ ] No horizontal scroll at narrow pane widths unless content is inherently 2D.
- [ ] Keyboard-only workflow pass.
- [ ] Forced-colors/high-contrast pass for disclosure/focus/border affordances.
- [ ] WCAG 2.2 target-size pass for primary/frequent controls (or documented exception).
- [x] Automated accessibility checks pass for generated webview HTML.
- [ ] Manual QA matrix (narrow/split/wide, forced-colors, keyboard-only, 400% zoom) executed and recorded.

### Open gaps / TODOs (v0.7.0)

- Completed: dedicated axe-core test coverage for generated panel HTML in CI gate (#218).
- Completed: persistence regression coverage including scroll/focus restoration behavior (#219).
- Completed: smoke report template now references the v0.7.0 matrix in `docs/smoke-report.md` (#221).
- Remaining: execute and record the v0.7.0 manual matrix run (#221).

## v0.8.x Dynamic Percolation Acceptance Addendum

Status: In progress (manual v0.8.x percolation sign-off pending)

Tracking epics:

- [#226](https://github.com/jkordish/vscode-tacos/issues/226) Adaptive Surface Layering and Calm Interaction Architecture
- [#227](https://github.com/jkordish/vscode-tacos/issues/227) Trust, Privacy, Evidence, and Explainability UX
- [#228](https://github.com/jkordish/vscode-tacos/issues/228) Work Signal Ingestion and Resume Semantics
- [#229](https://github.com/jkordish/vscode-tacos/issues/229) Metrics, Experimentation, and Release Validation

### Implemented baseline in this stream

- Deterministic percolation surface selection and calm interaction controls:
  - `src/extension.ts`
  - `src/percolation/*`
  - `test/percolationSurfaceBroker.test.ts`
  - `test/integration/suite/percolationDecisionMatrix.js`
- Companion Home policy slot semantics and one-primary CTA arbitration:
  - `src/resumeStackCard.ts`
  - `src/extension.ts`
  - `test/resumeStackCard.test.ts`
- One-click explainability and grouped evidence drill-down:
  - `src/webview/panelCards.ts`
  - `src/webview/panelClientScript.ts`
  - `test/panelCards.test.ts`
  - `test/panelClientScript.state.test.ts`
- Trust & Privacy tray and restricted-mode explainability copy:
  - `src/extension.ts`
  - `src/webview/panelCards.ts`
  - `docs/PRIVACY_AND_SAFETY.md`
- Signal normalization, blocker model v2, ranking priors, and no-change partition scoping:
  - `src/percolation/signals.ts`
  - `src/blockerModel.ts`
  - `src/summary.ts`
  - `test/percolationRanking.test.ts`
  - `test/blockerModel.test.ts`
- Metrics and rollout controls for percolation stages:
  - `src/metrics.ts`
  - `src/types.ts`
  - `docs/metrics.md`
  - `test/integration/suite/focusRefreshPresentation.js`

### v0.8.x acceptance criteria

- [x] Percolation policy engine and surface broker are deterministic and regression-covered.
- [x] Companion Home preserves stable slot order with one-primary CTA semantics.
- [x] Explainability and evidence drill-down are available in one click when enabled.
- [x] Restricted Mode rendering preserves safety boundaries with explicit rationale copy.
- [x] Local metrics export includes percolation decision and suppression fields.
- [x] Rollout flags provide safe fallback behavior for staged release controls.
- [ ] Manual v0.8.x runbook pass recorded (`docs/manual-smoke-runbook.md`).
- [ ] v0.8.x smoke report sign-off recorded (`docs/smoke-report.md`).

### Manual verification anchors (v0.8.x)

- Runbook: `docs/manual-smoke-runbook.md`
- Integration matrix anchor: `test/integration/suite/percolationDecisionMatrix.js`
- Metrics dictionary and required fields: `docs/metrics.md`

### Open gaps / TODOs (v0.8.x)

- Remaining manual sign-off execution and recorded outcomes for trusted, restricted, and rollout-fallback scenarios.
- Follow-on copy/adoption work tracked in:
  - [#247](https://github.com/jkordish/vscode-tacos/issues/247)
  - [#259](https://github.com/jkordish/vscode-tacos/issues/259)
