# Integration Test Harness (Stub)

This repository currently uses fast unit tests for safety-critical logic.

## Planned Integration Harness

Target stack:
- [`@vscode/test-electron`](https://github.com/microsoft/vscode-test)

Minimum scenario to automate:
1. Launch Extension Development Host.
2. Activate `vscode-tacos` extension.
3. Execute `tacos.showNow`.
4. Assert TaCoS webview panel appears and renders summary content.

## Suggested Next Steps

1. Add a fixture workspace under `test/fixtures/`.
2. Add `test/integration/run.ts` with VS Code test bootstrap.
3. Add CI job (optional matrix) for integration smoke runs.
