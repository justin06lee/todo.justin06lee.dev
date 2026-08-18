import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-time";

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0); // 2026-08-17T12:00Z

describe("formatRelativeTime", () => {
  it("says just now under a minute", () => {
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW, NOW - 59_000)).toBe("just now");
  });

  it("counts minutes, then hours", () => {
    expect(formatRelativeTime(NOW, NOW - 60_000)).toBe("1m ago");
    expect(formatRelativeTime(NOW, NOW - 59 * 60_000)).toBe("59m ago");
    expect(formatRelativeTime(NOW, NOW - 60 * 60_000)).toBe("1h ago");
    expect(formatRelativeTime(NOW, NOW - 23 * 60 * 60_000)).toBe("23h ago");
  });

  it("says yesterday between one and two days", () => {
    expect(formatRelativeTime(NOW, NOW - 24 * 60 * 60_000)).toBe("yesterday");
    expect(formatRelativeTime(NOW, NOW - 47 * 60 * 60_000)).toBe("yesterday");
  });

  it("falls back to a short date, with the year only when it differs", () => {
    expect(formatRelativeTime(NOW, Date.UTC(2026, 7, 12))).toBe("aug 12");
    expect(formatRelativeTime(NOW, Date.UTC(2025, 11, 30))).toBe("dec 30, 2025");
  });
});
