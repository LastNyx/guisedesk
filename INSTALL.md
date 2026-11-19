# Installing GuiseDesk

The daily app is a git worktree of this repo, detached at a release tag, next to the dev checkout. The dev repo
stays dev-only: switching branches or building there never touches the installed app. Examples below assume the
dev repo is `~/Dokumen/projects/personal/guisedesk` and the installed copy is `guisedesk-app` beside it.

Needs Node 24 or newer, npm and git.

## Install

    cd ~/Dokumen/projects/personal
    git -C guisedesk worktree add --detach ../guisedesk-app v0.1.0
    sh guisedesk-app/launchers/setup.sh

setup.sh runs `npm ci`, downloads the Electron binary if it is missing, and builds the app (`npm run build`).
It can be run again at any time. npm 12 skips Electron's postinstall step, so the binary is not downloaded by
`npm ci`; setup.sh runs `node node_modules/electron/install.js` for that (slow the first time).

Menu entry: copy the template with the install path filled in.

    APP="$HOME/Dokumen/projects/personal/guisedesk-app"
    sed "s|@APPDIR@|$APP|g" "$APP/launchers/guisedesk.desktop" > ~/.local/share/applications/guisedesk.desktop

Start it from the app menu, or run `sh guisedesk-app/launchers/guisedesk.sh`. The first start asks for a PIN or
password. "Start on login" (Settings, General) writes `~/.config/autostart/guisedesk.desktop`, which runs the
launcher script in the same folder as the running app with `--hidden`.

## Update to a new release
Quit GuiseDesk first (tray menu, Quit), then:

    cd ~/Dokumen/projects/personal
    git -C guisedesk fetch --tags        # if the tag is new
    git -C guisedesk-app checkout vX.Y.Z
    sh guisedesk-app/launchers/setup.sh

## Roll back
Same as update, with the previous tag: `git -C guisedesk-app checkout v0.1.0`, then rerun setup.sh. Data is not
changed by switching versions. If you re-enable Start on login after moving the install, toggle it off and on so
the autostart entry points at the current folder.

To remove the install: `git -C guisedesk worktree remove --force ../guisedesk-app` and delete
`~/.local/share/applications/guisedesk.desktop`.

## Where data lives
- The installed app: `~/.config/GuiseDesk` (accounts, sessions, lock file, settings).
- Dev runs (`npm run dev`): `~/.config/GuiseDesk-dev`, so they never touch the daily app's data.
- Tests use a temporary folder (`GUISEDESK_DATA`).
- Start on login: `~/.config/autostart/guisedesk.desktop`.

Data lives outside the worktree, so updating, rolling back or removing the worktree keeps it.
