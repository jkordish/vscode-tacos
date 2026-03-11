# vscode-tacos

TaCoS is a desktop-first, VS Code-first, local-first extension for state recovery after interruptions.

This slice is aimed at engineers whose brains are already getting kicked around by interruptions:

- SREs and on-call engineers
- incident responders
- staff+ engineers juggling parallel work
- researchers and architects carrying deep context stacks

TaCoS is not an AI productivity assistant. It helps you lose less mental state. The product wedge is cognitive observability for interruption-heavy engineering work: preserve task state before context decays, then restore it with calm, explainable cues later.

## What TaCoS Does

TaCoS now combines four local-first recovery primitives:

- `Structured Task Checkpoints`: capture objective, working set, assumptions, blockers, next step, confidence, stale boundary, and last known safe breakpoint.
- `Deterministic Task Switch Detection`: offer a lightweight checkpoint prompt only at conservative, explainable boundaries.
- `Resume Brief v2`: merge structured task state with current repo/editor evidence to answer `what you were doing`, `what changed`, `what to verify next`, and `what is still unresolved`.
- `Daily Cognitive Debrief`: on-demand local review of abandoned threads, repeated-switch tasks, stale state, blockers, and open assumptions.

TaCoS keeps the same ambient-to-deep interaction model:

- `Ambient`: calm status-bar cues.
- `Glanceable`: Companion Home answers `Now / Next / Blocked / Restore`.
- `Deep`: Trust, evidence, timeline, and AI payload drill-down remain one click away.

## Start in 60 Seconds

1. Install the extension.
2. Open a project in VS Code.
3. Run `TaCoS: Show Resume Brief Now`.
4. Optional: run `TaCoS: Capture Task Checkpoint`.
5. Optional: run `TaCoS: Set Privacy Preset`.

For a guided setup:

- [Quickstart](https://github.com/jkordish/vscode-tacos/blob/main/docs/quickstart.md)

## Key Commands

- `TaCoS: Show Resume Brief Now`
- `TaCoS: Show Last Resume Brief`
- `TaCoS: Capture Task Checkpoint`
- `TaCoS: Mark Task Resolved`
- `TaCoS: Confirm Task Switch`
- `TaCoS: Show Cognitive Debrief`
- `TaCoS: Show Resume Safety Check`

## Cognitive Observability Behavior

### Structured Task Checkpoints

Structured checkpoints are fast, typed task-state captures. They are not a diary and they are not hidden automation.

TaCoS captures:

- objective
- working set
- assumptions
- blockers
- next step
- confidence
- optional stale boundary
- last known safe breakpoint

The capture flow is manual first. If likely-switch prompting is enabled, TaCoS only offers a checkpoint at conservative boundaries and always gives one-action control: `Capture`, `Skip`, `Snooze`, or `Dismiss`.

### Deterministic Switch Detection

TaCoS uses small, inspectable signals that fit the current extension architecture:

- focus return after idle threshold
- workspace root changes
- task partition changes
- trusted branch changes
- file-cluster drift only as supporting evidence
- manual `Confirm Task Switch`

TaCoS does not use keystroke logging, biometrics, emotion detection, calendar integration, or black-box interruptibility scores.

### Resume Brief v2

The resume brief now prioritizes explicit state recovery:

1. what you were doing
2. what changed since
3. next likely safe move
4. open questions and blockers
5. timeline, evidence, and retrieval cues

This keeps TaCoS focused on orientation and verification, not autonomous execution.

### Daily Cognitive Debrief

`TaCoS: Show Cognitive Debrief` is on-demand and local-only. It helps close loops instead of performing surveillance theater.

It surfaces:

- abandoned threads
- unresolved blockers
- repeated-switch tasks
- stale task state
- open assumptions

## Resume Safety Check

TaCoS also includes a short post-resume safety check that appears after meaningful resume events. It uses `State / Risk / Verify` to reduce wrong first actions without forcing a second heavy workflow.

- Command: `TaCoS: Show Resume Safety Check`
- Settings: `tacos.resumeSafety.enabled`, `tacos.resumeSafety.idleMinutes`, `tacos.resumeSafety.strict`

## Settings

Core settings for this slice:

- `tacos.taskCheckpoint.enabled`
- `tacos.taskCheckpoint.promptOnLikelySwitch`
- `tacos.resumeSafety.enabled`
- `tacos.resumeSafety.idleMinutes`
- `tacos.resumeSafety.strict`

Legacy note-only blur prompting still exists behind:

- `tacos.promptCheckpointOnBlur`

That setting is separate from structured checkpoints.

## Safety in Plain English

- Local-first by default.
- No hidden telemetry.
- No cloud backend in this slice.
- AI is optional.
- Model output is untrusted.
- Restricted Mode is a hard boundary.
- Metrics and diagnostics stay local unless you explicitly export or share them.

Details:

- [docs/PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)

## Research Grounding

This slice is grounded in interruption and recovery research:

- unfinished-task carryover and attention residue
- goal-memory recovery and retrieval cues
- breakpoint-aware interruption timing
- interrupted programming resumption cues
- calm, explainable, user-controlled human-AI interaction
- automation-risk and agency-preserving design

Reference map:

- [docs/references.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md)

## Runtime Scope

TaCoS is desktop-first today. It runs in the Node-hosted VS Code extension runtime and does not currently declare a browser entrypoint.

## Where To Go Next

Product behavior and UX:

- [SPECS.md](https://github.com/jkordish/vscode-tacos/blob/main/SPECS.md)
- [docs/DESIGN_AND_IMPLEMENTATION.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/DESIGN_AND_IMPLEMENTATION.md)
- [docs/references.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md)

Privacy and safety:

- [docs/PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)
- [docs/action-safety-matrix.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/action-safety-matrix.md)

Metrics and validation:

- [docs/metrics.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/metrics.md)
- [docs/metrics-baseline.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/metrics-baseline.md)

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
