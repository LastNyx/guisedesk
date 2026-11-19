// Start on login (D4): an XDG autostart entry. Plain TS, no electron import; env/home are passed in so tests use a temp dir.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface AutostartOpts {
  env: Record<string, string | undefined>
  home: string
  appPath: string
}

export const autostartPath = (env: AutostartOpts['env'], home: string): string =>
  join(env.XDG_CONFIG_HOME || join(home, '.config'), 'autostart', 'guisedesk.desktop')

/** True when the app was started with --hidden (login start): the window stays in the tray. */
export const startsHidden = (argv: string[]): boolean => argv.includes('--hidden')

const q = (s: string) => (/[\s"'`$\\<>~|&;*?#()]/.test(s) ? `"${s.replace(/(["`$\\])/g, '\\$1')}"` : s)

/** The one place the launch command is built: the launcher script in the app's own root (app.getAppPath()). */
export const autostartExec = (appPath: string): string => `${q(join(appPath, 'launchers', 'guisedesk.sh'))} --hidden`

export const isAutostart = (o: AutostartOpts): boolean => existsSync(autostartPath(o.env, o.home))

export function setAutostart(o: AutostartOpts, on: boolean): void {
  const file = autostartPath(o.env, o.home)
  if (!on) {
    rmSync(file, { force: true })
    return
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(
    file,
    `[Desktop Entry]\nType=Application\nName=GuiseDesk\nComment=Chat accounts in one window\nExec=${autostartExec(o.appPath)}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`
  )
}
