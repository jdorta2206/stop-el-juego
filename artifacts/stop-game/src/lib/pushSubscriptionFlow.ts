/**
 * Keep browser permission requests single-flight. The operation is invoked
 * synchronously so Notification.requestPermission() can use the click gesture.
 */
export function runSingleFlight<T>(
  getCurrent: () => Promise<T> | null,
  setCurrent: (operation: Promise<T> | null) => void,
  operation: () => Promise<T>,
): Promise<T> {
  const current = getCurrent();
  if (current) return current;

  const pending = operation();
  setCurrent(pending);

  // Handle both outcomes without creating an unobserved rejected promise.
  void pending.then(
    () => { if (getCurrent() === pending) setCurrent(null); },
    () => { if (getCurrent() === pending) setCurrent(null); },
  );
  return pending;
}

export class PermissionRequestTimeoutError extends Error {
  constructor() {
    super("Permission request timed out; the original request is still pending");
    this.name = "PermissionRequestTimeoutError";
  }
}

/**
 * Notify the UI when permission is slow and release the UI after a timeout.
 * The original browser Promise cannot be cancelled; its handlers stay attached.
 */
export function waitForPermissionResult<T>(
  permissionRequest: Promise<T>,
  onWaiting: () => void,
  waitingAfterMs = 15000,
  timeoutAfterMs = 30000,
): Promise<T> {
  let waitingTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    const clearTimers = () => {
      if (waitingTimer !== undefined) {
        clearTimeout(waitingTimer);
        waitingTimer = undefined;
      }
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
    };

    waitingTimer = setTimeout(onWaiting, waitingAfterMs);
    timeoutTimer = setTimeout(() => {
      clearTimers();
      reject(new PermissionRequestTimeoutError());
    }, timeoutAfterMs);

    // Keep observing the original request even if the UI timeout wins.
    permissionRequest.then(
      (value) => {
        clearTimers();
        resolve(value);
      },
      (error) => {
        clearTimers();
        reject(error);
      },
    );
  });
}
