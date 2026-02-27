# Release 0.5.0 Checklist

Use this checklist to prepare, tag, and publish the `v0.5.0` release.

## 1) Scope Lock

- [x] Confirm only `v0.5.0` epic scope is included.
- [x] Confirm child issues #118-#126 are completed and linked to epic #117.
- [x] Confirm out-of-scope items remain out of this release (no cloud sync/telemetry upload/secret-manager features).

## 2) Feature Track Completion

- [x] #118 Redaction engine v2: modes + reporting + safe replacements
- [x] #119 Expand default detectors: common tokens + headers + Windows paths
- [x] #120 Hardening custom `tacos.redactionPatterns`: bounded, safe, non-footgun
- [x] #121 Strict AI-boundary sanitizer: high-risk detection + fail-closed gating
- [x] #122 UX: redaction visibility + `TaCoS: Test Sanitizer` + note-change warnings
- [x] #123 AI payload preview + consent: include/exclude toggles + redaction report
- [x] #124 Config: safe-by-default settings for AI inclusion of notes/scratchpad + sanitize mode
- [x] #125 Metrics: aggregate-only counters for redaction + blocked sends (local export)
- [x] #126 Tests + docs + issue templates: security-first rollout
- [x] #117 Epic closure (post-merge)

## 3) Versioning + Changelog

- [x] Update `package.json` version to `0.5.0`.
- [x] Update `package-lock.json` to `0.5.0` package metadata.
- [x] Add `v0.5.0` section to `CHANGELOG.md` with security-first rollout highlights.
- [x] Confirm release notes emphasize trust boundaries and limitations (risk reduction, not guarantee).

## 4) Verify Gates

- [ ] `npm run verify`
- [ ] Confirm CI checks are green on release prep PR.
- [ ] Smoke-check key commands in VS Code:
  - `TaCoS: Test Sanitizer`
  - `TaCoS: Revoke AI Payload Consent`
  - `TaCoS: Copy Prompt and Open Codex` (strict sanitize boundary)
  - `TaCoS: Add Checkpoint Note` and `TaCoS: Append to Scratchpad` (redaction-change UX)

## 5) Docs + Safety Artifacts

- [x] Confirm `docs/privacy-safety.md` reflects fail-closed AI boundary and safe defaults.
- [x] Confirm `docs/quickstart.md` calls out AI inclusion opt-in for checkpoint/scratchpad.
- [x] Confirm `docs/metrics.md` includes aggregate-only sanitizer counters.
- [x] Confirm privacy-safe issue templates exist under `.github/ISSUE_TEMPLATE/`.

## 6) Tag + Publish

- [ ] Merge release prep PR to `main`.
- [ ] Create and push annotated tag `v0.5.0`.
- [ ] Confirm GitHub Actions `Release VSIX` workflow succeeds for the `v0.5.0` tag.
- [ ] Confirm release page has generated notes + attached VSIX artifact.

## 7) Post-Release Observation

- [ ] Watch first 24-48h for sanitizer false-positive/false-negative reports.
- [ ] Link any follow-up fixes as `v0.5.1` candidates if needed.
