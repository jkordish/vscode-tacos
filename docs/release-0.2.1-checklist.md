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

- [ ] Update `package.json` version to `0.2.1`.
- [ ] Add `v0.2.1` section to `CHANGELOG.md` with stabilization highlights.
- [ ] Confirm release notes reference all included stabilization PRs/issues.

## 4) Verify Gates

- [ ] `npm run verify`
- [ ] Confirm CI checks are green on release branch.
- [ ] Smoke check critical commands:
  - `TaCoS: Resume Summary Quick`
  - `TaCoS: Restore Working Set`
  - `TaCoS: Export Local Metrics`
  - `TaCoS: Copy Diagnostics`

## 5) Tag + Publish

- [ ] Merge release prep PR to `main`.
- [ ] Create and push tag `v0.2.1`.
- [ ] Publish GitHub release artifact/notes.

## 6) Regression Window Anchor (Required)

Regression-window start time is the published timestamp of the `v0.2.1` tag/release on GitHub.

Record after publish:

- [ ] `v0.2.1` release URL: `TBD`
- [ ] Published at (UTC): `TBD`
- [ ] Regression window end (UTC + 14 days): `TBD`
