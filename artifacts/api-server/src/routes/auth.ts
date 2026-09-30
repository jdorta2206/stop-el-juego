import { Router } from "express";


const OAUTH_FETCH_TIMEOUT_MS = 15_000;

async function oauthFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { issuePlayerToken, clearPlayerToken, PLAYER_TOKEN_BRIDGE_KEY, readPlayerId, isLoggedInId } from "../lib/playerAuth";
import { db, playerScoresTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { revokePlayerId, markPlayerRevoked, isPlayerRevoked } from "../lib/playerRevocation";

const router = Router();

const oauthHandoffTableReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS oauth_handoffs (
    code_hash text PRIMARY KEY,
    payload_json text NOT NULL,
    expires_at timestamptz NOT NULL
  )
`).then(() => db.execute(sql`
  CREATE INDEX IF NOT EXISTS oauth_handoffs_expires_idx
    ON oauth_handoffs (expires_at)
`)).catch((err) => {
  console.error("[auth] failed to initialize OAuth handoff storage:", err);
  throw err;
});

const oauthHandoffCleanup = setInterval(() => {
  void oauthHandoffTableReady.then(() => db.execute(sql`
    DELETE FROM oauth_handoffs WHERE expires_at <= NOW()
  `)).catch((err) => console.error("[auth] OAuth handoff cleanup failed:", err));
}, 5 * 60 * 1000);
oauthHandoffCleanup.unref?.();

async function createOAuthHandoff(items: [string, string][]): Promise<string> {
  await oauthHandoffTableReady;
  const code = crypto.randomBytes(32).toString("base64url");
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  await db.execute(sql`
    INSERT INTO oauth_handoffs (code_hash, payload_json, expires_at)
    VALUES (${codeHash}, ${JSON.stringify(items)}, NOW() + INTERVAL '2 minutes')
  `);
  return code;
}

// ── OAuth response shapes ───────────────────────────────────────────────────
// External JSON from each provider. We only declare the fields we actually read;
// everything is optional because the provider may omit fields or return an error
// body instead of the success body.
interface OAuthTokenResponse {
  access_token?: string;
  id_token?: string;
  open_id?: string;
  data?: { access_token?: string; open_id?: string };
  error?: string;
  error_type?: string;
  error_description?: string;
  error_message?: string;
}
interface OAuthProfile {
  sub?: string;
  id?: string;
  name?: string;
  username?: string;
  display_name?: string;
  email?: string;
  picture?: string | { data?: { url?: string } };
  profile_picture_url?: string;
  avatar_url?: string;
  open_id?: string;
}
interface TikTokUserResponse {
  data?: { user?: OAuthProfile };
  user?: OAuthProfile;
}

// Canonical origin where OAuth runs — it's the ONLY origin registered as the
// redirect_uri in the Google/Facebook/Instagram consoles, and after auth we
// bounce the user back to whatever SAFE_RETURN_ORIGIN they came from (e.g.
// www.stopjuegodepalabras.com / the TWA). Configurable per-environment via the
// APP_ORIGIN env var. The fallback MUST be a LIVE, registered production origin:
// using the Replit dev-preview domain here meant any deploy without APP_ORIGIN
// set (e.g. the external host serving www) bounced social login to the stopped
// dev workspace and showed Replit's "Run this app" placeholder.
const APP_ORIGIN = process.env["APP_ORIGIN"] || "https://stop-el-juego.replit.app";

// Domains where it's safe to bounce the user back after OAuth. We keep this
// allowlist so a hostile referer can't turn our bridge into an open redirect.
// OAuth always runs on APP_ORIGIN (the only origin registered in the
// Google/Facebook/Instagram consoles), but the user may have started from
// stopjuegodepalabras.com (the TWA domain) — in that case we want them back
// where they came from so the TWA stays inside its trusted scope.
const SAFE_RETURN_ORIGINS = new Set<string>([
  "https://stop-el-juego.replit.app",
  "https://stopjuegodepalabras.com",
  "https://www.stopjuegodepalabras.com",
  APP_ORIGIN, // dev/prod canonical
]);

function pickReturnOrigin(req: Request, requestedOrigin: string | null): string {
  if (requestedOrigin && SAFE_RETURN_ORIGINS.has(requestedOrigin)) {
    return requestedOrigin;
  }
  // Try to infer from Referer when the client didn't pass an explicit origin
  // (e.g. legacy OAuth links). Falls back to APP_ORIGIN otherwise.
  const ref = req.get("referer") || "";
  try {
    const refOrigin = new URL(ref).origin;
    if (SAFE_RETURN_ORIGINS.has(refOrigin)) return refOrigin;
  } catch { /* malformed referer — ignore */ }
  return APP_ORIGIN;
}

/**
 * OAuth callbacks always land on APP_ORIGIN. When login starts from another
 * allowlisted origin (www/TWA), bounce the start request through APP_ORIGIN
 * first so the nonce cookie is created on the SAME origin that receives the
 * provider callback. Without this, the callback could not bind state to the
 * initiating browser and login-CSRF remained possible across origins.
 */
function redirectOAuthStartToCanonical(
  req: Request,
  res: Response,
  provider: string,
): boolean {
  const host = req.get("host");
  let appHost = "";
  try { appHost = new URL(APP_ORIGIN).host; } catch { return false; }
  if (!host || host === appHost) return false;

  const returnPath = typeof req.query["return"] === "string" ? req.query["return"] : "/";
  const requestedOrigin = typeof req.query["origin"] === "string" ? req.query["origin"] : null;
  const returnOrigin = pickReturnOrigin(req, requestedOrigin);
  const params = new URLSearchParams({ return: returnPath, origin: returnOrigin });
  res.redirect(APP_ORIGIN + "/api/auth/" + provider + "/start?" + params.toString());
  return true;
}
/** Encode {returnPath, returnOrigin} into the OAuth `state` param. Keep it
 *  short — Google/Facebook accept up to ~2KB but smaller is safer. */
function encodeAuthState(returnPath: string, returnOrigin: string): string {
  return encodeURIComponent(JSON.stringify({ r: returnPath, o: returnOrigin }));
}

/** Inverse of `encodeAuthState`. Tolerates legacy raw-path states so the
 *  switch-over doesn't strand in-flight OAuth flows after deploy. */
function decodeAuthState(raw: string | undefined): { returnPath: string; returnOrigin: string } {
  if (!raw) return { returnPath: "/", returnOrigin: APP_ORIGIN };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed === "object" && typeof parsed.r === "string") {
      const o = typeof parsed.o === "string" && SAFE_RETURN_ORIGINS.has(parsed.o)
        ? parsed.o
        : APP_ORIGIN;
      return { returnPath: parsed.r, returnOrigin: o };
    }
  } catch { /* not JSON — treat as legacy raw path */ }
  return { returnPath: raw.startsWith("/") ? raw : "/", returnOrigin: APP_ORIGIN };
}

// ── CSRF hardening for the OAuth `state` param ──────────────────────────────
// `state` used to carry only navigation info (returnPath/returnOrigin), so it
// gave no protection against login-CSRF. We now (a) HMAC-sign the state with
// SESSION_SECRET plus a timestamp (15-min TTL) and (b) bind it to the browser
// with a single-use httpOnly nonce cookie set at /start.
//
// Cross-origin caveat: /start runs on the user's current origin (e.g. www via
// Railway) but the provider always redirects to the callback on APP_ORIGIN
// (stop-el-juego.replit.app). The Lax nonce cookie set at /start therefore only
// reaches the callback when BOTH ran on the same origin (replit.app / dev). So
// we ENFORCE binding only when the nonce cookie is present and FAIL OPEN when
// it's absent (the cross-origin www path), keeping the fragile live login
// working everywhere while still adding real CSRF protection on the
// same-origin path. Apple (form_post → cross-site POST) never sends the Lax
// cookie either, so it also fails open — fine, it isn't enabled.
const OAUTH_NONCE_COOKIE = "stop_oauth_nonce";
const STATE_TTL_MS = 15 * 60 * 1000;

function stateSecret(): string | null {
  const s = process.env["SESSION_SECRET"];
  return s && s.length >= 16 ? s : null;
}

const NONCE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true,
  path: "/",
};

/** Set a single-use nonce cookie and return a signed state carrying it. Falls
 *  back to the legacy unsigned encoding when no secret is configured. */
function beginAuthState(res: Response, returnPath: string, returnOrigin: string): string {
  const secret = stateSecret();
  if (!secret) return encodeAuthState(returnPath, returnOrigin);
  const nonce = crypto.randomBytes(16).toString("base64url");
  res.cookie(OAUTH_NONCE_COOKIE, nonce, { ...NONCE_COOKIE_OPTS, maxAge: STATE_TTL_MS });
  const body = Buffer.from(
    JSON.stringify({ r: returnPath, o: returnOrigin, n: nonce, t: Date.now() }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

function parseSignedState(
  raw: string | undefined,
): { r: string; o: string; n: string; t: number } | null {
  if (!raw || !raw.startsWith("v1.")) return null;
  const secret = stateSecret();
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  let ok = false;
  try {
    ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof p["r"] === "string" && typeof p["n"] === "string" && typeof p["t"] === "number") {
      const o =
        typeof p["o"] === "string" && SAFE_RETURN_ORIGINS.has(p["o"])
          ? (p["o"] as string)
          : APP_ORIGIN;
      return { r: p["r"] as string, o, n: p["n"] as string, t: p["t"] as number };
    }
  } catch {
    /* malformed payload */
  }
  return null;
}

/** Resolve the return target AND check CSRF. Enforcement is limited to the
 *  same-origin path (nonce cookie present); the cross-origin path fails open. */
function verifyAuthState(
  req: Request,
  res: Response,
): { returnPath: string; returnOrigin: string; csrfFail: boolean; authStartedAt: number | null } {
  const raw = (req.query?.["state"] ?? req.body?.["state"]) as string | undefined;
  const nonceCookie = req.cookies?.[OAUTH_NONCE_COOKIE] as string | undefined;
  if (nonceCookie) res.clearCookie(OAUTH_NONCE_COOKIE, NONCE_COOKIE_OPTS);

  const signed = parseSignedState(raw);

  // Same-origin path: a nonce cookie was issued for THIS flow, so we MUST see a
  // valid signed state whose embedded nonce matches. Anything else (unsigned /
  // legacy / malformed / stale / mismatched) is a CSRF failure — never fall back
  // to the legacy decode here, or an attacker could downgrade to bypass the nonce.
  if (nonceCookie) {
    if (!signed) {
      return { returnPath: "/", returnOrigin: APP_ORIGIN, csrfFail: true, authStartedAt: signed?.t ?? null };
    }
    const age = Date.now() - signed.t;
    const fresh = age <= STATE_TTL_MS && age >= -60_000;
    let match = false;
    try {
      match =
        nonceCookie.length === signed.n.length &&
        crypto.timingSafeEqual(Buffer.from(nonceCookie), Buffer.from(signed.n));
    } catch {
      match = false;
    }
    if (!fresh || !match) {
      return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: true, authStartedAt: signed.t };
    }
    return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: false, authStartedAt: signed.t };
  }

  // No nonce cookie reached this host (cross-origin www/TWA, Apple form_post,
  // legacy links, or no SESSION_SECRET configured): fail open so login works.
  if (signed) {
    // Trust the integrity-checked (HMAC) payload for the return target.
    return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: false };
  }
  // Legacy / unsigned state — preserve prior behavior.
  const legacy = decodeAuthState(raw);
  return { returnPath: legacy.returnPath, returnOrigin: legacy.returnOrigin, csrfFail: false, authStartedAt: null };
}

// ── Dedup cache: prevent double-use of OAuth codes (mobile browsers fire callback twice) ──
const usedCodes = new Set<string>();
function claimCode(code: string): boolean {
  if (usedCodes.has(code)) return false;
  usedCodes.add(code);
  setTimeout(() => usedCodes.delete(code), 60_000);
  return true;
}

// Helper: build a tiny HTML page that redirects to the destination origin.
// OAuth material is stored server-side under a single-use, 2-minute handoff code.
// The code is intentionally opaque and contains no session/provider credentials.
async function bridgePageMulti(
  items: [string, string][],
  returnPath: string,
  returnOrigin: string = APP_ORIGIN,
) {
  const handoffCode = await createOAuthHandoff(items);
  const baseDest = returnOrigin + returnPath;
  const separator = baseDest.includes("?") ? "&" : "?";
  const handoffDest = baseDest + separator + "stopauth=" + encodeURIComponent(handoffCode);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Conectando...</title>
<style>body{background:#0d1757;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.logo{text-align:center;}.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,.2);border-top-color:#f9a825;border-radius:50%;animation:spin 0.8s linear infinite;margin:16px auto;}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="logo"><div class="spinner"></div><p>Conectando cuenta...</p></div>
<script>window.location.replace(${JSON.stringify(handoffDest)});</script>
</body></html>`;
}

// The destination redeems the opaque handoff with POST, so the actual OAuth
// session token and provider token never travel in a URL, Referer, or access log.
router.post("/handoff", async (req: Request, res: Response) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(code)) {
    return res.status(400).json({ error: "Invalid handoff code" });
  }

  try {
    await oauthHandoffTableReady;
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const payload = await db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        SELECT payload_json
        FROM oauth_handoffs
        WHERE code_hash = ${codeHash}
          AND expires_at > NOW()
        FOR UPDATE
      `);
      const row = (rows.rows as any[])[0];
      if (!row) return null;
      await tx.execute(sql`DELETE FROM oauth_handoffs WHERE code_hash = ${codeHash}`);
      return typeof row.payload_json === "string" ? row.payload_json : null;
    });

    if (!payload) {
      return res.status(410).json({ error: "Handoff expired or already used" });
    }

    let items: unknown;
    try { items = JSON.parse(payload); } catch {
      return res.status(500).json({ error: "Invalid handoff payload" });
    }
    if (!Array.isArray(items)) {
      return res.status(500).json({ error: "Invalid handoff payload" });
    }

    return res.json({ items });
  } catch (err: any) {
    console.error("[auth/handoff] redemption failed:", err?.message ?? err);
    return res.status(503).json({ error: "OAuth handoff unavailable" });
  }
});

async function persistOAuthProfile(
  playerId: string,
  playerName: string,
  profilePicture: string | null,
  authStartedAt: number | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);
    const revoked = await tx.execute(sql`
      SELECT revoked_at FROM revoked_player_ids WHERE player_id = ${playerId} LIMIT 1
    `);
    const revokedAt = (revoked.rows?.[0] as { revoked_at?: string | Date } | undefined)?.revoked_at;
    if (revokedAt && authStartedAt != null) {
      const revokedMs = new Date(revokedAt).getTime();
      if (Number.isFinite(revokedMs) && revokedMs >= authStartedAt) {
        throw new Error("Account was deleted during OAuth login");
      }
    }
    await tx.insert(playerScoresTable).values({
      playerId,
      playerName,
      avatarColor: "#f9a825",
      profilePicture,
    }).onConflictDoUpdate({
      target: playerScoresTable.playerId,
      set: { playerName, profilePicture, updatedAt: new Date() },
    });
    await tx.execute(sql`DELETE FROM revoked_player_ids WHERE player_id = ${playerId}`);
  });
}

// ── GOOGLE ─────────────────────────────────────────────────────────────────────

router.get("/google/start", (req: Request, res: Response) => {
  if (redirectOAuthStartToCanonical(req, res, "google")) return;
  const GOOGLE_CLIENT_ID = process.env["VITE_GOOGLE_CLIENT_ID"];
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=google_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/google/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const requestedOrigin = typeof req.query["origin"] === "string" ? req.query["origin"] : null;
  const returnOrigin = pickReturnOrigin(req, requestedOrigin);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const { returnPath, returnOrigin, csrfFail, authStartedAt } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;

  const GOOGLE_CLIENT_ID     = process.env["VITE_GOOGLE_CLIENT_ID"];
  const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"];

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=google_cancelled`);
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=google_not_configured`);
  }
  if (!claimCode(`google_${code}`)) {
    return res.redirect(`${returnOrigin}${returnPath}`);
  }

  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/google/callback`;

    // Exchange code → tokens
    const tokenRes = await oauthFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    console.log("Google token response keys:", Object.keys(tokenData));
    if (tokenData.error) {
      console.error("Google token error:", tokenData.error, tokenData.error_description);
      throw new Error(`Google error: ${tokenData.error} - ${tokenData.error_description}`);
    }

    let payload: OAuthProfile | null = null;

    if (tokenData.id_token) {
      // Decode JWT payload
      payload = JSON.parse(
        Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()
      ) as OAuthProfile;
    } else if (tokenData.access_token) {
      // Fallback: use userinfo endpoint
      const userinfoRes = await oauthFetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      payload = (await userinfoRes.json()) as OAuthProfile;
    } else {
      throw new Error("No id_token or access_token in Google response");
    }

    const googleSub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!googleSub) throw new Error("No sub from Google");
    const playerId = `google_${googleSub}`;
    const googlePicture = typeof payload.picture === "string" ? payload.picture : null;
    await persistOAuthProfile(playerId, String(payload.name || "Usuario").trim().slice(0, 14) || "Usuario", googlePicture, authStartedAt);

    const user = JSON.stringify({
      id:       playerId,
      name:     payload.name,
      email:    payload.email,
      picture:  googlePicture,
      provider: "google",
    });

        const sessionToken = issuePlayerToken(res, playerId);
    res.send(await bridgePageMulti([
      ["oauth_user", user],
      ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : []),
    ], returnPath, returnOrigin));
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=google_failed`);
  }
});

// ── FACEBOOK ───────────────────────────────────────────────────────────────────

router.get("/facebook/start", (req: Request, res: Response) => {
  if (redirectOAuthStartToCanonical(req, res, "facebook")) return;
  const FACEBOOK_APP_ID = process.env["VITE_FACEBOOK_APP_ID"];
  if (!FACEBOOK_APP_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/facebook/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const requestedOrigin = typeof req.query["origin"] === "string" ? req.query["origin"] : null;
  const returnOrigin = pickReturnOrigin(req, requestedOrigin);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    scope: "email,public_profile",
    response_type: "code",
    state,
  });
  res.redirect(`https://www.facebook.com/v26.0/dialog/oauth?${params}`);
});

router.get("/facebook/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const { returnPath, returnOrigin, csrfFail, authStartedAt } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;

  const FACEBOOK_APP_ID     = process.env["VITE_FACEBOOK_APP_ID"];
  const FACEBOOK_APP_SECRET = process.env["FACEBOOK_APP_SECRET"];

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_cancelled`);
  }
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_not_configured`);
  }
  if (!claimCode(`fb_${code}`)) {
    return res.redirect(`${returnOrigin}${returnPath}`);
  }

  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/facebook/callback`;

    // Exchange code → access token
    const tokenRes = await oauthFetch(
      `https://graph.facebook.com/v26.0/oauth/access_token?` +
      new URLSearchParams({ client_id: FACEBOOK_APP_ID, redirect_uri: redirectUri, client_secret: FACEBOOK_APP_SECRET, code })
    );
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (!tokenData.access_token) throw new Error("No access_token");

    // Fetch profile
    const meRes = await oauthFetch(
      `https://graph.facebook.com/v26.0/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
    );
    const me = (await meRes.json()) as OAuthProfile;

    const facebookId = typeof me.id === "string" ? me.id.trim() : "";
    if (!facebookId) throw new Error("No id from Facebook");
    const playerId = `fb_${facebookId}`;
    const facebookName = String(me.name || "Facebook User").trim().slice(0, 14) || "Facebook User";
    const facebookPicture =
      (typeof me.picture === "object" ? me.picture.data?.url : undefined) || null;

    // Persist the OAuth profile on the server as well as in the client handoff.
    // This is important for Android/TWA: if the browser drops the handoff URL
    // during the provider return, /api/auth/me must still be able to hydrate
    // the logged-in player instead of returning name=null and reopening AuthModal.
    await persistOAuthProfile(playerId, facebookName, facebookPicture, authStartedAt);

    const user = JSON.stringify({
      id:       playerId,
      name:     facebookName,
      email:    me.email,
      picture:  facebookPicture,
      provider: "facebook",
    });

        const sessionToken = issuePlayerToken(res, playerId);
    res.send(await bridgePageMulti([
      ["oauth_user", user],
      ["fb_access_token", tokenData.access_token],
      ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : []),
    ], returnPath, returnOrigin));
  } catch (err) {
    console.error("Facebook OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=facebook_failed`);
  }
});

// ── INSTAGRAM ─────────────────────────────────────────────────────────────────

router.get("/instagram/start", (req: Request, res: Response) => {
  if (redirectOAuthStartToCanonical(req, res, "instagram")) return;
  const INSTAGRAM_CLIENT_ID = process.env["INSTAGRAM_CLIENT_ID"];
  if (!INSTAGRAM_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/instagram/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic",
    response_type: "code",
    state,
  });
  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
});

router.get("/instagram/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const { returnPath, returnOrigin, csrfFail, authStartedAt } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;

  const INSTAGRAM_CLIENT_ID     = process.env["INSTAGRAM_CLIENT_ID"];
  const INSTAGRAM_CLIENT_SECRET = process.env["INSTAGRAM_CLIENT_SECRET"];

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_cancelled`);
  }
  if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_not_configured`);
  }
  if (!claimCode(`ig_${code}`)) {
    return res.redirect(`${returnOrigin}${returnPath}`);
  }

  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/instagram/callback`;

    const tokenRes = await oauthFetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: INSTAGRAM_CLIENT_ID,
        client_secret: INSTAGRAM_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    console.log("Instagram token keys:", Object.keys(tokenData));
    if (tokenData.error_type || tokenData.error) {
      throw new Error(`Instagram error: ${tokenData.error_type || tokenData.error} - ${tokenData.error_message || tokenData.error_description}`);
    }
    if (!tokenData.access_token) throw new Error("No access_token from Instagram");

    const meRes = await oauthFetch(
      `https://graph.instagram.com/v21.0/me?fields=id,username,profile_picture_url&access_token=${tokenData.access_token}`
    );
    const me = (await meRes.json()) as OAuthProfile;

    const instagramId = typeof me.id === "string" ? me.id.trim() : "";
    if (!instagramId) throw new Error("No id from Instagram");
    const playerId = `ig_${instagramId}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     me.username || me.name || "Usuario",
      picture:  me.profile_picture_url || null,
      provider: "instagram",
    });

    await persistOAuthProfile(playerId, String(me.username || me.name || "Usuario").trim().slice(0, 14) || "Usuario", me.profile_picture_url || null, authStartedAt);

        const sessionToken = issuePlayerToken(res, playerId);
    res.send(await bridgePageMulti([
      ["oauth_user", user],
      ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : []),
    ], returnPath, returnOrigin));
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=instagram_failed`);
  }
});

// ── APPLE ─────────────────────────────────────────────────────────────────────
// Requires: APPLE_CLIENT_ID (Service ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (.p8 content)

function makeAppleClientSecret(): string {
  const privateKey = (process.env["APPLE_PRIVATE_KEY"] || "").replace(/\\n/g, "\n");
  const teamId     = process.env["APPLE_TEAM_ID"]!;
  const clientId   = process.env["APPLE_CLIENT_ID"]!;
  const keyId      = process.env["APPLE_KEY_ID"]!;

  return jwt.sign({}, privateKey, {
    algorithm: "ES256",
    keyid: keyId,
    issuer: teamId,
    audience: "https://appleid.apple.com",
    subject: clientId,
    expiresIn: "5m",
  });
}

router.get("/apple/start", (req: Request, res: Response) => {
  if (redirectOAuthStartToCanonical(req, res, "apple")) return;
  const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"];
  if (!APPLE_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/apple/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "name email",
    response_mode: "form_post",
    state,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// Apple sends a POST (form_post response_mode)
router.post("/apple/callback", async (req: Request, res: Response) => {
  const code  = req.body?.["code"]  as string | undefined;
  const { returnPath, returnOrigin, csrfFail, authStartedAt } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.body?.["error"] as string | undefined;

  const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"];

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_cancelled`);
  }
  if (!APPLE_CLIENT_ID || !process.env["APPLE_TEAM_ID"] || !process.env["APPLE_KEY_ID"] || !process.env["APPLE_PRIVATE_KEY"]) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
  }
  if (!claimCode(`apple_${code}`)) {
    return res.redirect(`${returnOrigin}${returnPath}`);
  }

  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/apple/callback`;
    const clientSecret = makeAppleClientSecret();

    // Exchange code → tokens
    const tokenRes = await oauthFetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (tokenData.error) throw new Error(`Apple error: ${tokenData.error}`);
    if (!tokenData.id_token) throw new Error("No id_token from Apple");

    // Decode the id_token (Apple's JWT) — no need to verify signature here, we trust Apple
    const payload = JSON.parse(
      Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()
    );

    // Apple only sends name on first login (via req.body.user JSON string)
    let displayName = "Apple User";
    try {
      const userJson = req.body?.["user"];
      if (userJson) {
        const u = typeof userJson === "string" ? JSON.parse(userJson) : userJson;
        const firstName = u?.name?.firstName || "";
        const lastName  = u?.name?.lastName  || "";
        displayName = `${firstName} ${lastName}`.trim() || displayName;
      }
    } catch (_) {}

    const appleSub = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!appleSub) throw new Error("No sub from Apple");
    const playerId = `apple_${appleSub}`;

    // Persist the Apple profile just like Google/Facebook/Instagram.
    // Without this row, a later /api/auth/me restore kept the session cookie
    // but returned name/avatar as null after the OAuth handoff was gone.
    await persistOAuthProfile(playerId, displayName.slice(0, 14) || "Apple User", null, authStartedAt);

    const user = JSON.stringify({
      id:       playerId,
      name:     displayName,
      email:    payload.email || null,
      picture:  null,
      provider: "apple",
    });

        const sessionToken = issuePlayerToken(res, playerId);
    res.send(await bridgePageMulti([
      ["oauth_user", user],
      ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : []),
    ], returnPath, returnOrigin));
  } catch (err) {
    console.error("Apple OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=apple_failed`);
  }
});

// ── TIKTOK ────────────────────────────────────────────────────────────────────

router.get("/tiktok/start", (req: Request, res: Response) => {
  if (redirectOAuthStartToCanonical(req, res, "tiktok")) return;
  const TIKTOK_CLIENT_KEY = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  if (!TIKTOK_CLIENT_KEY) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    redirect_uri: redirectUri,
    scope: "user.info.basic",
    response_type: "code",
    state,
  });
  res.redirect(`https://www.tiktok.com/v2/auth/authorize?${params}`);
});

router.get("/tiktok/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const { returnPath, returnOrigin, csrfFail, authStartedAt } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;

  const TIKTOK_CLIENT_KEY    = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  const TIKTOK_CLIENT_SECRET = process.env["TIKTOK_CLIENT_SECRET"]?.trim();

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_cancelled`);
  }
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  }

  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;

    const tokenRes = await oauthFetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    console.log("TikTok token keys:", Object.keys(tokenData));
    if (tokenData.error) throw new Error(`TikTok token error: ${tokenData.error}`);

    const accessToken = tokenData.access_token || tokenData.data?.access_token;
    if (!accessToken) throw new Error("No access_token from TikTok");

    const openId = tokenData.open_id || tokenData.data?.open_id;

    const meRes = await oauthFetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meData = (await meRes.json()) as TikTokUserResponse;
    const me = meData.data?.user || meData.user || {};

    const resolvedOpenId = typeof me.open_id === "string" && me.open_id.trim()
      ? me.open_id.trim()
      : typeof openId === "string" && openId.trim()
        ? openId.trim()
        : "";
    if (!resolvedOpenId) throw new Error("No open_id from TikTok");

    const playerId = `tt_${resolvedOpenId}`;
    const tiktokName = String(me.display_name || "TikToker").trim().slice(0, 14) || "TikToker";
    const tiktokPicture = typeof me.avatar_url === "string" ? me.avatar_url : null;

    await persistOAuthProfile(playerId, tiktokName, tiktokPicture, authStartedAt);

    const user = JSON.stringify({
      id:       playerId,
      name:     tiktokName,
      picture:  tiktokPicture,
      provider: "tiktok",
    });

        const sessionToken = issuePlayerToken(res, playerId);
    res.send(await bridgePageMulti([
      ["oauth_user", user],
      ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : []),
    ], returnPath, returnOrigin));
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_failed`);
  }
});

// ── /me — silent session restore ───────────────────────────────────────────────
// Lets the client re-hydrate the player profile on cold start using the
// long-lived signed cookie (or x-stop-token header in TWA/cross-origin
// scenarios where cookies don't reach this origin). Returns 200 with the
// profile if we recognize the session, 401 otherwise. Also re-issues the
// cookie to slide the expiration window forward — every visit extends the
// session by another year so casual players never get kicked out.
router.get("/me", async (req: Request, res: Response) => {
  const playerId = readPlayerId(req);
  if (!playerId || await isPlayerRevoked(playerId)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Derive loginMethod from the playerId prefix (google_, fb_, instagram_,
  // apple_, tiktok_). This matches how OAuth callbacks construct the IDs.
  const prefixMap: Record<string, string> = {
    google_: "google",
    fb_: "facebook",
    // OAuth callbacks mint Instagram ids as `ig_<id>` and TikTok as `tt_<id>`.
    // The longer `instagram_`/`tiktok_` keys stay for any legacy-format ids.
    ig_: "instagram",
    instagram_: "instagram",
    apple_: "apple",
    tt_: "tiktok",
    tiktok_: "tiktok",
  };
  let loginMethod: string | null = null;
  for (const [prefix, method] of Object.entries(prefixMap)) {
    if (playerId.startsWith(prefix)) {
      loginMethod = method;
      break;
    }
  }

  try {
    const rows = await db
      .select({
        playerId: playerScoresTable.playerId,
        playerName: playerScoresTable.playerName,
        avatarColor: playerScoresTable.avatarColor,
        profilePicture: playerScoresTable.profilePicture,
      })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId))
      .limit(1);

    const row = rows[0];

    // Slide the cookie expiration forward on every successful restore so
    // active players never expire.
    const refreshedToken = issuePlayerToken(res, playerId);

    if (!row) {
      // Cookie valid but no profile row yet (logged in, never played).
      // Tell client we know who they are so they can keep the session, but
      // they may want to log in again to capture their name/avatar.
      return res.json({
        id: playerId,
        name: null,
        avatarColor: null,
        loginMethod,
        picture: null,
        token: refreshedToken,
      });
    }

    return res.json({
      id: row.playerId,
      name: row.playerName,
      avatarColor: row.avatarColor,
      loginMethod,
      picture: row.profilePicture ?? null,
      token: refreshedToken,
    });
  } catch (err) {
    console.error("[auth/me] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ── /logout — clear the session cookie ──────────────────────────────────────
// The session cookie is httpOnly, so the client can't delete it itself. This
// endpoint clears it (with attributes matching how it was set). Idempotent and
// always 200 so the client can fire it best-effort during logout without
// caring about the result. The client also wipes its localStorage profile and
// bridge token; this handles the cross-origin httpOnly cookie.
router.post("/delete-account", async (req: Request, res: Response) => {
  const playerId = readPlayerId(req);
  if (!playerId || !isLoggedInId(playerId)) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const rows = await db.execute(sql`
      SELECT player_id, stripe_customer_id
      FROM player_scores
      WHERE player_id = ${playerId}
      LIMIT 1
    `);
    const row = rows.rows?.[0] as
      | { player_id: string; stripe_customer_id: string | null }
      | undefined;

    if (!row) {
      clearPlayerToken(res);
      return res.json({ ok: true, deleted: false });
    }

    // Cancel/delete the Stripe customer before removing the local account so
    // an active web subscription cannot survive the account deletion.
    if (row.stripe_customer_id) {
      try {
        const { getUncachableStripeClient } = await import("../stripeClient");
        const stripe = await getUncachableStripeClient();
        await stripe.customers.del(row.stripe_customer_id);
      } catch (stripeError) {
        console.error("[auth/delete-account] Stripe customer deletion failed:", stripeError);
        return res.status(502).json({
          error: "No se pudo completar la cancelación de la suscripción. Tu cuenta no se ha eliminado.",
        });
      }
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);
      await revokePlayerId(playerId, tx);
      const locked = await tx.execute(sql`
        SELECT player_id
        FROM player_scores
        WHERE player_id = ${playerId}
        FOR UPDATE
      `);
      if (!locked.rows?.length) return;

      // Delete user-owned records from every current/future table that uses
      // player_id, except immutable billing ledgers retained for audit.
      const tableRows = await tx.execute(sql`
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE column_name = 'player_id'
          AND table_schema = 'public'
          AND table_name NOT IN ('player_scores', 'play_subscriptions', 'play_product_purchases', 'revoked_player_ids')
        GROUP BY table_schema, table_name
      `);

      for (const table of tableRows.rows as Array<{ table_schema: string; table_name: string }>) {
        const qualified = `"${table.table_schema.replace(/"/g, '""')}"."${table.table_name.replace(/"/g, '""')}"`;
        const escapedPlayerId = playerId.replace(/'/g, "''");
        await tx.execute(sql.raw(
          `DELETE FROM ${qualified} WHERE "player_id" = '${escapedPlayerId}'`,
        ));
      }

      // player_challenges uses from_player_id/to_player_id rather than the
      // generic player_id column, so it is not covered by the purge above.
      // Remove both incoming and outgoing challenges before deleting the
      // account, otherwise a deleted player can remain in pending/history
      // challenge records.
      await tx.execute(sql`
        DELETE FROM player_challenges
        WHERE from_player_id = ${playerId} OR to_player_id = ${playerId}
      `);

      // Follows uses follower_id/followed_id rather than player_id, so it is
      // not covered by the generic player_id purge above. Remove both sides
      // of the relationship to avoid orphaned references to a deleted account.
      await tx.execute(sql`
        DELETE FROM follows
        WHERE follower_id = ${playerId} OR followed_id = ${playerId}
      `);

      // A room/tournament can also retain non-host participants only inside
      // players_json (and tournaments additionally in bracket_json). Remove
      // the deleted player from those blobs while holding the row lock so a
      // concurrent join/leave cannot reintroduce the stale identity.
      const roomRows = await tx.execute(sql`
        SELECT id, players_json
        FROM rooms
        WHERE host_id <> ${playerId}
          AND players_json LIKE ${"%" + playerId + "%"}
        FOR UPDATE
      `);
      for (const room of roomRows.rows as Array<{ id: number; players_json: string }>) {
        let players: any[] = [];
        try {
          const parsed = JSON.parse(room.players_json);
          players = Array.isArray(parsed) ? parsed : [];
        } catch {
          continue;
        }
        const filtered = players.filter((p) => p?.playerId !== playerId);
        if (filtered.length !== players.length) {
          await tx.execute(sql`
            UPDATE rooms
            SET players_json = ${JSON.stringify(filtered)}, updated_at = NOW()
            WHERE id = ${room.id}
          `);
        }
      }

      const tournamentRows = await tx.execute(sql`
        SELECT id, players_json, bracket_json
        FROM tournaments
        WHERE host_id <> ${playerId}
          AND (players_json LIKE ${"%" + playerId + "%"} OR bracket_json LIKE ${"%" + playerId + "%"})
        FOR UPDATE
      `);
      for (const tournament of tournamentRows.rows as Array<{
        id: number;
        players_json: string;
        bracket_json: string | null;
      }>) {
        let players: any[] = [];
        try {
          const parsed = JSON.parse(tournament.players_json);
          players = Array.isArray(parsed) ? parsed : [];
        } catch {}

        const filteredPlayers = players.filter((p) => p?.playerId !== playerId);
        let bracket = null as any;
        try {
          bracket = tournament.bracket_json ? JSON.parse(tournament.bracket_json) : null;
        } catch {}

        let bracketChanged = false;
        const scrub = (value: any): any => {
          if (Array.isArray(value)) return value.map(scrub);
          if (!value || typeof value !== "object") return value;
          const obj = value as Record<string, any>;
          const out: Record<string, any> = {};
          const p1Removed = obj.p1Id === playerId;
          const p2Removed = obj.p2Id === playerId;
          const winnerRemoved = obj.winnerId === playerId;
          if (p1Removed || p2Removed || winnerRemoved) bracketChanged = true;
          for (const [key, val] of Object.entries(obj)) {
            if (key === "p1Id" && p1Removed) out[key] = null;
            else if (key === "p2Id" && p2Removed) out[key] = null;
            else if (key === "winnerId" && winnerRemoved) out[key] = null;
            else if (key === "p1Name" && p1Removed) out[key] = "TBD";
            else if (key === "p2Name" && p2Removed) out[key] = "TBD";
            else if (key === "winnerName" && winnerRemoved) out[key] = null;
            else out[key] = scrub(val);
          }
          return out;
        };
        const cleanedBracket = bracket ? scrub(bracket) : bracket;

        if (filteredPlayers.length !== players.length || bracketChanged) {
          await tx.execute(sql`
            UPDATE tournaments
            SET players_json = ${JSON.stringify(filteredPlayers)},
                bracket_json = ${cleanedBracket == null ? null : JSON.stringify(cleanedBracket)},
                updated_at = NOW()
            WHERE id = ${tournament.id}
          `);
        }
      }

      // Hosts are removed entirely; participant references above are scrubbed
      // before these host-owned rows are deleted.
      await tx.execute(sql`DELETE FROM rooms WHERE host_id = ${playerId}`);
      await tx.execute(sql`DELETE FROM tournaments WHERE host_id = ${playerId}`);

      // Keep Google Play purchase ledgers but sever their link to the deleted
      // account and remove stored provider payloads that may contain PII.
      const deletedId = sql`CONCAT('deleted_', LEFT(md5(${playerId} || ${Date.now()}::text), 24))`;
      await tx.execute(sql`
        UPDATE play_subscriptions
        SET player_id = ${deletedId}, raw_json = '{}', updated_at = NOW()
        WHERE player_id = ${playerId}
      `);
      await tx.execute(sql`
        UPDATE play_product_purchases
        SET player_id = ${deletedId}, raw_json = '{}', updated_at = NOW()
        WHERE player_id = ${playerId}
      `);

      await tx.execute(sql`DELETE FROM player_scores WHERE player_id = ${playerId}`);
    });

    markPlayerRevoked(playerId);
    clearPlayerToken(res);
    return res.json({ ok: true, deleted: true });
  } catch (error) {
    console.error("[auth/delete-account] error:", error);
    return res.status(500).json({ error: "No se pudo eliminar la cuenta. Inténtalo de nuevo." });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  clearPlayerToken(res);
  res.json({ ok: true });
});

export default router;
