---
name: Instagram login needs professional accounts
description: Why Instagram social login was removed from STOP; what the redirect_uri vs professional-account errors mean
---

# Instagram login can't be used for normal consumers

Meta deprecated the old Instagram Basic Display API (personal-account login) at the
end of 2024. The only Instagram API now is the business one, requested via scope
`instagram_business_basic`. It **only works with professional/business/creator
accounts**, not personal accounts.

**Symptom decoded:**
- "Invalid redirect_uri" → the redirect URI is NOT registered in the Meta app's
  Instagram Business login settings. Fix = register
  `${APP_ORIGIN}/api/auth/instagram/callback` (and www/non-www/replit variants),
  exactly like Google/Facebook.
- "¿Cambiar a una cuenta profesional?" → redirect_uri is now correct, but the user's
  Instagram is a personal account. This is a dead end for consumer login.

**Decision:** Removed the Instagram login button from STOP (set
`isInstagramConfigured = false` in `artifacts/stop-game/src/lib/oauth.ts`, removed the
SocialButton in `AuthModal.tsx`). Google + Facebook cover all players.
**Why:** Asking every player to convert their IG to a professional account just to log
in is unacceptable UX. Meta itself recommends Facebook Login as the replacement.
**How to apply:** Don't re-enable Instagram login unless Meta restores personal-account
auth. The OAuth backend route still exists; just leave the button hidden.
