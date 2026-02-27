# TaCoS Quickstart (5 Minutes)

This guide gets you from install to first useful resume summary quickly, while keeping privacy choices explicit.

## Local-Only In 60 Seconds

1. Open your project folder in VS Code.
2. Open Command Palette and run `TaCoS: Set Privacy Preset`.
3. Choose `Minimal` (recommended for first run).
4. Run `TaCoS: Resume Summary Quick`.
5. Open `TaCoS: Show Last Summary` if the panel is not already visible.

What to expect:
- You get an instant local summary (`Now`, `Next`, `Blocked`, `Restore`).
- No AI payload is sent in local mode.

## Optional AI In 2 Minutes

Use this only if you want refinement beyond local-only summaries.

1. Run `TaCoS: Configure AI Provider`.
2. Choose `VS Code LM` or `OpenAI (direct API)`.
3. If you choose OpenAI, run `TaCoS: Set OpenAI API Key`.
4. Trigger a summary again with `TaCoS: Resume Summary Quick`.
5. Review the generated `TaCoS: Review AI Payload` preview document.
6. Choose one consent action:
- `Send once`
- `Always allow in this workspace`
- `Do not send`

Default safety posture:
- `tacos.aiIncludeCheckpointNotes = false`
- `tacos.aiIncludeScratchpad = false`
- AI payload preview shows inclusion flags and redaction summary before send.

Control later:
- Run `TaCoS: Revoke AI Payload Consent` to require payload review again.
- Run `TaCoS: Configure AI Provider` and switch back to `local` at any time.
- Run `TaCoS: Test Sanitizer` to validate local redaction behavior without AI send.

## Privacy Presets (Plain Language)

Use `TaCoS: Set Privacy Preset` to switch.

| Preset | What TaCoS Uses | Typical Use |
| --- | --- | --- |
| `Minimal` | No diff, no terminal history, no debug history, local summary provider | Default safest baseline |
| `Balanced` | Terminal + debug history, no diff, local summary provider | More context without diff capture |
| `Max Context` | Terminal + debug history + diff, local summary provider | Richest local context for hard resumes |

Notes:
- Presets control local collection defaults and set provider back to `local`.
- In Restricted Mode, risky actions and AI refinement are blocked until workspace trust is granted.

## Fast Sanity Check

After setup, confirm:
- `TaCoS` status bar entry appears.
- `Companion Home` shows `Now / Next / Blocked / Restore`.
- `TaCoS: Export Local Metrics` writes `.tacos/metrics.csv` when you want local adoption metrics.

## Sticky Notes + Scratchpad (30 Seconds)

1. Run `TaCoS: Add Checkpoint Note` and capture one line for future-you.
2. Run `TaCoS: Open Scratchpad` to open the scoped scratchpad in a real editor tab.
3. Run `TaCoS: Append to Scratchpad` to append selected text (or clipboard fallback) with a timestamp divider.
4. Trigger `TaCoS: Show Resume Brief Now` and confirm the panel shows your notes/scratchpad context.

Expected:
- Checkpoint notes influence resume guidance and standup `Next`.
- Scratchpad content persists across reload/restart without creating a repo file by default.
