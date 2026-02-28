# Release 0.6.0 Checklist

Use this checklist to prepare, validate, and publish the `v0.6.0` release.

Related issues:

- Epics: [#131](https://github.com/jkordish/vscode-tacos/issues/131), [#132](https://github.com/jkordish/vscode-tacos/issues/132), [#133](https://github.com/jkordish/vscode-tacos/issues/133), [#134](https://github.com/jkordish/vscode-tacos/issues/134)
- Release-discipline children: [#155](https://github.com/jkordish/vscode-tacos/issues/155), [#156](https://github.com/jkordish/vscode-tacos/issues/156), [#158](https://github.com/jkordish/vscode-tacos/issues/158), [#159](https://github.com/jkordish/vscode-tacos/issues/159), [#160](https://github.com/jkordish/vscode-tacos/issues/160), [#161](https://github.com/jkordish/vscode-tacos/issues/161), [#162](https://github.com/jkordish/vscode-tacos/issues/162)
- Manual runbook: `docs/manual-smoke-runbook.md`
- Smoke report template: `docs/smoke-report.md`
- Metrics contract: `docs/metrics-baseline.md`
- Metrics dictionary: `docs/metrics.md`
- Privacy/safety posture: `docs/privacy-safety.md`

## 1) Scope Lock

- [ ] Confirm only `v0.6.0` scope is included in release branch.
- [ ] Confirm all `v0.6.0` child issues are closed or explicitly waived with rationale.
- [ ] Confirm `v0.6.1+` items are not pulled into `v0.6.0` by accident.

## 2) Cognitive Resume and Timing Scope Completion

- [ ] Cognitive Resume Kit outcomes complete (#131):
  - [ ] explicit last-action retrieval cue
  - [ ] single safe primary next-action CTA
  - [ ] blocker-aware unblock action path
  - [ ] resume-path checklist behavior stable
- [ ] Timing and noise outcomes complete (#132):
  - [ ] opportune timing / suppression logic validated
  - [ ] active typing deferral validated
  - [ ] quiet-now / quiet-hours behavior validated
  - [ ] forced-open prompt friction reduced
- [ ] Companion IA outcomes complete (#133):
  - [ ] 5-second scan hierarchy is stable
  - [ ] progressive disclosure defaults are stable
  - [ ] timeline/evidence affordance clarity is stable

## 3) Verify and Packaging Gates

- [ ] `npm run verify` passes locally on release candidate commit.
- [ ] Release PR CI checks are green.
- [ ] `vscode-tacos-verify.vsix` generated successfully from verify/package flow.
- [ ] No failing integration suites in `npm run test:integration`.

## 4) Manual Sign-off Gates (Trusted + Restricted)

- [ ] Execute full runbook: `docs/manual-smoke-runbook.md`.
- [ ] Record outcomes in `docs/smoke-report.md`.
- [ ] Must-pass trusted scenarios signed off:
  - [ ] short idle return (1-5 min)
  - [ ] long-gap return (30+ min)
  - [ ] active typing deferral
  - [ ] quiet suppression behavior
  - [ ] blocker-present flow
  - [ ] low-confidence/empty-evidence flow
- [ ] Restricted mode signed off:
  - [ ] restricted baseline behavior
  - [ ] collection restrictions
  - [ ] risky action restrictions

## 5) Metrics Gates (Local Only)

- [ ] Capture baseline snapshot using `TaCoS: Copy Metrics Baseline Snapshot`.
- [ ] Export local metrics with `TaCoS: Export Local Metrics`.
- [ ] Confirm gate-required metrics are reviewed:
  - [ ] `firstActionLagMs` p50/p95
  - [ ] `companionForcedOpenRate`
  - [ ] `companionActionFollowThroughRate`
  - [ ] `companionPrimaryCtaClickThroughRate`
  - [ ] `companionPrimaryCtaCompletionRate`
  - [ ] `interruptionTimingClass` distribution (`boundary`, `mid-activity`, `unknown`)
- [ ] Confirm sample gate from `docs/metrics-baseline.md` is met:
  - [ ] `>=30` sessions
  - [ ] `>=3` distinct workspaces
- [ ] Confirm no external telemetry or network analytics were introduced.

## 6) Safety and Trust Regression Gates

- [ ] Restricted mode still blocks risky execution/collection paths.
- [ ] Link and path safety checks still block unsafe targets.
- [ ] Evidence grounding is still enforced for open actions.
- [ ] Redaction and persistence rules still avoid storing raw terminal commands.
- [ ] AI payload preview/consent boundaries remain explicit and intact.

## 7) Performance and UX Friction Gates

- [ ] Focus-path performance counters show no new slow-path regressions under normal smoke usage.
- [ ] No focus-stealing or typing interruptions observed in manual smoke.
- [ ] Prompt/notification behavior remains calm and non-spammy.
- [ ] Forced-open details flow only appears in intended prompt mode behavior.

## 8) Versioning and Release Notes

- [ ] Update `package.json` and lockfile to `0.6.0`.
- [ ] Add `v0.6.0` section to `CHANGELOG.md` with UX/timing/safety highlights.
- [ ] Confirm release notes summarize:
  - [ ] interruption-recovery improvements
  - [ ] timing/noise-control improvements
  - [ ] trust/safety invariants retained
  - [ ] local-only metrics posture

## 9) Tag and Publish

- [ ] Merge release prep PR to `main`.
- [ ] Create and push annotated tag `v0.6.0`.
- [ ] Confirm `Release VSIX` workflow succeeds for tag.
- [ ] Confirm release page includes notes and VSIX artifact.

Recorded after publish:

- [ ] Release URL: `__________`
- [ ] Published at (UTC): `__________`
- [ ] Release workflow URL: `__________`
- [ ] Artifact name/version: `__________`

## 10) Rollback and v0.6.1 Spillover Criteria

- [ ] Rollback trigger criteria reviewed and accepted:
  - [ ] critical safety/trust regression
  - [ ] severe interruption/noise regression
  - [ ] major resume-flow breakage not patchable quickly
- [ ] If rollback trigger hits, create follow-up issue(s) immediately and link to epic #134.
- [ ] Capture v0.6.1 spillover candidates with issue links and rationale.
- [ ] Confirm post-release 24-48h watch owner and check-in time.

Post-release watch owner: `__________`  
First check-in timestamp (UTC): `__________`  
Spillover issue links: `__________`
