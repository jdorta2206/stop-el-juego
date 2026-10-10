# Google Play Games Services integration — STOP

## Safety status

This is a preparation branch only. It does not change the deployed website or the released Android app.

The current Android package is a Trusted Web Activity (TWA), not a native game Activity. Its existing `LauncherActivity` already uses a validated Custom Tabs postMessage channel for the ads bridge. Play Games messages must not be added to the ads message handler or be allowed to interfere with ad requests.

## Confirmed repository state

- Android application ID: `app.replit.stop_el_juego.twa`.
- Android project: `android-generated/`; release workflow builds signed APK and AAB from this project.
- Existing local achievements are defined in `artifacts/stop-game/src/hooks/useAchievements.ts`.
- Phase 1 scaffolding is now present on this branch: Play Games Services v2 SDK dependency (`22.1.0`), manifest metadata, project ID resource (`902072408470`), and a best-effort authentication capability check in `LauncherActivity`. The SDK's manifest provider performs normal initialization; the TWA activity does not manually initialize the SDK.
- The web side now installs a native `message` listener at startup, waits for `STOP_AD_BRIDGE_READY`, and queues/deduplicates fixed-key achievement requests until the channel reports ready. Requests use a non-navigational `window.postMessage` message and carry the current page origin; the native handler independently checks the validated TWA channel, origin, and allowlisted key. This is code-level implementation only: successful web-to-native delivery and real PGS unlocks still require end-to-end Android device validation. Leaderboard submission/UI and cloud-save implementation remain absent.
- The app's local achievements and the web backend's player identity/progression remain the source of truth for STOP. PGS is an optional platform layer and must never grant XP, coins, streaks, rewards, or competitive score on its own. Automatic achievement reporting is intentionally disabled. The exported `stoppgs://unlock` route and its native unlock handler were removed because an externally launched custom URL does not authenticate the caller. The official achievements screen remains available through `stoppgs://achievements`.

## Required external configuration (must be supplied from Play Console)

1. Create/configure Play Games Services for the existing Play Store app.
2. Record the numeric Play Games Services project ID.
3. Link an Android OAuth credential for package `app.replit.stop_el_juego.twa` using the **Google Play App Signing SHA-1** from Play Console. Add a separate debug credential only if local debug testing is needed.
4. Achievement IDs have been created and mapped. Keep the configuration in draft until the bridge is validated on a device; leaderboard IDs are out of scope for this phase.
5. Confirm the existing release signing workflow can produce a candidate AAB without changing the production version or pushing to the Railway-connected branch.

These values cannot safely be guessed or fabricated. Without them, a successful build would not prove PGS authentication works.

## Integration plan and release gates

### Phase 1 — native SDK and graceful capability detection

- **Scaffolding added on the integration branch:** SDK dependency, manifest project metadata, project ID resource, and non-blocking authentication capability check. The SDK initializes through its default manifest provider.
- **Build verified:** GitHub Actions run 37949040253 completed successfully, including `:app:assembleDebug`, `:app:bundleDebug`, and checks that both APK and AAB artifacts exist. This verifies debug compilation only; it does not verify sign-in, release signing, or on-device behavior. Test sign-in with Play Console-configured accounts after the Android OAuth client is linked. The validation workflow uploads both debug artifacts for seven days after a successful run so they can be installed on a test device; this remains an unsigned debug build, not a release candidate. A follow-up workflow check also guards the package ID, `versionCode 54`, `versionName 1.3.6.9`, start URL version, PGS SDK/manifest metadata, notification permission, and Play update-check wiring against accidental regression.
- The previous custom-scheme unlock transport remains prohibited. The current non-navigational bridge is implemented on the integration branch but is not yet release-approved: it must pass end-to-end device tests before this PR can be merged or a release AAB published. Native code validates the channel relationship, payload origin, and fixed achievement-key allowlist.
- If PGS is not configured, the Play Games app is missing, authentication is declined, or network/service calls fail, log a diagnostic and continue the existing TWA game unchanged.
- Do not expose a general-purpose JavaScript interface to arbitrary pages. Any future web-to-native bridge must validate the exact HTTPS origin, request schema, and allowed action IDs. The previous achievement-unlock deep-link route has been removed; do not restore it as a reporting transport.

### Phase 2 — achievements

- **ID mapping implemented:** all 15 local achievement keys map to the exact IDs supplied from Play Console in `GOOGLE_PLAY_ACHIEVEMENT_IDS` in `useAchievements.ts`.
- **Web/native request path implemented on this branch:** reports use a non-navigational message and only fixed local achievement keys. It does not navigate to `stoppgs://unlock`. The former exported unlock route and native handler remain removed. Do not claim automatic PGS achievement unlocks are functional until a real Android end-to-end test succeeds. Client-side stats/localStorage remain non-authoritative for competitive rewards.
- When reporting is implemented, it must be best-effort and idempotent. A failure to report an achievement must not block a round or change its result.

### Phase 3 — leaderboards (after score authority review)

- Publish only server-validated score values from a documented score definition.
- Never submit arbitrary client scores directly as authoritative competitive results.
- Add UI entry points only after the native bridge and fallback path have passed Android device tests.

### Mandatory validation before release

- Build both APK and AAB with the same application ID and release signing configuration.
- Verify manifest, SDK dependency resolution, package ID, version code, signing certificate, and AAB contents.
- Test: signed-in tester, no Play Games profile, service unavailable/offline, sign-in dismissed, web-only browser, interrupted app/resume, repeated achievement event, malformed/foreign-origin messages, and ordinary solo/multiplayer matches.
- Confirm existing ads, billing, notifications, deep links, gameplay, player identity, progression, and rankings still work.
- Do not merge or publish until these gates pass and the Play Games configuration is available.

## Current status and blockers

- **Implemented on branch, not released:** SDK dependency + project metadata + best-effort auth capability check.
- **Still blocked for end-to-end auth verification:** linked Android OAuth credential using the Play App Signing SHA-1.
- **Implemented:** mapping of all 15 STOP achievement keys to the real Play Console IDs.
- **Implemented but not yet device-verified:** non-navigational web-to-native achievement reporting. Real device delivery/authentication remains a release blocker.
- **Not implemented yet:** leaderboard mapping/submission and Saved Games save/load/conflict handling.
- Play Console achievement and leaderboard IDs must be created before those features can be wired to real resources. Saved Games must remain disabled until its implementation is ready to test.
- Unsigned debug APK/AAB build verified in GitHub Actions run 37961964977; artifact `stop-pgs-debug-build` was uploaded successfully and expires 2026-10-16. The next workflow run will also execute static guards for PGS configuration and preserved Android release settings. No successful device test or end-to-end PGS authentication result is confirmed. Do not call this integration complete or live.
