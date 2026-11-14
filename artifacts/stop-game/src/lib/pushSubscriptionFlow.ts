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

/**
 * Notify the UI that permission is taking unusually long without cancelling
 * or replacing the original browser permission Promise.
 */
export function waitForPermissionResult<T>(
  permissionRequest: Promise<T>,
  onWaiting: () => void,
  waitingAfterMs = 15000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(onWaiting, waitingAfterMs);
    permissionRequest.then(resolve, reject).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  });
}
