import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// ── Instagram OAuth callback ──────────────────────────────────────────────────
// Instagram redirects here with ?code=...
// We exchange the code for a token, fetch the user profile, then
// send the result to the frontend via a tiny HTML page that writes
// the profile to sessionStorage and redirects back.

router.get("/instagram/callback", async (req: Request, res: Response) => {
  const code  = req.query["code"]  as string | undefined;
  const error = req.query["error"] as string | undefined;

  const INSTAGRAM_CLIENT_ID     = process.env["INSTAGRAM_CLIENT_ID"];
  const INSTAGRAM_CLIENT_SECRET = process.env["INSTAGRAM_CLIENT_SECRET"];
  const APP_ORIGIN              = process.env["APP_ORIGIN"] || "http://localhost:3000";

  if (error || !code) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_cancelled`);
  }

  if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
    return res.redirect(`${APP_ORIGIN}/?auth_error=instagram_not_configured`);
  }

  try {
    // Exchange code for short-lived access token
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/instagram/callback`;

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
    if (!tokenData.access_token) throw new Error("No access token");

    // Fetch user info
    const userRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`
    );
    const user = (await userRes.json()) as any;

    const igUser = {
      id:       `ig_${user.id}`,
      name:     user.username,
      picture:  null,
      provider: "instagram",
    };

    // Return a small HTML page that stores the result and closes/redirects
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
  sessionStorage.setItem('ig_user', ${JSON.stringify(JSON.stringify(igUser))});
  const returnTo = sessionStorage.getItem('ig_return') || '/';
  sessionStorage.removeItem('ig_return');
  window.location.href = '${APP_ORIGIN}' + returnTo;
</script>
</body></html>`);
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    res.redirect(`${APP_ORIGIN}/?auth_error=instagram_failed`);
  }
});

export default router;
