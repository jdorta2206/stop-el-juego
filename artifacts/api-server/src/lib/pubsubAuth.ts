import { OAuth2Client } from "google-auth-library";

// Verifies the Authorization Bearer JWT that Google Pub/Sub attaches to push
// deliveries. Without this check, anyone who guesses the webhook URL could
// POST a forged "REFUND" notification and revoke a paying user's premium.
//
// Google signs each push with the service account configured on the
// subscription. We require:
//   - audience matches PUBSUB_PUSH_AUDIENCE (the URL configured in Pub/Sub)
//   - issuer is https://accounts.google.com
//   - email matches PUBSUB_PUSH_SA_EMAIL (the SA we authorised in Pub/Sub)
//
// If any of those secrets is missing the verifier fails closed (returns
// false and logs once) so we never accept unsigned webhooks in production.

const client = new OAuth2Client();
let warned = false;

function getConfig(): { audience: string; saEmail: string } | null {
  const audience = process.env["PUBSUB_PUSH_AUDIENCE"];
  const saEmail = process.env["PUBSUB_PUSH_SA_EMAIL"];
  if (!audience || !saEmail) {
    if (!warned) {
      warned = true;
      console.error(
        "[pubsubAuth] PUBSUB_PUSH_AUDIENCE and PUBSUB_PUSH_SA_EMAIL must be set. " +
          "Play Billing webhook will reject all requests until configured. " +
          "See GOOGLE_PLAY_BILLING_SETUP.md §5.",
      );
    }
    return null;
  }
  return { audience, saEmail };
}

export async function verifyPubSubJwt(
  authorizationHeader: string | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!authorizationHeader) return { ok: false, reason: "Missing Authorization header" };
  const cfg = getConfig();
  if (!cfg) return { ok: false, reason: "Server not configured for Pub/Sub auth" };

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  if (!match) return { ok: false, reason: "Invalid Authorization scheme" };
  const token = match[1]!;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: cfg.audience,
    });
    const payload = ticket.getPayload();
    if (!payload) return { ok: false, reason: "Empty JWT payload" };
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      return { ok: false, reason: `Bad issuer: ${payload.iss}` };
    }
    if (payload.email !== cfg.saEmail) {
      return { ok: false, reason: `Bad service account: ${payload.email}` };
    }
    if (payload.email_verified !== true) {
      return { ok: false, reason: "SA email not verified" };
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `JWT verification failed: ${msg}` };
  }
}
