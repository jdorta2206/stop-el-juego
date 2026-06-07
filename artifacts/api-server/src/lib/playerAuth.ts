import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const TTL_MS = 365 * 24 * 3600 * 1000;
const COOKIE_NAME = "stop_pt";
const HEADER_NAME = "x-stop-token";

let warnedMissingSecret = false;

/**
 * Resolve the signing secret lazily so the API can boot even if SESSION_SECRET
 * is not yet configured — only routes that actually mint/verify tokens fail
 * (with a clear log) instead of taking down the whole server. Returns null
 * when no usable secret is present.
 */
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
  if (Date.now() > Number(exp)) return null;
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

/**
 * Set the auth cookie on the response and return the token (also embedded in
 * localStorage by the OAuth bridge page so cross-origin clients without
 * cookies can send it via X-Stop-Token). Returns null if the secret isn't set.
 */
export function issuePlayerToken(res: Response, playerId: string): string | null {
  const token = signPlayerToken(playerId);
  if (!token) return null;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // "none" + secure lets the cookie ride cross-origin fetches with
    // credentials:include, which is required for the TWA case: the OAuth
    // callback sets the cookie on the canonical domain (stop-el-juego),
    // but the TWA loads from stopjuegodepalabras.com. With sameSite=lax
    // the cross-origin /api/auth/me fetch couldn't carry the cookie and
    // the user kept seeing the login modal on every cold start.
    sameSite: "none",
    secure: true,
    maxAge: TTL_MS,
    path: "/",
  });
  return token;
}

/**
 * Clear the auth cookie on logout. Must mirror the EXACT attributes used in
 * issuePlayerToken (sameSite/secure/path) — browsers only delete a cookie when
 * the clearing attributes match the ones it was set with.
 */
export function clearPlayerToken(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
  });
}

export const PLAYER_TOKEN_BRIDGE_KEY = "stop_session_token";

/**
 * OAuth-account id prefixes. Logged-in users get an id like `google_123`,
 * `fb_…`, etc. Guests use a random `crypto.randomUUID()` with none of these.
 */
const OAUTH_ID_PREFIXES = ["google_", "fb_", "ig_", "apple_", "tt_"];

/** True when this playerId belongs to a logged-in OAuth account (not a guest). */
export function isLoggedInId(playerId: string | null | undefined): boolean {
  return !!playerId && OAUTH_ID_PREFIXES.some((p) => playerId.startsWith(p));
}

/** True when the server can mint/verify tokens (SESSION_SECRET configured). */
export function isAuthConfigured(): boolean {
  return getSigningSecret() !== null;
}

/**
 * Identity binding for routes shared by BOTH guests and logged-in users
 * (Stripe billing, leaderboard, custom packs). It blocks IDOR/impersonation of
 * real accounts WITHOUT breaking the guest-first multiplayer model:
 *   - Guests (random-UUID ids): always allowed — they have no token to verify.
 *   - Logged-in (OAuth-prefixed) ids: REQUIRE a signed token matching the
 *     claimed id, so nobody can act on another account by guessing its public id.
 * Fails OPEN when auth isn't configured so a missing secret can't lock everyone
 * out of the live game. Returns true when the request may proceed.
 */
export function verifyClaimedIdentity(
  req: Request,
  claimedId: string | null | undefined,
): boolean {
  if (!claimedId) return true;
  if (!isLoggedInId(claimedId)) return true;
  if (!isAuthConfigured()) return true;
  return readPlayerId(req) === claimedId;
}
