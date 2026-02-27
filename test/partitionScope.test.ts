import {
  buildPartitionScope,
  inferTaskPartitionKey,
  resolveTaskPartitionKey,
} from '../src/partitionScope';

describe('inferTaskPartitionKey', () => {
  it('infers ticket-style partition from branch names', () => {
    expect(inferTaskPartitionKey('feature/ABC-123-add-status-pill')).toBe('ABC-123');
  });

  it('infers issue partition from hash-style branch names', () => {
    expect(inferTaskPartitionKey('fix/#72-partition-scope')).toBe('issue-72');
  });

  it('returns undefined when no partition hint exists', () => {
    expect(inferTaskPartitionKey('feature/cleanup')).toBeUndefined();
  });
});

describe('resolveTaskPartitionKey', () => {
  it('prefers manual partition when set', () => {
    expect(
      resolveTaskPartitionKey({
        manualTaskPartition: ' HOTFIX-5 ',
        scopeBranch: 'feature/ABC-123',
      }),
    ).toBe('HOTFIX-5');
  });

  it('falls back to inferred branch partition when manual is unset', () => {
    expect(
      resolveTaskPartitionKey({
        manualTaskPartition: '  ',
        scopeBranch: 'feature/ABC-123',
      }),
    ).toBe('ABC-123');
  });

  it('falls back to default when both manual and inference are empty', () => {
    expect(
      resolveTaskPartitionKey({
        manualTaskPartition: '',
        scopeBranch: 'feature/no-ticket',
      }),
    ).toBe('default');
  });
});

describe('buildPartitionScope', () => {
  it('builds canonical workspace/branch/partition scope strings', () => {
    expect(buildPartitionScope('/workspace/repo', 'feature/ABC-123', 'ABC-123')).toBe(
      '/workspace/repo::feature/ABC-123::ABC-123',
    );
  });

  it('normalizes blank branch/partition tokens to defaults', () => {
    expect(buildPartitionScope('/workspace/repo', '  ', '  ')).toBe(
      '/workspace/repo::default::default',
    );
  });
});
