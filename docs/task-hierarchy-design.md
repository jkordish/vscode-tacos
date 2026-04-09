# Task Hierarchy Design Spike

> **Status:** Draft — P26 design spike. No code changes in this document.
> **As of:** v0.99.0 schema v2 baseline (April 2026).
> **Authors:** TaCoS maintainers.
> **Issue:** [#316](https://github.com/jkordish/vscode-tacos/issues/316)

---

## 1. Purpose and Scope

This document explores what it would take to extend TaCoS beyond its current flat, single-active-task model into a **hierarchical / nested task model** where a root task can spawn sub-tasks, and each sub-task has its own structured state.

The TaCoS ICSE'26 paper explicitly calls out "nested and interdependent tasks" as a direction future systems should address:

> "Future systems should support nested task trees, where resuming a parent task requires first resolving outstanding sub-tasks, and the system must track both the parent context and the sub-task lineage to surface a complete recovery brief."

This is a **design spike only**. No code is proposed for this issue. The deliverables are:

1. A data model extension sketch with clear schema implications.
2. UI surface implications for the P19 cockpit and Evidence tab.
3. A migration path from flat (schema v2) to hierarchical.
4. Two user story sketches: incident investigation and PR review with sub-tasks.
5. A go/no-go recommendation for inclusion in v1.x.
6. Open questions for future deliberation.

---

## 2. Current Model (Schema v2 Baseline)

The current model in `src/taskState.ts` is deliberately flat:

```
StructuredTaskStateStore {
  schemaVersion: 2,
  tasks: StructuredTaskState[]
}
```

Each `StructuredTaskState` is keyed to a unique `(workspaceRoot, branch, taskPartition)` scope. At most one task per scope can be `resolutionState === 'active'`. There is no parent/child relationship.

**Key schema constants (as of schema v2):**

| Constant | Value |
|---|---|
| `MAX_TASKS_PER_WORKSPACE` | 48 |
| `MAX_WORKING_SET_ENTRIES` | 12 |
| `MAX_LIST_ENTRIES` | 8 |
| `MAX_TEXT_CHARS` | 280 |
| `TASK_STATE_SCHEMA_VERSION` | 2 |

**Key fields on `StructuredTaskState`:**

- `taskId` — UUID (primary key)
- `workspaceRoot`, `repo`, `branch`, `taskPartition` — scope tuple
- `objective`, `currentHypothesis`, `assumptions[]`, `blockers[]`, `nextAction`
- `prospectiveNextVerification` — what should be verified next at switch time
- `workingSet[]` — max 12 files/symbols
- `confidence` — `'low' | 'medium' | 'high'`
- `lastKnownSafeBreakpoint` — explicit safe return point
- `staleAfter`, `createdAt`, `updatedAt`, `switchCount`
- `resolutionState` — `'active' | 'resolved' | 'abandoned'`

The flat model is simple, local-first, and easy to reason about. Any hierarchical extension must preserve these properties.

---

## 3. Data Model Extension Sketch

### 3.1 Minimal additions

To support hierarchical tasks, the minimum additions to `StructuredTaskState` are:

```typescript
// Optional: present only on sub-tasks
parentTaskId?: string;          // UUID of direct parent task

// Optional: present only on tasks with children
childTaskIds?: string[];        // ordered list of direct child UUIDs

// Derived: full ancestor chain root→…→this, for lineage display
lineageChain?: string[];        // UUIDs from root to this task (inclusive)

// Depth from root (0 = root task, 1 = direct sub-task, etc.)
hierarchyDepth?: number;
```

All fields are **optional** to preserve backwards compatibility with flat tasks. A task with no `parentTaskId` and no `childTaskIds` is semantically identical to the current flat model.

### 3.2 Proposed schema v3 shape

```typescript
interface StructuredTaskState {
  // --- existing fields (all unchanged) ---
  taskId: string;
  workspaceRoot: string;
  repo: string;
  branch: string;
  taskPartition: string;
  objective: string;
  workingSet: TaskWorkingSetEntry[];
  currentHypothesis?: string;
  assumptions: string[];
  blockers: string[];
  nextAction?: string;
  prospectiveNextVerification?: string;
  confidence: 'low' | 'medium' | 'high';
  lastKnownSafeBreakpoint?: LastKnownSafeBreakpoint;
  staleAfter?: string;
  createdAt: string;
  updatedAt: string;
  switchCount: number;
  resolutionState: 'active' | 'resolved' | 'abandoned';

  // --- new optional hierarchy fields ---
  parentTaskId?: string;
  childTaskIds?: string[];
  lineageChain?: string[];
  hierarchyDepth?: number;
}
```

**Store-level change:** bump `TASK_STATE_SCHEMA_VERSION` to `3`.

### 3.3 Depth and breadth limits

To prevent runaway nesting and preserve the tool's "calm, approachable" character:

| Limit | Proposed value | Rationale |
|---|---|---|
| Max hierarchy depth | 3 | root → sub-task → leaf. Deeper nesting is rarely actionable in a brief. |
| Max children per task | 8 | Matches `MAX_LIST_ENTRIES` — aligns with existing render budgets. |
| Max total tasks per workspace | 48 | Unchanged — hierarchy does not increase this ceiling. |

### 3.4 Sub-task lifecycle

Sub-tasks follow the same `active → resolved / abandoned` lifecycle as root tasks, with two additions:

**Promotion:** A sub-task can be promoted to a root task (its `parentTaskId` is cleared, `hierarchyDepth` set to `0`, parent's `childTaskIds` updated). This is a non-destructive operation — no data is lost.

**Demotion:** A root task can be demoted to a sub-task of another task (a `parentTaskId` is set, `hierarchyDepth` updated, target parent's `childTaskIds` updated). This should require explicit user intent — never happen automatically.

**Cascading resolve:** When a parent task is marked resolved, the system should offer to resolve all active children too. Never cascade silently.

**Orphan handling:** If a parent task is deleted or abandoned, its children become orphaned root tasks (their `parentTaskId` is cleared automatically, `hierarchyDepth` reset to `0`).

### 3.5 `findActiveStructuredTaskForScope` changes

The current function uses an exact match on `(workspaceRoot, branch, taskPartition, resolutionState === 'active')`. With hierarchy:

- The function signature stays identical; callers are not broken.
- A new `findActiveTaskTree(workspaceRoot, branch): TaskTreeNode` function would build the full parent→children tree for cockpit rendering.
- The existing `findActiveStructuredTaskForScope` continues to return the **focused** task — the leaf being actively worked — not the root.

---

## 4. UI Surface Implications

### 4.1 P19 Resume Cockpit

The cockpit currently renders a single task's `verifyFirst`, `nextStep`, and `blocker` fields above the fold with anchor badges below.

With hierarchy, the cockpit needs to show **where you are in the tree** without overwhelming the screen:

**Option A — Breadcrumb header (recommended for v1.x):**
Add a compact `task-breadcrumb` row above the cockpit verify/next fields:

```
[ Root task title ] › [ Sub-task title ]   (you are here)
```

- Each breadcrumb segment is clickable and switches the cockpit's focused task.
- The breadcrumb row is hidden when `hierarchyDepth === 0` (flat tasks — no visual regression).
- The focused task's cockpit fields render exactly as today.

**Option B — Tree sidebar:**
Render a collapsible task tree in a new cockpit sidebar column. Higher complexity, higher information density. Recommended only for v2.0+ after validating Option A.

**Option C — Subtask list card:**
Add a `Sub-tasks` card to the bottom of the cockpit showing children as a compact checklist. Simple to implement but buries the tree context below the fold.

**Recommendation:** Option A (breadcrumb) for v1.x. Option B deferred. Option C as a supplemental card alongside Option A.

### 4.2 Evidence Tab

The Evidence tab currently groups timeline entries by file, time, or action mode. With hierarchy, two additions are useful:

1. **Scope filter toggle:** `All tasks / Root task only / Sub-tasks only` — lets users scan evidence across the full tree or narrow to a specific branch.
2. **Task label badge on each entry:** Small `[sub-task name]` badge on evidence items that were captured while a sub-task was active, so the timeline is attributable.

Neither addition requires changing `TimelineEntry` — the label would be derived by matching the entry's timestamp against the task's `createdAt`/`updatedAt` window.

### 4.3 Companion Panel — Task State Card

The Task State card shows `objective`, `confidence`, `nextAction`, and `blockers`. With hierarchy:

- Add a `Parent task` row (single line, truncated) when `parentTaskId` is set.
- Add a `Sub-tasks (N active / M total)` row when `childTaskIds` is non-empty.
- The existing action buttons (`Update task state`, `Switch task`) remain unchanged.

### 4.4 Cognitive Debrief

The Cognitive Debrief surfaces abandoned threads, stale task state, and repeated-switch tasks. With hierarchy, add:

- **Stale sub-task warning:** if a sub-task has been active for more than `staleAfter` with no update, surface it in the debrief under the parent task context.
- **Parent blocked by sub-task:** if a parent task has an active sub-task with a `blockers[]` entry, the parent's debrief should surface this cross-reference.

### 4.5 Status Bar

The status bar currently shows the active task partition label. With hierarchy, show the focused task's depth path in the tooltip (not the status bar chip itself — too noisy):

```
TaCoS: [incident-2026-04 > check-db-replication]  (tooltip)
```

The chip label itself remains the leaf task's `taskPartition` value — no visual regression for flat users.

---

## 5. Migration Path (Schema v2 → Schema v3)

### 5.1 Strategy

The migration must be:

- **Opt-in:** existing flat tasks remain flat. No automatic tree building.
- **Additive:** new fields are all optional. A schema v2 task read by a schema v3 extension is valid as a root task with `hierarchyDepth: 0`.
- **Reversible:** a schema v3 store with only depth-0 tasks is functionally identical to a schema v2 store.

### 5.2 `migrateV2toV3` function sketch

```typescript
function migrateV2toV3(raw: unknown): StructuredTaskStateStore {
  if (!raw || typeof raw !== 'object') return emptyV3Store();
  const store = raw as Record<string, unknown>;

  // Already v3+ — no-op
  if ((store.schemaVersion as number) >= 3) {
    return store as StructuredTaskStateStore;
  }

  // v2 → v3: stamp schemaVersion, add optional hierarchy fields with defaults
  const tasks = Array.isArray(store.tasks) ? store.tasks : [];
  const migratedTasks = tasks.map((t: unknown) => {
    if (!t || typeof t !== 'object') return t;
    const task = t as Record<string, unknown>;
    return {
      ...task,
      // Default all hierarchy fields to absent (undefined)
      // — no change in behavior for existing flat tasks
    };
  });

  return {
    ...(store as object),
    schemaVersion: 3,
    tasks: migratedTasks,
  } as StructuredTaskStateStore;
}
```

Because the new fields are all optional, the migration body is nearly a no-op — it just stamps `schemaVersion: 3`. The real behavioral changes come from the new create/update APIs that accept `parentTaskId`.

### 5.3 Rollback

If a user downgrades from a schema v3 extension to a schema v2 extension:

- The schema v2 parser will see `schemaVersion: 3` and treat the store as unknown/corrupt.
- Mitigation: `parseStructuredTaskStateStore` should read `tasks` defensively regardless of `schemaVersion` when the field array is structurally valid, treating unknown future versions as "best-effort v2".
- This must be tested explicitly before any schema v3 code ships.

---

## 6. User Story Sketches

### 6.1 Incident Investigation

**Persona:** Maya, Staff SRE. On-call. Alert fires at 02:00.

**Root task:** `investigate: payment-service latency spike`
- `objective`: "Determine root cause of P99 > 2s on /checkout since 01:47"
- `nextAction`: "Check DB query latency on payments-db-primary"
- `confidence`: medium
- `taskPartition`: `incident-2026-04`

Maya creates a sub-task to isolate the database:

**Sub-task 1:** `check-db-query-latency` (depth 1, parent: root)
- `objective`: "Confirm whether payments-db-primary query time increased after 01:47 deploy"
- `nextAction`: "Run EXPLAIN ANALYZE on top-3 slow queries"
- `confidence`: low
- Resolution: resolved (query times normal — ruled out)

Back in root task, Maya creates another sub-task:

**Sub-task 2:** `check-cache-hit-rate` (depth 1, parent: root)
- `objective`: "Confirm Redis cache hit rate didn't drop after deploy"
- `nextAction`: "Open Redis dashboard, filter to /checkout endpoint"
- `confidence`: low
- Resolution: resolved (cache hit rate dropped from 94% → 61% — **root cause found**)

Root task is now updated:
- `currentHypothesis`: "Cache invalidation bug in payment-service v2.4.1 deploy"
- `nextAction`: "Rollback to v2.4.0 or patch cache-key generation in hotfix"
- `confidence`: high

**Recovery brief with hierarchy:** When Maya resumes after a 10-minute handoff, the cockpit shows:

```
[ incident-2026-04 ] (root, 1 sub-task resolved, 1 active)
  Verify first: cache hit rate still ≤ 70% after rollback?
  Next step: confirm rollback v2.4.0 is healthy on canary
```

The breadcrumb breadcrumb correctly surfaces the parent context without forcing Maya to scroll through sub-task details.

---

### 6.2 PR Review with Sub-tasks

**Persona:** Tomás, senior engineer reviewing a complex 800-line PR.

**Root task:** `review: feat/new-cache-sharding-layer` (PR #412)
- `objective`: "Complete review of PR #412 before standup"
- `nextAction`: "Finish reviewing `src/cache/sharding.ts`"
- `confidence`: medium
- `taskPartition`: `pr-review-412`

While reviewing, Tomás notices a suspicious helper function and creates a sub-task to investigate:

**Sub-task 1:** `investigate-eviction-edge-case` (depth 1, parent: root)
- `objective`: "Verify `evictStaleEntries` handles concurrent writes safely"
- `nextAction`: "Search for call sites and check test coverage"
- `confidence`: low
- `workingSet`: [`src/cache/eviction.ts`, `test/cache/eviction.test.ts`]
- Resolution: The function is not thread-safe. Tomás leaves a comment and resolves this sub-task with the blocker logged.

Back in root task:
- `blockers`: ["eviction.ts concurrency issue — needs fix before merge"]
- `nextAction`: "Review remaining files: `src/cache/routing.ts`, `src/cache/index.ts`"

**Recovery brief with hierarchy:** Tomás resumes after a lunch break:

```
[ pr-review-412 ] > [ investigate-eviction-edge-case: resolved ]
  Verify first: was eviction concurrency blocker addressed in latest push?
  Next step: check PR #412 for new commits, then resume routing.ts review
```

The resolved sub-task surfaces its conclusion in the cockpit without requiring Tomás to re-derive the context.

---

## 7. Go/No-Go Recommendation for v1.x

### Summary table

| Criterion | Assessment |
|---|---|
| Research grounding | ✓ Explicit ICSE'26 recommendation |
| User demand | ✓ Clear use cases (incident/PR review); Staff+ engineers explicitly cited |
| Schema complexity | ⚑ Moderate — additive optional fields; migration is near-trivial |
| UI complexity | ⚑ Moderate — breadcrumb + sub-task list card is straightforward; tree sidebar is not |
| Local-first integrity | ✓ Fully preservable — all hierarchy data stays in `workspaceState` |
| Risk to existing flat users | ✓ Zero — all new fields are optional; flat tasks are unchanged |
| Interaction model risk | ⚠ Medium — users could create unnecessarily deep trees, fragmenting state |
| Implementation scope | ⚠ Non-trivial — new commands, new store functions, cockpit changes, migration |

### Recommendation: **Partial inclusion in v1.x — schema-only, UI deferred to v1.1**

The schema additions (optional `parentTaskId`, `childTaskIds`, `lineageChain`, `hierarchyDepth`) and the `migrateV2toV3` function are **safe to land in v1.0** because:

- They are fully additive and backwards-compatible.
- They impose no new UI complexity on flat users.
- They establish the schema contract early so future UI work does not require another migration.

The **UI surfaces** (cockpit breadcrumb, sub-task list card, Evidence tab scope filter) should be **deferred to v1.1** until:

1. At least two real users can validate the Story 6.1 and 6.2 workflows against their actual on-call/PR-review workflows.
2. The task creation flow for sub-tasks has been prototyped and user-tested.
3. The depth/breadth limits have been validated as non-confusing.

**What NOT to ship in v1.x under any circumstances:**
- Automatic sub-task creation (explicit intent only).
- Cascading resolve without confirmation.
- Tree sidebar (Option B from §4.1).
- Any AI-driven task decomposition (out of scope for the local-first model).

---

## 8. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| OQ-1 | Should sub-tasks inherit the parent's `branch` and `taskPartition`, or be free to differ? Inheriting is simpler but may not match real workflows where a sub-task opens a new branch. | Maintainers | High |
| OQ-2 | What is the UX for creating a sub-task? A command palette entry (`TaCoS: Create Sub-task`)? A button in the cockpit? Both? | UX | High |
| OQ-3 | Should `findActiveStructuredTaskForScope` return the focused leaf task, or the root? Current callers (resume brief, cockpit) expect the most-specific active task — this should be the leaf. But debrief callers may want the root. | Engineering | High |
| OQ-4 | How does `switchCount` work in a hierarchy? Does switching from a sub-task to its sibling increment the parent's count, the sub-task's count, or both? | Engineering | Medium |
| OQ-5 | Should sub-tasks be visible across branches? (E.g. root on `main`, sub-task on `fix/thing`.) The current scope model ties tasks to a branch — cross-branch hierarchies could be confusing. | Engineering | Medium |
| OQ-6 | What happens to orphaned sub-tasks when a parent is hard-deleted (not just resolved)? Promote to root silently, or surface a warning? | Engineering | Medium |
| OQ-7 | Is depth-3 the right limit? Incident trees in SRE practice can be deeper, but cognitive load for recovery scales badly beyond depth-2. Should depth-3 be a hard limit or a configurable warning threshold? | Product | Medium |
| OQ-8 | How does the `MAX_TASKS_PER_WORKSPACE = 48` limit interact with a hierarchy that has many small sub-tasks? Does the limit apply to all tasks (including sub-tasks) or only to root tasks? | Engineering | Low |
| OQ-9 | Should the `lineageChain` field be stored or derived at read time? Derived is simpler (no sync hazard) but adds cost to every read in deep trees. For depth ≤ 3 this is negligible. | Engineering | Low |
| OQ-10 | Should a v3 store round-trip cleanly through a v2 extension? (Best-effort read is possible but partial data loss on write-back is a risk.) What is the explicit downgrade contract? | Engineering | Low |

---

## 9. Files Affected (Implementation Preview)

This section is **informational only** — no changes proposed in this issue.

| File | Change type | Notes |
|---|---|---|
| `src/taskState.ts` | Schema extension | Add optional hierarchy fields; `migrateV2toV3`; `findActiveTaskTree`; sub-task create/promote/demote helpers |
| `src/types.ts` | Type additions | `TaskTreeNode`, depth/lineage types |
| `src/webview/panelCards.ts` | UI addition | Sub-task list card; cockpit breadcrumb row |
| `src/webview/panelFragments.ts` | UI addition | `renderTaskBreadcrumb()`; breadcrumb CSS classes |
| `src/webview/panelStyles.ts` | CSS addition | `.task-breadcrumb`, `.task-tree-node` classes |
| `src/extension.ts` | Command wiring | `TaCoS: Create Sub-task`, `TaCoS: Promote Sub-task`, `TaCoS: Switch to Parent Task` |
| `package.json` | Manifest | New command declarations and activation events |
| `test/taskState.test.ts` | Tests | `migrateV2toV3` describe block; tree traversal tests |
| `docs/DESIGN_AND_IMPLEMENTATION.md` | Docs | Hierarchy model and cockpit breadcrumb section |
| `SPECS.md` | Spec | Hierarchy feature contract |
| `CHANGELOG.md` | Release notes | Schema v3 and sub-task commands |

---

## 10. References

- [TaCoS ICSE'26 paper](https://github.com/jkordish/vscode-tacos/blob/main/docs/references.md) — §Discussion: "nested and interdependent tasks"
- `src/taskState.ts` — current schema v2 implementation
- `docs/references.md` — Feature Traceability Matrix (P25), row F5: nested tasks `○ Aspirational`
- [P24 in PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md) — schema v2 baseline this design extends
- [P19 in PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md) — cockpit layout; primary consumer of breadcrumb addition
- [P21 in PLANS.md](https://github.com/jkordish/vscode-tacos/blob/main/PLANS.md) — Evidence tab grouping; shares the anchor data layer with the scope filter addition
