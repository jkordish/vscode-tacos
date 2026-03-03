# Manual Smoke Runbook (v0.8.x Dynamic Percolation)

Use this runbook for v0.8.x sign-off and release gating of dynamic percolation behavior.

Related:

- Epic: [#229](https://github.com/jkordish/vscode-tacos/issues/229) Metrics, Experimentation, and Release Validation
- Child issue: [#257](https://github.com/jkordish/vscode-tacos/issues/257) Expand manual smoke runbook and acceptance report for percolation UX
- Percolation behavior contract: `docs/ux/dynamic-percolation-v0.8.0-spec.md`
- Integration matrix anchor: `test/integration/suite/percolationDecisionMatrix.js`
- Metrics dictionary: `docs/metrics.md`
- Acceptance report: `docs/acceptance-report.md`

- Date: `__________`
- Tester: `__________`
- VS Code version: `__________`
- OS: `__________`
- Branch/commit: `__________`

## 1) Preconditions

1. Install extension VSIX from the candidate branch.
2. Open a git-backed workspace with at least one runnable task/test/debug flow.
3. Ensure integrated terminal shell integration is enabled.
4. Confirm baseline settings:
   - `tacos.enabled=true`
   - `tacos.showOnFocus=true`
   - `tacos.autoRefreshInBackground=true`
   - `tacos.percolationPolicyEnabled=true`
   - `tacos.percolationExplainabilityEnabled=true`
   - `tacos.percolationNotificationBrokerEnabled=true`
   - `tacos.uiSurface` unset/default (unless explicitly testing fallback caps)
5. Keep Output panel (`TaCoS`) available for troubleshooting.

## 2) Trusted Workspace Percolation Scenarios

### P1. Ambient resume path (status bar or silent panel update)

Steps:

1. Make a small edit, then return after a short idle window.
2. Trigger a focus-based summary refresh.
3. Observe whether TaCoS remains ambient (status bar or silent panel refresh).

Expected:

- No unnecessary prompt interruption when confidence/urgency are moderate.
- Status bar text remains compact and policy-reasoned.
- Companion Home preserves fixed `Now`/`Next`/`Blocked`/`Restore` slot order.

Result: `PASS / FAIL`
Notes: `__________`

### P2. Blocked/high-risk escalation path

Steps:

1. Introduce a blocker (failing task, failing command, or diagnostics error).
2. Trigger summary refresh.
3. Observe selected surface and top-card treatment.

Expected:

- High-risk blocked state may elevate surface class (`panel-emphasis` or `notification`) when justified.
- `Blocked` card shows actionable, trust-aware guidance.
- Exactly one primary CTA remains highlighted across `Next` and `Blocked`.

Result: `PASS / FAIL`
Notes: `__________`

### P3. Suppression gates (quiet, cooldown, no-change)

Steps:

1. Trigger one accepted surfacing event.
2. Re-trigger within cooldown window.
3. Enable temporary quiet and trigger again.
4. Trigger without meaningful changes to exercise no-change suppression.

Expected:

- Cooldown and quiet suppressions prevent repeated interruptions.
- No-change suppression avoids low-value re-surfacing.
- Status remains calm and does not spam prompts.

Result: `PASS / FAIL`
Notes: `__________`

### P4. Explainability and evidence one-click paths

Steps:

1. Open Companion Home on a surfaced decision.
2. Click `Why am I seeing this?`.
3. Click `Open evidence tray`.

Expected:

- `Why am I seeing this?` opens `More Context` -> `Trust Center` explainability in one click.
- `Open evidence tray` opens `More Context` -> `Evidence` in one click.
- Evidence rows keep safe open/static affordances.

Result: `PASS / FAIL`
Notes: `__________`

### P5. Trust & Privacy tray controls

Steps:

1. Expand `Trust Center`.
2. Validate tray rows (`privacy preset`, `retention`, `AI provider`, `consent`, collection posture).
3. Trigger `Review AI payload preview` and `Revoke AI payload consent` controls.

Expected:

- Trust Center copy uses consistent Trust/Privacy/Restricted Mode terminology.
- Payload preview and consent actions are reachable in one click.
- Consent revoke state updates are reflected on subsequent refresh.

Result: `PASS / FAIL / N/A`
Notes: `__________`

### P6. Surface arbitration sanity under focus cycles

Steps:

1. Run at least 5 focus regain cycles across boundary and mid-activity moments.
2. Observe surface choices and prompt frequency.
3. Record notable surfacing decisions.

Expected:

- Boundary moments are favored when interruption is justified.
- Mid-activity prompt interruptions remain rare.
- Surface choices appear deterministic for similar conditions.

Result: `PASS / FAIL`
Notes: `__________`

## 3) Restricted Mode Scenarios

### R1. Restricted baseline rendering

Steps:

1. Open workspace in Restricted Mode.
2. Trigger `TaCoS: Show Resume Brief Now`.
3. Inspect Companion Home, Trust Center, and Restore sections.

Expected:

- Local summary remains available.
- Trust-sensitive execution actions remain disabled.
- Restricted Mode rationale is explicit in panel copy.

Result: `PASS / FAIL`
Notes: `__________`

### R2. Restricted explainability semantics

Steps:

1. In Restricted Mode, open `Why am I seeing this?`.
2. Inspect suppression/explainability detail.

Expected:

- Explainability mentions filtered signal classes and suppressed execution-oriented candidates.
- Copy remains clear without hiding safety rationale.

Result: `PASS / FAIL`
Notes: `__________`

### R3. Restricted evidence and trust drill-down continuity

Steps:

1. Open `Open evidence tray`.
2. Expand Trust Center and verify tray rows.

Expected:

- Evidence drill-down remains available.
- Trust & Privacy tray remains available and clearly marked for restricted posture.
- No restricted path bypasses trust guards.

Result: `PASS / FAIL`
Notes: `__________`

## 4) Rollout Flag Matrix

Run each scenario below and confirm expected fallback behavior.

### F1. Policy disabled fallback

Settings:

- `tacos.percolationPolicyEnabled=false`

Expected:

- Legacy `uiSurface` behavior governs surface selection.
- No percolation policy emphasis badges or broker-specific reasoning are required.

Result: `PASS / FAIL`
Notes: `__________`

### F2. Explainability disabled fallback

Settings:

- `tacos.percolationPolicyEnabled=true`
- `tacos.percolationExplainabilityEnabled=false`

Expected:

- `Why am I seeing this?` affordances are hidden.
- Core resume guidance remains available.

Result: `PASS / FAIL`
Notes: `__________`

### F3. Notification broker disabled fallback

Settings:

- `tacos.percolationPolicyEnabled=true`
- `tacos.percolationNotificationBrokerEnabled=false`

Expected:

- Surface selection falls back safely without broker escalation logic.
- No crash/regression in focus-triggered presentation.

Result: `PASS / FAIL`
Notes: `__________`

## 5) Local Metrics Capture (Required)

After executing sections above:

1. Run `TaCoS: Copy Metrics Baseline Snapshot`.
2. Paste into `docs/metrics-baseline.md` (or issue comment for release PR).
3. Run `TaCoS: Export Local Metrics` and inspect `.tacos/metrics.csv`.
4. Record percolation-specific fields:
   - `percolationDecisionCount`
   - `surfaceSelectionStatusbar`
   - `surfaceSelectionPanelSilent`
   - `surfaceSelectionPanelEmphasis`
   - `surfaceSelectionNotification`
   - `percolationConfidenceBandLow`
   - `percolationConfidenceBandMedium`
   - `percolationConfidenceBandHigh`
   - `percolationSuppressedQuietHours`
   - `percolationSuppressedCooldown`
   - `percolationSuppressedNoChange`
   - `percolationSuppressedNoiseBudget`
   - `percolationSuppressedLowConfidence`
   - `trustTrayOpens`
   - `restrictedTrustTrayOpens`
   - `whySurfacedOpens`
   - `companionPrimaryCtaImpressions`
   - `companionPrimaryCtaClicks`
   - `companionPrimaryCtaCompletions`
   - `companionForcedOpenRate`
   - `companionActionFollowThroughRate`

Snapshot/date reference: `__________`
Metric notes: `__________`

## 6) Final Sign-off

Scenario status:

- P1 ambient resume path: `PASS / FAIL`
- P2 blocked/high-risk escalation: `PASS / FAIL`
- P3 suppression gates: `PASS / FAIL`
- P4 explainability + evidence one-click paths: `PASS / FAIL`
- P5 Trust & Privacy tray controls: `PASS / FAIL / N/A`
- P6 surface arbitration sanity: `PASS / FAIL`
- R1 restricted baseline rendering: `PASS / FAIL`
- R2 restricted explainability semantics: `PASS / FAIL`
- R3 restricted drill-down continuity: `PASS / FAIL`
- F1 policy disabled fallback: `PASS / FAIL`
- F2 explainability disabled fallback: `PASS / FAIL`
- F3 broker disabled fallback: `PASS / FAIL`

Overall trusted workspace sign-off: `PASS / FAIL`
Overall restricted workspace sign-off: `PASS / FAIL`
Overall rollout fallback sign-off: `PASS / FAIL`
Ready for release checklist gate: `YES / NO`

Final notes: `__________`
