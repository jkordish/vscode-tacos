# Sticky Notes + Scratchpad QA Signoff Template

Use this template to record final v0.4.0 manual signoff after running `docs/sticky-notes-qa-matrix.md`.

## Signoff Metadata

- Date:
- Tester:
- VS Code version:
- OS:
- Branch and commit:
- Trust mode(s) tested: trusted / restricted
- Workspace topology tested: single-root / multi-root / remote

## Matrix Execution Summary

| Scenario | Result (PASS/FAIL/N/A) | Notes |
| --- | --- | --- |
| Multi-root workspace isolation |  |  |
| No git / detached HEAD fallback |  |  |
| Remote workspace stability |  |  |
| Rapid branch switching |  |  |
| Rapid task-partition switching |  |  |
| Restricted mode vs trusted mode |  |  |
| Scratchpad open/edit persistence |  |  |
| Note lifecycle + UI refresh |  |  |

## Regression Checks

- Compile (`npm run compile`): PASS / FAIL
- Tests (`npm test`): PASS / FAIL
- Dark theme UI sanity: PASS / FAIL
- Light theme UI sanity: PASS / FAIL

## Findings

- P0:
- P1:
- P2:

## Final Recommendation

- Ready for merge: YES / NO
- Follow-up issues required: YES / NO
- Linked issue(s) if needed:
