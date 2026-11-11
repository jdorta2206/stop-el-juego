export function isStalePushEndpointStatus(statusCode: unknown): boolean {
  return statusCode === 404 || statusCode === 410;
}
