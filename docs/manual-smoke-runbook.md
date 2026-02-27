# Manual Smoke Runbook (Trusted + Restricted)

For sticky notes/scratchpad specific edge cases, also run: `docs/sticky-notes-qa-matrix.md`.

Date: `__________`
Tester: `__________`
VS Code version: `__________`
OS: `__________`
Branch/commit: `feature/epic-must-have-tracking @ __________`

## Preconditions

1. Install extension VSIX from this branch.
2. Open a git-backed workspace with at least one npm script and tests.
3. Ensure terminal shell integration is enabled in VS Code.
4. Confirm `tacos.enabled=true`, `tacos.showOnFocus=true`.

## Part A - Trusted Workspace

### A1. Local-first summary appears immediately

Steps:
1. Make a small code edit.
2. Run one task or test command from the integrated terminal.
3. Trigger `TaCoS: Show Resume Brief Now`.

Expected:
- Resume panel opens quickly with local summary.
- Status shows local summary timestamp.

Result: `PASS / FAIL`
Notes: `__________`

### A2. Optional AI refinement updates in-place

Steps:
1. Run `TaCoS: Configure AI Provider` and choose `vscode-lm` or `openai`.
2. Trigger `TaCoS: Show Resume Brief Now` again.

Expected:
- Local summary appears first.
- Later updates to refined summary without blocking UI.
- Status reflects refined source/timestamp.

Result: `PASS / FAIL / N/A`
Notes: `__________`

### A3. Evidence link safety

Steps:
1. Click a file evidence badge/link.
2. Click a URL evidence badge/link.
3. Try clicking any non-evidence anchor-like element in panel (if present).

Expected:
- File opens only within workspace.
- URL opens only http/https links.
- Unexpected links are blocked with warning (no unsafe open).

Result: `PASS / FAIL`
Notes: `__________`

### A4. Timeline behavior

Steps:
1. Confirm timeline card is present.
2. Click `Show timeline`.
3. Inspect group ordering and row behavior.
4. Click a file/url timeline row and a non-clickable row type.

Expected:
- Timeline starts collapsed.
- Groups appear in order: files, terminal, debug/tasks, urls, git (when data exists).
- Only file/url rows are clickable.

Result: `PASS / FAIL`
Notes: `__________`

### A5. Restore Pack behavior (trusted)

Steps:
1. Use `Reopen files` and `Open changed files`.
2. If available, test `Rerun last task`, `Rerun debug config`, `Checkout previous branch`.

Expected:
- Available actions execute correctly.
- No unsafe path/link behavior occurs.

Result: `PASS / FAIL`
Notes: `__________`

### A6. Checkpoint capture behavior

Steps:
1. Run `TaCoS: Add Checkpoint Note from Clipboard` with non-empty clipboard.
2. Enable `tacos.promptCheckpointOnBlur=true`.
3. Perform meaningful activity, then blur VS Code window.

Expected:
- Clipboard note persists workspace-scoped.
- Blur prompt appears only when gating conditions are met.
- Prompt does not spam repeatedly (cooldown enforced).

Result: `PASS / FAIL`
Notes: `__________`

### A7. UX friction checks (notification and click budget)

Steps:
1. Set `tacos.autoRefreshInBackground=true`.
2. Cause at least 3 focus-triggered refresh opportunities (blur/focus cycles with meaningful activity).
3. Count how many times you must click `Open details` to see updated state.
4. Repeat with `tacos.autoRefreshInBackground=false`.

Expected:
- With background mode enabled, updated state should require `0` forced `Open details` clicks.
- With background mode disabled, prompt flow should still be available.
- No repeated notification spam while idle (cooldown/debounce still honored).
- Companion nudges should not repeatedly fire within the configured nudge cooldown window.

Record:
- Background mode forced-click count: `__________`
- Prompt mode forced-click count: `__________`
- Interruption score (1 low friction - 5 high friction): `__________`
- Notes: `__________`

### A8. Session recap and checkpoint shortcut

Steps:
1. Trigger `TaCoS: Show Resume Brief Now`.
2. Confirm `Session Recap` renders `Done since last resume`, `Pending / blocked`, and `Recommended first action`.
3. Click `Save checkpoint` from the recap card.

Expected:
- Recap fields update after additional edits/tasks and a new summary cycle.
- Checkpoint input opens from recap and saves a workspace-scoped note.
- Saved checkpoint appears in subsequent resume panel runs.

Result: `PASS / FAIL`
Notes: `__________`

### A9. Metrics export output

Steps:
1. Perform one quick action from panel or status bar.
2. Run `TaCoS: Export Local Metrics`.
3. Inspect `.tacos/metrics.json` and `.tacos/metrics.csv`.

Expected:
- Both files are written locally.
- CSV includes companion columns (`companionPromptImpressions`, `companionQuickActionsTaken`, follow-through rates).
- No network dependency is required for metrics export.

Result: `PASS / FAIL`
Notes: `__________`

## Part B - Restricted Mode

### B1. Enter restricted mode

Steps:
1. Open workspace in Restricted Mode (do not trust workspace).
2. Trigger `TaCoS: Show Resume Brief Now`.

Expected:
- Local summary still works.
- No AI refinement is performed.

Result: `PASS / FAIL`
Notes: `__________`

### B2. Verify collection restrictions

Steps:
1. Trigger summaries and inspect behavior.
2. Observe extension output channel if needed.

Expected:
- No git execution-dependent context collection.
- No terminal command scraping/collection.

Result: `PASS / FAIL`
Notes: `__________`

### B3. Verify risky action restrictions

Steps:
1. Open details panel Restore Pack.
2. Inspect rerun/checkout actions.

Expected:
- Risky task/debug/checkout actions are disabled.
- Informational restricted-mode message is shown.

Result: `PASS / FAIL`
Notes: `__________`

## Sign-off

- Trusted workspace overall: `PASS / FAIL`
- Restricted mode overall: `PASS / FAIL`
- Ready to close #35 and #27: `YES / NO`

Final notes: `__________`
