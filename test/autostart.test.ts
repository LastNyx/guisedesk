import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { autostartExec, autostartPath, isAutostart, setAutostart, startsHidden } from '../src/main/autostart'

const tmp = () => mkdtempSync(join(tmpdir(), 'gd-xdg-'))
const o = (xdg: string) => ({ env: { XDG_CONFIG_HOME: xdg }, home: '/nonexistent-home', execPath: '/opt/gd dir/electron', appPath: '/opt/gd dir/app' })

describe('Start on login (XDG autostart)', () => {
  it('creates guisedesk.desktop with a --hidden Exec, and removes it again', () => {
    const xdg = tmp()
    expect(isAutostart(o(xdg))).toBe(false)
    setAutostart(o(xdg), true)
    const file = join(xdg, 'autostart', 'guisedesk.desktop')
    expect(existsSync(file)).toBe(true)
    expect(isAutostart(o(xdg))).toBe(true)
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('[Desktop Entry]')
    expect(text).toContain('Name=GuiseDesk')
    expect(text).toContain(`Exec=${autostartExec('/opt/gd dir/electron', '/opt/gd dir/app')}`)
    expect(text).toMatch(/Exec=.*--hidden/)
    setAutostart(o(xdg), false)
    expect(existsSync(file)).toBe(false)
    expect(isAutostart(o(xdg))).toBe(false)
    expect(() => setAutostart(o(xdg), false)).not.toThrow()
  })

  it('quotes paths with spaces in Exec', () => {
    expect(autostartExec('/opt/gd dir/electron', '/opt/gd dir/app')).toBe('"/opt/gd dir/electron" "/opt/gd dir/app" --hidden')
  })

  it('uses XDG_CONFIG_HOME, else ~/.config', () => {
    expect(autostartPath({ XDG_CONFIG_HOME: '/x/cfg' }, '/home/u')).toBe('/x/cfg/autostart/guisedesk.desktop')
    expect(autostartPath({}, '/home/u')).toBe('/home/u/.config/autostart/guisedesk.desktop')
  })

  it('startsHidden sees the --hidden flag', () => {
    expect(startsHidden(['electron', 'app', '--hidden'])).toBe(true)
    expect(startsHidden(['electron', 'app'])).toBe(false)
  })
})
