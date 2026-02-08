#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$ROOT_DIR/webextension"
DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/.stage"
KEY_DIR="$ROOT_DIR/.keys"
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SAFARI_APP_NAME="${SAFARI_APP_NAME:-Okta Auto-Next}"
# For Safari converter, the extension bundle id is derived as "${BUNDLE_ID}.Extension".
# To avoid Xcode embed errors, use the same bundle id the converter uses for the app target.
SAFARI_BUNDLE_ID="${SAFARI_BUNDLE_ID:-au.unimelb.okta.Okta-Auto-Next}"

rm -rf "$DIST_DIR"
mkdir -p "$STAGE_DIR"
mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR" 2>/dev/null || true

echo "Validating manifest..."
jq -e . "$SRC_DIR/manifest.json" >/dev/null

echo "Ensuring PNG icons exist (for Safari)..."
if [ ! -f "$SRC_DIR/icons/okta-next-16.png" ] && [ -f "$SRC_DIR/icons/okta-next.svg" ]; then
  TMP_ICON_DIR="$(mktemp -d)"
  for s in 16 32 48 128; do
    qlmanage -t -s "$s" -o "$TMP_ICON_DIR" "$SRC_DIR/icons/okta-next.svg" >/dev/null 2>&1 || true
    if [ -f "$TMP_ICON_DIR/okta-next.svg.png" ]; then
      mv -f "$TMP_ICON_DIR/okta-next.svg.png" "$SRC_DIR/icons/okta-next-${s}.png"
    fi
  done
  rm -rf "$TMP_ICON_DIR"
fi

build_zip() {
  local name="$1"
  local stage="$2"
  local out_zip="$DIST_DIR/${name}.zip"
  (cd "$stage" && zip -qr "$out_zip" .)
  echo "Wrote $out_zip"
}

echo "Building Firefox zip..."
cp -R "$SRC_DIR" "$STAGE_DIR/firefox"
rm -f "$STAGE_DIR/firefox/manifest.json"
cp -f "$STAGE_DIR/firefox/manifest.firefox.json" "$STAGE_DIR/firefox/manifest.json"
rm -f "$STAGE_DIR/firefox/manifest.firefox.json"
build_zip "okta-auto-next-firefox" "$STAGE_DIR/firefox"
cp -f "$DIST_DIR/okta-auto-next-firefox.zip" "$DIST_DIR/okta-auto-next-firefox.xpi"
echo "Wrote $DIST_DIR/okta-auto-next-firefox.xpi"

echo "Building Chrome zip..."
cp -R "$SRC_DIR" "$STAGE_DIR/chrome"
node - "$STAGE_DIR/chrome/manifest.json" <<'NODE'
const fs = require("fs");
const p = process.argv[2];
const m = JSON.parse(fs.readFileSync(p, "utf8"));
// Chrome doesn't need (and may not like) Firefox-specific metadata.
delete m.browser_specific_settings;
fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
NODE
build_zip "okta-auto-next-chrome" "$STAGE_DIR/chrome"

echo "Building Chrome CRX (best effort)..."
if [ -x "$CHROME_BIN" ]; then
  CRX_STAGE_DIR="$STAGE_DIR/chrome-crx"
  rm -rf "$CRX_STAGE_DIR"
  cp -R "$STAGE_DIR/chrome" "$CRX_STAGE_DIR"

  KEY_PATH="$KEY_DIR/chrome.pem"
  if [ -f "$KEY_PATH" ]; then
    chmod 600 "$KEY_PATH" 2>/dev/null || true
    "$CHROME_BIN" --pack-extension="$CRX_STAGE_DIR" --pack-extension-key="$KEY_PATH" >/dev/null 2>&1 || true
  else
    "$CHROME_BIN" --pack-extension="$CRX_STAGE_DIR" >/dev/null 2>&1 || true
    # Chrome writes a new pem alongside the extension dir (same parent).
    if [ -f "${CRX_STAGE_DIR}.pem" ]; then
      mv -f "${CRX_STAGE_DIR}.pem" "$KEY_PATH"
      chmod 600 "$KEY_PATH" 2>/dev/null || true
      "$CHROME_BIN" --pack-extension="$CRX_STAGE_DIR" --pack-extension-key="$KEY_PATH" >/dev/null 2>&1 || true
    fi
  fi

  if [ -f "${CRX_STAGE_DIR}.crx" ]; then
    mv -f "${CRX_STAGE_DIR}.crx" "$DIST_DIR/okta-auto-next-chrome.crx"
    echo "Wrote $DIST_DIR/okta-auto-next-chrome.crx"
    if [ -f "$KEY_PATH" ]; then
      echo "Chrome key: $KEY_PATH (keep this stable to keep the same extension ID)"
    fi
  else
    echo "Skipping CRX: Chrome pack-extension did not produce a .crx (Chrome may require a GUI session)."
  fi
else
  echo "Skipping CRX: Chrome binary not found at $CHROME_BIN"
fi

echo "Building Safari wrapper project (best effort)..."
DEV_DIR=""
if [ -d "/Applications/Xcode.app/Contents/Developer" ]; then
  DEV_DIR="/Applications/Xcode.app/Contents/Developer"
fi

if command -v xcrun >/dev/null 2>&1; then
  ACTIVE_DEV_DIR="$(xcode-select -p 2>/dev/null || true)"
  if [ -n "$DEV_DIR" ] && [ "$ACTIVE_DEV_DIR" != "$DEV_DIR" ]; then
    echo "Note: active developer dir is $ACTIVE_DEV_DIR"
    echo "Safari build may require selecting Xcode:"
    echo "  sudo xcode-select -s \"$DEV_DIR\""
  fi
  set +e
  FIND_OUT="$(DEVELOPER_DIR="$DEV_DIR" xcrun --find safari-web-extension-converter 2>&1)"
  FIND_CODE="$?"
  set -e
  if [ "$FIND_CODE" -eq 0 ]; then
    SAFARI_SRC="$STAGE_DIR/safari_src"
    rm -rf "$SAFARI_SRC"
    cp -R "$SRC_DIR" "$SAFARI_SRC"
    if [ -f "$SAFARI_SRC/manifest.safari.json" ]; then
      rm -f "$SAFARI_SRC/manifest.json"
      cp -f "$SAFARI_SRC/manifest.safari.json" "$SAFARI_SRC/manifest.json"
      rm -f "$SAFARI_SRC/manifest.safari.json"
    fi
    # Avoid embedding Firefox-only manifest in the Safari wrapper resources.
    rm -f "$SAFARI_SRC/manifest.firefox.json" "$SAFARI_SRC/background.firefox.js" 2>/dev/null || true

    # Generates an Xcode project + macOS app wrapper. You still need to open/build it once.
    DEVELOPER_DIR="$DEV_DIR" xcrun safari-web-extension-converter "$SAFARI_SRC" \
      --app-name "$SAFARI_APP_NAME" \
      --bundle-identifier "$SAFARI_BUNDLE_ID" \
      --macos-only \
      --project-location "$DIST_DIR/safari" \
      --copy-resources \
      --no-open >/dev/null 2>&1 || true
    if [ -d "$DIST_DIR/safari" ]; then
      echo "Wrote $DIST_DIR/safari (open the Xcode project and build once to enable in Safari)."
      (cd "$DIST_DIR" && zip -qr "okta-auto-next-safari-project.zip" "safari")
      echo "Wrote $DIST_DIR/okta-auto-next-safari-project.zip"
    else
      echo "Safari converter did not produce output."
    fi
  else
    if echo "$FIND_OUT" | grep -q "Xcode license agreements"; then
      echo "Skipping Safari: Xcode license not accepted. Run: sudo xcodebuild -license accept"
    else
      echo "Skipping Safari: safari-web-extension-converter not available (or Xcode not selected)."
      echo "Details: $FIND_OUT"
    fi
  fi
else
  echo "Skipping Safari: xcrun not found."
fi

echo "Done."
