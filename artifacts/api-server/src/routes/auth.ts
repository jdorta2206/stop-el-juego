import { Router } from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { issuePlayerToken, PLAYER_TOKEN_BRIDGE_KEY, readPlayerId } from "../lib/playerAuth";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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

// ── Dedup cache: prevent double-use of OAuth codes (mobile browsers fire callback twice) ──
const usedCodes = new Set<string>();
function claimCode(code: string): boolean {
  if (usedCodes.has(code)) return false;
  usedCodes.add(code);
  setTimeout(() => usedCodes.delete(code), 60_000);
  return true;
}

// Helper: build a tiny HTML page that writes data to sessionStorage and redirects
function bridgePage(key: string, value: string, returnPath: string) {
  return bridgePageMulti([[key, value]], returnPath);
}

// Multi-key bridge page — writes multiple sessionStorage entries before redirecting.
// `returnOrigin` lets us bounce the user back to the domain they came from
// (e.g. stopjuegodepalabras.com) instead of hardcoded APP_ORIGIN, so the TWA
// stays inside its trusted scope. Defaults to APP_ORIGIN for legacy callers.
function bridgePageMulti(
  items: [string, string][],
  returnPath: string,
  returnOrigin: string = APP_ORIGIN,
) {
  // Most items are session-scoped (OAuth profile handoff). The
  // PLAYER_TOKEN_BRIDGE_KEY entry, however, must persist across tabs and
  // browser restarts so daily Season Pass missions keep accumulating — write
  // it to localStorage. NOTE: these writes only help when returnOrigin equals
  // APP_ORIGIN (same-origin). For the cross-origin case the items are also
  // carried in the URL hash below (see handoffDest) and imported by the
  // destination origin; that is the path that actually fixes cross-domain login.
  const setItems = items
    .map(([k, v]) => {
      const store = k === PLAYER_TOKEN_BRIDGE_KEY ? "localStorage" : "sessionStorage";
      return `${store}.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`;
    })
    .join("\n    ");

  // Cross-origin handoff. The storage writes above land on APP_ORIGIN (where
  // this bridge is served), but the user is being redirected to returnOrigin
  // (e.g. www.stopjuegodepalabras.com / the TWA), a DIFFERENT origin whose
  // sessionStorage/localStorage are separate — so those writes are invisible
  // there and the session wouldn't "stick" (user bounced back to login). To
  // fix that we ALSO carry the items in the URL hash: the destination imports
  // them into its OWN storage on load (consumeAuthHandoff). The hash fragment
  // is never sent to servers / access logs and is stripped client-side on
  // arrival so the token doesn't linger in the address bar.
  const baseDest = returnOrigin + returnPath;
  const handoffDest = baseDest + (baseDest.includes("#") ? "&" : "#") +
    "stopauth=" + encodeURIComponent(JSON.stringify(items));
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Conectando...</title>
<style>body{background:#0d1757;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.logo{text-align:center;}.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,.2);border-top-color:#f9a825;border-radius:50%;animation:spin 0.8s linear infinite;margin:16px auto;}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="logo"><div class="spinner"></div><p>Conectando cuenta...</p></div>
<script>
  try {
    ${setItems}
  } catch(e) {}
  window.location.replace(${JSON.stringify(handoffDest)});
</script>
</body></html>`;
}

// ── GOOGLE ─────────────────────────────────────────────────────────────────────

router.get("/google/start", (req: Request, res: Response) => {
  const GOOGLE_CLIENT_ID = process.env["VITE_GOOGLE_CLIENT_ID"];
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=google_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/google/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = encodeAuthState(returnPath, returnOrigin);
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
  const { returnPath, returnOrigin } = decodeAuthState(req.query["state"] as string | undefined);
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
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
    const tokenData = (await tokenRes.json()) as any;
    console.log("Google token response keys:", Object.keys(tokenData));
    if (tokenData.error) {
      console.error("Google token error:", tokenData.error, tokenData.error_description);
      throw new Error(`Google error: ${tokenData.error} - ${tokenData.error_description}`);
    }

    let payload: any = null;

    if (tokenData.id_token) {
      // Decode JWT payload
      payload = JSON.parse(
        Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()
      );
    } else if (tokenData.access_token) {
      // Fallback: use userinfo endpoint
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      payload = (await userinfoRes.json()) as any;
      console.log("Google userinfo payload:", JSON.stringify(payload));
    } else {
      throw new Error("No id_token or access_token in Google response");
    }

    const playerId = `google_${payload.sub}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     payload.name,
      email:    payload.email,
      picture:  payload.picture,
      provider: "google",
    });

    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([
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
  const FACEBOOK_APP_ID = process.env["VITE_FACEBOOK_APP_ID"];
  if (!FACEBOOK_APP_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=facebook_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/facebook/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = encodeAuthState(returnPath, returnOrigin);
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    scope: "email,public_profile,user_friends",
    response_type: "code",
    state,
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

router.get("/facebook/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const { returnPath, returnOrigin } = decodeAuthState(req.query["state"] as string | undefined);
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
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({ client_id: FACEBOOK_APP_ID, redirect_uri: redirectUri, client_secret: FACEBOOK_APP_SECRET, code })
    );
    const tokenData = (await tokenRes.json()) as any;
    if (!tokenData.access_token) throw new Error("No access_token");

    // Fetch profile
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
    );
    const me = (await meRes.json()) as any;

    const playerId = `fb_${me.id}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     me.name,
      email:    me.email,
      picture:  me.picture?.data?.url || null,
      provider: "facebook",
    });

    const sessionToken = issuePlayerToken(res, playerId);
    // Pass both user profile AND access token so frontend can call Graph API for friends
    res.send(bridgePageMulti([
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
  const INSTAGRAM_CLIENT_ID = process.env["INSTAGRAM_CLIENT_ID"];
  if (!INSTAGRAM_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/instagram/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = encodeAuthState(returnPath, returnOrigin);
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
  const { returnPath, returnOrigin } = decodeAuthState(req.query["state"] as string | undefined);
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

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
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
    const tokenData = (await tokenRes.json()) as any;
    console.log("Instagram token keys:", Object.keys(tokenData));
    if (tokenData.error_type || tokenData.error) {
      throw new Error(`Instagram error: ${tokenData.error_type || tokenData.error} - ${tokenData.error_message || tokenData.error_description}`);
    }
    if (!tokenData.access_token) throw new Error("No access_token from Instagram");

    const meRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=id,username,profile_picture_url&access_token=${tokenData.access_token}`
    );
    const me = (await meRes.json()) as any;

    const playerId = `ig_${me.id}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     me.username || me.name || "Usuario",
      picture:  me.profile_picture_url || null,
      provider: "instagram",
    });

    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([
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
  const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"];
  if (!APPLE_CLIENT_ID) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=apple_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/apple/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = encodeAuthState(returnPath, returnOrigin);
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
  const { returnPath, returnOrigin } = decodeAuthState(req.body?.["state"] as string | undefined);
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
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
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
    const tokenData = (await tokenRes.json()) as any;
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

    const playerId = `apple_${payload.sub}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     displayName,
      email:    payload.email || null,
      picture:  null,
      provider: "apple",
    });

    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([
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
  const TIKTOK_CLIENT_KEY = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  if (!TIKTOK_CLIENT_KEY) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;
  const returnPath = (req.query["return"] as string) || "/";
  const returnOrigin = pickReturnOrigin(req, null);
  const state = encodeAuthState(returnPath, returnOrigin);
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
  const { returnPath, returnOrigin } = decodeAuthState(req.query["state"] as string | undefined);
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

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
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
    const tokenData = (await tokenRes.json()) as any;
    console.log("TikTok token keys:", Object.keys(tokenData));
    if (tokenData.error) throw new Error(`TikTok token error: ${tokenData.error}`);

    const accessToken = tokenData.access_token || tokenData.data?.access_token;
    if (!accessToken) throw new Error("No access_token from TikTok");

    const openId = tokenData.open_id || tokenData.data?.open_id;

    const meRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meData = (await meRes.json()) as any;
    const me = meData.data?.user || meData.user || {};

    const playerId = `tt_${me.open_id || openId}`;
    const user = JSON.stringify({
      id:       playerId,
      name:     me.display_name || "TikToker",
      picture:  me.avatar_url || null,
      provider: "tiktok",
    });

    const sessionToken = issuePlayerToken(res, playerId);
    res.send(bridgePageMulti([
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
  if (!playerId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Derive loginMethod from the playerId prefix (google_, fb_, instagram_,
  // apple_, tiktok_). This matches how OAuth callbacks construct the IDs.
  const prefixMap: Record<string, string> = {
    google_: "google",
    fb_: "facebook",
    instagram_: "instagram",
    apple_: "apple",
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
      picture: null,
      token: refreshedToken,
    });
  } catch (err) {
    console.error("[auth/me] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
