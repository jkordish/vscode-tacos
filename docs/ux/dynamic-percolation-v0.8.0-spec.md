# Dynamic Percolation UX Spec for TaCoS (`v0.8.0+`)

Status: Proposed
Owner: TaCoS maintainers
Scope: `v0.8.0`, `v0.8.x`, and post-`v0.8` follow-on
Related modules: `src/extension.ts`, `src/summary.ts`, `src/companionNudges.ts`, `src/noiseControl.ts`, `src/webview/*`, `src/metrics.ts`, `src/restoreSafety.ts`, `src/pathSafety.ts`, `src/activityPersistence.ts`, `src/redaction.ts`, `src/llm.ts`
Research references: `docs/references.md`

## 1. Problem Statement
TaCoS already has strong resume intelligence and strong safety defaults, but the current UX still risks cumulative weight:
- too many meaningful surfaces active at once
- not enough policy-level coordination across status bar, panel emphasis, nudges, and notifications
- low-confidence and high-confidence states can feel similarly dense

Current code has local decisions (for example `chooseCompanionNudges`, `resolveSummaryPresentationMode`, section collapse defaults), but no single policy layer that ranks all candidate signals and chooses the minimum necessary surface.

## 2. Product Thesis
TaCoS should expose a richer internal model than it displays.

Core call:
- adapt emphasis, not structure
- promote what matters now
- keep trust and privacy one click away
- suppress low-value interruption by default

North-star behavior:
- useful in 5 seconds
- deep in 1 click
- calm by default
- deterministic and explainable

## 3. User Archetypes and Scenarios
### Archetypes
1. Fast-return coder
- returns after 2-10 minutes
- wants a single safe next action

2. Interrupted debugger
- returns after failing task/debug loop
- wants blocker-first guidance

3. Privacy-first engineer
- wants local-first confidence and transparent AI boundaries

4. Restricted-mode workspace user
- expects degraded but trustworthy behavior, not broken UI

### High-value scenarios
1. Focus regain after short gap with meaningful file changes
2. Focus regain after long gap with sparse signals
3. Branch switch with divergence and failing command
4. Restricted mode with disabled execution actions
5. Manual refresh with AI refinement enabled and consented

## 4. Current-State Audit (Repo-Grounded)
### What already works well
1. Resume stack and progressive disclosure
- `renderResumeStackCard` and `More Context` sections already provide stable hierarchy.
- Section expansion persistence is implemented (`setPanelSectionExpanded`, panel state storage).

2. Safety invariants
- File/URL validation on open (`resolveFileTargetInWorkspace`, `normalizeHttpUrl`, `isSummaryLinkEvidenceGrounded`).
- Strict AI send sanitizer and consent preview (`ensureAiPayloadConsent`, `buildStrictSanitizedSummaryContext`).
- Restricted-mode execution gating (`computeRestoreAvailability`, rerun/checkout guards).

3. Noise controls
- focus debounce and boundary-aware gating (`shouldAutoTriggerSummary`).
- quiet hours and snooze controls for summaries and nudges.
- cross-signal noise budget (`evaluateNoiseBudget`).

4. Local metrics and testing footprint
- robust local metric export and baseline synthesis (`src/metrics.ts`).
- integration suites for focus presentation, suppression paths, and critical resume flow.

### Current gaps
1. No unified percolation policy object
- ranking logic is split across summary generation, nudge engine, and panel render conditions.

2. Nudge model is narrow
- `companionNudges.ts` ranks only four hardcoded candidate types.

3. Surface arbitration is coarse
- summary presentation mode currently depends mostly on `uiSurface` and focus context, not rich signal severity/actionability.

4. Explainability is fragmented
- trust cue, nudge reason, and card-specific explanations exist, but there is no single "why surfaced" decision trace.

5. Signal normalization is implicit
- branch/task/debug/checkpoint/corrections signals are used in multiple places without one typed, inspectable event stream.

## 5. Pain Points and Failure Modes
1. Cognitive stacking
- multiple cards can be relevant but lack explicit priority ordering rationale.

2. Interruption ambiguity
- users may not know why they were prompted versus silently updated.

3. Low-confidence clutter
- uncertainty handling exists but can still occupy similar visual weight as high-confidence action.

4. Trust transparency drift
- trust/privacy controls are available but not consistently attached to the surfaced decision itself.

5. Policy drift risk
- logic spread across modules increases regression risk and makes behavior harder to tune safely.

## 6. Design Principles
1. Progressive disclosure first
2. Calm technology defaults
3. Interruptions are expensive
4. Stable layout, dynamic emphasis
5. One-click transparency for trust/privacy/evidence
6. Deterministic, inspectable decisions
7. Restricted-mode-safe degradation
8. VS Code-native interaction patterns

## 7. Information Architecture
### Target IA layers
1. Layer 0 Ambient
- status bar text/icon, compact chips

2. Layer 1 Glanceable
- Companion Home top card (`Now`, `Next`, `Blocked`, `Restore`)

3. Layer 2 Explainable
- "Why surfaced" panel and decision trace snippets

4. Layer 3 Trust/Privacy/Evidence
- one-click trays; collapsed by default

5. Layer 4 Forensic
- timeline, diagnostics, metrics, full evidence catalog

### Decision rationale
- Keep current card scaffolding in `renderWebview` and `renderResumeStackCard`.
- Add policy-driven emphasis and default expansion states instead of introducing a new layout tree.

### Tradeoffs
- Pros: preserves spatial memory and existing tests.
- Cons: less freedom for radical redesign.

### Rejected alternatives
- Full dashboard redesign in `v0.8.0`.
- Chat-first panel replacing card model.

### Failure modes to avoid
- moving sections between locations on every refresh
- burying trust/privacy behind multi-step navigation

## 8. State Model
### Runtime states
1. Disabled
2. Paused
3. Restricted
4. Active-idle
5. Active-refreshing
6. Active-high-confidence
7. Active-low-confidence
8. Active-blocked

### Transition drivers
- focus regain
- workspace/branch/partition change
- checkpoint/correction changes
- task/debug/diagnostic outcomes
- user dismissal/snooze actions

### State invariants
1. Every surfaced item must map to evidence IDs or explicit missing-signal reason.
2. Restricted mode may not surface risky execution actions as primary CTA.
3. One primary CTA maximum per summary context.

## 9. Percolation Policy Model
### 9.1 Signal normalization
Introduce normalized signal records (new policy layer) derived from existing sources:
- git and branch context (`collectSignals`, `applyBranchHistory`)
- blocker and diagnostics (`decidePrimaryBlocker`, diagnostics collector)
- checkpoint/intent/corrections (`resolveCheckpointContext`, correction store)
- runtime timing/noise (`noiseControl`, quiet/snooze state)
- trust/privacy mode (restricted, consent, provider)

### 9.2 Candidate surfaced-item schema
Proposed shape for policy candidates:

```ts
interface SurfacedItem {
  id: string;
  kind: 'next-safe-action' | 'blocker' | 'reorientation' | 'trust-chip' | 'privacy-chip' | 'nudge';
  evidenceIds: string[];
  primaryActionId?: string;
  confidence: 'high' | 'medium' | 'low';
  urgency: number;
  actionability: number;
  continuityGap: number;
  novelty: number;
  interruptCost: number;
  privacySensitivity: number;
  suppressedBy?: 'quiet-hours' | 'cooldown' | 'recent-dismissal' | 'noise-budget' | 'restricted-mode';
  explanation: {
    surfacedBecause: string[];
    suppressedBecause: string[];
  };
}
```

### 9.3 Ranking and suppression pipeline
1. Build candidates from normalized signals.
2. Compute deterministic score with fixed weights.
3. Apply hard safety/restricted filters.
4. Apply suppression gates (quiet, cooldown, no-change, dismissal history, noise budget).
5. Select output surfaces:
- status bar only
- silent panel update
- panel emphasis update
- actionable notification

### 9.4 Deterministic explanation model
Every decision emits:
- top 3 positive contributors
- top suppression reason (if any)
- evidence IDs used
- missing signals (if low confidence)

### 9.5 Confidence behavior
- high confidence: show one primary CTA + rationale
- medium confidence: show advisory step + one-click evidence
- low confidence: suppress nudge/notification, elevate clarification/reorientation actions

### Decision rationale
- Build deterministic policy before any adaptive learning.

### Tradeoffs
- Pros: testability, explainability, low regression risk.
- Cons: less personalized ranking in early phases.

### Rejected alternatives
- opaque learned ranking in `v0.8.0`.
- random exploration-based UI surfacing.

### Failure modes to avoid
- score oscillation causing visual churn
- notification-triggering on weak/noisy signals

## 10. Surfacing Ladder Contract
### Layer contracts
1. Ambient
- always available; no modal interruption

2. Glanceable
- at most one primary CTA, one secondary advisory

3. Explainable
- "Why surfaced" and "Why suppressed" always reachable from top card/trust area

4. Trust/Privacy/Evidence
- collapsed by default, one-click open

5. Forensic
- deep details remain available but do not compete for top-card space

### Default expansion policy (`v0.8.0`)
- `trustCenter`, `timeline`, `evidence`, `details`, `moreContext`: collapsed unless high-severity conditions require emphasis token, not auto-expansion.

## 11. Trust, Privacy, and Evidence Treatment
1. Keep existing safety invariants unchanged
- click-time file/url validation
- evidence grounding checks
- strict sanitizer and consent
- no raw terminal persistence

2. Add decision-local trust chips
- "Evidence: X"
- "Privacy: local-only / consented AI"
- "Mode: restricted / active"

3. Add explainability links
- "Why am I seeing this?"
- "What did TaCoS use?"
- "What would be sent to AI?"

4. Keep all trust actions one click away
- open privacy docs
- pause/resume
- revoke consent

## 12. Restricted-Mode Behavior
1. Percolation input degradation
- no git execution signals
- no terminal command collection
- no AI refinement

2. Surface behavior
- disable risky actions with explicit reason text
- keep safe navigation actions and evidence visibility
- elevate restricted-mode chip in Layer 0/1

3. Explanation behavior
- include "restricted mode filtered these candidates" in suppression trace

## 13. Rollout Plan and Milestone Split
### `v0.8.0` must-have
1. Policy engine v1 (deterministic ranking/suppression/explanation)
2. Surface arbitration across status bar/panel/notification
3. Trust/privacy/evidence drill-down tied to surfaced decisions
4. Resume signal normalization and blocker semantics tightening
5. Metrics and integration coverage for percolation behavior

### `v0.8.x` follow-on
1. scoring weight tuning with dogfooding data
2. expanded per-signal suppression heuristics
3. copy and affordance polish
4. additional smoke/test matrix depth

### post-`v0.8` stretch
1. advanced adaptive emphasis tuning (still local-only)
2. larger experimentation harness for policy parameter sweeps

## 14. Metrics and Success Criteria
### New/extended metrics
1. `percolationDecisionCount`
2. `percolationSuppressionCount` by reason
3. `surfaceSelectionCount` by surface (`statusbar`, `panel-silent`, `panel-emphasis`, `notification`)
4. `whySurfacedOpenRate`
5. `trustTrayOpenRate`
6. `evidenceTrayOpenRate`
7. `lowConfidenceClarificationRate`
8. `primaryCtaFollowThroughRate`

### Launch-blocking targets for `v0.8.0`
1. forced-open rate in default mode does not regress vs `v0.7.0` baseline
2. notification dismiss rate does not increase release-over-release
3. primary CTA follow-through improves or remains stable
4. restricted-mode safety tests remain green
5. sanitizer and evidence safety tests remain green

### Observational metrics (not launch-blocking)
1. trust/privacy drill-down open rates
2. why-surfaced open rates
3. suppression-reason distribution

### Privacy consistency rules
- metrics remain local-only export artifacts (`.tacos/metrics.json`, `.tacos/metrics.csv`)
- no cloud telemetry introduced

## 15. Risks and Anti-Goals
### Top risks
1. policy complexity creating hard-to-debug regressions
2. over-suppression that hides useful actions
3. under-suppression causing interruption fatigue
4. trust controls becoming harder to discover
5. brittle test matrix if explanation payloads are not stable

### Anti-goals
1. omniscient dashboard sprawl
2. chat-UI pivot
3. autonomous risky actions
4. opaque ranking behavior
5. cloud-dependent personalization

## 16. Open Questions
1. Should no-change suppression be global or partition-scoped by default?
2. How long should dismissal memory persist per context hash?
3. Should low-confidence mode ever surface notifications?
4. What is the default threshold for blocker-first override vs next-step continuity?
5. How should percolation reasoning be exposed in status bar tooltip without clutter?

## 17. Definition of Done
1. Policy engine selects and explains surfaces deterministically from normalized signals.
2. Companion Home preserves stable layout while applying dynamic emphasis and one-primary CTA rule.
3. Trust/privacy/evidence remain one click away with direct links from surfaced decisions.
4. Restricted mode degrades safely with explicit rationale text.
5. Integration + unit + manual smoke coverage includes ranking, suppression, surface arbitration, and explainability paths.
6. Metrics exports include percolation fields with documented dictionary updates.
7. README and release docs reflect percolation model and calm-interruption contract.
