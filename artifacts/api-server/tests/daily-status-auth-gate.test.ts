import { describe, expect, it } from "vitest";
import { getDailyStatusRequestMode } from "../../stop-game/src/lib/dailyStatusAuthGate";

describe("daily status auth restore gate", () => {
  const account = { loginMethod: "google" };
  const guest = { loginMethod: "guest" };

  it("waits while a persisted account session is being restored", () => {
    expect(getDailyStatusRequestMode(account, "pending")).toBe("wait");
  });

  it("uses the server only after the account session is restored", () => {
    expect(getDailyStatusRequestMode(account, "restored")).toBe("server");
  });

  it("keeps the local banner when session restoration is unavailable", () => {
    expect(getDailyStatusRequestMode(account, "unavailable")).toBe("local");
  });

  it("keeps guest and anonymous players on the existing local path", () => {
    expect(getDailyStatusRequestMode(guest, "pending")).toBe("local");
    expect(getDailyStatusRequestMode(null, "pending")).toBe("local");
  });
});
