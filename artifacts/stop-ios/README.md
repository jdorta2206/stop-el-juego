# STOP iOS

Native iOS application for STOP! Juego de Palabras Online.

## Current preparation phase — before paying Apple Developer

The objective is to leave everything that can be prepared and checked **without the Apple Developer Program fee** ready first. The €99 Apple payment is deliberately the final external step.

### Already prepared

- Expo SDK 57 / React Native 0.86 bootstrap.
- Native iOS bundle identifier: `com.dorynex.stopjuegodepalabras`.
- Production API configured against the existing STOP backend.
- Native Apple Sign In flow prepared.
- Google and Facebook web OAuth bridge prepared for iOS.
- Secure session storage prepared with `expo-secure-store`.
- Native shop/collection shell and inventory API prepared.
- EAS configuration with development simulator and preview profiles.

### Work to complete before paying Apple

- Keep the iOS project isolated from production web/Android code.
- Finish native screens and API integration for the existing STOP account, ranking, achievements, profile, shop and gameplay systems.
- Verify all TypeScript/build configuration and remove compile-time blockers.
- Prepare StoreKit product identifiers and purchase/restore flow without submitting anything to App Store Connect yet.
- Prepare App Store metadata/configuration, privacy declarations and required assets list.
- Prepare the TestFlight release configuration so only the Apple Developer account/signing step remains.

### Final steps that require the Apple account

1. Pay the Apple Developer Program fee.
2. Create/confirm the App Store Connect app using bundle ID `com.dorynex.stopjuegodepalabras`.
3. Configure Apple signing/certificates and App Store Connect products.
4. Build the signed iOS release with EAS.
5. Test through TestFlight on a real iPhone/iPad.
6. Submit for App Review.

## Validation plan

1. TypeScript check.
2. Expo native/simulator build.
3. Validate authentication and session restoration.
4. Validate gameplay and multiplayer API integration.
5. Validate ranking, profile, achievements and shop/collection.
6. Validate purchase/restore wiring against StoreKit test configuration.
7. Only then perform the Apple Developer/StoreKit/App Store Connect setup.

## Important

A real iPhone/iPad is not available to the project owner, so simulator/build validation and cloud builds will be used as far as possible. Final physical-device validation must be performed before App Store submission.
