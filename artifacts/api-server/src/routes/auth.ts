import { Router } from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { issuePlayerToken, clearPlayerToken, PLAYER_TOKEN_BRIDGE_KEY, readPlayerId } from "../lib/playerAuth";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// OAuth response shapes
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

const APP_ORIGIN = process.env["APP_ORIGIN"] || "https://stop-el-juego.replit.app";
const MOBILE_RETURN_ORIGINS = new Set<string>(["stopjuego://oauth"]);
const SAFE_RETURN_ORIGINS = new Set<string>([
  "https://stop-el-juego.replit.app",
  "https://stopjuegodepalabras.com",
  "https://www.stopjuegodepalabras.com",
  APP_ORIGIN,
  ...MOBILE_RETURN_ORIGINS,
]);

function pickReturnOrigin(req: Request, requestedOrigin: string | null): string {
  if (requestedOrigin && SAFE_RETURN_ORIGINS.has(requestedOrigin)) return requestedOrigin;
  const ref = req.get("referer") || "";
  try {
    const refOrigin = new URL(ref).origin;
    if (SAFE_RETURN_ORIGINS.has(refOrigin)) return refOrigin;
  } catch { /* malformed referer — ignore */ }
  return APP_ORIGIN;
}

function encodeAuthState(returnPath: string, returnOrigin: string): string {
  return encodeURIComponent(JSON.stringify({ r: returnPath, o: returnOrigin }));
}

function decodeAuthState(raw: string | undefined): { returnPath: string; returnOrigin: string } {
  if (!raw) return { returnPath: "/", returnOrigin: APP_ORIGIN };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed === "object" && typeof parsed.r === "string") {
      const o = typeof parsed.o === "string" && SAFE_RETURN_ORIGINS.has(parsed.o) ? parsed.o : APP_ORIGIN;
      return { returnPath: parsed.r, returnOrigin: o };
    }
  } catch { /* not JSON — treat as legacy raw path */ }
  return { returnPath: raw.startsWith("/") ? raw : "/", returnOrigin: APP_ORIGIN };
}

const OAUTH_NONCE_COOKIE = "stop_oauth_nonce";
const STATE_TTL_MS = 15 * 60 * 1000;
function stateSecret(): string | null {
  const s = process.env["SESSION_SECRET"];
  return s && s.length >= 16 ? s : null;
}
const NONCE_COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/" };

function beginAuthState(res: Response, returnPath: string, returnOrigin: string): string {
  const secret = stateSecret();
  if (!secret) return encodeAuthState(returnPath, returnOrigin);
  const nonce = crypto.randomBytes(16).toString("base64url");
  res.cookie(OAUTH_NONCE_COOKIE, nonce, { ...NONCE_COOKIE_OPTS, maxAge: STATE_TTL_MS });
  const body = Buffer.from(JSON.stringify({ r: returnPath, o: returnOrigin, n: nonce, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

function parseSignedState(raw: string | undefined): { r: string; o: string; n: string; t: number } | null {
  if (!raw || !raw.startsWith("v1.")) return null;
  const secret = stateSecret();
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof p["r"] === "string" && typeof p["n"] === "string" && typeof p["t"] === "number") {
      const o = typeof p["o"] === "string" && SAFE_RETURN_ORIGINS.has(p["o"] as string) ? p["o"] as string : APP_ORIGIN;
      return { r: p["r"] as string, o, n: p["n"] as string, t: p["t"] as number };
    }
  } catch { /* malformed */ }
  return null;
}

function verifyAuthState(req: Request, res: Response): { returnPath: string; returnOrigin: string; csrfFail: boolean } {
  const raw = (req.query?.["state"] ?? req.body?.["state"]) as string | undefined;
  const nonceCookie = req.cookies?.[OAUTH_NONCE_COOKIE] as string | undefined;
  if (nonceCookie) res.clearCookie(OAUTH_NONCE_COOKIE, NONCE_COOKIE_OPTS);
  const signed = parseSignedState(raw);
  if (nonceCookie) {
    if (!signed) return { returnPath: "/", returnOrigin: APP_ORIGIN, csrfFail: true };
    const age = Date.now() - signed.t;
    const fresh = age <= STATE_TTL_MS && age >= -60_000;
    let match = false;
    try {
      match = nonceCookie.length === signed.n.length && crypto.timingSafeEqual(Buffer.from(nonceCookie), Buffer.from(signed.n));
    } catch { match = false; }
    if (!fresh || !match) return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: true };
    return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: false };
  }
  if (signed) return { returnPath: signed.r, returnOrigin: signed.o, csrfFail: false };
  const legacy = decodeAuthState(raw);
  return { returnPath: legacy.returnPath, returnOrigin: legacy.returnOrigin, csrfFail: false };
}

const usedCodes = new Set<string>();
function claimCode(code: string): boolean {
  if (usedCodes.has(code)) return false;
  usedCodes.add(code);
  setTimeout(() => usedCodes.delete(code), 60_000);
  return true;
}

function bridgePageMulti(items: [string, string][], returnPath: string, returnOrigin: string = APP_ORIGIN) {
  const setItems = items.map(([k, v]) => {
    const store = k === PLAYER_TOKEN_BRIDGE_KEY ? "localStorage" : "sessionStorage";
    return `${store}.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`;
  }).join("\n    ");
  const baseDest = returnOrigin + returnPath;
  const handoffDest = baseDest + (baseDest.includes("#") ? "&" : "#") + "stopauth=" + encodeURIComponent(JSON.stringify(items));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectando...</title></head><body><p>Conectando cuenta...</p><script>
  try { ${setItems} } catch(e) {}
  window.location.replace(${JSON.stringify(handoffDest)});
</script></body></html>`;
}

// GOOGLE
router.get("/google/start", (req: Request, res: Response) => {
  const GOOGLE_CLIENT_ID = process.env["VITE_GOOGLE_CLIENT_ID"];
  if (!GOOGLE_CLIENT_ID) return res.redirect(`${APP_ORIGIN}/?auth_error=google_not_configured`);
  const redirectUri = `${APP_ORIGIN}/api/auth/google/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, (req.query["returnOrigin"] as string) || null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, access_type: "online", prompt: "select_account" });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const { returnPath, returnOrigin, csrfFail } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;
  const GOOGLE_CLIENT_ID = process.env["VITE_GOOGLE_CLIENT_ID"];
  const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"];
  if (error || !code) return res.redirect(`${APP_ORIGIN}/?auth_error=google_cancelled`);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.redirect(`${APP_ORIGIN}/?auth_error=google_not_configured`);
  if (!claimCode(`google_${code}`)) return res.redirect(`${returnOrigin}${returnPath}`);
  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (tokenData.error) throw new Error(`Google error: ${tokenData.error}`);
    let payload: OAuthProfile | null = null;
    if (tokenData.id_token) payload = JSON.parse(Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()) as OAuthProfile;
    else if (tokenData.access_token) {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      payload = (await userinfoRes.json()) as OAuthProfile;
    }
    if (!payload?.sub) throw new Error("Google identity missing");
    const playerId = `google_${payload.sub}`;
    const user = JSON.stringify({ id: playerId, name: payload.name, email: payload.email, picture: payload.picture, provider: "google" });
    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([["oauth_user", user], ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : [])], returnPath, returnOrigin));
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=google_failed`);
  }
});

// FACEBOOK
router.get("/facebook/start", (req: Request, res: Response) => {
  const FACEBOOK_APP_ID = process.env["VITE_FACEBOOK_APP_ID"];
  if (!FACEBOOK_APP_ID) return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_not_configured`);
  const redirectUri = `${APP_ORIGIN}/api/auth/facebook/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, (req.query["returnOrigin"] as string) || null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({ client_id: FACEBOOK_APP_ID, redirect_uri: redirectUri, scope: "email,public_profile,user_friends", response_type: "code", state });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

router.get("/facebook/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const { returnPath, returnOrigin, csrfFail } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;
  const FACEBOOK_APP_ID = process.env["VITE_FACEBOOK_APP_ID"];
  const FACEBOOK_APP_SECRET = process.env["FACEBOOK_APP_SECRET"];
  if (error || !code) return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_cancelled`);
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_not_configured`);
  if (!claimCode(`fb_${code}`)) return res.redirect(`${returnOrigin}${returnPath}`);
  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/facebook/callback`;
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({ client_id: FACEBOOK_APP_ID, redirect_uri: redirectUri, client_secret: FACEBOOK_APP_SECRET, code })}`);
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (!tokenData.access_token) throw new Error("No access_token");
    const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`);
    const me = (await meRes.json()) as OAuthProfile;
    if (!me.id) throw new Error("Facebook identity missing");
    const playerId = `fb_${me.id}`;
    const user = JSON.stringify({ id: playerId, name: me.name, email: me.email, picture: (typeof me.picture === "object" ? me.picture.data?.url : undefined) || null, provider: "facebook" });
    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([["oauth_user", user], ["fb_access_token", tokenData.access_token], ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : [])], returnPath, returnOrigin));
  } catch (err) {
    console.error("Facebook OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=facebook_failed`);
  }
});

// APPLE
function makeAppleClientSecret(): string {
  const privateKey = (process.env["APPLE_PRIVATE_KEY"] || "").replace(/\\n/g, "\n");
  const teamId = process.env["APPLE_TEAM_ID"]!;
  const clientId = process.env["APPLE_CLIENT_ID"]!;
  const keyId = process.env["APPLE_KEY_ID"]!;
  return jwt.sign({}, privateKey, { algorithm: "ES256", keyid: keyId, issuer: teamId, audience: "https://appleid.apple.com", subject: clientId, expiresIn: "5m" });
}

router.get("/apple/start", (req: Request, res: Response) => {
  const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"];
  if (!APPLE_CLIENT_ID) return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
  const redirectUri = `${APP_ORIGIN}/api/auth/apple/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, (req.query["returnOrigin"] as string) || null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({ client_id: APPLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "name email", response_mode: "form_post", state });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

router.post("/apple/callback", async (req: Request, res: Response) => {
  const code = req.body?.["code"] as string | undefined;
  const { returnPath, returnOrigin, csrfFail } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.body?.["error"] as string | undefined;
  const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"];
  if (error || !code) return res.redirect(`${APP_ORIGIN}/?auth_error=apple_cancelled`);
  if (!APPLE_CLIENT_ID || !process.env["APPLE_TEAM_ID"] || !process.env["APPLE_KEY_ID"] || !process.env["APPLE_PRIVATE_KEY"]) return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
  if (!claimCode(`apple_${code}`)) return res.redirect(`${returnOrigin}${returnPath}`);
  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/apple/callback`;
    const clientSecret = makeAppleClientSecret();
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: APPLE_CLIENT_ID, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }) });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (tokenData.error || !tokenData.id_token) throw new Error("Apple token exchange failed");
    const payload = JSON.parse(Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString());
    let displayName = "Apple User";
    try {
      const userJson = req.body?.["user"];
      if (userJson) {
        const u = typeof userJson === "string" ? JSON.parse(userJson) : userJson;
        displayName = `${u?.name?.firstName || ""} ${u?.name?.lastName || ""}`.trim() || displayName;
      }
    } catch (_) {}
    const playerId = `apple_${payload.sub}`;
    const user = JSON.stringify({ id: playerId, name: displayName, email: payload.email || null, picture: null, provider: "apple" });
    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([["oauth_user", user], ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : [])], returnPath, returnOrigin));
  } catch (err) {
    console.error("Apple OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=apple_failed`);
  }
});

// TIKTOK
router.get("/tiktok/start", (req: Request, res: Response) => {
  const TIKTOK_CLIENT_KEY = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  if (!TIKTOK_CLIENT_KEY) return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, (req.query["returnOrigin"] as string) || null);
  const state = beginAuthState(res, returnPath, returnOrigin);
  const params = new URLSearchParams({ client_key: TIKTOK_CLIENT_KEY, redirect_uri: redirectUri, scope: "user.info.basic", response_type: "code", state });
  res.redirect(`https://www.tiktok.com/v2/auth/authorize?${params}`);
});

router.get("/tiktok/callback", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const { returnPath, returnOrigin, csrfFail } = verifyAuthState(req, res);
  if (csrfFail) return res.redirect(`${APP_ORIGIN}/?auth_error=csrf`);
  const error = req.query["error"] as string | undefined;
  const TIKTOK_CLIENT_KEY = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  const TIKTOK_CLIENT_SECRET = process.env["TIKTOK_CLIENT_SECRET"]?.trim();
  if (error || !code) return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_cancelled`);
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  try {
    const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" }, body: new URLSearchParams({ client_key: TIKTOK_CLIENT_KEY, client_secret: TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirectUri }) });
    const tokenData = (await tokenRes.json()) as OAuthTokenResponse;
    if (tokenData.error) throw new Error(`TikTok token error: ${tokenData.error}`);
    const accessToken = tokenData.access_token || tokenData.data?.access_token;
    if (!accessToken) throw new Error("No access_token from TikTok");
    const openId = tokenData.open_id || tokenData.data?.open_id;
    const meRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: { Authorization: `Bearer ${accessToken}` } });
    const meData = (await meRes.json()) as TikTokUserResponse;
    const me = meData.data?.user || meData.user || {};
    const playerId = `tt_${me.open_id || openId}`;
    const user = JSON.stringify({ id: playerId, name: me.display_name || "TikToker", picture: me.avatar_url || null, provider: "tiktok" });
    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([["oauth_user", user], ...(sessionToken ? [[PLAYER_TOKEN_BRIDGE_KEY, sessionToken] as [string, string]] : [])], returnPath, returnOrigin));
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_failed`);
  }
});

router.get("/me", async (req: Request, res: Response) => {
  const playerId = readPlayerId(req);
  if (!playerId) return res.status(401).json({ error: "Not authenticated" });
  const prefixMap: Record<string, string> = { google_: "google", fb_: "facebook", ig_: "instagram", instagram_: "instagram", apple_: "apple", tt_: "tiktok", tiktok_: "tiktok" };
  let loginMethod: string | null = null;
  for (const [prefix, method] of Object.entries(prefixMap)) if (playerId.startsWith(prefix)) { loginMethod = method; break; }
  try {
    const rows = await db.select({ playerId: playerScoresTable.playerId, playerName: playerScoresTable.playerName, avatarColor: playerScoresTable.avatarColor }).from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1);
    const row = rows[0];
    const refreshedToken = issuePlayerToken(res, playerId);
    if (!row) return res.json({ id: playerId, name: null, avatarColor: null, loginMethod, picture: null, token: refreshedToken });
    return res.json({ id: row.playerId, name: row.playerName, avatarColor: row.avatarColor, loginMethod, picture: null, token: refreshedToken });
  } catch (err) {
    console.error("[auth/me] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  clearPlayerToken(res);
  res.json({ ok: true });
});

export default router;
