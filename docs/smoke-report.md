# Smoke Report Template (v0.8.x Dynamic Percolation)

Use this template to record final manual and automated smoke outcomes for release prep.

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

Trusted percolation scenarios:

- [ ] P1 ambient resume path
- [ ] P2 blocked/high-risk escalation
- [ ] P3 suppression gates (quiet/cooldown/no-change)
- [ ] P4 explainability + evidence one-click paths
- [ ] P5 Trust & Privacy tray controls
- [ ] P6 surface arbitration sanity

Restricted scenarios:

- [ ] R1 restricted baseline rendering
- [ ] R2 restricted explainability semantics
- [ ] R3 restricted drill-down continuity

Rollout fallback matrix:

- [ ] F1 policy disabled fallback
- [ ] F2 explainability disabled fallback
- [ ] F3 broker disabled fallback

Result summary:

- Trusted workspace sign-off: `PASS / FAIL`
- Restricted workspace sign-off: `PASS / FAIL`
- Rollout fallback sign-off: `PASS / FAIL`

## 3) Metrics Snapshot Capture

- [ ] `TaCoS: Copy Metrics Baseline Snapshot` captured and pasted into `docs/metrics-baseline.md`
- [ ] `TaCoS: Export Local Metrics` reviewed locally (`.tacos/metrics.csv` required for gate)
- [ ] Key percolation metrics reviewed:
  - `percolationDecisionCount`
  - `surfaceSelectionStatusbar`
  - `surfaceSelectionPanelSilent`
  - `surfaceSelectionPanelEmphasis`
  - `surfaceSelectionNotification`
  - `percolationSuppressedQuietHours`
  - `percolationSuppressedCooldown`
  - `percolationSuppressedNoChange`
  - `percolationSuppressedNoiseBudget`
  - `percolationSuppressedLowConfidence`
  - `trustTrayOpens`
  - `restrictedTrustTrayOpens`
  - `whySurfacedOpens`
  - `companionPrimaryCtaClickThroughRate`
  - `companionPrimaryCtaCompletionRate`
  - `companionForcedOpenRate`
  - `companionActionFollowThroughRate`

Snapshot date/identifier: `__________`
Metrics notes: `__________`

## 4) Final Recommendation

- Ready for release checklist gate: `YES / NO`
- Follow-up issues required before ship: `__________`
- Final notes: `__________`
