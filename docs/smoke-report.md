# Smoke Report (v0.6.0 Template)

Use this template to record final manual/automated smoke outcomes for v0.6.0 release prep.

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
