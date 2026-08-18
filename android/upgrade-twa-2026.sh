#!/usr/bin/env bash
set -euo pipefail

# STOP El Juego — Android/TWA release upgrade for Google Play (2026)
#
# Required fixes:
#   - Android target SDK 36 (Android 16)
#   - Play Billing >= 8.0; use playbilling 1.2.0 (Billing 8.3.0)
#   - Keep the existing packageId and signing key
#
# Run this from the GENERATED Bubblewrap TWA project directory, where
# twa-manifest.json and app/build.gradle are present.

if [[ ! -f twa-manifest.json || ! -f app/build.gradle ]]; then
  echo "ERROR: No encuentro twa-manifest.json y app/build.gradle en este directorio."
  echo "Este repositorio solo guarda el manifest; ejecuta este script dentro del proyecto Android/TWA generado por Bubblewrap."
  exit 1
fi

command -v npx >/dev/null 2>&1 || {
  echo "ERROR: Node.js/npx no está instalado."
  exit 1
}

if [[ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" || -z "${BUBBLEWRAP_KEY_PASSWORD:-}" ]]; then
  echo "AVISO: Bubblewrap pedirá las contraseñas de la keystore al hacer el build."
fi

echo "==> Actualizando/generando el proyecto con Bubblewrap 1.25.0..."
npx --yes @bubblewrap/cli@1.25.0 update --manifest="$(pwd)/twa-manifest.json"

# Bubblewrap 1.25.0 generates targetSdkVersion 36. Its Play Billing wrapper
# may still reference playbilling 1.1.0 (Billing 7.1.1), which Google Play
# no longer accepts for new updates after 31-Aug-2026. The android-browser-helper
# billing-1.2.0 artifact upgrades the underlying Billing Client to 8.3.0.
if grep -q "com.google.androidbrowserhelper:playbilling:1\.1\.0" app/build.gradle; then
  echo "==> Actualizando Play Billing wrapper 1.1.0 -> 1.2.0..."
  sed -i 's/com\.google\.androidbrowserhelper:playbilling:1\.1\.0/com.google.androidbrowserhelper:playbilling:1.2.0/g' app/build.gradle
fi

# Defensive check: if Bubblewrap ever emits an older target SDK, fail instead
# of producing an AAB that Google Play will reject.
if ! grep -Eq 'targetSdkVersion[[:space:]]+36' app/build.gradle; then
  echo "ERROR: app/build.gradle no tiene targetSdkVersion 36. No se genera el AAB."
  exit 1
fi

if grep -q "com.google.androidbrowserhelper:playbilling:1\.1\.0" app/build.gradle; then
  echo "ERROR: sigue presente playbilling 1.1.0. No se genera el AAB."
  exit 1
fi

echo "==> Verificación OK: targetSdkVersion 36 y Play Billing actualizado."
echo "==> Generando AAB firmado..."
npx --yes @bubblewrap/cli@1.25.0 build --skipPwaValidation --manifest="$(pwd)/twa-manifest.json"

echo
echo "=============================================="
echo " AAB generado. Busca: app-release-bundle.aab"
echo " Package: app.replit.stop_el_juego.twa"
echo " Version: 1.3.6.1 / versionCode 15"
echo "=============================================="
