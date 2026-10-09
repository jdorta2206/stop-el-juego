# Google Play Games Services integration — STOP

## Safety status

This is a preparation branch only. It does not change the deployed website or the released Android app.

The current Android package is a Trusted Web Activity (TWA), not a native game Activity. Its existing `LauncherActivity` already uses a validated Custom Tabs postMessage channel for the ads bridge. Play Games messages must not be added to the ads message handler or be allowed to interfere with ad requests.

## Confirmed repository state

- Android application ID: `app.replit.stop_el_juego.twa`.
- Android project: `android-generated/`; release workflow builds signed APK and AAB from this project.
- Existing local achievements are defined in `artifacts/stop-game/src/hooks/useAchievements.ts`.
- Phase 1 scaffolding is now present on this branch: Play Games Services v2 SDK dependency (`22.1.0`), manifest metadata, project ID resource (`902072408470`), and a best-effort authentication capability check in `LauncherActivity`. The SDK's manifest provider performs normal initialization; the TWA activity does not manually initialize the SDK.
- No achievement reporting, leaderboard submission/UI, cloud-save implementation, or web-to-native PGS message protocol has been added yet.
- The app's local achievements and the web backend's player identity/progression remain the source of truth for STOP. PGS is an optional platform layer and must never grant XP, coins, streaks, rewards, or competitive score on its own.

## Required external configuration (must be supplied from Play Console)

1. Create/configure Play Games Services for the existing Play Store app.
2. Record the numeric Play Games Services project ID.
3. Link an Android OAuth credential for package `app.replit.stop_el_juego.twa` using the **Google Play App Signing SHA-1** from Play Console. Add a separate debug credential only if local debug testing is needed.
4. Create the achievement IDs and leaderboard IDs in Play Console and publish the PGS configuration for test accounts.
5. Confirm the existing release signing workflow can produce a candidate AAB without changing the production version or pushing to the Railway-connected branch.

These values cannot safely be guessed or fabricated. Without them, a successful build would not prove PGS authentication works.

## Integration plan and release gates

### Phase 1 — native SDK and graceful capability detection

- **Scaffolding added on the integration branch:** SDK dependency, manifest project metadata, project ID resource, and non-blocking authentication capability check. The SDK initializes through its default manifest provider.
- An unsigned Android debug APK/AAB validation workflow is configured to install Android SDK API 36 and attempt both build targets. Its result still needs to be confirmed; test sign-in with Play Console-configured test accounts after the Android OAuth client is linked.
- Keep all PGS calls isolated from the ad bridge.
- If PGS is not configured, the Play Games app is missing, authentication is declined, or network/service calls fail, log a diagnostic and continue the existing TWA game unchanged.
- Do not expose a general-purpose JavaScript interface to arbitrary pages. Any web-to-native bridge must validate the exact HTTPS origin, message schema, request IDs, and allowed action IDs.

### Phase 2 — achievements

- Map only existing STOP achievement definitions to Play Console IDs; do not invent a second XP/reward system.
- Trigger achievements only from server-confirmed milestones. Never trust a client-supplied “unlock” message or award gameplay currency from PGS.
- Treat PGS reporting as best-effort and idempotent. A failure to report an achievement must not block a round or change its result.

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
- **Not implemented yet:** STOP achievement mapping/reporting, leaderboard mapping/submission, any guarded native/web action protocol, and Saved Games save/load/conflict handling.
- Play Console achievement and leaderboard IDs must be created before those features can be wired to real resources. Saved Games must remain disabled until its implementation is ready to test.
- No successful build or device test result is confirmed yet. Do not call this integration complete or live.
