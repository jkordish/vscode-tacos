import { isInQuietHours, parseQuietHoursWindow } from '../src/quietHours';

describe('quiet hours utilities', () => {
  it('parses valid windows and rejects invalid inputs', () => {
    expect(parseQuietHoursWindow('22:00-07:00')).toEqual({
      startMinute: 22 * 60,
      endMinute: 7 * 60,
    });
    expect(parseQuietHoursWindow('')).toBeUndefined();
    expect(parseQuietHoursWindow('22:00')).toBeUndefined();
    expect(parseQuietHoursWindow('25:00-07:00')).toBeUndefined();
  });

  it('handles wrap-around windows', () => {
    const night = new Date(2026, 0, 10, 23, 30, 0).getTime();
    const morning = new Date(2026, 0, 10, 6, 30, 0).getTime();
    const day = new Date(2026, 0, 10, 12, 30, 0).getTime();

    expect(isInQuietHours(night, '22:00-07:00')).toBe(true);
    expect(isInQuietHours(morning, '22:00-07:00')).toBe(true);
    expect(isInQuietHours(day, '22:00-07:00')).toBe(false);
  });
});
