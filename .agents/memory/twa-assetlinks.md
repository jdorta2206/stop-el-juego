---
name: TWA assetlinks / .well-known serving
description: Why the Android TWA shows the browser toolbar, and how /.well-known/assetlinks.json must be served on each tier.
---

# TWA "ugly browser bar" = assetlinks.json not served

When the Android app (TWA, package `app.replit.stop_el_juego.twa`) opens with the
browser toolbar visible (X + URL bar) instead of full-screen, the cause is Digital
Asset Links verification failing: the start-URL origin is not serving
`/.well-known/assetlinks.json` as real JSON. Verify with
`curl -i https://<host>/.well-known/assetlinks.json` — must be `200` +
`application/json`, never `text/html`. If it returns the SPA `index.html`, it's broken.

**Why it breaks (the trap):** dotfile directories like `.well-known` are NOT served
by default on multiple tiers, so the SPA catch-all swallows the path and returns
`index.html`:
- `express.static(dir)` defaults to `dotfiles: "ignore"` → use `{ dotfiles: "allow" }`.
- `res.sendFile(file)` ALSO defaults to ignoring dotfiles → pass `{ dotfiles: "allow" }`
  in its options, or it 404s even when the file exists.
- `vite preview` (sirv) does not serve dotfile dirs either.

**How to apply (fix lives on every serving tier):**
- Express single-service (`api-server`, `SERVE_CLIENT=1`): add an explicit
  `app.get("/.well-known/assetlinks.json", ...)` route BEFORE the SPA fallback, using
  `res.sendFile(..., { dotfiles: "allow" })`; this is the tier the Railway/www host
  and the Android app actually hit.
- Vite dev/preview: a small plugin (`configureServer` + `configurePreviewServer`)
  intercepting the exact path and returning the file gives local parity.
- `public/_redirects`: exclude `/.well-known/*` from the `/* /index.html 200` catch-all
  (only helps Netlify/Cloudflare-style hosts).

**Caveat:** the `sha256_cert_fingerprints` in assetlinks.json must match the app's
Play Console signing key, or verification fails even when the file is served correctly.
That value is out of the agent's reach (needs Play Console).
