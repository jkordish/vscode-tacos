# Smoke Report - 2026-02-26

## Automated Gates (Local)

All of the following passed on branch `feature/epic-must-have-tracking`:

- `npm run compile`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:integration`
- `npx @vscode/vsce package --no-dependencies`

## Trusted / Restricted Manual Smoke

Manual Extension Host verification requires interactive VS Code UI and is not executed in this terminal-only run.

Detailed step-by-step runbook:

- `docs/manual-smoke-runbook.md`

### Trusted Workspace Checklist

- [ ] Edit files, run task/test, trigger resume.
- [ ] Confirm instant local summary.
- [ ] Confirm optional AI refinement updates in-place.
- [ ] Confirm evidence links open safely.
- [ ] Confirm Restore Pack actions work.

### Restricted Mode Checklist

- [ ] Confirm no git execution.
- [ ] Confirm no terminal scraping.
- [ ] Confirm risky restore actions are disabled.
- [ ] Confirm local summary still works.

## Notes

Code-level guardrails for trusted/restricted behavior, CSP, link safety, path safety, redaction, and provider validation are covered by unit tests in `test/`.
