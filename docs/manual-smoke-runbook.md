# Manual Smoke Runbook (v0.6.0 Trusted + Restricted)

Use this runbook for v0.6.0 sign-off and release gating.

Related:

- Epic: [#134](https://github.com/jkordish/vscode-tacos/issues/134) (Proof, Metrics, and Release Discipline)
- Epic acceptance anchors: [#131](https://github.com/jkordish/vscode-tacos/issues/131), [#132](https://github.com/jkordish/vscode-tacos/issues/132), [#133](https://github.com/jkordish/vscode-tacos/issues/133)
- Release checklist tracking: [#161](https://github.com/jkordish/vscode-tacos/issues/161)
- Release checklist doc: `docs/release-0.6.0-checklist.md`
- Metrics contract: `docs/metrics-baseline.md`
- Local metrics dictionary: `docs/metrics.md`

Date: `__________`  
Tester: `__________`  
VS Code version: `__________`  
OS: `__________`  
Branch/commit: `__________`

## 1) Preconditions

1. Install extension VSIX from the candidate branch.
2. Open a git-backed workspace with at least one npm task/test flow.
3. Ensure integrated terminal shell integration is enabled.
4. Confirm:
   - `tacos.enabled=true`
   - `tacos.showOnFocus=true`
   - `tacos.autoRefreshInBackground=true` (default path; only applies when `tacos.uiSurface` is not explicitly set)
   - `tacos.uiSurface` is left unset/default when validating background vs prompt behavior with `tacos.autoRefreshInBackground=true/false`
5. Keep Output panel available (`TaCoS`) for troubleshooting.

## 2) Must-Pass v0.6.0 Scenarios (Trusted Workspace)

These scenarios are release-blocking for v0.6.0.

### T1. Return after short idle (1-5 min)

Steps:

1. Make a small edit and run one command/task.
2. Leave workspace idle for 1-5 minutes, then refocus VS Code.
3. Open or observe Resume Brief.

Expected:

- Companion Home answers Now/Next/Blocked/Restore quickly.
- One clear primary next safe action is shown.
- Last action cue is present when evidence exists.
- No forced extra click is needed in background-refresh mode.

Result: `PASS / FAIL`  
Notes: `__________`

### T2. Return after long gap (30+ min)

Steps:

1. Capture activity (edit + run/test), then leave for at least 30 minutes.
2. Refocus VS Code and trigger `TaCoS: Show Resume Brief Now`.

Expected:

- Resume copy favors reorientation (retrieval cue + safe assistant cue).
- Safe primary CTA remains available or clearly unavailable with reason.
- Resume Path remains 3 steps and still actionable.

Result: `PASS / FAIL`  
Notes: `__________`

### T3. Active typing deferral

Steps:

1. Trigger a focus regain opportunity.
2. Immediately start typing in an editor for several seconds.

Expected:

- TaCoS does not steal focus or interrupt typing.
- Notification/prompt is deferred/suppressed while active typing is detected.
- Status updates remain calm and non-intrusive.

Result: `PASS / FAIL`  
Notes: `__________`

### T4. Quiet now + quiet hours suppression

Steps:

1. Activate `Quiet now` (or temporary quiet) and create a focus-trigger chance.
2. Configure quiet hours and test within active quiet window.
3. Trigger `TaCoS: Show Resume Brief Now` manually.

Expected:

- Auto focus-trigger surfacing is suppressed during quiet periods.
- Manual `Show Resume Brief Now` still works.
- Status shows quiet/snoozed state clearly.

Result: `PASS / FAIL`  
Notes: `__________`

### T5. Blocker-present workflow

Steps:

1. Create a blocker (failing task, diagnostics error, or failing command).
2. Trigger summary refresh.

Expected:

- Blocked card is active and shows one primary unblock action.
- Blocker action is safe and trust-aware (disabled when unavailable).
- Evidence badges/cues align with blocker claim.

Result: `PASS / FAIL`  
Notes: `__________`

### T6. Empty/low-confidence workflow

Steps:

1. Open a sparse workspace (minimal recent evidence) or clear activity context.
2. Trigger summary generation.

Expected:

- Intent/next-step copy clearly indicates low confidence.
- TaCoS suggests safe evidence-building action(s) without inventing unsafe links.
- No noisy prompt spam while evidence is sparse.

Result: `PASS / FAIL`  
Notes: `__________`

## 3) v0.6.0 UX and Safety Detail Checks (Trusted Workspace)

### T7. Timeline + evidence affordance clarity

Steps:

1. Open Timeline and Evidence sections.
2. Inspect mixed clickable (`file`/`url`) and non-clickable rows.
3. Expand/collapse Evidence `Show more` if present.

Expected:

- Clickable rows are visually distinct and labeled `Open`.
- Informational rows are labeled `Not clickable`.
- Show-more behavior is stable across rerenders.

Result: `PASS / FAIL`  
Notes: `__________`

### T8. Evidence and link safety

Steps:

1. Click a file evidence action.
2. Click a URL evidence action.
3. Attempt unsupported/invalid action paths if available.

Expected:

- File opens only within workspace-safe boundaries.
- URL opens only normalized `http/https`.
- Unsupported/unsafe paths are blocked with warning.

Result: `PASS / FAIL`  
Notes: `__________`

### T9. Prompt friction and interruption timing sanity

Steps:

1. Run 3+ focus cycles at likely boundary moments.
2. Run 3+ focus cycles mid-activity (including active typing).
3. Compare behavior with `tacos.autoRefreshInBackground=true` and `false`.

Expected:

- Boundary moments are more likely to surface useful prompt/updates.
- Mid-activity surfacing is reduced and non-intrusive.
- Forced `Open details` clicks trend near zero in background mode.

Record:

- Background mode forced-open count: `__________`
- Prompt mode forced-open count: `__________`
- Interruption score (1 calm - 5 disruptive): `__________`
- Notes: `__________`

### T10. Optional AI refinement safety (N/A if local-only)

Steps:

1. Run `TaCoS: Configure AI Provider` and select `vscode-lm` or `openai`.
2. Trigger summary and inspect payload preview/consent flow.

Expected:

- Local summary appears first.
- Optional refinement updates in place.
- Redaction and consent boundaries remain explicit.

Result: `PASS / FAIL / N/A`  
Notes: `__________`

## 4) Restricted Mode Scenarios

### R1. Restricted mode baseline behavior

Steps:

1. Open workspace in Restricted Mode (untrusted).
2. Trigger `TaCoS: Show Resume Brief Now`.

Expected:

- Local summary still works.
- Risky collection/actions stay disabled.
- Trust state is clearly communicated.

Result: `PASS / FAIL`  
Notes: `__________`

### R2. Collection restrictions

Steps:

1. Trigger summaries while untrusted.
2. Observe output channel and panel behavior.

Expected:

- No execution-dependent git collection.
- No raw terminal command persistence/scraping regressions.

Result: `PASS / FAIL`  
Notes: `__________`

### R3. Restore action restrictions

Steps:

1. Open Restore sections.
2. Inspect task/debug/branch-sensitive actions.

Expected:

- Risky actions remain disabled in Restricted Mode.
- Safe local navigation remains available.

Result: `PASS / FAIL`  
Notes: `__________`

## 5) Local Metrics Capture (Required for v0.6.0 Sign-off)

After running scenarios above:

1. Run `TaCoS: Copy Metrics Baseline Snapshot` and paste into `docs/metrics-baseline.md`.
2. Run `TaCoS: Export Local Metrics` and inspect `.tacos/metrics.csv` (required) and `.tacos/metrics.json` (optional structured view).
3. Record key v0.6.0 metrics:
   - `firstActionLagMs` (p50/p95)
   - `companionForcedOpenRate`
   - `companionActionFollowThroughRate`
   - `companionPrimaryCtaClickThroughRate`
   - `companionPrimaryCtaCompletionRate`
   - `interruptionTimingClass` distribution (`boundary` vs `mid-activity` vs `unknown`; PASS if `unknown` is rare/expected and reviewed, FAIL if `unknown` is common or unexplained)

Snapshot/date reference: `__________`  
Metric notes: `__________`

## 6) Final Sign-off

Must-pass scenario status:

- T1 short-idle return: `PASS / FAIL`
- T2 long-gap return: `PASS / FAIL`
- T3 active typing deferral: `PASS / FAIL`
- T4 quiet suppression behavior: `PASS / FAIL`
- T5 blocker-present flow: `PASS / FAIL`
- T6 low-confidence flow: `PASS / FAIL`
- R1 restricted baseline: `PASS / FAIL`
- R2 restricted collection limits: `PASS / FAIL`
- R3 restricted action limits: `PASS / FAIL`

Overall trusted workspace sign-off: `PASS / FAIL`  
Overall restricted workspace sign-off: `PASS / FAIL`  
Ready for release checklist gate (#161): `YES / NO`

Final notes: `__________`
