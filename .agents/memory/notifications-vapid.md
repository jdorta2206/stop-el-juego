---
name: Web-push VAPID keys across hosts
description: Why the notifications bell/toggle can vanish on non-Replit hosts and how the public key is handled.
---

# Web-push (VAPID) visibility vs delivery

The notifications UI (bell in Layout, enable/disable toggle in Notifications page)
only renders when `isSupported` is true, which requires a **public** VAPID key
present in the client bundle at build time.

**Rule:** keep a hardcoded fallback for the *public* VAPID key in
`usePushNotifications.ts` (`VITE_VAPID_PUBLIC_KEY || "<public key>"`). The public
key is public by design (ships in JS, sent with every subscription), so hardcoding
is safe and guarantees the UI renders on hosts that don't set the build var
(e.g. the Railway-served www domain). Env var still takes priority.

**Never** hardcode `VAPID_PRIVATE_KEY` — it stays server-side only. Actual
*delivery* of pushes still needs `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
(+ `VAPID_EMAIL`) set on whichever backend sends them.

**Why:** users on www reported the bell/toggle disappeared. Root cause was the
missing build-time public key on Railway, not a code regression.

**Host-config quirk:** the VAPID vars exist in the Replit project's shared env
(visible via viewEnvVars) but did NOT appear in the user's Secrets tab UI, which
caused confusion when directing the user to copy them. Don't assume a value the
agent can read via viewEnvVars is visible to the user in the Secrets panel.
