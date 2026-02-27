# TaCoS Roadmap v0.3.0

This document defines how `v0.3.0` scope is selected and tracks the current candidate issue set.

## Triage Rubric

Score each candidate 1-5 for the dimensions below.

| Dimension | 1 (low) | 3 (medium) | 5 (high) |
| --- | --- | --- | --- |
| ROI | Limited adoption or quality gain | Noticeable improvement for active users | Clear multiplier on adoption, trust, or reliability |
| User value | Nice-to-have | Solves a recurring pain point | Removes a top recurring blocker |
| Safety impact | Neutral | Improves one safety/trust surface | Materially improves trust/privacy/safety guarantees |
| Complexity | Small isolated change | Multi-file change with moderate coupling | Broad refactor or multi-surface rollout |
| Risk | Low regression risk | Moderate behavior regression risk | High risk or hard rollback |

Priority heuristic:

- Prefer items with high `ROI + user value + safety impact`.
- De-prioritize items with high `complexity + risk` unless they unblock a major outcome.

## Explicit Won't-Do List (For v0.3.0)

- Telemetry upload or external analytics services.
- Expanding TaCoS into non-VS Code product surfaces.
- New restore actions that bypass existing trust/safety gates.
- Marketplace/branding overhaul unrelated to product behavior.

## Candidate Issue Set

| Issue | Scope | Labels | Why it made the cut |
| --- | --- | --- | --- |
| #90 | Guided first-run setup checklist | `v0.3.0`, `roi:high`, `risk:medium` | Direct adoption and onboarding clarity impact |
| #91 | Selective restore presets + dry-run plan | `v0.3.0`, `roi:high`, `risk:medium` | Improves confidence and usability of restore workflows |
| #92 | In-extension metrics baseline snapshot command | `v0.3.0`, `roi:medium`, `risk:low` | Makes evidence-based iteration easier with low implementation risk |
| #93 | Companion nudge explainability | `v0.3.0`, `roi:medium`, `risk:low` | Improves trust and reduces perceived nudge noise |

## Notes

- Every issue in this set includes explicit acceptance criteria in the issue body.
- Scope remains intentionally small enough to keep `v0.3.0` executable.
