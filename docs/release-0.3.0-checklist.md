# Release 0.3.0 Checklist

Use this checklist to prepare, tag, and publish the `v0.3.0` release.

## 1) Scope Lock

- [ ] Confirm only `v0.3.0` roadmap items are included.
- [ ] Confirm post-`v0.3.0` ideas are moved to new issues (not bundled into this release).

## 2) Feature Track Completion

- [x] #90 guided first-run setup checklist
- [x] #91 selective restore presets + dry-run plan
- [x] #92 in-extension metrics baseline snapshot command
- [x] #93 companion nudge explainability

## 3) Versioning + Changelog

- [ ] Update `package.json` version to `0.3.0`.
- [ ] Add `v0.3.0` section to `CHANGELOG.md` with links to included PRs/issues.
- [ ] Confirm release notes summarize adoption/confidence improvements and trust boundaries.

## 4) Verify Gates

- [ ] `npm run verify`
- [ ] Confirm CI checks are green on the release prep branch.
- [ ] Smoke-check key commands in VS Code:
  - `TaCoS: Run Setup Checklist`
  - `TaCoS: Restore Working Set`
  - `TaCoS: Copy Metrics Baseline Snapshot`
  - `TaCoS: Show Last Summary`

## 5) Docs + Metrics Snapshot

- [x] Publish a post-implementation baseline snapshot in `docs/metrics-baseline.md`.
- [ ] If available, refresh snapshot with non-empty local dogfooding sample before release tag.
- [ ] Confirm `docs/metrics.md` and `docs/quickstart.md` match shipped command behavior.

## 6) Tag + Publish

- [ ] Merge release prep PR to `main`.
- [ ] Create and push tag `v0.3.0`.
- [ ] Publish GitHub release notes and artifact.

## 7) Post-Release Observation

- [ ] Track regressions for `v0.3.0` rollout window and record any P0/P1 incidents.
- [ ] Link follow-up fixes to the release notes if a `v0.3.1` patch is required.
