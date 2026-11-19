// Settings that act at once (Lock tab). Plain TS, no electron import.
import { saveIdleMinutes } from './accounts'
import type { IdleMinutes } from './idle'

/** Saves the idle choice to settings.json (idleLock) and hands it to the running timer, so no restart is needed. */
export function applyIdle(dir: string, value: unknown, idle: { setMinutes(m: IdleMinutes): void }): boolean {
  if (value !== 5 && value !== 10 && value !== 30 && value !== 'manual') return false
  saveIdleMinutes(dir, value)
  idle.setMinutes(value)
  return true
}
