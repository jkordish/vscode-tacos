# Metrics Baseline (Dogfooding)

This document records local dogfooding metrics used to evaluate TaCoS stabilization and adoption progress.

## v0.6.0 Outcome Contract

North star: after returning to a workspace, users can recover in about 5 seconds with one clear, safe next action.

Parent epics:
- #131 Cognitive Resume Kit for 5-Second Resume
- #132 Opportune Timing + Noise Budget 2.0
- #133 Companion IA Overhaul for 5-Second Scan
- #134 Proof, Metrics, and Release Discipline

Target deltas are evaluated against the most recent baseline snapshot that passes the sample gate.

| Outcome | Primary metric | Formula / interpretation | v0.6.0 target delta |
| --- | --- | --- | --- |
| Faster recovery to first action | `firstActionLagMs` p50, p95 | Quantiles of ms from summary display to first meaningful action. Lower is better. | p50: `-25%`, p95: `-20%` |
| Lower forced-click friction | `companionForcedOpenRate` | `companionForcedOpenDetailsClicks / companionPromptImpressions` (when prompt impressions > 0). Lower is better. | `<= 0.05` |
| Fewer harmful interruptions | `interruptionEvent` rate | `sum(interruptionEvent) / sessions` where `interruptionEvent=1` for focus-triggered prompt-mode interruptions. Lower is better. | `-40%` relative |
| Better action follow-through | `companionActionFollowThroughRate` | `companionQuickActionsTaken / companionPromptImpressions` (when prompt impressions > 0). Higher is better. | `+20%` relative |
| Higher perceived usefulness | `helpfulnessRating` mean | Average local helpfulness rating (`1`-`5`) for sessions with ratings. Higher is better. | `+0.5` absolute |

Target revision policy:
- Keep initial targets until at least one gate-passing baseline sample (`>=30` sessions and `>=3` workspaces) is recorded.
- If a target is shown to be unrealistic, revise in an issue comment with explicit rationale and timestamp before release sign-off.

## Minimum Sample Gate

Before marking the epic gate complete:

- `>= 30` metric sessions
- `>= 3` distinct workspaces

## How To Generate Baseline Summary

1. Run `TaCoS: Copy Metrics Baseline Snapshot` in VS Code.
2. Paste clipboard output into the "Current Baseline Snapshot" section below.
3. Optionally export raw files for deeper analysis with `TaCoS: Export Local Metrics`.
4. Optional CLI summary (from repo root):

```bash
npm run metrics:summary -- .tacos/metrics.csv
```

5. Update the date and notes.

## Snapshot Interpretation Rules

- Use deltas, not absolute values alone, for go/no-go decisions.
- Compare similar workflow windows where possible (same week/daypart and similar project type).
- Treat very low-denominator ratio metrics (`promptImpressions < 10`) as directional only.
- Keep all exports local-only and redact workspace paths before sharing externally.

## Current Baseline Snapshot

Date: `2026-02-27`
Source: `Repository-local snapshot (no .tacos/metrics.csv present in this checkout)`

Status:
- Dogfooding gate met: `no`
- Sessions: `0`
- Distinct workspaces: `0`

Lag summary (ms):

| Metric | n | p50 | p95 |
| --- | ---: | ---: | ---: |
| `firstMeaningfulEditLagMs` | 0 | n/a | n/a |
| `firstRunLagMs` | 0 | n/a | n/a |
| `firstActionLagMs` | 0 | n/a | n/a |

Prompt and nudge rates:

| Metric | Value |
| --- | ---: |
| Prompt impressions (total) | 0 |
| Prompt impressions per session | n/a |
| Forced-open details clicks (total) | 0 |
| Forced-open rate (`forced/prompt`) | n/a |
| Nudge impressions (total) | 0 |
| Nudge impressions per session | n/a |
| noteCreated (total) | 0 |
| noteMarkedDone (total) | 0 |
| notePinned (total) | 0 |
| scratchpadOpened (total) | 0 |
| scratchpadAppended (total) | 0 |

Resumption lag by note usage (`firstActionLagMs`):

| Cohort | Sessions | p50 (ms / s) | p95 (ms / s) |
| --- | ---: | ---: | ---: |
| `resumeWithNote = 1` | 0 | n/a | n/a |
| `resumeWithNote = 0` | 0 | n/a | n/a |

Notes:
- This is a valid post-implementation baseline snapshot, but it does not meet the dogfooding gate yet.
- Replace this section with fresh output from `TaCoS: Copy Metrics Baseline Snapshot` once local sessions are recorded.
- Keep this document local-context safe (no raw workspace paths in shared copies).
