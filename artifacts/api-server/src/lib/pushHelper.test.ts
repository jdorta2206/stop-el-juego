import { describe, expect, it } from "vitest";
import { isStalePushEndpointStatus } from "./pushHelper";

describe("push subscription stale endpoint detection", () => {
  it.each([404, 410])("treats HTTP %i as an expired endpoint", (status) => {
    expect(isStalePushEndpointStatus(status)).toBe(true);
  });

  it.each([400, 401, 403, 408, 429, 500, undefined, null])(
    "preserves subscriptions for non-expiry status %s",
    (status) => {
      expect(isStalePushEndpointStatus(status)).toBe(false);
    },
  );
});
