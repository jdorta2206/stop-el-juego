import { Router } from "express";
import type { Request, Response } from "express";
import { issuePlayerToken } from "../lib/playerAuth";

const router = Router();
const GRAPH_API_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface FacebookDebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expiration_time?: number;
    expires_at?: number;
    is_valid?: boolean;
    user_id?: string;
  };
  error?: { message?: string };
}

interface FacebookProfile {
  id?: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
  error?: { message?: string };
}

router.post("/facebook/native", async (req: Request, res: Response) => {
  const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
  const appId = process.env["VITE_FACEBOOK_APP_ID"]?.trim();
  const appSecret = process.env["FACEBOOK_APP_SECRET"]?.trim();

  if (!accessToken) {
    return res.status(400).json({ error: "accessToken is required" });
  }
  if (!appId || !appSecret) {
    return res.status(503).json({ error: "Facebook Login is not configured" });
  }

  try {
    // Validate that the token was issued for our Facebook app and is still valid.
    // Never trust the user id supplied by the client.
    const debugUrl = `${GRAPH_BASE}/debug_token?${new URLSearchParams({
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    })}`;
    const debugRes = await fetch(debugUrl);
    const debug = (await debugRes.json()) as FacebookDebugTokenResponse;

    if (!debugRes.ok || debug.error || !debug.data?.is_valid || debug.data.app_id !== appId || !debug.data.user_id) {
      return res.status(401).json({ error: "Invalid Facebook access token" });
    }

    const meUrl = `${GRAPH_BASE}/me?${new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
      access_token: accessToken,
    })}`;
    const meRes = await fetch(meUrl);
    const me = (await meRes.json()) as FacebookProfile;

    if (!meRes.ok || me.error || !me.id || me.id !== debug.data.user_id) {
      return res.status(401).json({ error: "Invalid Facebook identity" });
    }

    const playerId = `fb_${me.id}`;
    const sessionToken = issuePlayerToken(res, playerId);

    return res.json({
      ok: true,
      user: {
        id: playerId,
        name: me.name || "Facebook User",
        email: me.email || null,
        picture: me.picture?.data?.url || null,
        provider: "facebook",
      },
      token: sessionToken,
    });
  } catch (error) {
    console.error("[auth/facebook/native] verification failed:", error);
    return res.status(502).json({ error: "Facebook authentication service unavailable" });
  }
});

export default router;
