import {
  captureEditLocation,
  decideEditActivity,
  pushRecentEditLocation,
} from '../src/editActivity';

describe('decideEditActivity', () => {
  it('marks meaningful activity for file edits even without a metric session', () => {
    expect(
      decideEditActivity({
        documentScheme: 'file',
        hasMeaningfulChange: true,
        hasMetricSession: false,
        hasCapturedFirstMeaningfulEdit: false,
      }),
    ).toEqual({
      shouldMarkMeaningfulActivity: true,
      shouldCaptureMetricLag: false,
    });
  });

  it('captures metric lag once when metric session is active', () => {
    expect(
      decideEditActivity({
        documentScheme: 'file',
        hasMeaningfulChange: true,
        hasMetricSession: true,
        hasCapturedFirstMeaningfulEdit: false,
      }),
    ).toEqual({
      shouldMarkMeaningfulActivity: true,
      shouldCaptureMetricLag: true,
    });
  });

  it('does not capture metric lag again after first meaningful edit', () => {
    expect(
      decideEditActivity({
        documentScheme: 'file',
        hasMeaningfulChange: true,
        hasMetricSession: true,
        hasCapturedFirstMeaningfulEdit: true,
      }),
    ).toEqual({
      shouldMarkMeaningfulActivity: true,
      shouldCaptureMetricLag: false,
    });
  });

  it('ignores non-file edits and non-meaningful changes', () => {
    expect(
      decideEditActivity({
        documentScheme: 'untitled',
        hasMeaningfulChange: true,
        hasMetricSession: true,
        hasCapturedFirstMeaningfulEdit: false,
      }),
    ).toEqual({
      shouldMarkMeaningfulActivity: false,
      shouldCaptureMetricLag: false,
    });

    expect(
      decideEditActivity({
        documentScheme: 'file',
        hasMeaningfulChange: false,
        hasMetricSession: true,
        hasCapturedFirstMeaningfulEdit: false,
      }),
    ).toEqual({
      shouldMarkMeaningfulActivity: false,
      shouldCaptureMetricLag: false,
    });
  });
});

describe('captureEditLocation', () => {
  it('prefers active editor selection position for meaningful file edits', () => {
    const captured = captureEditLocation({
      documentScheme: 'file',
      hasMeaningfulChange: true,
      relativePath: 'src/extension.ts',
      now: 123,
      fallbackLine: 10,
      fallbackCharacter: 2,
      selectionLine: 14,
      selectionCharacter: 7,
    });

    expect(captured).toEqual({
      path: 'src/extension.ts',
      line: 14,
      character: 7,
      timestamp: 123,
    });
  });

  it('falls back to last content-change start position when selection is unavailable', () => {
    const captured = captureEditLocation({
      documentScheme: 'file',
      hasMeaningfulChange: true,
      relativePath: 'src/summary.ts',
      now: 999,
      fallbackLine: 22,
      fallbackCharacter: 5,
    });

    expect(captured).toEqual({
      path: 'src/summary.ts',
      line: 22,
      character: 5,
      timestamp: 999,
    });
  });

  it('ignores non-file edits and empty paths', () => {
    expect(
      captureEditLocation({
        documentScheme: 'untitled',
        hasMeaningfulChange: true,
        relativePath: 'src/extension.ts',
        now: 1,
        fallbackLine: 0,
        fallbackCharacter: 0,
      }),
    ).toBeUndefined();

    expect(
      captureEditLocation({
        documentScheme: 'file',
        hasMeaningfulChange: true,
        relativePath: '   ',
        now: 1,
        fallbackLine: 0,
        fallbackCharacter: 0,
      }),
    ).toBeUndefined();
  });
});

describe('pushRecentEditLocation', () => {
  it('prepends latest location, dedupes by path+position, and enforces limit', () => {
    const existing = [
      { path: 'a.ts', line: 1, character: 1, timestamp: 10 },
      { path: 'b.ts', line: 2, character: 2, timestamp: 20 },
      { path: 'a.ts', line: 1, character: 1, timestamp: 30 },
    ];

    const updated = pushRecentEditLocation(
      existing,
      { path: 'c.ts', line: 3, character: 3, timestamp: 40 },
      3,
    );

    expect(updated).toEqual([
      { path: 'c.ts', line: 3, character: 3, timestamp: 40 },
      { path: 'a.ts', line: 1, character: 1, timestamp: 10 },
      { path: 'b.ts', line: 2, character: 2, timestamp: 20 },
    ]);
  });
});
