import { TickMarkType, type Time } from 'lightweight-charts';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeToDate(time: Time): Date {
  // Most of our charts use UTCTimestamp (seconds)
  if (typeof time === 'number') {
    return new Date(time * 1000);
  }

  // BusinessDay support (defensive)
  if (typeof time === 'object' && time !== null && 'year' in time) {
    const t = time as unknown as { year: number; month: number; day: number };
    // Interpret as UTC date, then render in local timezone for consistency with UI
    return new Date(Date.UTC(t.year, t.month - 1, t.day));
  }

  // Fallback
  return new Date(0);
}

/**
 * Format chart x-axis tick mark as local time strings (HH:mm / HH:mm:ss),
 * and for larger tick types show date.
 */
export function formatTickMark(time: Time, tickMarkType: TickMarkType): string {
  const d = timeToDate(time);

  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const HH = pad2(d.getHours());
  const MM = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());

  switch (tickMarkType) {
    case TickMarkType.Year:
      return `${yyyy}`;
    case TickMarkType.Month:
      return `${yyyy}-${mm}`;
    case TickMarkType.DayOfMonth:
      return `${mm}/${dd}`;
    case TickMarkType.TimeWithSeconds:
      return `${HH}:${MM}:${SS}`;
    case TickMarkType.Time:
    default:
      return `${HH}:${MM}`;
  }
}


