# Action Safety Matrix

Issue: `#75`

This matrix captures expected safety behavior for TaCoS action surfaces across trust mode, prerequisite availability, and evidence validity.

## Execution Actions (task/debug/branch)

| Action | Trusted Mode | Restricted Mode | Missing Prerequisite |
| --- | --- | --- | --- |
| Rerun last task | Allowed when last task metadata resolves to an available task. | Blocked with warning. | No-op with informational warning (`no recent VS Code task`). |
| Rerun debug config | Allowed when a recent debug config is present. | Blocked with warning. | No-op with informational warning (`no recent debug configuration`). |
| Checkout previous branch | Allowed with explicit modal confirmation and workspace root. | Blocked with warning. | No-op with informational warning (`no previous branch`). |

## File / URL Safety Actions

| Action | Valid Target | Invalid / Missing Target | Safety Invariant |
| --- | --- | --- | --- |
| Open evidence file | Opens workspace-bounded file target. | Blocked with warning and skipped. | Must resolve within workspace root. |
| Open top file | Opens workspace-bounded file target. | Blocked with warning and skipped. | Must resolve within workspace root. |
| Open next-step file | Opens workspace-bounded file target. | Blocked with warning and skipped. | Must resolve within workspace root. |
| Open evidence/next-step URL | Opens `http/https` external URL. | Blocked with warning and skipped. | URL must pass `normalizeHttpUrl` allowlist. |

## Restore Surface

| Restore Path | Expected Behavior |
| --- | --- |
| Missing summary context | No-op with informational message. |
| Missing/deleted file targets | Skip safely; continue remaining restore items. |
| Missing terminal cwd | Skip terminal restore safely. |
| Missing search query | Skip search restore safely. |

## Validation Coverage

- Unit: `test/restoreSafety.test.ts`, `test/pathSafety.test.ts`
- Integration:
  - `action-safety-noop`
  - `execution-action-guards`
  - `partition-switch-reset`
  - `partition-scope`
  - `multi-root-scope`
- Manual follow-up:
  - trusted vs restricted mode
  - git vs no-git workspace
  - existing vs missing evidence target
