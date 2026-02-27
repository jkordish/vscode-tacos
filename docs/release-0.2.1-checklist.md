# Release 0.2.1 Stabilization Checklist

Use this checklist to publish the `v0.2.1` stabilization release and start the post-release regression window.

## 1) Scope Lock

- [ ] Confirm only `0.2.x` stabilization items are included.
- [ ] Confirm `0.3.0` candidate work remains out of scope for this release.

## 2) Stabilization Track Completion

- [x] #74 partition boundaries
- [x] #75 action surface safety sweep
- [x] #76 nudge suppression correctness
- [x] #77 compact panel readability pass
- [x] #78 quickstart docs
- [x] #79 metrics dictionary + baseline workflow
- [x] #80 feedback loop templates + diagnostics bundle
- [x] #81 v0.3.0 roadmap triage + candidate issue set

## 3) Versioning + Changelog

- [x] Update `package.json` version to `0.2.1`.
- [x] Add `v0.2.1` section to `CHANGELOG.md` with stabilization highlights.
- [x] Confirm release notes reference all included stabilization PRs/issues.

## 4) Verify Gates

- [x] `npm run verify`
- [x] Confirm CI checks are green on release branch.
- [ ] Smoke check critical commands:
  - `TaCoS: Resume Summary Quick`
  - `TaCoS: Restore Working Set`
  - `TaCoS: Export Local Metrics`
  - `TaCoS: Copy Diagnostics`

## 5) Tag + Publish

- [x] Merge release prep PR to `main`.
- [x] Create and push tag `v0.2.1`.
- [x] Publish GitHub release artifact/notes.

## 6) Regression Window Anchor (Required)

Regression-window start time is the published timestamp of the `v0.2.1` tag/release on GitHub.

Recorded after publish:

- [x] `v0.2.1` release URL: `https://github.com/jkordish/vscode-tacos/releases/tag/v0.2.1`
- [x] Published at (UTC): `2026-02-27T18:23:26Z`
- [x] Regression window end (UTC + 14 days): `2026-03-13T18:23:26Z`
