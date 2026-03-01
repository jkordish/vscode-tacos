# Smoke Report Template (v0.6.0 + v0.7.0)

Use this template to record final manual/automated smoke outcomes for release prep.

Date: `__________`  
Tester: `__________`  
Branch/commit: `__________`

## 1) Automated Gates (Local)

- [ ] `npm run verify`
- [ ] CI checks green on release PR
- [ ] `vscode-tacos-verify.vsix` generated successfully

Notes: `__________`

## 2) Manual Runbook Execution

Detailed runbook:

- `docs/manual-smoke-runbook.md`

v0.6.0 must-pass scenarios:

- [ ] T1 short-idle return (1-5 min)
- [ ] T2 long-gap return (30+ min)
- [ ] T3 active typing deferral
- [ ] T4 quiet now/quiet hours suppression
- [ ] T5 blocker-present flow
- [ ] T6 empty/low-confidence flow
- [ ] R1 restricted baseline
- [ ] R2 restricted collection limits
- [ ] R3 restricted action limits

Result summary:

- Trusted workspace sign-off: `PASS / FAIL`
- Restricted workspace sign-off: `PASS / FAIL`

## 2.1) v0.7.0 UI/A11y/Reflow Matrix

For v0.7.0 details panel sign-off, execute section `7) v0.7.0 UI, Accessibility, and Reflow Matrix` in:

- `docs/manual-smoke-runbook.md`

v0.7.0 scenarios:

- [ ] U1 semantic shell + landmarks
- [ ] U2 reflow and horizontal scroll audit
- [ ] U3 keyboard-only flow
- [ ] U4 disclosure consistency + progressive context
- [ ] U5 status feedback + disabled-action explainability

Required view modes:

- [ ] narrow pane (`~320 CSS px`)
- [ ] standard split pane (`~600-900 CSS px`)
- [ ] wide pane (`~1100+ CSS px`)
- [ ] forced-colors active
- [ ] keyboard-only navigation
- [ ] 400% zoom reflow check

Result summary:

- v0.7.0 matrix sign-off: `PASS / FAIL`
- Outstanding failures / follow-ups: `__________`

## 3) Metrics Snapshot Capture

- [ ] `TaCoS: Copy Metrics Baseline Snapshot` captured and pasted into `docs/metrics-baseline.md`
- [ ] `TaCoS: Export Local Metrics` reviewed locally (`.tacos/metrics.csv` required for gate; `.tacos/metrics.json` optional for deeper inspection/debugging)
- [ ] Key fields reviewed:
  - `firstActionLagMs` p50/p95
  - `companionForcedOpenRate`
  - `companionActionFollowThroughRate`
  - `companionPrimaryCtaClickThroughRate`
  - `companionPrimaryCtaCompletionRate`
  - `interruptionTimingClass` (`boundary` vs `mid-activity` vs `unknown` - `unknown` is valid; investigate if rate is high)

Snapshot date/identifier: `__________`  
Metrics notes: `__________`

## 4) Final Recommendation

- Ready for release checklist gate (#161): `YES / NO`
- Follow-up issues required before ship: `__________`
- Final notes: `__________`
