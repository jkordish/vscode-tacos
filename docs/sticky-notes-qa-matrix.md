# Sticky Notes + Scratchpad QA Matrix (v0.4.0)

Issue coverage: `#115` (QA + tests), `#107`-`#112` (behavioral surfaces)

Use this checklist to validate sticky checkpoint notes and scoped scratchpad behavior before closing v0.4.0 work.

When done, copy results into: `docs/sticky-notes-qa-signoff-template.md`.

## Manual Matrix

| Scenario | Steps | Expected |
| --- | --- | --- |
| Multi-root workspace isolation | Open workspace with folders `A` + `B`. Create checkpoint note + scratchpad content in `A`; switch active root to `B` and refresh summary. | Notes/scratchpad preview from `A` do not appear in `B`; each root keeps isolated scoped state. |
| No git / detached HEAD fallback | Open non-git folder or detach HEAD. Add checkpoint note and open scratchpad. | Scope falls back safely (`default` branch handling); commands do not error; notes still persist in scoped storage. |
| Remote workspace stability | Connect to a remote workspace (SSH/Container/Codespaces). Add note, append scratchpad, reload window. | Notes and scratchpad persist and reopen correctly; no absolute local path leaks in UI labels. |
| Rapid branch switching | On git repo, switch branches `feature/a` <-> `feature/b` quickly while refreshing summaries. | Partition-scoped notes/scratchpad do not bleed across branch scopes; resume panel context follows current branch. |
| Rapid task-partition switching | Use `TaCoS: Switch Task Partition` repeatedly (`ABC-1`, `ABC-2`, clear). Add unique notes in each scope. | Notes are isolated per partition scope by default; list/open flows surface only relevant scoped notes plus workspace-global notes. |
| Restricted mode vs trusted mode | Repeat key flows in both trust modes: add/list notes, open/append scratchpad, panel actions. | Notes/scratchpad flows still work in Restricted Mode; risky execution actions remain gated/disabled. |
| Scratchpad open/edit persistence | Run `TaCoS: Open Scratchpad`, edit in real editor tab, save, reload VS Code. | Scratchpad content persists, opens in normal text editor, and panel preview updates without needing webview-only editing. |
| Note lifecycle + UI refresh | Create note, then Pin, Mark done, Dismiss, Reopen/Edit via list command and panel actions. | Lifecycle transitions apply immediately; panel rerender is stable (no flicker/jump); `Notes (N)` count and top note stay consistent. |

## Fast Verification Script (optional)

1. Create two checkpoint notes in task scope and one workspace-global note.
2. Pin one note and mark one done.
3. Open scratchpad and append selected text.
4. Trigger `TaCoS: Show Resume Brief Now`.
5. Confirm:
- `recommendedFirstAction` reflects pinned/newest open note.
- Low-confidence card is reduced when open notes exist.
- Scratchpad card shows compact preview only when scratchpad exists.
- `TaCoS: List Checkpoint Notes` actions reflect current lifecycle state.

## Automated Coverage Notes

Existing automated checks should include:
- checkpoint migration and parsing (`test/checkpoint.test.ts`)
- webview message safety/validation for note + scratchpad actions (`test/webviewMessages.test.ts`)
- standup note injection (`test/standup.test.ts`)
- metrics fields for note/scratchpad signals (`test/metrics.test.ts`)

If a matrix scenario regresses, capture:
- trust mode (`trusted` or `restricted`)
- workspace topology (single-root/multi-root/remote)
- branch + task partition values
- commands/actions used and exact expected vs actual
