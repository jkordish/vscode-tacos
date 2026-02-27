# Metrics Baseline (Dogfooding)

This document records local dogfooding metrics used to evaluate TaCoS stabilization and adoption progress.

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
| Forced-open details clicks (total) | 0 |
| Forced-open rate (`forced/prompt`) | n/a |
| Nudge impressions (total) | 0 |
| Nudge impressions per session | n/a |

Notes:
- This is a valid post-implementation baseline snapshot, but it does not meet the dogfooding gate yet.
- Replace this section with fresh output from `TaCoS: Copy Metrics Baseline Snapshot` once local sessions are recorded.
- Keep this document local-context safe (no raw workspace paths in shared copies).
