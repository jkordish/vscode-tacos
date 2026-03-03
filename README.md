# vscode-tacos

TaCoS ("TaCoS Resume Brief") is a VS Code extension that helps you get back into your work after an interruption.

## Explain It Like I'm Five

You come back to your code and forget what you were doing.

TaCoS helps by saying:

- what you were just doing,
- what you should do next,
- what is blocked,
- and what is safe to click.

It tries to stay quiet unless something important needs attention.

TaCoS follows an ambient-vs-deep flow:

- `Ambient`: status bar keeps calm, low-noise cues visible.
- `Glanceable`: Companion Home answers `Now / Next / Blocked / Restore` in ~5 seconds.
- `Deep`: Trust, privacy, evidence, and AI payload details are one click away.

## Start in 60 Seconds

1. Install the extension.
2. Open a project in VS Code.
3. Run `TaCoS: Show Resume Brief Now` from the Command Palette.
4. Optional: run `TaCoS: Set Privacy Preset`.

For a fast guided setup:

- [Quickstart](https://github.com/jkordish/vscode-tacos/blob/main/docs/quickstart.md)

## Safety in Plain English

- Local-first by default.
- AI is optional.
- AI payload review and consent are explicit, with one-click deep-links from surfaced guidance.
- Restricted Mode blocks trust-sensitive collection and execution actions.
- Metrics and diagnostics stay local unless you explicitly share exports.

Details:

- [PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)

## Runtime Scope

TaCoS is desktop-first today. It runs in the Node-hosted VS Code extension runtime and does not currently declare a browser entrypoint.

## Where To Go Next

Product behavior and UX:

- [SPECS.md](https://github.com/jkordish/vscode-tacos/blob/main/SPECS.md)
- [docs/DESIGN_AND_IMPLEMENTATION.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/DESIGN_AND_IMPLEMENTATION.md)
- [docs/ux/dynamic-percolation-v0.8.0-spec.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/ux/dynamic-percolation-v0.8.0-spec.md)
- [docs/references.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md)

Privacy and safety:

- [docs/PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)
- [docs/action-safety-matrix.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/action-safety-matrix.md)

Metrics and validation:

- [docs/metrics.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/metrics.md)
- [docs/metrics-baseline.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/metrics-baseline.md)
- [docs/manual-smoke-runbook.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/manual-smoke-runbook.md)
- [docs/acceptance-report.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/acceptance-report.md)

Contributor/operator docs:

- [AGENTS.md](https://github.com/jkordish/vscode-tacos/blob/main/AGENTS.md)
- [PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md)
- [CHANGELOG.md](https://github.com/jkordish/vscode-tacos/blob/main/CHANGELOG.md)

## Development Quick Commands

```bash
npm ci
npm run verify:quick
npm run test:integration
npm run package:vsix
```

## License

MIT
