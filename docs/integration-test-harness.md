# Integration Test Harness

This repository includes a minimal VS Code integration harness using [`@vscode/test-electron`](https://github.com/microsoft/vscode-test).

## Command

```bash
npm run test:integration
```

Optional override if your VS Code binary is in a custom location:

```bash
VSCODE_TEST_BINARY=/absolute/path/to/Code npm run test:integration
```

## What It Verifies

The harness launches Extension Development Host runs against `test/fixtures/workspace`:

1. Trusted suite:
   - extension `jkordish.vscode-tacos` activates
   - `tacos.slash` opens markdown summary output
   - `tacos.showLastSummary` executes without throwing
2. Isolated-profile local suite (dedicated user-data profile with trust settings):
   - executes against a fresh profile configured for trust prompts disabled
   - `tacos.slash` still works
   - summary source remains local-only (`- Source: local`)
3. Focus refresh presentation suite:
   - verifies `autoRefreshInBackground=true` resolves focus-refresh behavior to background mode
   - verifies `autoRefreshInBackground=false` resolves focus-refresh behavior to prompt mode
   - verifies companion status bar mode transitions for active/paused/disabled states
4. Resume flow critical-path suite:
   - executes `TaCoS: Show Resume Brief Now`
   - validates critical panel/runtime contract for v0.6 resume path:
     - panel + scratch summary availability
     - Companion Home card marker
     - primary next-step action presence when next steps exist
     - restore/trust affordance markers
5. Focus suppression paths suite:
   - verifies focus-trigger suppression reasons for:
     - disabled/paused mode
     - active snooze window
     - quiet-hours window
6. Companion status mode checks:
   - verifies companion status bar mode transitions for active/paused states
   - verifies disabled state transitions where applicable

## Files

- Runner: `test/integration/runTest.js`
- Suites: `test/integration/suite/trusted.js`, `test/integration/suite/isolatedProfileLocal.js`, `test/integration/suite/focusRefreshPresentation.js`, `test/integration/suite/resumeFlowCriticalPath.js`
- Suites: `test/integration/suite/trusted.js`, `test/integration/suite/isolatedProfileLocal.js`, `test/integration/suite/focusRefreshPresentation.js`, `test/integration/suite/resumeFlowCriticalPath.js`, `test/integration/suite/focusSuppressionPaths.js`
- Fixture workspace: `test/fixtures/workspace/`

## Notes

- Integration tests require launching a VS Code/Electron instance.
- Runner prefers a local VS Code executable (`VSCODE_TEST_BINARY` or common OS install paths) to avoid network download flakiness.
- Runner now deletes temporary isolated-profile user-data directories after execution.
- Workspace trust semantics can vary by host build and local-folder policies; final true Restricted Mode behavior must still be validated via manual smoke runbook.
- Keep this suite minimal and deterministic; most safety logic remains covered by unit tests.
