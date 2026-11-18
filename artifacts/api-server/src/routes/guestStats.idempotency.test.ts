import { describe, expect, it } from "vitest";
import { isGuestStatsEventId } from "../lib/guestStatsEvent";

describe("guest stats event identifiers", () => {
  it("accepts stable UUID-style event identifiers", () => {
    expect(isGuestStatsEventId("9d9e5c62-21f3-4c8d-99f8-1ecf6d4e8f01")).toBe(true);
  });

  it("rejects missing, short, or unsafe event identifiers", () => {
    expect(isGuestStatsEventId(undefined)).toBe(false);
    expect(isGuestStatsEventId("short")).toBe(false);
    expect(isGuestStatsEventId("invalid id with spaces")).toBe(false);
  });
});
