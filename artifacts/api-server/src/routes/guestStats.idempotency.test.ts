import { describe, expect, it } from "vitest";

const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

describe("guest stats event identifiers", () => {
  it("accepts stable UUID-style event identifiers", () => {
    expect(EVENT_ID_PATTERN.test("9d9e5c62-21f3-4c8d-99f8-1ecf6d4e8f01")).toBe(true);
  });

  it("rejects missing, short, or unsafe event identifiers", () => {
    expect(EVENT_ID_PATTERN.test("")).toBe(false);
    expect(EVENT_ID_PATTERN.test("short")).toBe(false);
    expect(EVENT_ID_PATTERN.test("invalid id with spaces")).toBe(false);
  });
});
