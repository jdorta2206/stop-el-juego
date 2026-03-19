import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

const APP_ORIGIN = process.env["APP_ORIGIN"] || "https://3697d7d1-ea3c-4cf5-b00f-386041779844-00-emhgnr1gq77c.kirk.replit.dev";

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

// Multi-key bridge page — writes multiple sessionStorage entries before redirecting
function bridgePageMulti(items: [string, string][], returnPath: string) {
  const setItems = items
    .map(([k, v]) => `sessionStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
    .join("\n    ");
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
  window.location.replace(${JSON.stringify(APP_ORIGIN + returnPath)});
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
  const state = req.query["return"] as string || "/";
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
  const state = req.query["state"] as string || "/";
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
    return res.redirect(`${APP_ORIGIN}${state}`);
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

    const user = JSON.stringify({
      id:       `google_${payload.sub}`,
      name:     payload.name,
      email:    payload.email,
      picture:  payload.picture,
      provider: "google",
    });

    res.send(bridgePage("oauth_user", user, state));
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
  const state = req.query["return"] as string || "/";
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
  const state = req.query["state"] as string || "/";
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
    return res.redirect(`${APP_ORIGIN}${state}`);
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

    const user = JSON.stringify({
      id:       `fb_${me.id}`,
      name:     me.name,
      email:    me.email,
      picture:  me.picture?.data?.url || null,
      provider: "facebook",
    });

    // Pass both user profile AND access token so frontend can call Graph API for friends
    res.send(bridgePageMulti([
      ["oauth_user", user],
      ["fb_access_token", tokenData.access_token],
    ], state));
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
  const state = req.query["return"] as string || "/";
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
  const state = req.query["state"] as string || "/";
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
    return res.redirect(`${APP_ORIGIN}${state}`);
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

    const user = JSON.stringify({
      id:       `ig_${me.id}`,
      name:     me.username || me.name || "Usuario",
      picture:  me.profile_picture_url || null,
      provider: "instagram",
    });

    res.send(bridgePage("oauth_user", user, state));
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=instagram_failed`);
  }
});

// ── TIKTOK ────────────────────────────────────────────────────────────────────

router.get("/tiktok/start", (req: Request, res: Response) => {
  const TIKTOK_CLIENT_KEY = process.env["TIKTOK_CLIENT_KEY"]?.trim();
  if (!TIKTOK_CLIENT_KEY) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_not_configured`);
  }
  const redirectUri = `${APP_ORIGIN}/api/auth/tiktok/callback`;
  const state = req.query["return"] as string || "/";
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
  const state = req.query["state"] as string || "/";
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

    const user = JSON.stringify({
      id:       `tt_${me.open_id || openId}`,
      name:     me.display_name || "TikToker",
      picture:  me.avatar_url || null,
      provider: "tiktok",
    });

    res.send(bridgePage("oauth_user", user, state));
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=tiktok_failed`);
  }
});

export default router;
