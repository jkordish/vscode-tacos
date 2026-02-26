import { decideEditActivity } from '../src/editActivity';

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
