/**
 * Remove query strings and fragments from absolute URLs embedded in browser
 * diagnostics. They can contain signed asset URLs or transient credentials.
 */
export function sanitizeDiagnosticText(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/https?:\/\/[^\s)"'<>]+/gi, (candidate) => {
    try {
      const parsed = new URL(candidate);
      return parsed.origin + parsed.pathname;
    } catch {
      return candidate.replace(/[?#].*$/, "");
    }
  });
}
