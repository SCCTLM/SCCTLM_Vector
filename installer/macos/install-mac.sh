#!/bin/bash
# SCCTLM Vector installer for macOS. Runs as the current user (no sudo) and uses only stock tools.
#
#   Install / update:  curl -fsSL <release-url>/install-mac.sh | bash
#   Uninstall:         bash install-mac.sh --uninstall
#
# VECTOR_BASE_URL overrides where vector-extension.zip and its .sha256 are fetched from
# (file:// URLs work, which is how CI tests this script).
set -euo pipefail

EXT_ID="vn.scctlm.vector"
BASE_URL="${VECTOR_BASE_URL:-https://github.com/SCCTLM/SCCTLM_Vector-releases/releases/latest/download}"
EXT_ROOT="$HOME/Library/Application Support/Adobe/CEP/extensions"
EXT_DIR="$EXT_ROOT/$EXT_ID"
ZIP_NAME="vector-extension.zip"

fail() { echo "Error: $*" >&2; exit 1; }

if [ "${1:-}" = "--uninstall" ]; then
  # Presets live outside the extension folder and are deliberately kept.
  rm -rf "$EXT_DIR"
  echo "Removed $EXT_ID. Your presets were kept. Restart Illustrator."
  exit 0
fi

[ "$(uname -s)" = "Darwin" ] || fail "this installer is for macOS"
for tool in curl ditto shasum defaults; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool"
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Downloading SCCTLM Vector..."
curl -fsSL "$BASE_URL/$ZIP_NAME" -o "$WORK/$ZIP_NAME" || fail "could not download $BASE_URL/$ZIP_NAME"
curl -fsSL "$BASE_URL/$ZIP_NAME.sha256" -o "$WORK/$ZIP_NAME.sha256" || fail "could not download the checksum file"

expected="$(awk '{print tolower($1)}' "$WORK/$ZIP_NAME.sha256" | head -n 1)"
actual="$(shasum -a 256 "$WORK/$ZIP_NAME" | awk '{print $1}')"
[ -n "$expected" ] && [ "$expected" = "$actual" ] || fail "checksum mismatch, nothing was installed"

ditto -x -k "$WORK/$ZIP_NAME" "$WORK/ext" || fail "could not unpack the download"
[ -f "$WORK/ext/CSXS/manifest.xml" ] && [ -f "$WORK/ext/loader.html" ] || fail "download is not a valid extension package"

mkdir -p "$EXT_ROOT"
rm -rf "$EXT_DIR"
mv "$WORK/ext" "$EXT_DIR"

# Let Illustrator load unsigned CEP panels.
for n in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$n" PlayerDebugMode 1
done
killall cfprefsd >/dev/null 2>&1 || true

echo "Installed. Restart Illustrator, then open Window > Extensions > SCCTLM Vector."
