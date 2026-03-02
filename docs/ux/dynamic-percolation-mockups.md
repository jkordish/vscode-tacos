# Dynamic Percolation Mockups (`v0.8.0+`)

Status: Draft visual companion for `docs/ux/dynamic-percolation-v0.8.0-spec.md`

## Current vs Proposed

| Area | Current (`v0.7.0`) | Proposed (`v0.8.0`) |
| --- | --- | --- |
| Ranking scope | Nudge-local plus card-level conditions | Single policy engine ranks all surfaced candidates |
| Explainability | Trust cue + nudge explanation split | Unified "why surfaced / why suppressed" trace |
| Surface arbitration | Mostly `uiSurface` + focus context | Deterministic statusbar/panel/notification policy |
| Layout behavior | Stable card stack with collapsed sections | Same stable stack, but policy-driven emphasis and defaults |
| Restricted mode clarity | Disabled actions + messaging | Same safety, plus explicit policy suppression reasons |

## Information Architecture Diagram

```mermaid
flowchart LR
  A["Layer 0: Ambient\nStatus bar + compact chips"] --> B["Layer 1: Glanceable\nCompanion Home (Now/Next/Blocked/Restore)"]
  B --> C["Layer 2: Explainable\nWhy surfaced / Why suppressed"]
  C --> D["Layer 3: Trust/Privacy/Evidence\nCollapsed one-click trays"]
  D --> E["Layer 4: Forensic\nTimeline, diagnostics, metrics"]
```

## Signal -> Policy -> Surface Flow

```mermaid
flowchart LR
  S1["Focus regain"] --> N["Signal normalization"]
  S2["Workspace/branch change"] --> N
  S3["Task/debug outcomes"] --> N
  S4["Checkpoint/correction updates"] --> N
  S5["Trust/privacy mode"] --> N

  N --> R["Candidate registry\n(build surfaced items)"]
  R --> K["Deterministic ranking\n(score + confidence)"]
  K --> G["Suppression gates\nquiet/cooldown/noise budget/dismissal"]
  G --> P["Policy decision + explanation payload"]

  P --> O1["Status bar only"]
  P --> O2["Panel silent refresh"]
  P --> O3["Panel emphasis update"]
  P --> O4["Actionable notification"]
```

## Event-State Model

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Refreshing: focus/manual trigger
  Refreshing --> Stable: summary rendered
  Stable --> HighConfidence: primary CTA selected
  Stable --> LowConfidence: sparse/ambiguous signals
  Stable --> Blocked: blocker promoted
  HighConfidence --> Stable: action complete or context shift
  LowConfidence --> Stable: clarification evidence added
  Blocked --> Stable: blocker resolved
  Stable --> Restricted: trust revoked
  Restricted --> Stable: trust granted
  Stable --> Paused: pause/snooze/quiet
  Paused --> Idle: resumed
```

## Default Panel Wireframe (Prioritized)

```text
+--------------------------------------------------------------+
| Companion Home                                                |
| ------------------------------------------------------------ |
| NOW:   Stabilize parser fix on branch feature/parser         |
|        [Intent source: inferred] [Mode: coding]             |
|        Last action: Edited src/parser.ts:214 [Open]         |
|                                                              |
| NEXT:  Re-run focused parser test                            |
|        [Primary CTA] Run parser test                         |
|        [Why this next step?]                                 |
|        1) Re-run parser test [evidence badge]               |
|        2) Patch failing branch case [evidence badge]        |
|        3) Capture checkpoint note [advisory]                |
|                                                              |
| BLOCKED: Test failure in parser suite                        |
|          [Primary unblock action] Open failing test          |
|                                                              |
| RESTORE: [Reopen files] [Jump to last edit] [Open Problems] |
|          [Why unavailable?]                                  |
+--------------------------------------------------------------+
| Resume Path (3-step checklist)                               |
+--------------------------------------------------------------+
| Status                                                        |
+--------------------------------------------------------------+
| More Context (collapsed)                                      |
|   - Trust Center                                              |
|   - Session Recap                                             |
|   - Changes Since Last Time                                   |
|   - Companion Nudge                                           |
|   - Timeline                                                  |
|   - Evidence                                                  |
|   - Details                                                   |
+--------------------------------------------------------------+
```

## Trust / Privacy / Evidence Quick Drill-Down

```text
[Trust Chip: Based on 6 files • 3 runs • branch feature/parser]
[Privacy Chip: Local-only + redacted persistence]
[Mode Chip: Active]

Click Trust Chip ->

+--------------------------------------------------------------+
| Why am I seeing this?                                         |
| 1. Branch switched from main -> feature/parser               |
| 2. Recent failing test command detected                       |
| 3. High-confidence file evidence in src/parser.ts             |
|                                                              |
| What TaCoS used                                                |
| - file: src/parser.ts                                         |
| - terminal: npm test -- parser                                |
| - task: test suite run                                        |
|                                                              |
| Privacy posture                                                 |
| - Stored locally: redacted activity + summary cache           |
| - Sent to AI: none (local mode)                               |
| - Restricted mode: off                                         |
|                                                              |
| [Open Privacy & Safety] [Review AI payload preview]           |
+--------------------------------------------------------------+
```

## Notification vs Statusbar Decision Flow

```mermaid
flowchart LR
  A["Percolation decision ready"] --> B{"High urgency + high confidence + actionable?"}
  B -- "No" --> C{"Meaningful but non-urgent?"}
  C -- "No" --> D["Status bar update only"]
  C -- "Yes" --> E["Panel refresh silently"]
  B -- "Yes" --> F{"Suppression gates clear?\nquiet/noise/dismissal"}
  F -- "No" --> G["Panel emphasis without notification"]
  F -- "Yes" --> H{"User in mid-activity typing window?"}
  H -- "Yes" --> I["Defer to panel emphasis"]
  H -- "No" --> J["Show actionable notification"]
```

## Restricted Mode Rendering Example

```text
+--------------------------------------------------------------+
| Companion Home                                                |
| NOW: Limited context in Restricted Mode                       |
| NEXT: Safe local action available                             |
| [Open last edited file]                                       |
|                                                              |
| BLOCKED: Execution actions restricted                         |
| [Rerun task] (disabled)                                       |
| Reason: Trust this workspace to enable task/debug execution.  |
|                                                              |
| TRUST CENTER                                                   |
| Mode: restricted                                               |
| Collection changes: git + terminal execution signals disabled |
| AI refinement: disabled                                        |
| [Learn more]                                                   |
+--------------------------------------------------------------+
```

## Stable Emphasis Tokens (No Layout Thrash)

```text
Token examples applied in-place:
- [PRIMARY] one CTA in Next or Blocked section
- [ADVISORY] low-confidence or non-actionable cue
- [ELEVATED CHIP] trust/privacy/restricted chip emphasis
- [SUPPRESSED] badge with quick reason (quiet, cooldown, dismissal)

Rule:
- never move section order based on score
- only change badge/weight/action availability and card accent
```
