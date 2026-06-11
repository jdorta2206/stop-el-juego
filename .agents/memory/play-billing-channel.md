---
name: Play Billing channel detection & Stripe fallback
description: Why TWA payment-channel detection is unreliable and how the pack purchase falls back to Stripe
---

# Payment channel "play" can resolve while Play Billing still fails

`detectPaymentChannel()` returns "play" when `getDigitalGoodsService("https://play.google.com/billing")`
resolves. But that resolving is NOT a guarantee that `PaymentRequest.show()` for
Play Billing works: a TWA whose AAB was built WITHOUT Play Billing enabled still
exposes the Digital Goods service, yet `show()` rejects with a `NotSupportedError`
("The payment method 'https://play.google.com/billing' is not supported").

**Why it matters:** this made the in-app "Pack Mundial" button dead-end with a
scary error even inside the installed app.

**How to apply:** the purchase handler (`CosmeticShop.handleBuyPack`) must treat
the Play path defensively:
- `AbortError` → user closed the Google Play sheet → abort quietly (no fallback,
  no alert).
- `NotSupportedError` / message contains "not supported" / our "no está
  disponible" guard → fall back to Stripe checkout (`startPackCheckout` →
  redirect). Helpers: `isPlayPurchaseCancelled` / `isPlayBillingUnavailable` in
  `playBilling.ts`.
- other errors → surface an alert.

**Root fix (infra, not code):** rebuild/release the TWA AAB with Play Billing
enabled so Stripe becomes a resilience path, not the primary in-app path.

**Policy caveat:** selling in-app digital goods via Stripe inside a Play-
distributed app can conflict with Google Play billing policy. The fallback is a
stopgap so purchases don't fail; the proper path is Play Billing in the AAB.
