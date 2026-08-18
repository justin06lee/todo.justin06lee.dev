import { describe, expect, it } from "vitest";

import {
  MAX_TASK_TITLE_LEN,
  isContentWithin,
  isRecordId,
  isTitleWithin,
} from "./validate";

describe("isRecordId", () => {
  it("accepts crypto.randomUUID output", () => {
    expect(isRecordId(crypto.randomUUID())).toBe(true);
  });

  it("rejects non-uuid strings and non-strings", () => {
    expect(isRecordId("1")).toBe(false);
    expect(isRecordId("'; DROP TABLE todo_tasks; --")).toBe(false);
    expect(isRecordId("")).toBe(false);
    expect(isRecordId(42)).toBe(false);
    expect(isRecordId(null)).toBe(false);
    expect(isRecordId(undefined)).toBe(false);
  });
});

describe("isTitleWithin", () => {
  it("accepts a plain title", () => {
    expect(isTitleWithin("buy milk", MAX_TASK_TITLE_LEN)).toBe(true);
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(isTitleWithin("", MAX_TASK_TITLE_LEN)).toBe(false);
    expect(isTitleWithin("   ", MAX_TASK_TITLE_LEN)).toBe(false);
  });

  it("measures the trimmed value, since that is what gets stored", () => {
    const padded = " ".repeat(MAX_TASK_TITLE_LEN) + "a";
    expect(isTitleWithin(padded, MAX_TASK_TITLE_LEN)).toBe(true);
    expect(isTitleWithin("a".repeat(MAX_TASK_TITLE_LEN + 1), MAX_TASK_TITLE_LEN)).toBe(
      false,
    );
    expect(isTitleWithin("a".repeat(MAX_TASK_TITLE_LEN), MAX_TASK_TITLE_LEN)).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(isTitleWithin(7, MAX_TASK_TITLE_LEN)).toBe(false);
    expect(isTitleWithin(null, MAX_TASK_TITLE_LEN)).toBe(false);
  });
});

describe("isContentWithin", () => {
  it("allows empty content — note bodies start blank", () => {
    expect(isContentWithin("", 10)).toBe(true);
  });

  it("enforces the cap and the type", () => {
    expect(isContentWithin("a".repeat(10), 10)).toBe(true);
    expect(isContentWithin("a".repeat(11), 10)).toBe(false);
    expect(isContentWithin(undefined, 10)).toBe(false);
  });
});
