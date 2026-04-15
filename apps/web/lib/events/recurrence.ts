import type { RecurrenceRule } from "./types";

/**
 * Returns `count` future occurrence date strings (yyyy-mm-dd) after baseDate.
 * baseDate itself is NOT included — these are the stub dates.
 * All date math uses UTC arithmetic only.
 */
export function computeStubDates(
  baseDate: string, // yyyy-mm-dd
  rule: RecurrenceRule,
  count: number = 12
): string[] {
  const dates: string[] = [];
  let cursor = new Date(baseDate + "T00:00:00Z");

  for (let i = 0; i < count; i++) {
    cursor = nextOccurrence(cursor, rule);
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function nextOccurrence(from: Date, rule: RecurrenceRule): Date {
  const d = new Date(from);
  switch (rule) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      return d;
    case "monthly_first_sunday": {
      // Advance to the first Sunday of the NEXT calendar month
      d.setUTCMonth(d.getUTCMonth() + 1, 1); // first day of next month
      const dayOfWeek = d.getUTCDay(); // 0=Sun
      const offset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    }
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
  }
}
