import { afterEach, describe, expect, it, vi } from "vitest";
import { runSingleFlight, waitForPermissionResult } from "../../stop-game/src/lib/pushSubscriptionFlow";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("push permission operation coordination", () => {
  afterEach(() => vi.useRealTimers());

  it("reuses the active permission operation instead of starting a second one", async () => {
    const request = deferred<boolean>();
    let active: Promise<boolean> | null = null;
    let calls = 0;
    const start = () => runSingleFlight(
      () => active,
      (next) => { active = next; },
      () => { calls += 1; return request.promise; },
    );

    const first = start();
    const second = start();
    expect(second).toBe(first);
    expect(calls).toBe(1);

    request.resolve(true);
    await first;
    await Promise.resolve();
    expect(active).toBeNull();
  });

  it("shows a waiting state after 15 seconds but still resolves from the original permission result", async () => {
    vi.useFakeTimers();
    const request = deferred<"granted" | "denied">();
    const onWaiting = vi.fn();
    const result = waitForPermissionResult(request.promise, onWaiting, 15000);

    await vi.advanceTimersByTimeAsync(14999);
    expect(onWaiting).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onWaiting).toHaveBeenCalledTimes(1);

    request.resolve("granted");
    await expect(result).resolves.toBe("granted");
  });

  it("releases the UI with a timeout when Android never settles the permission request", async () => {
    vi.useFakeTimers();
    const request = deferred<"granted" | "denied">();
    const onWaiting = vi.fn();
    const result = waitForPermissionResult(request.promise, onWaiting, 15000, 30000);
    // Attach the rejection assertion before advancing timers so the intentional
    // timeout rejection is observed immediately by the test runner.
    const timedOut = expect(result).rejects.toThrow("Permission request timed out");

    await vi.advanceTimersByTimeAsync(15000);
    expect(onWaiting).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14999);
    await vi.advanceTimersByTimeAsync(1);
    await timedOut;

    // The browser promise may settle after the UI timeout; it must be observed.
    request.resolve("granted");
    await Promise.resolve();
  });

  it("propagates a late permission rejection and clears the waiting timer", async () => {
    vi.useFakeTimers();
    const request = deferred<string>();
    const onWaiting = vi.fn();
    const result = waitForPermissionResult(request.promise, onWaiting, 15000);

    request.reject(new Error("permission failed"));
    await expect(result).rejects.toThrow("permission failed");
    await vi.advanceTimersByTimeAsync(15000);
    expect(onWaiting).not.toHaveBeenCalled();
  });
});
