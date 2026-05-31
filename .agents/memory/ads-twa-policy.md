---
name: Banner ads must be fail-closed vs Play TWA
description: Why/how banner ads are gated to web-only and never the Play Store app
---

# Banner ads: web-only, fail-closed against the Play TWA

Adsterra banners can redirect/hijack the screen. Inside the Play Store TWA
(the app is Chrome under the hood) that triggers Google Play's "Disruptive
Ads" policy and risks the app being **removed**. So banners must render ONLY
in real web browsers, never in the TWA / installed standalone app.

**Rule:** banner gating must be **fail-closed** — hidden by default, shown
only after *positively* confirming a plain browser. Heuristic "looks like a
browser" checks are NOT enough; a false negative leaks a banner into the app.

**How to apply (current impl in `AdSystem.tsx` `BannerAd`):**
- `adsAllowed` state starts `false`; render returns null unless `visible && adsAllowed`.
- An effect bails (stays hidden) if `VITE_ADS_DISABLED` or `inStandaloneOrTwaSync()`
  (android-app:// referrer, `source/utm_source=twa`, or standalone+Android).
- Otherwise it awaits the **authoritative** `detectPaymentChannel()` (playBilling,
  resolves Digital Goods service) and only sets `adsAllowed=true` when it returns
  `"stripe"` (non-Play). Any error → stays hidden.
- Do NOT gate on `getDigitalGoodsService` merely *existing* — that function is
  present in regular Android Chrome too, so it would kill mobile-web banner
  revenue. The authoritative signal is the async resolve, not the symbol.

**Why web-only is worth it:** most traffic is web (≈746 unique IPs/week vs ~13
logged-in accounts), so web banners are the real banner revenue; in-app money
comes from rewarded ads (opt-in, safe) + Premium.

Rewarded ads and `BannerAd` call sites are also gated by `!isPremium`.
`VITE_ADS_DISABLED=1` is the global kill-switch.
