# Companion v1 Design and Implementation Spec

Status: Draft v1  
Owner: TaCoS maintainers  
Related issues: #38, #39, #40, #41, #42, #43, #44, #45, #46, #47

## 1. Vision

TaCoS should feel like a calm companion in VS Code that helps people resume work quickly and confidently with minimal interruption.

## 2. Problem Statement

TaCoS is technically strong (local-first, safety-aware, trust-aware), but users can still experience friction when guidance feels fragmented or interruptive. The companion should reduce forced clicks, reduce notification fatigue, and increase actionability.

## 3. Product Goals

1. Reduce interruption cost during resume flows.
2. Improve time-to-first-meaningful-action after resume.
3. Keep guidance actionable and evidence-grounded.
4. Make tracking/privacy posture obvious and controllable.
5. Preserve current safety and trust constraints without regression.

## 4. Non-goals (v1)

1. Full conversational chat interface.
2. Cloud sync of work history/preferences.
3. Cross-repository orchestration.
4. Autonomously executing risky actions without explicit user intent.

## 5. UX Principles

1. Calm by default: avoid prompts unless high value.
2. Useful over verbose: emphasize immediate next actions.
3. Transparent by design: show what is tracked/stored/sent.
4. Local-first speed: instant update first, optional refinement later.
5. Safe by construction: evidence grounding and re-validation remain mandatory.

## 6. Primary User Stories

1. As a returning developer, I want to instantly see what I should do next.
2. As a multitasking developer, I want a compact status signal without opening a panel.
3. As a privacy-conscious user, I want to know exactly what TaCoS is tracking.
4. As a user under pressure, I want fewer interruptions and one-click actions.

## 7. Information Architecture (Companion Home)

Top-level companion home sections:

1. `Now`: one-line summary of current intent/state.
2. `Next`: top 1-3 high-confidence actions.
3. `Blocked`: strongest blocker with an unblock suggestion.
4. `Restore`: fast continuation actions (open files, rerun task/debug, copy failing command).

Design rules:

1. Show companion home above detailed timeline/evidence.
2. Keep each section scannable in under 5 seconds.
3. Include inline actions where safe and possible.
4. Collapse low-priority details behind secondary affordances.

## 8. Interaction Model

### 8.1 Focus-triggered resume

1. Compute summary.
2. Render/update scratch summary silently.
3. If panel is open, update in place.
4. Show minimal status indication, not blocking modal interactions.

### 8.2 Manual “show now”

1. Manual command remains explicit and foregrounded.
2. Panel opens with full companion home and details.

### 8.3 Prompt fallback mode

1. When `autoRefreshInBackground=false`, prompt flow remains available.
2. Prompt mode is intentionally opt-in and test-covered.

### 8.4 Restricted mode

1. Companion remains available for safe local summary.
2. Risky collection/actions remain disabled.
3. UI explicitly indicates restricted behavior.

## 9. Companion Runtime State Model

Companion states:

1. `active`: normal tracking and summaries enabled.
2. `paused`: tracking/summaries paused by user.
3. `restricted`: workspace trust restrictions active.
4. `idle`: active but waiting for trigger/event.
5. `refreshing`: summary generation in progress.

Key transitions:

1. `active -> paused` via pause controls.
2. `paused -> active` via resume controls.
3. `active -> restricted` when workspace trust changes.
4. `idle -> refreshing -> active` on trigger.

## 10. Nudge Engine (v1)

Inputs:

1. Recent failures (test/build commands).
2. Branch switches and changed files.
3. Recent debug/task history.
4. Outstanding blockers inferred from summary state.

Selection rules:

1. Deterministic ranking for same input state.
2. Emit one primary nudge and optional secondary nudge.
3. Apply cooldown and quiet-window suppression before display.
4. Never generate unsafe links or actions.

## 11. Session Memory Recap

Companion recap fields:

1. `Done since last resume`
2. `Pending/blocked`
3. `Recommended first action`

Rules:

1. Keep recap concise and evidence-grounded.
2. Prefer explicit facts over speculative language.
3. Allow quick checkpoint capture from recap.

## 12. Trust Center

Trust Center should always show:

1. Tracking mode (`on`, `paused`, `restricted`).
2. What is stored locally.
3. What can be sent to AI providers when enabled.
4. Fast controls for pause/resume and privacy docs access.

## 13. Visual Design System (Webview)

1. Use clear type hierarchy for primary actionability.
2. Use theme-aware tokens for light/dark/high-contrast.
3. Use codicons or equivalent visual markers for evidence/action types.
4. Apply subtle transition on refresh updates only.
5. Preserve keyboard accessibility and readable contrast.

## 14. Metrics and Success Criteria

Companion metrics:

1. Forced-click count for viewing refreshed state.
2. Prompt impressions per session.
3. Action follow-through rate for quick actions.
4. Time to first meaningful action after resume.

Initial target direction:

1. Forced-click count trends to zero in default mode.
2. Prompt impressions decrease without reducing useful actions.
3. Follow-through rate improves release-over-release.

## 15. Configuration and Controls (v1)

Existing and planned settings:

1. `tacos.autoRefreshInBackground` (default `true`)
2. `tacos.pauseSummaries`
3. Companion nudge settings:
   1. `tacos.companionNudgesEnabled`
   2. aggressiveness level
   3. quiet hours window
   4. cooldown minutes

## 16. Implementation Plan (Phased)

### Phase 0: Spec and alignment (#47)

1. Land this document.
2. Link all child issues to this spec.
3. Align DoD across issues and PR template.

### Phase 1: Core surfaces (#39, #40)

1. Implement companion home sections.
2. Add status bar companion and quick actions.
3. Keep current safety and trust behavior unchanged.

### Phase 2: Intelligence and memory (#41, #42)

1. Add deterministic nudge engine with cooldown controls.
2. Add session recap fields and UI rendering.

### Phase 3: Trust and polish (#44, #43)

1. Add Trust Center and transparency controls.
2. Apply visual polish and accessibility pass.

### Phase 4: Metrics and validation (#45, #46)

1. Extend metric export for friction/usefulness.
2. Expand integration coverage and release checks.

## 17. Test Strategy

Automated:

1. Unit tests for ranking, suppression, and state transitions.
2. Integration tests for presentation mode toggles and key companion actions.
3. Regression checks for safety boundaries and trust behavior.

Manual:

1. Execute smoke runbook friction section.
2. Record forced-click counts and interruption score.
3. Verify light/dark/high-contrast readability.

## 18. Risks and Mitigations

1. Risk: Over-notification from low-confidence nudges.
   Mitigation: strict ranking thresholds and cooldown suppression.
2. Risk: UX regressions under Restricted Mode.
   Mitigation: explicit trust-state rendering and dedicated coverage.
3. Risk: Companion UI complexity grows too quickly.
   Mitigation: phased rollout and scoped v1 non-goals.

## 19. Program Definition of Done (Companion v1)

1. Child issues #39-#47 are completed with merged PRs.
2. Default focus refresh requires zero forced `Open details` clicks.
3. Companion home sections and status bar are stable and discoverable.
4. Trust Center clearly communicates tracking/privacy posture.
5. Metrics capture friction and actionability, with documented interpretation.
6. Integration/manual validation gates pass and are recorded.
7. No regressions in privacy, evidence safety, or workspace-trust constraints.
