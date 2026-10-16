#!/usr/bin/env bash
set -euo pipefail

# Build the pinned Android Browser Helper revision that exposes
# LauncherActivity.getCustomTabsSession(). Patch its launcher lifecycle so the
# activity owning the TWA CustomTabsSession survives while Chrome is foregrounded.
# The stock completion callback finishes LauncherActivity immediately, which
# triggers TwaLauncher.destroy()/unbindService() and kills the postMessage bridge.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android-generated"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

REPO_URL="https://github.com/dnikolaev/android-browser-helper.git"
PINNED_COMMIT="febadb4dcdd7a66fb4d17175b67c012f245c8610"

git clone --quiet --filter=blob:none "$REPO_URL" "$TMP_DIR/android-browser-helper"
git -C "$TMP_DIR/android-browser-helper" checkout --quiet --detach "$PINNED_COMMIT"

HELPER_LAUNCHER="$TMP_DIR/android-browser-helper/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/LauncherActivity.java"
HELPER_TWA_LAUNCHER="$TMP_DIR/android-browser-helper/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/TwaLauncher.java"
test -s "$HELPER_LAUNCHER"
test -s "$HELPER_TWA_LAUNCHER"

# Keep the launcher Activity and its CustomTabsService binding alive behind Chrome.
# The inherited onRestart() already finishes the activity when the user returns
# after closing the TWA, because mBrowserWasLaunched is set by this callback.
python3 - "$HELPER_LAUNCHER" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
lines = source.splitlines()
callback_lines = [i for i, line in enumerate(lines) if "mBrowserWasLaunched = true;" in line]
if len(callback_lines) != 1:
    raise SystemExit(
        "Expected exactly one stock TWA launch-completion marker; "
        f"found {len(callback_lines)}. Refusing to build an unpatched helper."
    )
index = callback_lines[0]
if index == 0 or index + 1 >= len(lines):
    raise SystemExit("TWA completion callback is truncated; refusing to patch")
if lines[index - 1].strip() != "() -> {" or "finish();" not in lines[index + 1]:
    raise SystemExit("TWA completion callback shape changed; refusing to patch")
lines[index] += " // STOP patch: retain this Activity and its CustomTabsSession"
del lines[index + 1]
patched_source = "\n".join(lines) + "\n"
path.write_text(patched_source)
patched = path.read_text()
if "STOP patch: retain this Activity and its CustomTabsSession" not in patched:
    raise SystemExit("TWA session lifecycle patch verification failed")
print("Applied and verified STOP TWA session lifecycle patch.")
PY

# CustomTabsSession.validateRelationship() requires CustomTabsClient.warmup()
# to have been called first. The upstream helper skips warmup on providers that
# advertise launch-without-warmup support, which can leave STOP's use_as_origin
# validation rejected. Warm up unconditionally before creating the TWA session.
python3 - "$HELPER_TWA_LAUNCHER" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
source = path.read_text()
pattern = re.compile(
    r'if\s*\(\s*!ChromeLegacyUtils\s*\.supportsLaunchWithoutWarmup\('
    r'\s*mContext\.getPackageManager\(\)\s*,\s*mProviderPackage\s*\)\s*\)'
    r'\s*\{\s*client\.warmup\(0\);\s*\}',
    re.S,
)
patched, count = pattern.subn(
    'client.warmup(0); // STOP patch: required before validateRelationship',
    source,
)
if count != 1:
    raise SystemExit(
        "Expected exactly one conditional TWA warmup block; "
        f"found {count}. Refusing to build an unpatched helper."
    )
path.write_text(patched)
verified = path.read_text()
if "client.warmup(0); // STOP patch: required before validateRelationship" not in verified:
    raise SystemExit("Custom Tabs warmup patch verification failed")
print("Applied and verified unconditional Custom Tabs warmup before session creation.")
PY

(
  cd "$TMP_DIR/android-browser-helper"
  chmod +x ./gradlew
  ./gradlew :androidbrowserhelper:assembleRelease --no-daemon
)

AAR="$TMP_DIR/android-browser-helper/androidbrowserhelper/build/outputs/aar/androidbrowserhelper-release.aar"
test -s "$AAR"
mkdir -p "$ANDROID_DIR/app/libs"
cp "$AAR" "$ANDROID_DIR/app/libs/androidbrowserhelper-release.aar"
echo "Built patched Android Browser Helper AAR from $PINNED_COMMIT"
