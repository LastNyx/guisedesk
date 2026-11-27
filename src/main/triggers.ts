// Lock triggers (D15): screen lock and in-app idle. Ctrl+L and the tray call lock.lock() directly. No electron import.
import { createIdle, type IdleMinutes } from './idle'
import type { LockSchedule } from './schedule'

export interface TriggerLock {
  lock(): void
  onChange(cb: (s: string) => void): void
  state(): string
}

export function wireTriggers(o: {
  lock: TriggerLock
  power: { on(event: 'lock-screen', cb: () => void): unknown }
  now: () => number
  minutes: IdleMinutes
  schedule?: LockSchedule
}) {
  const idle = createIdle({ now: o.now, minutes: o.minutes, schedule: o.schedule, onIdle: () => o.lock.lock() })
  o.power.on('lock-screen', () => o.lock.lock())
  // A fresh unlock starts a fresh idle period.
  o.lock.onChange((s) => s === 'unlocked' && idle.unlocked())
  return idle
}
