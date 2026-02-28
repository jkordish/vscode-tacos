import {
  buildResumePathSteps,
  buildResumePathStorageKey,
  createResumePathState,
  isResumePathComplete,
  normalizeResumePathState,
  toggleResumePathStep,
} from '../src/resumePath';

describe('resumePath', () => {
  it('builds partition-scoped storage keys that differ across scopes', () => {
    const scopeA = '/workspace/repo::feature/a::TASK-1';
    const scopeB = '/workspace/repo::feature/a::TASK-2';

    const keyA = buildResumePathStorageKey(scopeA);
    const keyB = buildResumePathStorageKey(scopeB);
    expect(keyA).toContain('tacos.resumePath.');
    expect(keyA).not.toBe(keyB);
  });

  it('resets completion state when context hash changes', () => {
    const raw = {
      contextHash: 'old-hash',
      completedStepIds: ['confirmIntent', 'runNextSafeAction', 'clearBlocker'],
      collapsed: true,
    };

    const normalized = normalizeResumePathState(raw, 'new-hash');
    expect(normalized.contextHash).toBe('new-hash');
    expect(normalized.completedStepIds).toEqual([]);
    expect(normalized.collapsed).toBe(false);
  });

  it('tracks completion and auto-collapses only when all three steps are complete', () => {
    let state = createResumePathState('hash');
    state = toggleResumePathStep(state, 'confirmIntent', true);
    state = toggleResumePathStep(state, 'runNextSafeAction', true);
    expect(isResumePathComplete(state)).toBe(false);
    expect(state.collapsed).toBe(false);

    state = toggleResumePathStep(state, 'clearBlocker', true);
    expect(isResumePathComplete(state)).toBe(true);
    expect(state.collapsed).toBe(true);

    state = toggleResumePathStep(state, 'clearBlocker', false);
    expect(isResumePathComplete(state)).toBe(false);
    expect(state.collapsed).toBe(false);
  });

  it('builds exactly three checklist steps', () => {
    const stepsWithBlocker = buildResumePathSteps(true);
    const stepsWithoutBlocker = buildResumePathSteps(false);
    expect(stepsWithBlocker).toHaveLength(3);
    expect(stepsWithoutBlocker).toHaveLength(3);
  });
});
