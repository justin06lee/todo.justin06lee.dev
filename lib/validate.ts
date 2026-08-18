// Input limits and guards for everything the server actions accept.
// Deliberately free of any database or environment coupling so the part that
// decides what a valid record looks like can be tested on its own
// (validate.test.ts) — and so the form components can import the same limits
// without dragging server code across the client boundary.

export const MAX_CATEGORY_NAME_LEN = 60;
export const MAX_TASK_TITLE_LEN = 200;
export const MAX_NOTE_TITLE_LEN = 120;
export const MAX_NOTE_CONTENT_LEN = 200_000;

/**
 * Record ids are crypto.randomUUID() output and nothing else. Rejecting other
 * shapes up front means an id can go straight into a parameterized query
 * knowing it names at most one row.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * A non-empty string within `max` after trimming. The length check runs on the
 * trimmed value because that is what gets stored — a title of 201 spaces and
 * one letter is a one-letter title, not an over-long one.
 */
export function isTitleWithin(value: unknown, max: number): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max;
}

/** A string within `max`, empty allowed — note bodies start blank. */
export function isContentWithin(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
