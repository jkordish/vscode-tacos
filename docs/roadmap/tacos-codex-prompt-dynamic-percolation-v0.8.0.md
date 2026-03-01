# Codex Prompt: Dynamic Percolation UX Program for TaCoS (`v0.8.0+`)

Use this prompt with Codex in the `jkordish/vscode-tacos` repository.

## Status (March 1, 2026)

Planning outputs and GitHub issue creation are already complete.

Canonical artifacts:
- `docs/ux/dynamic-percolation-v0.8.0-spec.md`
- `docs/ux/dynamic-percolation-mockups.md`
- `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
- live issues `#225-#259` (epics `#225-#229`)

Use this prompt as historical planning input. For implementation, execute the existing issues rather than rerunning this prompt to generate a second issue set.

---

## Prompt for Codex

You are operating inside the `jkordish/vscode-tacos` repository.

Your job is **not** to code the feature yet. Your job is to do a **serious product + technical planning pass** and then produce a **full GitHub issue program** for a future TaCoS release train targeted at **`v0.8.0+`**.

This is a strategic UX program, not a patch. Treat it like a product architecture effort with implementation consequences.

The concept to operationalize is:

> **Dynamic Percolation UX for TaCoS**
>
> TaCoS currently has strong functionality, but the UX risks feeling like “everything everywhere all at once.” We want TaCoS to become more dynamic and context-aware: information that is likely relevant should **percolate upward** when needed, while lower-priority detail remains hidden by default and available instantly on demand. Evidence, privacy, and trust posture must remain visible enough to preserve confidence, but they should usually live behind calm, low-friction affordances instead of occupying prime screen real estate all the time.

The point is to make TaCoS feel:
- **calm, not chatty**
- **adaptive, not chaotic**
- **transparent, not noisy**
- **useful in 5 seconds**
- **deep in 1 click**
- **safe by construction**

You must inspect the repo, understand the current implementation, then create:
1. one or more **large epics**
2. a **maximally useful set of child issues** beneath them
3. supporting planning docs with **reasoning, tradeoffs, diagrams, mockups, success metrics, and sequencing**

Do this with real rigor. No hand-wavy product fluff. No “AI vibes.” No cargo-cult PM sludge.

---

## Why this matters

TaCoS already has the right ingredients:
- local-first summaries
- evidence-grounded links and revalidation
- privacy presets and retention controls
- workspace trust restrictions
- companion cards / timeline / recap / Trust Center concepts
- status bar and notification surface choices
- metrics export and integration tests

But the current direction risks a common failure mode:

> **A tool that is individually thoughtful, but cumulatively heavy.**

The goal of Dynamic Percolation UX is to fix that by making the UI surface area **policy-driven** instead of static.

Do **not** interpret this as “hide everything.” The goal is:
- promote the most relevant signal for the current moment
- suppress irrelevant detail until requested
- preserve user trust with easy-access transparency
- minimize interruptions and forced clicks
- keep spatial and conceptual stability so the product does not feel like it is rearranging itself every 10 seconds

---

## Repo context you must ground yourself in first

Before planning anything, inspect at minimum:

### Product / docs
- `README.md`
- `docs/companion-v1-spec.md`
- `docs/privacy-safety.md`
- `docs/manual-smoke-runbook.md`
- `docs/integration-test-harness.md`
- `docs/acceptance-report.md`
- `CHANGELOG.md`

### Extension manifest / configuration
- `package.json`

### Core source areas
At minimum inspect the files that define:
- extension activation and UI rendering
- summary presentation
- webview rendering
- companion / panel / status bar behavior
- noise control / cooldown logic
- timeline logic
- checkpoint capture
- metrics export
- privacy / trust / restore safety
- evidence link handling
- provider flow / LLM validation / redaction / persistence

Likely candidates include:
- `src/extension.ts`
- `src/noiseControl.ts`
- `src/timeline.ts`
- `src/checkpoint.ts`
- `src/llm.ts`
- `src/redaction.ts`
- `src/activityPersistence.ts`
- `src/restoreSafety.ts`
- `src/pathSafety.ts`
- `src/webviewSecurity.ts`
- relevant tests in `test/`

Read the code before writing issues. The issue program must be repo-aware, not generic.

---

## Product thesis to encode

Treat the new direction as a **percolation model**, not a dashboard model.

### Core idea
TaCoS should maintain a richer internal understanding of relevant state than it shows at any given moment.

The UI should expose information in layers:

#### Layer 0: Ambient
Subtle status and lightweight signals.
Examples:
- status bar summary
- compact badge / chip state
- passive freshness / blocked / trust indicators

#### Layer 1: Glanceable
The 5-second “what matters now?” surface.
Examples:
- `Now`
- `Next`
- `Blocked`
- `Restore`
- single primary nudge if confidence is high

#### Layer 2: Explainable
Why TaCoS surfaced this and what evidence it used.
Examples:
- “Why am I seeing this?”
- “Based on: X files, Y runs, branch Z”
- recent changes since last time

#### Layer 3: Trust / Privacy / Evidence Controls
Always reachable, usually collapsed.
Examples:
- Trust Center
- privacy posture
- retention state
- what is stored locally
- what would be sent to AI
- payload preview / consent affordance
- grouped evidence list

#### Layer 4: Forensic Detail
Deeper traceability for power users and debugging.
Examples:
- grouped timeline
- full evidence catalog
- diagnostics / metrics
- raw-ish local provenance views where safe

The new UX should **percolate upward** only what is relevant for the current task state.

---

## What “dynamic percolation” means in practice

The system should be able to decide what deserves promotion based on signals such as:
- return-from-idle / focus regained
- workspace switch
- branch switch
- meaningful file changes
- commit created
- failed command / failed task / failed debug run
- new checkpoint note or edited note
- updated intent / correction hint
- restore-related context gaps
- blockers inferred from recent work
- CLI-heavy work
- large diff or large divergence since last summary
- privacy mode / trust mode changes
- AI consent state changes

The system should rank candidate surfaced items using deterministic or at least inspectable logic.

Potential ranking features include:
- recency
- confidence
- severity / urgency
- unblock potential
- continuity gap
- novelty
- user intent alignment
- actionability
- privacy sensitivity
- interruptiveness cost
- whether the user has recently dismissed / ignored similar surfacing

The output should not merely be “show card / hide card.”
It should decide things like:
- what goes in the top card
- which quick action becomes primary
- whether to surface a nudge at all
- whether evidence/privacy chips should visually elevate
- whether a status bar change is enough
- whether a notification is justified
- whether the panel should update silently vs foreground
- whether sections should start collapsed vs expanded
- whether a confidence explanation should be elevated

---

## Research / design guardrails

You must explicitly use these principles in your reasoning and in the resulting issue bodies.

### 1. Progressive disclosure
TaCoS should show the most important thing now and defer deeper/rarely-needed detail until requested.

### 2. Calm technology
The default mode should live in the user’s periphery and only move to the center of attention when justified.

### 3. Interruptions are expensive
Avoid attention theft, repeated prompts, and forced-click workflows.

### 4. Adaptive UI must remain stable
Adapt **priority and emphasis** more than raw layout churn. Do not create a system that constantly moves furniture around and destroys spatial memory.

### 5. Trust must be close at hand
Evidence, privacy, and restricted-mode constraints should never feel hidden in a deceptive way. They should be **one click away**, plainly labeled, and easy to inspect.

### 6. VS Code native-feel matters
Respect VS Code extension UX guidance. TaCoS should feel like a high-quality citizen of the workbench, not a mini web app squatting in the editor.

---

## Non-negotiable existing constraints

The new roadmap must preserve and extend these repo truths:

1. **Local-first UX remains the baseline**
   - local summary first
   - optional AI refinement later

2. **All model output is untrusted**
   - evidence-grounded only
   - revalidate on click
   - no unsafe links or paths

3. **Privacy-first remains intact**
   - redact before persistence
   - never persist raw terminal commands
   - explicit AI payload preview / consent

4. **Workspace Trust remains first-class**
   - restricted mode disables risky collection and risky actions
   - percolation behavior must degrade safely in restricted mode

5. **Fast + quiet stays mandatory**
   - cooldowns, debounce, caching, bounded expensive ops
   - dynamic surfacing must not become jittery or spammy

Do not create issues that violate these constraints.
If an idea conflicts with them, the idea loses.

---

## Strategic framing for `v0.8.0+`

This is not a `v0.3.x` polish pass.
Treat Dynamic Percolation UX as a **future shaping release train** that lands in `v0.8.0` and continues in `v0.8.x+`.

Your output should distinguish:
- **`v0.8.0 must-have`**
- **`v0.8.x follow-on`**
- **`post-v0.8` experimental / stretch**

A good default assumption:
- `v0.8.0` = the first coherent Dynamic Percolation release
- `v0.8.x` = tuning, rollout, experiment follow-ups, and polish
- `v0.9.0+` = anything that requires more speculative intelligence or bigger architecture changes

If code reality suggests a different split, explain why and adjust.

---

## Deliverables you must produce

You must produce **all** of the following.

### A. One planning/spec document
Create a markdown document such as:

- `docs/ux/dynamic-percolation-v0.8.0-spec.md`

This document must include:
1. problem statement
2. product thesis
3. user archetypes / scenarios
4. current-state audit of TaCoS UX
5. pain points / failure modes
6. design principles
7. information architecture
8. state model
9. percolation policy model
10. surfacing ladder (ambient -> glanceable -> explainable -> forensic)
11. trust/privacy/evidence treatment
12. restricted-mode behavior
13. rollout plan
14. metrics and success criteria
15. risks / anti-goals
16. open questions
17. definition of done

### B. One visual design companion doc
Create a markdown document such as:

- `docs/ux/dynamic-percolation-mockups.md`

It must include:
- ASCII mockups and/or Mermaid diagrams
- at least one “current vs proposed” comparison
- at least one information architecture diagram
- at least one signal-to-surface flow diagram
- at least one state machine or event flow diagram
- at least one prioritized card / panel wireframe
- at least one Trust / Privacy / Evidence drill-down mockup
- at least one notification-vs-statusbar decision flow
- at least one restricted-mode rendering example

### C. One roadmap / issue inventory doc
Create a markdown document such as:

- `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`

This doc should contain:
- epic hierarchy
- issue hierarchy
- dependencies
- sequencing
- milestone recommendation
- labels recommendation
- rough implementation order
- “must-have vs follow-on vs stretch” categorization

### D. Actual issue bodies
If GitHub CLI/auth is available and permitted, create the actual issues.
If not, generate issue-ready markdown files or a single issue catalog doc with copy/paste-ready issue bodies.

Each issue must be real, concrete, and implementation-oriented.

---

## Epic architecture you should aim for

Start from the following proposed structure, but adapt if the repo strongly suggests a better split.

### Epic 1: Percolation Policy Engine
Purpose:
- Introduce the logic that ranks and promotes context instead of statically rendering everything.

Likely issue themes:
- signal model and percolation policy spec
- candidate surfaced-item schema
- ranking and suppression rules
- confidence model
- deterministic explanation model (“why surfaced”)
- persistence of user dismissals / learned suppression where appropriate
- quiet-hours and cooldown integration
- testing for deterministic ranking / suppression

### Epic 2: Adaptive Surface Architecture
Purpose:
- Reshape the UI around progressive disclosure and stable hierarchy.

Likely issue themes:
- redefine panel/home hierarchy
- top-card prioritization
- section default collapse/expand rules
- status bar compaction
- nudge presentation rules
- notification minimization policy
- affordances for “see more” without visual clutter
- preserving layout stability while changing emphasis
- theme/accessibility pass

### Epic 3: Trust, Privacy, Evidence, and Explainability
Purpose:
- Make confidence and transparency easy to inspect without forcing them to dominate the main surface.

Likely issue themes:
- one-click evidence drill-down
- one-click privacy/trust drill-down
- “why am I seeing this?” view
- AI payload preview linkage
- retention and storage summary chip/card
- trust mode / restricted mode elevation rules
- evidence counts and provenance rendering
- copy and terminology cleanup for transparency surfaces

### Epic 4: Work Signal Ingestion and Resume Semantics
Purpose:
- Improve detection of what changed in the user’s actual workflow so percolation is earned, not decorative.

Likely issue themes:
- git event interpretation (commit, branch switch, divergence)
- CLI/task/debug failure and success semantics
- checkpoint note / intent update integration
- “changes since last time” precision improvements
- work partition switch consequences
- blocker detection / unblock opportunity model
- better resume trigger taxonomy
- context hash / no-change suppression improvements

### Epic 5: Metrics, Experimentation, and Release Validation
Purpose:
- Prove the UX works and does not just sound good in issue bodies.

Likely issue themes:
- event instrumentation for percolation decisions
- metrics schema expansion
- action follow-through analysis
- “forced-open” and interruption budget metrics
- local experiment toggles / feature flags
- integration tests for surfacing policy
- manual smoke additions
- dogfooding and validation report
- rollout / release checklist

### Epic 6: Adoption, Onboarding, and Delight
Purpose:
- Make the calmer UX legible and desirable so users want to keep the extension installed.

Likely issue themes:
- setup checklist refresh
- walkthrough improvements
- “aha moment” first-run flow
- better empty states
- smarter defaults
- copy polish for commands / settings
- discoverability of trust/privacy without intimidation
- docs and screenshots updates for marketplace/readme

If your repo audit shows these should collapse into 4 or 5 epics instead of 6, do that. But do not under-scope the child issue set.

---

## Issue count expectations

Do **not** produce a tiny roadmap.

Aim for:
- **4-6 epics**
- **25-45 child issues total**
- enough granularity that implementation can proceed in parallel without vague mega-issues

Each child issue should be small enough to finish in one focused implementation thread, but large enough to mean something.

Avoid these two bad patterns:
1. uselessly broad issues like “Improve UX”
2. trivial atomization like “Rename one button label”

---

## Required structure for each epic

Each epic must include:

1. **Title**
2. **Problem**
3. **Why now**
4. **Outcome / user value**
5. **In scope**
6. **Out of scope**
7. **Dependencies**
8. **Success metrics**
9. **Risks**
10. **Definition of done**
11. **Suggested milestone**
12. **Suggested labels**
13. **Child issue list**

---

## Required structure for each child issue

Each child issue must include:

1. **Title**
2. **Parent epic**
3. **Problem**
4. **Why this matters**
5. **Proposal**
6. **Implementation notes**
7. **Acceptance criteria**
8. **Test plan**
9. **Telemetry / metrics impact**
10. **Risks / edge cases**
11. **Dependencies**
12. **Suggested labels**
13. **Suggested milestone**
14. **If relevant: screenshots / diagrams / mockup reference**

Where relevant, include:
- touched files or likely touched modules
- config flags to add or update
- migration/backward-compatibility notes
- restricted-mode behavior notes
- performance constraints
- privacy constraints
- copywriting or docs implications

---

## Required reasoning style

Do **not** provide hidden chain-of-thought.
Do provide **explicit reasoning artifacts**.

For every epic and major issue cluster, include:
- assumptions
- tradeoffs
- alternatives considered
- failure modes
- why this slice belongs in `v0.8.0` vs `v0.8.x` vs later

I want the work to be explainable, not mystical.

Use sections such as:
- “Decision rationale”
- “Tradeoffs”
- “Rejected alternatives”
- “Failure modes to avoid”

That gives durable engineering reasoning without pretending certainty.

---

## Specific product decisions you should pressure-test

As part of your audit and resulting issues, explicitly decide or create issues for deciding:

1. **What is always visible vs hidden by default?**
2. **What can percolate upward automatically?**
3. **What requires explicit user action to reveal?**
4. **How does evidence stay close without cluttering the top surface?**
5. **How does privacy/trust stay visible without feeling like compliance wallpaper?**
6. **When is a notification justified vs a status bar update vs a silent panel refresh?**
7. **How do we avoid layout thrash / moving targets?**
8. **How do we explain why TaCoS surfaced a thing?**
9. **How do we handle low-confidence states gracefully?**
10. **How do we degrade in restricted mode?**
11. **What metrics prove the calmer UX is actually better?**
12. **How do we preserve user agency and avoid surprise?**

If the current code already partially answers some of these, capture that and plan around it instead of reinventing it.

---

## Concrete UX concepts you should evaluate and likely issue-ize

These are candidate concepts. Validate them against the repo and then convert the good ones into issues.

### Percolation concepts
- percolation policy engine / scorecard
- surfaced-item registry
- “why surfaced” explanation object
- primary/secondary nudge ranking
- confidence gating and suppression
- dismissal and snooze semantics
- no-change / low-signal suppression

### Surface concepts
- compact top summary with rotating priority slots
- section priority ordering driven by work state
- collapsible evidence/privacy trays
- confidence / trust / privacy chips
- expandable “changes since last time”
- dynamic emphasis without changing the whole layout
- ambient status bar with stronger but rare elevation path

### Trust / explainability concepts
- one-click “Why am I seeing this?”
- one-click “What did TaCoS use?”
- one-click “What is stored / what could be sent?”
- confidence explanation and missing-signal explanation
- restricted-mode differences called out directly

### Resume intelligence concepts
- git commit as a context checkpoint
- branch switch as a likely intent change
- task/debug/test failure as blocker promotion
- new checkpoint note as intent override
- correction hint as ranking prior
- last meaningful action and next best action relationship

### Adoption concepts
- calmer first-run defaults
- walkthrough that explains “ambient vs detailed” model
- screenshot refresh
- marketplace positioning around calm, trusted, local-first resume intelligence
- docs that show power without scaring users

---

## Mockups and diagrams requirements

Your visual companion doc must include at least these.

### 1. Information architecture
Show layers:
- ambient
- glanceable
- explainable
- trust/privacy/evidence
- forensic

### 2. Signal -> policy -> surface flow
Example Mermaid idea:
- source signals
- normalization
- ranking
- suppression
- selected surfaced items
- rendered surfaces

### 3. Event-state model
Example states:
- idle
- refreshing
- stable
- high-confidence suggestion available
- blocked
- restricted
- paused
- low-confidence / needs clarification

### 4. Default panel mockup
Show:
- top card
- Now / Next / Blocked / Restore
- secondary chips
- hidden evidence/privacy tray
- optional timeline collapsed below the fold

### 5. Trust / Privacy / Evidence quick drill-down
Show a one-click disclosure surface.

### 6. Notification decision flow
When to:
- show nothing
- status bar update only
- update panel silently
- show an actionable notification

### 7. Restricted Mode rendering
Show how risky actions disappear or disable and how the UI explains why.

ASCII is fine. Mermaid is preferred where useful. Clarity beats artistry.

---

## Metrics you should design around

Build issues around measurable improvement.

At minimum define or extend metrics for:
- time to first meaningful action after resume
- forced-open count / forced-click count
- notification rate
- notification dismiss rate
- action follow-through rate
- top-card interaction rate
- evidence drill-down open rate
- privacy/trust drill-down open rate
- “why surfaced” open rate
- low-confidence clarification rate
- suppression rate / quiet-hours suppression
- no-change refresh suppression
- helpfulness rating by surfacing mode
- restricted-mode comprehension (proxy metric if possible)
- opt-out / pause / snooze / disable events

You may add better metrics if the repo supports them.

The roadmap should also define:
- which metrics are launch-blocking for `v0.8.0`
- which are observational only
- how local-only metrics remain privacy-consistent

---

## Safety, trust, and privacy requirements for issues

Every issue that touches surfacing logic must consider:
- evidence grounding
- click-time validation
- privacy preset interactions
- AI consent / payload preview implications
- restricted mode
- storage / retention effects
- performance / cooldown implications

If an issue impacts any of those, say so explicitly in the issue body.

---

## Quality bar for the resulting issues

The finished issue program should feel like it was written by:
- a staff+ product engineer
- who read the code
- who understands VS Code extension ergonomics
- who respects privacy/security constraints
- and who knows that attention is a precious resource rather than free inventory

The roadmap should make a maintainer think:

> “This is implementable, sequenced, defensible, and worth doing.”

Not:

> “This is a pile of UX adjectives with no execution path.”

---

## Suggested output order

Work in this order:

1. Audit current repo UX and architecture
2. Write the planning/spec doc
3. Write the mockups/diagrams doc
4. Draft epic hierarchy
5. Draft child issue hierarchy
6. Classify by `v0.8.0` / `v0.8.x` / `post-v0.8`
7. Create issue bodies
8. If permitted, create GitHub issues
9. Produce a final summary mapping epics -> issues -> files/docs created

---

## Final report format

At the end, produce a concise final summary containing:

### Summary
- what you created
- how many epics
- how many child issues
- how they are split by milestone

### Key design call
State the central call in one sentence.
For example:
- “TaCoS should adapt emphasis, not constantly rearrange structure.”

### Deliverables
List created docs and issues.

### Risks to watch
List the top 3-5 risks.

### Recommended first implementation slice
Name the smallest, highest-leverage set of issues that should land first.

---

## Additional context from the existing repo direction

The repo already points in the right direction. You should treat the existing companion work as an ancestor, not a finished answer.

Known repo-level signals include:
- TaCoS is positioned as a VS Code extension that helps users resume work quickly with local-first summaries, evidence-backed next steps, and optional AI refinement.
- Current docs already describe companion home sections (`Now`, `Next`, `Blocked`, `Restore`), confidence-gated nudges, session recap, Trust Center, timeline, and local-only metrics.
- `package.json` currently reports version `0.3.0`, with configuration for `uiSurface`, timeline visibility, quiet hours, privacy presets, retention, companion nudge aggressiveness, and summary provider selection.
- Existing docs explicitly preserve restricted-mode behavior, privacy-first storage, local metrics, and evidence-grounded link safety.

Use that as the baseline. The job is to evolve it into a more coherent dynamic percolation model.

---

## References you should respect while planning

Use these as planning anchors when writing rationale. You do not need to quote them heavily, but you should align with them.

### Repo / product sources
- `README.md`
- `docs/companion-v1-spec.md`
- `docs/privacy-safety.md`
- `docs/manual-smoke-runbook.md`
- `package.json`

### VS Code official UX guidance
- UX Guidelines overview
- Status Bar guidance
- Notifications guidance
- Views / Sidebars / Webviews guidance
- Walkthroughs guidance

### Research / theory anchors
- Progressive disclosure as a way to reduce complexity and error
- Calm technology and peripheral awareness
- interruption / context-switch cost research
- adaptive UI findings suggesting adaptation should be careful and stable rather than visually erratic

When in doubt, favor:
- stable hierarchy
- fewer interruptions
- one-click transparency
- deterministic behavior
- visible control
- low-regret defaults

---

## Hard anti-goals

Do **not** let the roadmap drift into these traps:

1. a giant omniscient dashboard
2. a chat UI redesign
3. autonomous risky action execution
4. surfacing logic that is impossible to explain
5. notifications as the default answer
6. hiding trust/privacy so thoroughly that users feel tricked
7. perpetual layout churn
8. “personalization” that depends on cloud identity or sync
9. speculative ML ranking before deterministic policy is solid
10. issues that are too vague to assign

---

## One-line north star

Use this as the north star for issue wording and decision-making:

> **TaCoS should feel like a calm, trustworthy resume companion that surfaces the right thing at the right moment, keeps proof and privacy one click away, and never makes the user pay for intelligence with clutter or surprise.**

Now do the work.

---

## Optional issue title seed list

Use these only if helpful after the repo audit. Improve them if the code suggests better naming.

### Epic candidates
- EPIC: Dynamic Percolation UX for TaCoS (`v0.8.0`)
- EPIC: Percolation policy engine and explainable surfacing
- EPIC: Progressive disclosure refresh for TaCoS companion surfaces
- EPIC: Trust, privacy, and evidence quick-drill UX
- EPIC: Resume semantics and work-signal ranking
- EPIC: Dynamic percolation metrics, rollout, and validation
- EPIC: First-run adoption and calm discoverability refresh

### Child issue candidates
- Define surfaced-item schema and percolation score inputs
- Implement deterministic percolation ranking pipeline
- Add explainable “why surfaced” payload and UI
- Add suppression rules for low-signal and no-change refreshes
- Rework default companion panel hierarchy around top-priority slots
- Convert evidence details into a collapsed quick-drill tray
- Convert privacy/trust details into a collapsed quick-drill tray
- Add confidence / trust / privacy summary chips
- Introduce notification decision policy and telemetry
- Compact status bar messaging and action budget
- Promote task/debug/test failure into blocker-aware ranking input
- Promote git commit / branch switch into resume semantic inputs
- Integrate checkpoint notes and correction hints into ranking
- Improve “changes since last time” precision and surfacing rules
- Add restricted-mode-specific rendering and copy pass for percolated surfaces
- Expand metrics for interruption cost and follow-through
- Add integration tests for ranking, suppression, and surface selection
- Add manual smoke scenarios for dynamic percolation
- Refresh onboarding walkthrough around ambient vs detailed model
- Refresh marketplace docs/screenshots for calm trusted UX

---

## Optional deliverable filenames

Use these if you want a clean structure:

- `docs/ux/dynamic-percolation-v0.8.0-spec.md`
- `docs/ux/dynamic-percolation-mockups.md`
- `docs/roadmap/v0.8.0-dynamic-percolation-issues.md`
- `docs/roadmap/v0.8.0-dynamic-percolation-gh-commands.sh`
