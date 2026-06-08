---
name: OAuth state CSRF nonce
description: Why OAuth `state` is HMAC-signed + nonce-bound, and the fail-open vs fail-closed rule that must not be downgraded
---

OAuth `state` is HMAC-signed (`SESSION_SECRET`) and carries a random nonce that is
also stored in a single-use httpOnly cookie. On callback the cookie nonce must
match the signed nonce.

**The invariant (do not weaken):** the decision is driven by whether the nonce
cookie reached this host, NOT by whether the state happens to be signed.
- Nonce cookie **present** (same-origin: replit.app / dev) → a valid signed state
  with matching, fresh nonce is REQUIRED. Unsigned / legacy / malformed / stale /
  mismatched state = CSRF fail. **Never** fall back to the legacy unsigned decode
  in this branch — doing so lets an attacker downgrade to bypass the nonce.
- Nonce cookie **absent** (cross-origin www on Railway, Apple `form_post`, legacy
  links, or no `SESSION_SECRET`) → fail open: trust the HMAC-checked payload, or
  fall back to legacy decode. This keeps cross-domain/TWA login working.

**Why fail-open cross-origin:** OAuth always runs on APP_ORIGIN, but the cookie is
set on APP_ORIGIN and the callback can be reached from a different return origin
where the cookie isn't sent. Hard-failing there would break live www/TWA login.

**Why this is safe:** the signed state is integrity-protected, so the only thing
the cross-origin path gives up is replay/CSRF binding — an accepted tradeoff while
the canonical-host migration is incomplete.

On `csrfFail` the callbacks ignore the return target and redirect to
`${APP_ORIGIN}/?auth_error=csrf`.
