/**
 * Locale-independent date formatters.
 *
 * toLocaleDateString() produces different output between Node's ICU and the
 * browser's ICU, causing React hydration mismatches. These functions use
 * hard-coded arrays so output is identical on server and client.
 */

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** Parses YYYY-MM-DD (or ISO datetime) as a local calendar date. */
function parseLocalDate(isoDate: string) {
  const [yearStr, monthStr, dayStr] = isoDate.split("T")[0].split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const day = Number(dayStr);
  const weekday = new Date(year, month - 1, day).getDay(); // 0=Sun
  return { year, month, day, weekday };
}

/** "Mon, 14 Apr 2026" — short weekday + short month */
export function formatEventDate(isoDate: string): string {
  const { year, month, day, weekday } = parseLocalDate(isoDate);
  return `${SHORT_DAYS[weekday]}, ${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

/** "14 April 2026" — no weekday, long month */
export function formatLongDate(isoDate: string): string {
  const { year, month, day } = parseLocalDate(isoDate);
  return `${day} ${LONG_MONTHS[month - 1]} ${year}`;
}

/** "14 Apr 2026" — no weekday, short month */
export function formatShortDate(isoDate: string): string {
  const { year, month, day } = parseLocalDate(isoDate);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

/** "Monday, 14 April 2026" — long weekday + long month */
export function formatFullDate(isoDate: string): string {
  const { year, month, day, weekday } = parseLocalDate(isoDate);
  return `${LONG_DAYS[weekday]}, ${day} ${LONG_MONTHS[month - 1]} ${year}`;
}

/** "Mon, 14 April 2026" — short weekday + long month */
export function formatMediumDate(isoDate: string): string {
  const { year, month, day, weekday } = parseLocalDate(isoDate);
  return `${SHORT_DAYS[weekday]}, ${day} ${LONG_MONTHS[month - 1]} ${year}`;
}

/**
 * "14 Apr 2026, 10:30" — short date + 24 h time.
 * Accepts a full ISO timestamp string (with time component).
 */
export function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const day = d.getDate();
  const month = SHORT_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}
