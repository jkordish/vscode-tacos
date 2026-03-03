# HCI and UX References

This document captures external research references used to inform TaCoS UX decisions,
especially around interruption handling, progressive disclosure, calm interaction design,
and explainability.

Use this as an evidence map, not as a hard requirement doc.

## Core References

1. Mark Weiser, John Seely Brown. "The Coming Age of Calm Technology." 1996.
   Link: https://calmtech.com/papers/coming-age-calm-technology
   Relevance: grounds the "calm by default, foreground only when necessary" interaction posture.

2. Piotr D. Adamczyk, Brian P. Bailey. "If not now, when? The effects of interruption at different moments within task execution." CHI 2004.
   Link: https://dl.acm.org/doi/10.1145/985692.985727
   Relevance: interruption timing matters; badly timed prompts impose disproportionate cost.

3. Shamsi T. Iqbal, Brian P. Bailey. "Effects of intelligent notification management on users and their tasks." CHI 2008.
   Link: https://doi.org/10.1145/1357054.1357070
   Relevance: adaptive notification strategies can reduce disruption and improve task continuity.

4. Brian P. Bailey, Joseph A. Konstan, John V. Carlis. "The Effects of Interruptions on Task Performance, Annoyance, and Anxiety in the User Interface." INTERACT 2001.
   Link: https://interruptions.net/literature.htm
   Relevance: interruptions increase task completion cost and subjective friction.

5. Erik M. Altmann, J. Gregory Trafton. "Memory for goals: An activation-based model." Cognitive Science, 2002.
   Link: https://doi.org/10.1207/S15516709COG2601_2
   Relevance: resumption depends on cues and memory activation, supporting explicit reorientation signals.

6. Erik M. Altmann, J. Gregory Trafton. "Timecourse of recovery from task interruption: Data and a model." Psychonomic Bulletin & Review, 2007.
   Link: https://doi.org/10.3758/BF03193094
   Relevance: post-interruption recovery is measurable and non-instant; UX should minimize repeated context switching.

7. Saleema Amershi et al. "Guidelines for Human-AI Interaction." CHI 2019.
   Link: https://doi.org/10.1145/3290605.3300233
   Relevance: informs transparency, confidence signaling, and one-click explainability patterns.

## TaCoS Design Mapping

- Calm ambient defaults (`status bar`, `silent panel` before escalation):
  - Weiser and Brown (1996)
  - Iqbal and Bailey (2008)

- Suppression gates and interruption-budget thinking (`quiet`, `cooldown`, `no-change`):
  - Adamczyk and Bailey (2004)
  - Bailey, Konstan, and Carlis (2001)

- Fast resume cues (`Now`, `Next`, `Blocked`, `Restore`) and continuity prompts:
  - Altmann and Trafton (2002)
  - Altmann and Trafton (2007)

- Explainability and trust affordances (`Why am I seeing this?`, Trust and Privacy tray):
  - Amershi et al. (2019)

## Notes for Maintainers

- Prefer references with stable publisher/DOI links.
- Keep the list focused on design decisions that are visible in product behavior or docs.
- If a reference informs a specific spec change, link this file from that spec section.
