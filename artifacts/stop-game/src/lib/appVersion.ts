// ─── Installed Android (TWA) app version ─────────────────────────────────
// The web page cannot natively know which build of the Play Store app is
// running around it. To fix that, the TWA wrapper reports its version to the
// web on launch in one of two ways:
//   1. the `?appVersion=` query param on the launch URL, OR
//   2. a `STOPApp/<version>` token appended to the User-Agent.
// We capture whichever is present on the first load, persist it (URL params
// are lost as soon as the user navigates), and compare it against the minimum
// recommended version below so we only nudge users who are actually behind.

const STORAGE_KEY = "stop_app_version";

// ── Configurable threshold ──────────────────────────────────────────────
// Bump this to the latest published versionName whenever you ship an Android
// build you want everyone on. Anyone whose installed version is >= this value
// will NOT see the "update available" prompt.
export const MIN_RECOMMENDED_APP_VERSION = "1.0.0";

function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t ? t : null;
}

function readFromUrl(): string | null {
  try {
    return clean(new URLSearchParams(window.location.search).get("appVersion"));
  } catch {
    return null;
  }
}

function readFromUserAgent(): string | null {
  try {
    const m = (navigator.userAgent || "").match(/STOPApp\/([0-9][0-9.]*)/i);
    return clean(m && m[1] ? m[1] : null);
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return clean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// Capture the version the TWA reported this launch and persist it. A freshly
// reported value (URL, then UA) always wins over the stored one, so an update
// is reflected the moment the new build launches with a higher value. Call
// this once, early, before any later navigation can drop the query param.
export function captureInstalledAppVersion(): string | null {
  const fresh = readFromUrl() ?? readFromUserAgent();
  if (fresh) {
    try {
      localStorage.setItem(STORAGE_KEY, fresh);
    } catch {
      /* storage unavailable — fine, we still return the fresh value */
    }
    return fresh;
  }
  return readStored();
}

// Best-effort lookup of the installed version: persisted value first, then a
// live re-read of the URL / UA in case capture hasn't run yet.
export function getInstalledAppVersion(): string | null {
  return readStored() ?? readFromUrl() ?? readFromUserAgent();
}

// Compares dotted numeric versions ("1.2.3", "42"). Returns -1 if a < b, 0 if
// equal, 1 if a > b. Non-numeric / missing segments are treated as 0.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = b.split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Whether to nudge the user to update. We only have a version for builds that
// report it: an OLD build (one that predates this feature) reports nothing, so
// an unknown version is treated as "behind" and still gets nudged. A build
// that reports a version >= the threshold is up to date and is left alone.
export function isAppUpdateRecommended(): boolean {
  const installed = getInstalledAppVersion();
  if (!installed) return true;
  return compareVersions(installed, MIN_RECOMMENDED_APP_VERSION) < 0;
}
