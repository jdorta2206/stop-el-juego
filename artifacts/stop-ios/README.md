# STOP iOS

Native iOS application for STOP! Juego de Palabras Online.

## Goal

This app is intentionally isolated from the production web/Android frontend. It will reuse the existing STOP backend and account/game APIs while providing a native iOS experience.

## Current phase

- Expo SDK 57 / React Native 0.86 bootstrap.
- Native iOS bundle identifier reserved: `com.dorynex.stopjuegodepalabras`.
- Production API base URL is configured in `app.json`.
- No production changes are made by this app.

## Validation plan

1. Install dependencies and run TypeScript checks.
2. Start Expo and validate the native shell.
3. Add API client and authentication.
4. Port gameplay and multiplayer screens incrementally.
5. Add iOS-native features and purchases only after the core game works.
6. Build with EAS and test through TestFlight before any App Store submission.

## Important

A real iPhone/iPad is not available to the project owner, so simulator/build validation and cloud builds will be used as far as possible. Final physical-device validation must be performed before App Store submission.
