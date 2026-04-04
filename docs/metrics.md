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
3. Paste the markdown snapshot into an issue comment or release PR description.

The copied snapshot includes:

- lag p50/p95 for `firstMeaningfulEditLagMs`, `firstRunLagMs`, `firstActionLagMs`, and `resumeSafetyFirstActionLagMs`
- prompt/nudge/forced-open totals and rates
- Resume Safety Check totals (`shown`, `dismissed`, `action clicked`, `mismatch detected`, `strict warning fired`)
- structured checkpoint totals (`offered`, `completed`, `skipped`, `dismissed`, `edited later`, `field completeness`)
- structured task-state totals (`created`, `resolved`, `stale`) and switch/debrief totals
- resume-brief state-recovery totals (`resumeBriefUsesCheckpointState`, `resumeBriefShowsTimelineCue`)
- primary CTA impression/click/completion totals and rates
- interruption timing class breakdown (`boundary`, `mid-activity`, `unknown`)
- derived `UX friction score` (`0-100`, lower is better) with component breakdown and formula
- cohort comparisons for:
  - `resumeWithStructuredTaskState`
  - `taskSwitchSessionClass`
  - `resumeTaskStateFreshness`
- dogfooding gate status (`>=30` sessions and `>=3` workspaces)

The snapshot is aggregate-only and excludes raw workspace paths.

## CSV Data Dictionary

| Column                                | Type    | Description                                                                     |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `startedAtMs`                         | integer | Session start timestamp in Unix milliseconds.                                   |
| `startedAtIso`                        | string  | Session start timestamp as ISO 8601.                                            |
| `sessionDate`                         | string  | UTC date (`YYYY-MM-DD`) for daily grouping.                                     |
| `workspaceRoot`                       | string  | Workspace root path for local grouping.                                         |
| `trigger`                             | enum    | Summary trigger (`focus`, `manual`, `cached`).                                  |
| `uiSurface`                           | enum    | UI surface mode (`statusbar`, `notification`, `silent`).                        |
| `percolationDecisionCount`            | integer | Number of percolation surface-arbitration decisions recorded in the session.    |
| `surfaceSelectionNone`                | integer | Count of broker-selected `none` surface outcomes in the session.                |
| `surfaceSelectionStatusbar`           | integer | Count of broker-selected `statusbar` surface outcomes in the session.           |
| `surfaceSelectionPanel`               | integer | Count of broker-selected `panel` surface outcomes in the session.               |
| `surfaceSelectionPanelSilent`         | integer | Count of `panel` outcomes classified as ambient/silent background updates.       |
| `surfaceSelectionPanelEmphasis`       | integer | Count of `panel` outcomes classified as emphasized drill-down paths.             |
| `surfaceSelectionNotification`        | integer | Count of broker-selected `notification` surface outcomes in the session.        |
| `percolationConfidenceBandLow`        | integer | Count of percolation decisions where primary candidate confidence was low.       |
| `percolationConfidenceBandMedium`     | integer | Count of percolation decisions where primary candidate confidence was medium.    |
| `percolationConfidenceBandHigh`       | integer | Count of percolation decisions where primary candidate confidence was high.      |
| `interruptionEvent`                   | integer | `1` when focus-triggered summary used notification prompt mode, else `0`/empty. |
| `interruptionTimingClass`             | enum    | Focus-return timing class: `boundary`, `mid-activity`, or `unknown`.            |
| `firstMeaningfulEditLagMs`            | integer | Milliseconds from session start to first meaningful edit.                       |
| `firstRunLagMs`                       | integer | Milliseconds from session start to first run/test/debug action.                 |
| `firstActionLagMs`                    | integer | Milliseconds from session start to first meaningful action of any tracked type. |
| `companionFirstActionLagMs`           | integer | Milliseconds from session start to first companion action.                      |
| `companionPromptImpressions`          | integer | Number of prompt-mode companion impressions in session.                         |
| `companionForcedOpenDetailsClicks`    | integer | Number of "Open details" forced-open clicks from prompt mode.                   |
| `companionQuickActionsTaken`          | integer | Number of prompt-mode quick actions taken (copy/pause/open flows).              |
| `companionNudgeImpressions`           | integer | Number of accepted companion nudge impressions in session.                      |
| `resumeSafetyShown`                   | integer | Count of Resume Safety Check annunciators shown in the session.                 |
| `resumeSafetyDismissed`               | integer | Count of Resume Safety Check annunciators that timed out/dismissed quietly.     |
| `resumeSafetyActionClicks`            | integer | Count of Resume Safety Check verify-action clicks.                              |
| `resumeSafetyMismatchDetected`        | integer | Count of Resume Safety Check surfaces that identified a mismatch/stale assumption. |
| `resumeSafetyStrictWarnings`          | integer | Count of strict-mode `fix or proceed` warnings shown before the first risky action. |
| `resumeSafetyFirstActionLagMs`        | integer | Milliseconds from Resume Safety Check surface time to the first inferable action. |
| `companionPrimaryCtaImpressions`      | integer | Number of sessions where TaCoS rendered a primary next-action CTA.              |
| `companionPrimaryCtaSourceClass`      | string  | Policy source class for the single primary CTA (for example `policy:next-step-action:openFile` or `policy:blocker:taskFailure`). |
| `companionPrimaryCtaClicks`           | integer | Number of primary CTA clicks taken by the user.                                 |
| `companionPrimaryCtaCompletions`      | integer | Number of primary CTA attempts that completed successfully.                     |
| `blockerPromotionTaskFailure`         | integer | Count of blocker promotions attributed to task failure signals.                  |
| `blockerPromotionCommandFailure`      | integer | Count of blocker promotions attributed to failing command signals.               |
| `blockerPromotionDiagnostics`         | integer | Count of blocker promotions attributed to diagnostics signals.                   |
| `blockerPromotionBranchContext`       | integer | Count of blocker promotions attributed to branch/divergence context.             |
| `blockerPromotionLowConfidence`       | integer | Count of blocker promotions attributed to low-confidence context.                |
| `blockerPromotionRestricted`          | integer | Count of blocker promotions attributed to Restricted Mode constraints.           |
| `blockerPromotionNoNextSteps`         | integer | Count of blocker promotions attributed to missing safe next steps.               |
| `priorPromotionCheckpoint`            | integer | Count of ranking promotions attributed to checkpoint-note priors.                |
| `priorPromotionCorrections`           | integer | Count of ranking promotions attributed to saved correction priors.               |
| `priorPromotionScratchpad`            | integer | Count of ranking promotions attributed to scratchpad priors.                     |
| `trustTrayOpens`                      | integer | Count of Trust & Privacy tray disclosure opens in trusted mode.                 |
| `restrictedTrustTrayOpens`            | integer | Count of Trust & Privacy tray disclosure opens in Restricted Mode.              |
| `whySurfacedOpens`                    | integer | Count of one-click `Why am I seeing this?` drill-down opens.                    |
| `aiPayloadPreviewOpensTrustCenter`    | integer | Count of AI payload preview opens from Trust Center controls.                    |
| `aiPayloadPreviewOpensWhySurfaced`    | integer | Count of AI payload preview opens from nested `Why am I seeing this?` details.   |
| `aiPayloadPreviewOpensCompanionHome`  | integer | Count of AI payload preview opens from Companion Home surfaced-item controls.     |
| `percolationSuppressedQuietHours`     | integer | Count of percolation suppressions attributed to configured quiet hours.          |
| `percolationSuppressedCooldown`       | integer | Count of percolation suppressions attributed to cooldown gating.                 |
| `percolationSuppressedNoChange`       | integer | Count of percolation suppressions attributed to no-change fingerprint checks.    |
| `percolationSuppressedNoiseBudget`    | integer | Count of percolation suppressions attributed to noise-budget gating.             |
| `percolationSuppressedLowConfidence`  | integer | Count of percolation suppressions attributed to low-confidence safeguards.       |
| `noveltyScoreBucketLow`               | integer | Count of sessions whose selected novelty profile bucket was `low`.               |
| `noveltyScoreBucketMedium`            | integer | Count of sessions whose selected novelty profile bucket was `medium`.            |
| `noveltyScoreBucketHigh`              | integer | Count of sessions whose selected novelty profile bucket was `high`.              |
| `percolationDismissActions`           | integer | Count of percolation-memory dismiss actions captured from panel controls.        |
| `percolationSnoozeActions`            | integer | Count of percolation-memory snooze actions captured from panel controls.         |
| `lowConfidenceClarificationRate`      | ratio   | `1` when low-confidence summary selected clarification-first primary path.       |
| `helpfulnessRating`                   | integer | Optional local rating (`1`-`5`) from `TaCoS: Rate Summary Helpfulness`.         |
| `pauseActions`                        | integer | Count of pause actions taken during session.                                    |
| `snoozeActions`                       | integer | Count of snooze actions taken during session.                                   |
| `summaryQuietActions`                 | integer | Count of temporary quiet-mode actions taken (`Quiet now`, `until tomorrow`).    |
| `disableActions`                      | integer | Count of disable/toggle-off actions taken during session.                       |
| `noteCreated`                         | integer | Count of checkpoint notes created during session.                               |
| `noteMarkedDone`                      | integer | Count of checkpoint notes marked done during session.                           |
| `notePinned`                          | integer | Count of checkpoint notes pinned during session.                                |
| `checkpointOffered`                   | integer | Count of structured checkpoint prompts offered on likely-switch boundaries.      |
| `checkpointCompleted`                 | integer | Count of structured task checkpoint captures/edits completed.                   |
| `checkpointSkipped`                   | integer | Count of likely-switch checkpoint prompts explicitly skipped.                    |
| `checkpointDismissed`                 | integer | Count of likely-switch checkpoint prompts explicitly dismissed.                  |
| `checkpointEditedLater`               | integer | Count of structured checkpoints edited after initial creation.                   |
| `checkpointFieldCompleteness`         | integer | Aggregate completeness score (`0-100`) for structured task-state captures.      |
| `structuredTaskStateCreated`          | integer | Count of structured task-state records created during session.                   |
| `structuredTaskStateResolved`         | integer | Count of structured task-state records explicitly resolved during session.       |
| `structuredTaskStateStale`            | integer | Count of resume sessions where the active structured task state was stale.       |
| `taskSwitchDetected`                  | integer | Count of deterministic likely task-switch detections surfaced for the session.   |
| `taskSwitchConfirmed`                 | integer | Count of switch detections that led to checkpoint capture.                       |
| `taskSwitchCorrected`                 | integer | Count of manual switch flows that ended without capture after user review.       |
| `resumeBriefUsesCheckpointState`      | integer | Count of resume briefs that merged structured task state into the recovery view. |
| `resumeBriefShowsTimelineCue`         | integer | Count of resume briefs that surfaced timeline/evidence retrieval cues.           |
| `dailyDebriefOpened`                  | integer | Count of `TaCoS: Show Cognitive Debrief` opens during the session.              |
| `abandonedThreadSurfaced`             | integer | Number of abandoned-thread items surfaced in the cognitive debrief.              |
| `unresolvedBlockerSurfaced`           | integer | Number of unresolved-blocker items surfaced in the cognitive debrief.            |
| `resumePathCompletions`               | integer | Count of completed resume-path checklist steps (when feature is enabled).       |
| `resumeWithNote`                      | integer | `1` if an open checkpoint note was present in the resume context, else `0`.     |
| `resumeWithStructuredTaskState`       | integer | `1` if structured task state was present in the resume context, else `0`.       |
| `taskSwitchSessionClass`              | enum    | Switch cohort for active structured task state: `stable`, `repeated-switch`, `none`. |
| `resumeTaskStateFreshness`            | enum    | Active structured task freshness: `fresh`, `stale`, or `none`.                  |
| `scratchpadOpened`                    | integer | Count of `TaCoS: Open Scratchpad` actions during session.                       |
| `scratchpadAppended`                  | integer | Count of `TaCoS: Append to Scratchpad` actions during session.                  |
| `redactionEventsTotal`                | integer | Aggregate count of sanitizer replacements performed locally during the session. |
| `redactionHighRiskDetectedTotal`      | integer | Count of high-risk sanitizer detections during the session.                     |
| `aiSendBlockedBySanitizerTotal`       | integer | Count of AI-boundary sends blocked by strict sanitizer checks.                  |
| `aiSendAllowedAfterReviewTotal`       | integer | Count of AI sends explicitly approved after payload review.                     |
| `companionActionFollowThroughRate`    | ratio   | Derived as `companionQuickActionsTaken / companionPromptImpressions`.           |
| `companionForcedOpenRate`             | ratio   | Derived as `companionForcedOpenDetailsClicks / companionPromptImpressions`.     |
| `companionPrimaryCtaClickThroughRate` | ratio   | Derived as `companionPrimaryCtaClicks / companionPrimaryCtaImpressions`.        |
| `companionPrimaryCtaCompletionRate`   | ratio   | Derived as `companionPrimaryCtaCompletions / companionPrimaryCtaClicks`.        |

## Epic #72 Key Fields

Track these explicitly for stabilization/adoption gating:

- `firstMeaningfulEditLagMs`
- `firstRunLagMs`
- `firstActionLagMs`
- `percolationDecisionCount`
- `companionPromptImpressions`
- `surfaceSelectionStatusbar`
- `surfaceSelectionPanelSilent`
- `surfaceSelectionPanelEmphasis`
- `surfaceSelectionNotification`
- `percolationConfidenceBandLow`
- `percolationConfidenceBandMedium`
- `percolationConfidenceBandHigh`
- `companionForcedOpenDetailsClicks`
- `companionNudgeImpressions`
- `resumeSafetyShown`
- `resumeSafetyMismatchDetected`
- `resumeSafetyStrictWarnings`
- `resumeSafetyFirstActionLagMs`
- `companionPrimaryCtaImpressions`
- `companionPrimaryCtaSourceClass`
- `companionPrimaryCtaClicks`
- `companionPrimaryCtaCompletions`
- `interruptionTimingClass`
- `summaryQuietActions`
- `noteCreated`
- `noteMarkedDone`
- `notePinned`
- `resumePathCompletions`
- `resumeWithNote`
- `checkpointOffered`
- `checkpointCompleted`
- `structuredTaskStateCreated`
- `structuredTaskStateResolved`
- `taskSwitchDetected`
- `taskSwitchConfirmed`
- `resumeBriefUsesCheckpointState`
- `resumeBriefShowsTimelineCue`
- `dailyDebriefOpened`
- `abandonedThreadSurfaced`
- `unresolvedBlockerSurfaced`
- `resumeWithStructuredTaskState`
- `taskSwitchSessionClass`
- `resumeTaskStateFreshness`
- `scratchpadOpened`
- `scratchpadAppended`
- `redactionEventsTotal`
- `redactionHighRiskDetectedTotal`
- `aiSendBlockedBySanitizerTotal`
- `aiSendAllowedAfterReviewTotal`
- `aiPayloadPreviewOpensTrustCenter`
- `aiPayloadPreviewOpensWhySurfaced`
- `aiPayloadPreviewOpensCompanionHome`

## Resume Safety Check Evaluation

Primary metric:

- `resumeSafetyFirstActionLagMs` compared with the existing `firstActionLagMs` and `firstMeaningfulEditLagMs` cohorts.

Secondary proxy:

- wrong-first-action proxy within 30 seconds: `resumeSafetyStrictWarnings`, interpreted alongside `resumeSafetyMismatchDetected` and `resumeSafetyActionClicks`.

Recommended comparisons:

- feature on vs off: compare cohorts with `tacos.resumeSafety.enabled=true` and `false`
- strict on vs off: compare `resumeSafetyStrictWarnings`, `resumeSafetyActionClicks`, and follow-on lag changes
- mismatch-heavy vs mismatch-light sessions: segment by `resumeSafetyMismatchDetected`

## Cognitive Observability Evaluation

Primary recovery-support comparisons:

- checkpoint cohort vs non-checkpoint cohort:
  - compare `firstActionLagMs` for `resumeWithStructuredTaskState = 1` vs `0`
- repeated-switch tasks vs stable tasks:
  - compare `firstActionLagMs` for `taskSwitchSessionClass = repeated-switch` vs `stable`
- stale task-state sessions vs fresh task-state sessions:
  - compare `firstActionLagMs` for `resumeTaskStateFreshness = stale` vs `fresh`

Useful supporting counters:

- `checkpointOffered`, `checkpointCompleted`, `checkpointSkipped`, `checkpointDismissed`
- `structuredTaskStateCreated`, `structuredTaskStateResolved`, `structuredTaskStateStale`
- `taskSwitchDetected`, `taskSwitchConfirmed`, `taskSwitchCorrected`
- `resumeBriefUsesCheckpointState`, `resumeBriefShowsTimelineCue`
- `dailyDebriefOpened`, `abandonedThreadSurfaced`, `unresolvedBlockerSurfaced`

Interpretation guardrails:

- Treat these as local product-learning signals, not productivity scores.
- False negatives are acceptable for switch detection; false-positive prompting is the larger UX risk.
- Derived comparisons should be read alongside trust state, quiet/snooze controls, and interruption timing classes.

What TaCoS cannot reliably measure:

- whether a user mentally chose the correct action without taking a tracked command or editor action
- correctness of arbitrary terminal commands executed outside VS Code signal coverage
- whether a later success definitively proves the first action was correct

## Notes

- Empty values mean the metric was not observed in that session.
- `workspaceRoot` is local-only and should be redacted/anonymized before public sharing.

## Derived UX Friction Score

The baseline snapshot and `npm run metrics:summary` now include a derived `UX friction score` (`0-100`, lower is better) for trend checks.

Formula:

- weighted mean of:
  - `clamp01(firstActionLagMs_p50 / 5000)`
  - `clamp01(companionForcedOpenRate)`
  - `clamp01(midActivityShare(boundary+mid-activity only))`
    - `midActivityShare` is computed over sessions classified as `boundary` or `mid-activity` (excluding `unknown` and unclassified rows)
  - `clamp01(1 - companionActionFollowThroughRate)`

Default weights:

- lag component: `0.45`
- forced-open component: `0.25`
- mid-activity share component: `0.20`
- follow-through gap component: `0.10`

Interpretation bands:

- `0-33`: low friction
- `34-66`: medium friction
- `67-100`: high friction

When any component is missing, TaCoS reports coverage weight (`available/total`) and computes the weighted mean over available components only.
