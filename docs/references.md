# TaCoS Research References

This document is the evidence map for TaCoS design decisions that are visible in product behavior.

TaCoS is not trying to automate engineering judgment away. The design target is state recovery for interruption-heavy engineers, with calm, explainable, user-controlled behavior.

## Core Canon

1. Sophie Leroy. "Why is it so hard to do my work? The challenge of attention residue when switching between work tasks." 2009.
   Link: https://doi.org/10.1287/orsc.1080.0415
   Relevance: unfinished tasks contaminate the next task. TaCoS uses structured checkpoints and explicit task resolution to reduce carryover cost.

2. Erik M. Altmann, J. Gregory Trafton. "Memory for goals: An activation-based model." 2002.
   Link: https://doi.org/10.1207/S15516709COG2601_2
   Relevance: resumption is a goal-retrieval problem. TaCoS captures prospective goal state, next action, and retrieval cues instead of relying on summary text alone.

3. Erik M. Altmann, J. Gregory Trafton. "Timecourse of recovery from task interruption: Data and a model." 2007.
   Link: https://doi.org/10.3758/BF03193094
   Relevance: recovery is not instantaneous. TaCoS prioritizes fast orientation and safe verification before execution.

4. Christopher A. Monk, J. Gregory Trafton, Deborah A. Boehm-Davis. "The effect of interruption duration and demand on resuming suspended goals." 2008.
   Link: https://doi.org/10.1177/0018720808093430
   Relevance: interruption length and demand affect recovery. TaCoS preserves simple prospective cues early so they survive longer interruptions.

5. Piotr D. Adamczyk, Brian P. Bailey. "If not now, when? The effects of interruption at different moments within task execution." CHI 2004.
   Link: https://dl.acm.org/doi/10.1145/985692.985727
   Relevance: interruption timing matters. TaCoS offers checkpoint prompts at likely boundaries rather than arbitrary mid-flow moments.

6. Shamsi T. Iqbal, Brian P. Bailey. "Effects of intelligent notification management on users and their tasks." CHI 2008.
   Link: https://doi.org/10.1145/1357054.1357070
   Relevance: notification timing and management change disruption cost. TaCoS uses conservative, dismissible, likely-boundary prompting with quiet/cooldown/noise controls.

7. Chris Parnin, Spencer Rugaber. "Resumption strategies for interrupted programming tasks."
   Link: https://faculty.cc.gatech.edu/~spencer/papers/resumption-strategies.pdf
   Relevance: programmers recover by reconstructing task context from cues, artifacts, and chronology. TaCoS preserves working set, breakpoint, blockers, and intent.

8. Robert DeLine, Chris Parnin. "Evaluating Cues for Resuming Interrupted Programming Tasks." 2010.
   Link: https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/
   Relevance: timeline and evidence cues can outperform pure summary. TaCoS Resume Brief v2 explicitly surfaces chronology, evidence, and retrieval cues.

9. "TaCoS: Generated Context Summaries for Task Resumption." ICSE 2026.
   Link: https://hasel.dev/publications/
   Relevance: TaCoS-specific evidence suggests summaries help, but evidence and timeline cues can outperform summary-only recovery. This directly motivated Resume Brief v2 and Cognitive Debrief.

10. "Interruptibility of software developers and its prediction using psycho-physiological sensors: a replication."
    Link: https://dl.acm.org/doi/10.1145/3544548.3580865
    Relevance: do not build biometrics-based or pseudo-scientific interruptibility prediction. TaCoS explicitly avoids those features.

11. Saleema Amershi et al. "Guidelines for Human-AI Interaction." CHI 2019.
    Link: https://doi.org/10.1145/3290605.3300233
    Relevance: informs calm, explainable, dismissible, correctable, user-controlled behavior and explicit AI payload review.

12. Raja Parasuraman, Victor Riley. "Humans and Automation: Use, Misuse, Disuse, Abuse." 1997.
    Link: https://doi.org/10.1518/001872097778543886
    Relevance: over-automation creates misuse and disuse risk. TaCoS automates retrieval and orientation, not engineering judgment.

13. Raja Parasuraman, Thomas B. Sheridan, Christopher D. Wickens. "A model for types and levels of human interaction with automation." 2000.
    Link: https://doi.org/10.1109/3468.844354
    Relevance: automation level matters. TaCoS stays low on the ladder: recover context, suggest verification, leave execution to the user.

14. Nicole Forsgren, Eirini Kalliamvakou, Abi Noda, Michaela Greiler, Brian Houck, Margaret-Anne Storey. "The SPACE of Developer Productivity." 2021.
    Link: https://queue.acm.org/detail.cfm?id=3454124
    Relevance: developer productivity is multi-dimensional; "time spent on unplanned work or rework" and context switching are measurable proxies. Supports TaCoS local metrics design.

15. Meyer et al. "Today Was a Good Day: The Daily Life of Software Developers." 2019.
    Link: https://doi.org/10.1109/TSE.2017.2734581
    Relevance: "Mind the Gap" / developer diary study showing that more-interruptions-than-usual predicts lower self-rated productivity while fewer-interruptions-than-usual predicts higher. Supports local per-session friction scoring and noise budget targets.

16. Gonçalves et al. "An empirical study of the effects of interruptions on software engineering activities." ICSE'24.
    Link: https://doi.org/10.1145/3597503.3639219
    Relevance: controlled lab study showing that high-dominance on-screen interruptions increase comprehension time, and that subjective stress ratings can diverge from physiological measures. Reinforces conservative interruptibility thresholds and warns against over-trusting self-report.

## Supporting References

1. Mark Weiser, John Seely Brown. "The Coming Age of Calm Technology." 1996.
   Link: https://calmtech.com/papers/coming-age-calm-technology
   Relevance: supports TaCoS ambient-to-deep posture and low-noise defaults.

2. Brian P. Bailey, Joseph A. Konstan, John V. Carlis. "The Effects of Interruptions on Task Performance, Annoyance, and Anxiety in the User Interface." 2001.
   Link: https://interruptions.net/literature.htm
   Relevance: interruptions impose measurable cost and annoyance, reinforcing quiet-by-default product posture.

## Product Mapping

### Structured Task Checkpoints

- Leroy (2009): explicit closure matters, so TaCoS includes `Mark Task Resolved`.
- Altmann and Trafton (2002), Monk et al. (2008): capture prospective goal state before it decays.
- Parnin and Rugaber: capture intent, artifacts, and next step instead of only a text note.

Implemented mapping:

- typed task-state schema
- manual-first capture flow
- editable structured checkpoint storage
- objective, blockers, assumptions, working set, safe breakpoint, and next action

### Deterministic Likely-Switch Prompting

- Adamczyk and Bailey (2004), Iqbal and Bailey (2008): prompts should happen at boundaries.
- Interruptibility replication: avoid unsupported prediction gimmicks.
- Amershi et al. (2019): prompts must be explainable and dismissible.

Implemented mapping:

- focus-return idle, workspace, partition, branch, and manual-confirm signals
- file-cluster drift as supporting evidence only
- `Capture / Skip / Snooze / Dismiss`
- diagnostics reason codes and suppression reasons

### Resume Brief v2

- Altmann and Trafton (2007): recovery takes time, so orientation quality matters.
- DeLine and Parnin (2010): timeline and evidence cues matter for resumption.
- TaCoS preprint: evidence/timeline cues can outperform summary-only recovery.

Implemented mapping:

- `What you were doing`
- `What changed since`
- `Next likely safe move`
- `Open questions / unresolved blockers`
- `Timeline / evidence / retrieval cues`

### Cognitive Debrief

- Leroy (2009): unfinished tasks create residue, so abandoned/stale work should be surfaced for closure.
- Altmann and Trafton (2002): unresolved goals remain cognitively expensive without explicit recovery cues.
- Parasuraman and Riley (1997): surface orientation and closure opportunities, not performance theater.

Implemented mapping:

- abandoned threads
- repeated-switch tasks
- stale task state
- unresolved blockers
- open assumptions

### Human-AI and Agency Boundaries

- Amershi et al. (2019): one-click explainability, explicit review, correctable prompts.
- Parasuraman and Riley (1997), Parasuraman et al. (2000): automate retrieval/orientation, not judgment/execution.

Implemented mapping:

- optional AI refinement
- explicit AI payload preview and consent
- model output remains untrusted
- no hidden actions
- no autonomous execution runner

## Product Mapping (Additions)

### Local Friction Metrics and Noise Budget

- Meyer et al. (2019): daily diary evidence that more-interruptions-than-usual is a negative productivity predictor; supports per-session noise budget targets and friction scoring.
- Gonçalves et al. (ICSE'24): high-dominance interruptions inflate comprehension time; corroborates conservative mid-task suppression and reinforces quiet-by-default posture.
- SPACE (2021): supports multi-dimensional local metrics exports (lag, friction, follow-through, suppression health) as first-class product concerns rather than vanity metrics.

## Maintainer Notes

- Prefer stable DOI, ACM, arXiv, or publisher links.
- If a feature claim changes product behavior, update this file and link the relevant section from `SPECS.md` or design docs.
- If a proposed feature feels creepier, louder, or more magical than the research justifies, cut it.
