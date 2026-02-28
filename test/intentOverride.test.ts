import {
  buildIntentOverrideStorageKey,
  createIntentOverrideState,
  normalizeIntentOverrideState,
  normalizeIntentOverrideText,
} from '../src/intentOverride';

describe('intentOverride', () => {
  it('builds partition-scoped storage keys', () => {
    const keyA = buildIntentOverrideStorageKey('/workspace/repo::feature/a::TASK-1');
    const keyB = buildIntentOverrideStorageKey('/workspace/repo::feature/a::TASK-2');
    expect(keyA).toContain('tacos.intentOverride.');
    expect(keyA).not.toBe(keyB);
  });

  it('normalizes freeform override text into a single safe line', () => {
    expect(normalizeIntentOverrideText('  Fix  parser\nand rerun tests  ')).toBe(
      'Fix parser and rerun tests',
    );
    expect(normalizeIntentOverrideText('   ')).toBeUndefined();
    expect(normalizeIntentOverrideText(undefined)).toBeUndefined();
  });

  it('accepts only matching context hash when restoring state', () => {
    const stored = createIntentOverrideState('ctx-a', 'Fix parser');

    expect(normalizeIntentOverrideState(stored, 'ctx-a')?.intent).toBe('Fix parser');
    expect(normalizeIntentOverrideState(stored, 'ctx-b')).toBeUndefined();
  });
});
