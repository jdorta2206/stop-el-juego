#!/usr/bin/env bash
set -euo pipefail

# Build the pinned Android Browser Helper revision that exposes
# LauncherActivity.getCustomTabsSession(). It is an upstream PR commit and is
# not published to Maven/JitPack, so build the AAR from source reproducibly.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android-generated"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

REPO_URL="https://github.com/dnikolaev/android-browser-helper.git"
PINNED_COMMIT="febadb4dcdd7a66fb4d17175b67c012f245c8610"

git clone --quiet --filter=blob:none "$REPO_URL" "$TMP_DIR/android-browser-helper"
git -C "$TMP_DIR/android-browser-helper" checkout --quiet --detach "$PINNED_COMMIT"

(
  cd "$TMP_DIR/android-browser-helper"
  chmod +x ./gradlew
  ./gradlew :androidbrowserhelper:assembleRelease --no-daemon
)

AAR="$TMP_DIR/android-browser-helper/androidbrowserhelper/build/outputs/aar/androidbrowserhelper-release.aar"
test -s "$AAR"
mkdir -p "$ANDROID_DIR/app/libs"
cp "$AAR" "$ANDROID_DIR/app/libs/androidbrowserhelper-release.aar"
echo "Built pinned Android Browser Helper AAR from $PINNED_COMMIT"
