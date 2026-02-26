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

The harness launches an Extension Development Host against `test/fixtures/workspace` and verifies:

1. extension `jkordish.vscode-tacos` activates
2. `tacos.slash` runs and opens markdown summary output
3. `tacos.showLastSummary` executes without throwing

## Files

- Runner: `test/integration/runTest.js`
- Suite: `test/integration/suite/index.js`
- Fixture workspace: `test/fixtures/workspace/`

## Notes

- Integration tests require launching a VS Code/Electron instance.
- Runner prefers a local VS Code executable (`VSCODE_TEST_BINARY` or common OS install paths) to avoid network download flakiness.
- Keep this suite minimal and deterministic; most safety logic remains covered by unit tests.
