---
name: Push broadcast & admin POST rules
description: Correctness rules for mass push broadcasts and CSRF on the Basic-Auth admin panel
---

# Localized mass-push broadcasts

Rule: a multilingual broadcast to all subscribers must fetch rows ONCE, dedupe by
player ONCE across all languages, then pick the per-row localized payload (with a
fallback language for null/unknown). Do NOT loop a per-language sender (e.g.
`sendPushToAllSubscribers(payload, lang)`) once per language.

**Why:** dedup only happens *within* a single send call. A player who has
subscription rows stored under different `language` values would receive one push
per language (duplicate beeps), and rows with null/unknown language would be
skipped entirely. `sendLocalizedBroadcast()` in `pushHelper.ts` is the correct
single-pass primitive.

**How to apply:** any new "notify everyone" feature (events, packs, announcements)
should use `sendLocalizedBroadcast`, not a per-language loop.

# CSRF on the Basic-Auth admin panel (`/test`)

Rule: state-changing POSTs under `/test` (e.g. the Pack Mundial broadcast button)
must enforce a same-origin check (Origin/Referer host === request host, reject
when neither header is present) in addition to Basic Auth.

**Why:** browsers cache and auto-replay HTTP Basic Auth credentials, so a
cross-site auto-submitting form could trigger a mass action while the owner has an
authenticated session. Basic Auth alone does not stop CSRF.

**How to apply:** reuse the `sameOrigin(req)` guard for any future mutating admin
endpoint.
