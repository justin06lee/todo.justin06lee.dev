// Relative "edited …" stamps for the notes list. Pure — the caller passes
// `now` — so the boundaries can be tested without freezing the clock
// (format-time.test.ts). Copy is lowercase like everything else on the site.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

/**
 * "just now" under a minute, then minutes, then hours, then "yesterday", then
 * a short date — with the year appended only once it differs from `now`'s.
 * Calendar fields are read in UTC on both sides of the comparison: this site
 * renders on a server whose zone is an accident of deployment, and a stamp
 * that is a day off at midnight is better than one that flips with the host
 * machine's timezone.
 */
export function formatRelativeTime(now: number, then: number): string {
  const delta = now - then;

  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 2 * DAY) return "yesterday";

  const d = new Date(then);
  const nowYear = new Date(now).getUTCFullYear();
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return year === nowYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
}
