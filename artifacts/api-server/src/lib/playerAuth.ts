import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// Session token / cookie lifetime. Kept short (30 days) to bound the blast
// radius of a leaked token. Active players never notice expiry because
// /auth/me re-issues a fresh token on every session restore (sliding window),
// and the web client also slides it forward in the background on each load for
// logged-in users — so only accounts dormant for >30 days must re-authenticate.
const TTL_MS = 30 * 24 * 3600 * 1000;
const COOKIE_NAME = "stop_pt";
const HEADER_NAME = "x-stop-token";

let warnedMissingSecret = false;

function getSigningSecret(): string | null {
  const s = process.env["SESSION_SECRET"];
  if (s && s.length >= 16) return s;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.error(
      "[playerAuth] SESSION_SECRET is missing or too short (<16 chars). " +
        "Season Pass auth endpoints will return 503 until it is set. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return null;
}

export function signPlayerToken(playerId: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const exp = Date.now() + TTL_MS;
  const payload = `${playerId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPlayerToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const secret = getSigningSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [pid, exp, sig] = parts;
  if (!pid || !exp || !sig) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${pid}.${exp}`)
    .digest("base64url");
  let ok = false;
  try {
    ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return null;
  }
  if (!ok) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs <= 0 || Date.now() > expMs) return null;
  return pid;
}

export interface AuthedRequest extends Request {
  playerId?: string;
}

/** Extract a verified playerId from cookie or X-Stop-Token header, or null. */
export function readPlayerId(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME] as string | undefined;
  const rawHeader = req.headers[HEADER_NAME];
  const headerToken = typeof rawHeader === "string" ? rawHeader : undefined;
  return verifyPlayerToken(cookieToken) ?? verifyPlayerToken(headerToken);
}

/** Middleware: 401s unless caller has a valid signed playerId token. */
export function requirePlayerIdentity(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!getSigningSecret()) {
    res.status(503).json({ error: "Server auth not configured" });
    return;
  }
  const pid = readPlayerId(req);
  if (!pid) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.playerId = pid;
  next();
}

export function issuePlayerToken(res: Response, playerId: string): string | null {
  const token = signPlayerToken(playerId);
  if (!token) return null;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: TTL_MS,
    path: "/",
  });
  return token;
}

export function clearPlayerToken(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
  });
}

export const PLAYER_TOKEN_BRIDGE_KEY = "stop_session_token";

const OAUTH_ID_PREFIXES = ["google_", "fb_", "ig_", "apple_", "tt_"];

export function isLoggedInId(playerId: string | null | undefined): boolean {
  return !!playerId && OAUTH_ID_PREFIXES.some((p) => playerId.startsWith(p));
}

export function isAuthConfigured(): boolean {
  return getSigningSecret() !== null;
}

/**
 * Identity binding for routes shared by BOTH guests and logged-in users.
 * Guest ids remain intentionally anonymous. OAuth ids are fail-closed: if
 * authentication is unavailable, an authenticated-account operation is
 * rejected rather than falling back to an unauthenticated identity check.
 */
export function verifyClaimedIdentity(
  req: Request,
  claimedId: string | null | undefined,
): boolean {
  if (!claimedId) return false;
  if (!isLoggedInId(claimedId)) return true;
  if (!isAuthConfigured()) return false;
  return readPlayerId(req) === claimedId;
}
