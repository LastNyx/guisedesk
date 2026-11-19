#!/usr/bin/env sh
# Apply an update (D29): update.sh <tag> <app pid> <app root> <log file>.
# The app copies this file to a temp path and starts the copy detached, then quits: checkout rewrites this file mid-run.
# Waits for the app to exit, refuses on local changes, checks out the tag, runs npm ci only when package-lock.json
# changed (or Electron is missing), builds and relaunches. If anything fails after the checkout it goes back to the
# old commit, rebuilds it and relaunches that. Steps can be replaced for tests: GUISEDESK_UPDATE_CI / _BUILD / _LAUNCH.
set -eu
TAG="${1:?tag}"; PID="${2:?pid}"; ROOT="${3:?app root}"; LOG="${4:?log file}"
exec >>"$LOG" 2>&1
echo "update: $(date '+%Y-%m-%d %H:%M:%S') -> $TAG (root $ROOT)"

printf '%s' "$TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || { echo "update: not a version tag: $TAG"; exit 2; }
printf '%s' "$PID" | grep -Eq '^[0-9]+$' || { echo "update: bad pid: $PID"; exit 2; }

# (default kept in its own variable: a closing brace inside ${VAR:-...} would end the expansion early)
DEFAULT_CI='npm ci && { [ -d node_modules/electron/dist ] || node node_modules/electron/install.js; }'
CI_CMD="${GUISEDESK_UPDATE_CI:-$DEFAULT_CI}"
BUILD_CMD="${GUISEDESK_UPDATE_BUILD:-npm run build}"
LAUNCH_CMD="${GUISEDESK_UPDATE_LAUNCH:-sh launchers/guisedesk.sh}"

cd "$ROOT"

# Wait for the app to be gone (give up after 60 s: it is still running, so leave everything alone).
i=0
while [ -d "/proc/$PID" ]; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then echo "update: the app (pid $PID) did not exit in 60 s; giving up"; exit 1; fi
  sleep 1
done

launch() {
  echo "update: relaunching"
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid sh -c "$LAUNCH_CMD" >>"$LOG" 2>&1 </dev/null &
  else
    nohup sh -c "$LAUNCH_CMD" >>"$LOG" 2>&1 </dev/null &
  fi
}

# build <from sha> <to sha>: npm ci only when the lock differs or Electron is missing, then the build.
build() {
  if [ ! -d node_modules/electron/dist ] || ! git diff --quiet "$1" "$2" -- package-lock.json; then
    echo "update: npm ci"
    sh -c "$CI_CMD" || return 1
  else
    echo "update: package-lock.json unchanged, keeping node_modules"
  fi
  echo "update: build"
  sh -c "$BUILD_CMD" || return 1
}

early() { echo "update: $1; nothing was changed"; launch; exit 1; }

[ -z "$(git status --porcelain)" ] || early "refused: local changes present"
OLD_SHA="$(git rev-parse HEAD)"
OLD_REF="$(git symbolic-ref -q --short HEAD || echo "$OLD_SHA")"

git fetch --tags origin || early "git fetch failed"
git checkout --detach "$TAG" || early "git checkout $TAG failed"
NEW_SHA="$(git rev-parse HEAD)"

if build "$OLD_SHA" "$NEW_SHA"; then
  echo "update: now at $TAG"
  launch
  exit 0
fi

echo "update: FAILED, rolling back to $OLD_REF"
git checkout -f "$OLD_REF" || echo "update: rollback checkout failed"
build "$NEW_SHA" "$OLD_SHA" || echo "update: rebuilding the old version failed"
launch
exit 1
