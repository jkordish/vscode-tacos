interface QuietHoursWindow {
  startMinute: number;
  endMinute: number;
}

function parseHourMinute(raw: string): number | undefined {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return undefined;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }
  return hour * 60 + minute;
}

export function parseQuietHoursWindow(raw: string): QuietHoursWindow | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }

  const parts = value.split('-');
  if (parts.length !== 2) {
    return undefined;
  }

  const startMinute = parseHourMinute(parts[0]);
  const endMinute = parseHourMinute(parts[1]);
  if (startMinute === undefined || endMinute === undefined || startMinute === endMinute) {
    return undefined;
  }

  return { startMinute, endMinute };
}

export function isInQuietHours(now: number, quietHours: string): boolean {
  const window = parseQuietHoursWindow(quietHours);
  if (!window) {
    return false;
  }

  const date = new Date(now);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  if (window.startMinute < window.endMinute) {
    return minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute;
  }

  return minuteOfDay >= window.startMinute || minuteOfDay < window.endMinute;
}
