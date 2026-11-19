#!/usr/bin/env sh
# Install dependencies and build the app. Safe to run again. Run from anywhere; it works in the worktree root.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for tool in node npm; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: $tool was not found on PATH. Install Node 24 or newer and run this again." >&2; exit 1; }
done
echo "setup: npm ci"
npm ci
# npm 12 skips Electron's postinstall, so the binary is not downloaded: fetch it when missing.
if [ ! -d node_modules/electron/dist ]; then
  echo "setup: downloading the Electron binary (node_modules/electron/install.js)"
  node node_modules/electron/install.js
fi
if [ ! -x node_modules/electron/dist/electron ]; then
  echo "ERROR: node_modules/electron/dist/electron is missing after install." >&2
  exit 1
fi
echo "setup: npm run build"
npm run build
echo "done. start with: sh $ROOT/launchers/guisedesk.sh"
