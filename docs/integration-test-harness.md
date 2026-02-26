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
2. Restricted suite (`--disable-workspace-trust`):
   - executes against restricted-mode launch args
   - `tacos.slash` still works
   - summary source remains local-only (`- Source: local`)

## Files

- Runner: `test/integration/runTest.js`
- Suites: `test/integration/suite/trusted.js`, `test/integration/suite/restricted.js`
- Fixture workspace: `test/fixtures/workspace/`

## Notes

- Integration tests require launching a VS Code/Electron instance.
- Runner prefers a local VS Code executable (`VSCODE_TEST_BINARY` or common OS install paths) to avoid network download flakiness.
- Workspace trust semantics can vary by host build; final restricted-mode behavior must still be validated via manual smoke runbook.
- Keep this suite minimal and deterministic; most safety logic remains covered by unit tests.
