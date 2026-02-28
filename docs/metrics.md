# Local Metrics Guide

TaCoS metrics are local-only. No telemetry upload or external analytics pipeline is used.

## Export Metrics

1. Open Command Palette.
2. Run `TaCoS: Export Local Metrics`.
3. TaCoS writes:
- `.tacos/metrics.json` (raw local records)
- `.tacos/metrics.csv` (dashboard-friendly CSV)

## Copy Baseline Snapshot

1. Open Command Palette.
2. Run `TaCoS: Copy Metrics Baseline Snapshot`.
3. Paste the markdown snapshot into `docs/metrics-baseline.md` or an issue comment.

The copied snapshot includes:
- lag p50/p95 for `firstMeaningfulEditLagMs`, `firstRunLagMs`, and `firstActionLagMs`
- prompt/nudge/forced-open totals and rates
- primary CTA impression/click/completion totals and rates
- interruption timing class breakdown (`boundary`, `mid-activity`, `unknown`)
- dogfooding gate status (`>=30` sessions and `>=3` workspaces)

The snapshot is aggregate-only and excludes raw workspace paths.

## CSV Data Dictionary

| Column | Type | Description |
| --- | --- | --- |
| `startedAtMs` | integer | Session start timestamp in Unix milliseconds. |
| `startedAtIso` | string | Session start timestamp as ISO 8601. |
| `sessionDate` | string | UTC date (`YYYY-MM-DD`) for daily grouping. |
| `workspaceRoot` | string | Workspace root path for local grouping. |
| `trigger` | enum | Summary trigger (`focus`, `manual`, `cached`). |
| `uiSurface` | enum | UI surface mode (`statusbar`, `notification`, `silent`). |
| `interruptionEvent` | integer | `1` when focus-triggered summary used notification prompt mode, else `0`/empty. |
| `interruptionTimingClass` | enum | Focus-return timing class: `boundary`, `mid-activity`, or `unknown`. |
| `firstMeaningfulEditLagMs` | integer | Milliseconds from session start to first meaningful edit. |
| `firstRunLagMs` | integer | Milliseconds from session start to first run/test/debug action. |
| `firstActionLagMs` | integer | Milliseconds from session start to first meaningful action of any tracked type. |
| `companionFirstActionLagMs` | integer | Milliseconds from session start to first companion action. |
| `companionPromptImpressions` | integer | Number of prompt-mode companion impressions in session. |
| `companionForcedOpenDetailsClicks` | integer | Number of "Open details" forced-open clicks from prompt mode. |
| `companionQuickActionsTaken` | integer | Number of prompt-mode quick actions taken (copy/pause/open flows). |
| `companionNudgeImpressions` | integer | Number of accepted companion nudge impressions in session. |
| `companionPrimaryCtaImpressions` | integer | Number of sessions where TaCoS rendered a primary next-action CTA. |
| `companionPrimaryCtaClicks` | integer | Number of primary CTA clicks taken by the user. |
| `companionPrimaryCtaCompletions` | integer | Number of primary CTA attempts that completed successfully. |
| `helpfulnessRating` | integer | Optional local rating (`1`-`5`) from `TaCoS: Rate Summary Helpfulness`. |
| `pauseActions` | integer | Count of pause actions taken during session. |
| `snoozeActions` | integer | Count of snooze actions taken during session. |
| `summaryQuietActions` | integer | Count of temporary quiet-mode actions taken (`Quiet now`, `until tomorrow`). |
| `disableActions` | integer | Count of disable/toggle-off actions taken during session. |
| `noteCreated` | integer | Count of checkpoint notes created during session. |
| `noteMarkedDone` | integer | Count of checkpoint notes marked done during session. |
| `notePinned` | integer | Count of checkpoint notes pinned during session. |
| `resumePathCompletions` | integer | Count of completed resume-path checklist steps (when feature is enabled). |
| `resumeWithNote` | integer | `1` if an open checkpoint note was present in the resume context, else `0`. |
| `scratchpadOpened` | integer | Count of `TaCoS: Open Scratchpad` actions during session. |
| `scratchpadAppended` | integer | Count of `TaCoS: Append to Scratchpad` actions during session. |
| `redactionEventsTotal` | integer | Aggregate count of sanitizer replacements performed locally during the session. |
| `redactionHighRiskDetectedTotal` | integer | Count of high-risk sanitizer detections during the session. |
| `aiSendBlockedBySanitizerTotal` | integer | Count of AI-boundary sends blocked by strict sanitizer checks. |
| `aiSendAllowedAfterReviewTotal` | integer | Count of AI sends explicitly approved after payload review. |
| `companionActionFollowThroughRate` | ratio | Derived as `companionQuickActionsTaken / companionPromptImpressions`. |
| `companionForcedOpenRate` | ratio | Derived as `companionForcedOpenDetailsClicks / companionPromptImpressions`. |
| `companionPrimaryCtaClickThroughRate` | ratio | Derived as `companionPrimaryCtaClicks / companionPrimaryCtaImpressions`. |
| `companionPrimaryCtaCompletionRate` | ratio | Derived as `companionPrimaryCtaCompletions / companionPrimaryCtaClicks`. |

## Epic #72 Key Fields

Track these explicitly for stabilization/adoption gating:

- `firstMeaningfulEditLagMs`
- `firstRunLagMs`
- `firstActionLagMs`
- `companionPromptImpressions`
- `companionForcedOpenDetailsClicks`
- `companionNudgeImpressions`
- `companionPrimaryCtaImpressions`
- `companionPrimaryCtaClicks`
- `companionPrimaryCtaCompletions`
- `interruptionTimingClass`
- `summaryQuietActions`
- `noteCreated`
- `noteMarkedDone`
- `notePinned`
- `resumePathCompletions`
- `resumeWithNote`
- `scratchpadOpened`
- `scratchpadAppended`
- `redactionEventsTotal`
- `redactionHighRiskDetectedTotal`
- `aiSendBlockedBySanitizerTotal`
- `aiSendAllowedAfterReviewTotal`

## Notes

- Empty values mean the metric was not observed in that session.
- `workspaceRoot` is local-only and should be redacted/anonymized before public sharing.
