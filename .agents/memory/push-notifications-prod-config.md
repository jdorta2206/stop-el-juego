---
name: Push notifications prod config (VAPID on Railway)
description: Why production push notifications can go silently dead even though dev works — VAPID env vars missing on the Railway host.
---

# Push notifications: prod (Railway) VAPID config

Production is served by **Railway** (`server: railway-hikari`), NOT a Replit
Deployment. So Replit production env vars (`setEnvVars environment:"production"`)
do NOT reach the live site. Prod env must be set in the Railway dashboard.

## Failure mode: ALL push notifications silently dead
Every send helper in `artifacts/api-server/src/lib/pushHelper.ts` and the
`send-invite` route starts with `if (!VAPID_PUBLIC || !VAPID_PRIVATE) return`,
and `webpush.setVapidDetails` only runs when both are set. So if the host is
missing `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, the server accepts subscriptions
but NEVER delivers anything — daily challenge, double-points/happy-hour,
invitations, and friend-online all go silent at once.

**Why:** dev (Replit) has the keys in `.replit` so it works; Railway had
`VAPID_PUBLIC_KEY` empty, so prod sent nothing. Symptom is identical for every
notification type, which points at the shared VAPID gate, not any one feature.

## Fast diagnosis
- `curl https://www.stopjuegodepalabras.com/api/notifications/vapid-public-key`
  → `{"key":""}` means the prod server has no public key set → all sends bail.
  A healthy host returns the real base64url key.

## Fix (no code change)
Set on the Railway api-server service Variables, then redeploy:
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.
**Must reuse the SAME keypair the client subscribes with** (the client's hardcoded
public fallback in `usePushNotifications.ts`). Verified: that public key, the
`.replit` public, and the key derived from the `.replit` private all match, so
existing subscriptions keep working. Generating a fresh keypair would invalidate
every existing subscription and require rebuilding the client too — avoid.

## Security note (do not paste the private key into chat/memory)
The VAPID **private** key is committed in plaintext in `.replit`. That's a minor
leak (anyone with repo access could push to subscribers). Rotating it is the
clean fix but it invalidates all subscriptions + needs a client rebuild, so it's
an optional follow-up, not urgent.
