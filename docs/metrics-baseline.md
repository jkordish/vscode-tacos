# Metrics Baseline (Dogfooding)

This document records local dogfooding metrics used to evaluate TaCoS stabilization progress for `0.2.x`.

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

## Current Baseline Snapshot

Date: `TBD`
Source CSV: `.tacos/metrics.csv`

Status:
- Dogfooding gate met: `TBD`
- Sessions: `TBD`
- Distinct workspaces: `TBD`

Lag summary (ms):

| Metric | n | p50 | p95 |
| --- | ---: | ---: | ---: |
| `firstMeaningfulEditLagMs` | TBD | TBD | TBD |
| `firstRunLagMs` | TBD | TBD | TBD |
| `firstActionLagMs` | TBD | TBD | TBD |

Prompt and nudge rates:

| Metric | Value |
| --- | ---: |
| Prompt impressions (total) | TBD |
| Forced-open details clicks (total) | TBD |
| Forced-open rate (`forced/prompt`) | TBD |
| Nudge impressions (total) | TBD |
| Nudge impressions per session | TBD |

Notes:
- Replace all `TBD` values with the latest local export summary before closing epic `#72`.
- Keep this document local-context safe (no raw workspace paths in shared copies).
