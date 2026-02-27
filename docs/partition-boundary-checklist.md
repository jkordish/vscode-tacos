# Partition Boundary Reliability Checklist

Issue: `#74`

Use this checklist to validate workspace/branch/task-partition scoping behavior before closing stabilization work.

## Matrix

| Scenario | Expected |
| --- | --- |
| Branch switch (`feature/A` -> `feature/B`) | Summary/activity scope changes; no stale state bleed from prior branch. |
| Manual partition set (`ABC-123`) | Scope uses manual task partition regardless of branch naming. |
| Manual partition cleared | Scope falls back to inferred ticket (when present) or `default`. |
| Branch inference source | Prefers live git `HEAD` branch; falls back to persisted branch state safely. |
| Detached HEAD / no git info | Scope falls back to persisted branch or `default` safely. |
| Multi-root workspace | Active workspace root scoping remains isolated per root. |
| Remote workspace | Scope key generation remains stable and does not leak across roots. |

## Repro Steps

1. Open a git-backed workspace and trigger `TaCoS: Show Resume Brief Now`.
2. Create branch `feature/ABC-123-partition-a`, trigger summary, and note context.
3. Switch to branch `feature/XYZ-999-partition-b`, trigger summary again.
4. Confirm branch/task-partition scoped data changed and does not include stale entries from step 2.
5. Run `TaCoS: Switch Task Partition`, set `HOTFIX-1`, trigger summary, and confirm scoped change.
6. Clear manual partition, trigger summary, and confirm inferred/default fallback behavior.
7. Repeat after simulating missing git branch signal (detached HEAD or non-git folder) and verify safe defaulting.

## Verification Notes

- Capture any stale summary/activity evidence with exact branch + task key values.
- Record whether behavior is reproducible across restarts.
- Link resulting findings and fixes back to issue `#74`.
