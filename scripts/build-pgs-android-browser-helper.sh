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
test -s "$HELPER_LAUNCHER"

# Keep the launcher Activity and its CustomTabsService binding alive behind Chrome.
# The inherited onRestart() already finishes the activity when the user returns
# after closing the TWA, because mBrowserWasLaunched is set by this callback.
python3 - "$HELPER_LAUNCHER" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
source = path.read_text()
pattern = re.compile(
    r"(?P<arrow>[ \\t]*)\\(\\) -> \\{\\n"
    r"(?P<body>[ \\t]*)mBrowserWasLaunched = true;\\n"
    r"[ \\t]*finish\\(\\);\\n(?P<close>[ \\t]*)\\},"
)

def retain_session(match):
    arrow = match.group("arrow")
    body = match.group("body")
    close = match.group("close")
    return (
        f"{arrow}() -> {{\\n"
        f"{body}// STOP patch: retain this Activity and its CustomTabsSession while\\n"
        f"{body}// the TWA is open. Finishing here unbinds the service in onDestroy()\\n"
        f"{body}// and invalidates the CustomTabsCallback used by postMessage.\\n"
        f"{body}// onRestart() finishes this Activity after the user closes the TWA.\\n"
        f"{body}mBrowserWasLaunched = true;\\n"
        f"{close}}},"
    )

patched_source, replacements = pattern.subn(retain_session, source, count=1)
if replacements != 1:
    raise SystemExit(
        "Expected exactly one stock TWA completion callback to patch; "
        f"found {replacements}. Refusing to build an unpatched helper."
    )
path.write_text(patched_source)
patched = path.read_text()
if "STOP patch: retain this Activity and its CustomTabsSession" not in patched:
    raise SystemExit("TWA session lifecycle patch verification failed")
print("Applied and verified STOP TWA session lifecycle patch.")
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
