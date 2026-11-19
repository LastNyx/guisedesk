#!/usr/bin/env sh
# Start the built app with the Electron from node_modules. Data lives in ~/.config/GuiseDesk.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -x node_modules/electron/dist/electron ] || [ ! -f out/main/index.js ]; then
  echo "GuiseDesk is not set up here. Run: sh $ROOT/launchers/setup.sh" >&2
  exit 1
fi
exec node_modules/electron/dist/electron out/main/index.js "$@"
