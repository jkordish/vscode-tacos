# vscode-tacos

**TaCoS Resume Brief** — `v0.99.1`

TaCoS is a desktop-first, VS Code-first, local-first extension for cognitive state recovery after interruptions.

Built for engineers whose brains get kicked around all day:

- SREs and on-call engineers
- incident responders
- staff+ engineers juggling parallel work
- researchers and architects carrying deep context stacks

TaCoS is **not** an AI productivity assistant. It helps you lose less mental state. The core wedge is **cognitive observability** for interruption-heavy engineering work: preserve what you were thinking before context decays, then restore it with calm, explainable cues later.

---

## What TaCoS Does

TaCoS combines five local-first recovery primitives:

1. **Structured Task Checkpoints** — capture objective, working set, assumptions, blockers, next step, confidence, stale boundary, last known safe breakpoint, and prospective next verification (what to confirm after resuming).
2. **Deterministic Task Switch Detection** — offer a lightweight checkpoint prompt only at conservative, explainable boundaries with one-action control: `Capture / Skip / Snooze / Dismiss`.
3. **Prospective Intent Capture** — record the single thing you need to verify next, so resuming is oriented not just at what you were doing, but at what you intended to check first.
4. **Resume Brief v2** — merge structured task state with current repo/editor evidence to answer _what you were doing_, _what changed_, _what to verify next_, and _what is still unresolved_.
5. **Daily Cognitive Debrief** — on-demand local review of abandoned threads, repeated-switch tasks, stale state, blockers, and open assumptions.

TaCoS keeps a calm, layered interaction model:

- **Ambient** — quiet status-bar cues.
- **Glanceable** — Companion Home answers `Now / Next / Blocked / Restore`.
- **Deep** — Trust, evidence, timeline, and AI payload drill-down, one click away.

---

## Start in 60 Seconds

1. Install the extension.
2. Open a project in VS Code.
3. Run **`TaCoS: Show Resume Brief Now`**.
4. Optional: run **`TaCoS: Capture Task Checkpoint`** to record your current context.
5. Optional: run **`TaCoS: Set Privacy Preset`** to tune local-vs-AI behavior.

For a guided setup:
→ [docs/quickstart.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/quickstart.md)

---

## Key Commands

| Command                                 | What it does                                            |
| --------------------------------------- | ------------------------------------------------------- |
| `TaCoS: Show Resume Brief Now`          | Open the full resume brief immediately                  |
| `TaCoS: Show Last Summary`              | Re-open the most recent summary                         |
| `TaCoS: Capture Task Checkpoint`        | Save structured task state (objective, next step, etc.) |
| `TaCoS: Mark Task Resolved`             | Close the current task checkpoint cleanly               |
| `TaCoS: Confirm Task Switch`            | Manually trigger a task-switch checkpoint prompt        |
| `TaCoS: Show Cognitive Debrief`         | On-demand local review of open threads and stale state  |
| `TaCoS: Show Resume Safety Check`       | Post-resume `State / Risk / Verify` annunciator         |
| `TaCoS: Add Quick Checkpoint Note`      | Add a fast freeform note to the current task            |
| `TaCoS: Add Checkpoint from Selection`  | Capture selected editor text as a checkpoint note       |
| `TaCoS: List Checkpoint Notes`          | Browse and manage open checkpoint notes                 |
| `TaCoS: Run Setup Checklist`            | Guided first-run setup                                  |
| `TaCoS: Set Privacy Preset`             | Choose `Minimal / Balanced / Max context`               |
| `TaCoS: Copy Diagnostics`               | Privacy-safe local diagnostics bundle                   |
| `TaCoS: Copy Metrics Baseline Snapshot` | Local markdown metrics summary                          |

---

## Cognitive Observability Behavior

### Structured Task Checkpoints

Fast, typed task-state captures. Not a diary. Not hidden automation.

TaCoS captures:

- **objective** — what you are trying to accomplish
- **working set** — files, services, or systems in scope
- **assumptions** — things you are treating as true but haven't verified
- **blockers** — what is actively in the way
- **next step** — the single concrete action to take next
- **confidence** — low / medium / high
- **stale boundary** — when this state becomes unreliable
- **last known safe breakpoint** — the last state you know was clean
- **prospective next verification** — the one thing to confirm first on resume _(new in v0.99)_

The capture flow is manual first. Likely-switch prompting only fires at conservative, explainable boundaries.

### Prospective Intent Capture

Based on the ICSE'26 TaCoS research finding that automated summaries systematically lack the _prospective information_ present in manual notes, v0.99 adds a dedicated `prospectiveNextVerification` field.

It answers: **"What do I need to confirm the moment I'm back?"**

This is the single highest-value recovery cue — it orients you at the _next action_, not just the last state.

### Deterministic Switch Detection

TaCoS uses small, inspectable signals:

- focus return after idle threshold
- workspace root changes
- task partition changes
- trusted branch changes
- file-cluster drift (supporting evidence only)
- manual `Confirm Task Switch`

TaCoS does **not** use keystroke logging, biometrics, emotion detection, calendar integration, or black-box interruptibility scores.

### Resume Brief v2

The resume brief prioritizes explicit state recovery in this order:

1. what you were doing
2. what changed since
3. what to verify next (prospective intent)
4. open questions and blockers
5. timeline, evidence, and retrieval cues

### Daily Cognitive Debrief

`TaCoS: Show Cognitive Debrief` — on-demand, local-only, no telemetry. It surfaces:

- abandoned threads
- unresolved blockers
- repeated-switch tasks
- stale task state
- open assumptions

### Resume Safety Check

A short post-resume `State / Risk / Verify` annunciator that appears after meaningful resume events. Reduces wrong first actions without forcing a second heavy workflow.

- **Command:** `TaCoS: Show Resume Safety Check`
- **Settings:** `tacos.resumeSafety.enabled`, `tacos.resumeSafety.idleMinutes`, `tacos.resumeSafety.strict`

---

## Companion Panel

The Companion panel provides a glanceable, layered resume surface. Key cards:

- **Task State** — structured checkpoint with confidence badge, freshness, and breakpoint.
- **Mental Load** — open threads, stale state, unresolved blockers (item-count badge, non-zero counts only).
- **What Changed** — precision-bucket diff (`Code / Runs / Blocker / Key files / Git / References`).
- **Resume Path** — 3-step checklist with live progress badge and completed-step strikethrough.
- **Suggestion** — ambient nudge with `Got it / Not now` dismiss flow.
- **Confidence / What are we doing?** — low-evidence reorientation with `card-attention` accent.
- **Restore Pack** — working-set restore actions with Restricted Mode notice surfaced prominently.
- **Trust Center** — explainability trail, AI payload preview, consent controls.

Companion Home slot tokens use quiet visual labels (`✓` / `~` / `–`) with CSS data-attributes driving semantic treatment.

---

## Settings

### Task Checkpoint

| Setting                                     | Default | Description                                               |
| ------------------------------------------- | ------- | --------------------------------------------------------- |
| `tacos.taskCheckpoint.enabled`              | `true`  | Enable structured task checkpoint capture and display     |
| `tacos.taskCheckpoint.promptOnLikelySwitch` | `true`  | Offer checkpoint prompt at conservative switch boundaries |

### Resume Safety

| Setting                          | Default | Description                                       |
| -------------------------------- | ------- | ------------------------------------------------- |
| `tacos.resumeSafety.enabled`     | `true`  | Show post-resume safety check annunciator         |
| `tacos.resumeSafety.idleMinutes` | `10`    | Minimum idle time before safety check triggers    |
| `tacos.resumeSafety.strict`      | `false` | Warn before first risky action on strong mismatch |

### Percolation (Dynamic Surface Policy)

| Setting                                      | Default | Description                                          |
| -------------------------------------------- | ------- | ---------------------------------------------------- |
| `tacos.percolationPolicyEnabled`             | `true`  | Enable dynamic percolation surface arbitration       |
| `tacos.percolationExplainabilityEnabled`     | `true`  | Surface `Why am I seeing this?` explainability trail |
| `tacos.percolationNotificationBrokerEnabled` | `true`  | Route surface decisions through notification broker  |

### Privacy and AI

| Setting                          | Default | Description                             |
| -------------------------------- | ------- | --------------------------------------- |
| `tacos.aiIncludeCheckpointNotes` | `false` | Include checkpoint notes in AI payloads |
| `tacos.aiIncludeScratchpad`      | `false` | Include scratchpad in AI payloads       |

### Legacy (note-only blur prompting)

| Setting                        | Default | Description                                                                    |
| ------------------------------ | ------- | ------------------------------------------------------------------------------ |
| `tacos.promptCheckpointOnBlur` | `false` | Legacy note-only blur checkpoint prompt (separate from structured checkpoints) |

---

## Safety in Plain English

- **Local-first by default.** No data leaves your machine without your consent.
- **No hidden telemetry.** All metrics and diagnostics stay local unless you explicitly export or share them.
- **No cloud backend in this slice.** No account, no sync, no backend.
- **AI is optional.** You choose when and whether to involve a model.
- **Model output is untrusted.** TaCoS never bypasses path, URL, or evidence validation based on model output.
- **Restricted Mode is a hard boundary.** Risky collection and execution actions are fully suppressed.

→ [docs/PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)

---

## Research Grounding

TaCoS is grounded in interruption and recovery research:

- unfinished-task carryover and attention residue
- goal-memory recovery and retrieval cues
- breakpoint-aware interruption timing
- interrupted programming resumption cues (ICSE'26 TaCoS paper)
- calm, explainable, user-controlled human-AI interaction
- automation-risk and agency-preserving design

→ [docs/references.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md)

---

## Runtime Scope

TaCoS is **desktop-first**. It runs in the Node-hosted VS Code extension runtime and does not currently declare a browser entrypoint.

---

## Where To Go Next

**Product behavior and UX:**

- [SPECS.md](https://github.com/jkordish/vscode-tacos/blob/main/SPECS.md)
- [docs/DESIGN_AND_IMPLEMENTATION.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/DESIGN_AND_IMPLEMENTATION.md)
- [docs/references.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md)

**Privacy and safety:**

- [docs/PRIVACY_AND_SAFETY.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/PRIVACY_AND_SAFETY.md)
- [docs/action-safety-matrix.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/action-safety-matrix.md)

**Metrics and validation:**

- [docs/metrics.md](https://github.com/jkordish/vscode-tacos/blob/main/docs/metrics.md)

**Contributor/operator docs:**

- [AGENTS.md](https://github.com/jkordish/vscode-tacos/blob/main/AGENTS.md)
- [PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md)
- [CHANGELOG.md](https://github.com/jkordish/vscode-tacos/blob/main/CHANGELOG.md)

---

## Development Quick Commands

```bash
npm ci
npm run verify:quick       # format + lint + typecheck + unit tests
npm run test:integration   # VS Code integration harness
npm run package:vsix       # build VSIX artifact
```

---

## License

MIT
