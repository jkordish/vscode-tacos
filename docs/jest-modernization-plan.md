# Jest Modernization Plan (Jest 30)

## Why this plan exists

- Current stack is `jest@29` + `ts-jest@29`.
- `ts-jest` is tied to Jest 29 today, so direct upgrade to Jest 30 is blocked.
- Goal: move to Jest 30 without breaking extension test confidence.

## Recommended migration path

1. Baseline and freeze
- Keep tests green on `main` before migration work.
- Record current runtime and coverage as a baseline (`npm test` output).

2. Replace `ts-jest` transform (compatibility unlock)
- Add `@swc/jest` and `@swc/core` as dev dependencies.
- Update `jest.config.cjs`:
  - remove `preset: "ts-jest"`
  - transform `^.+\\.ts$` with `@swc/jest`
  - preserve `testEnvironment`, `testMatch`, and module extensions.
- Keep TypeScript type-checking in `npm run compile` (separate from tests).

3. Upgrade Jest toolchain to 30.x
- Upgrade `jest`, `@types/jest`, and any related config packages to 30.x.
- Remove `ts-jest` dependency.
- Regenerate lockfile and run full tests.

4. CI and stability pass
- Run tests in local and CI on Node 20.
- Validate no snapshot/transform regressions.
- Capture final test runtime and compare to baseline.

## Acceptance criteria

- All existing tests pass on Jest 30.
- `ts-jest` removed.
- No increase in flaky test behavior.
- CI workflow is green for at least one tagged release.

## Rollback strategy

- Keep migration in a dedicated PR.
- If transform-related failures are high-risk, pin back to Jest 29 and reopen the migration with smaller slices.
