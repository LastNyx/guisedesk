// In-app idle tracker (D15, D17) and the lock schedule (D51). Plain TS, injected clock. Main feeds touch() from input
// in the app window and every service view, unlocked() at each unlock, and calls check() on a timer.
import { scheduleMinutes, type LockSchedule } from './schedule'

export type IdleMinutes = 5 | 10 | 30 | 'manual'

export function createIdle(o: { now: () => number; minutes: IdleMinutes; onIdle: () => void; schedule?: LockSchedule }) {
  let minutes = o.minutes
  let schedule = o.schedule
  let last = o.now()
  let unlockedAt = o.now()
  return {
    touch(): void {
      last = o.now()
    },
    /** A fresh unlock: both clocks restart. */
    unlocked(): void {
      last = unlockedAt = o.now()
    },
    setMinutes(m: IdleMinutes): void {
      minutes = m
    },
    setSchedule(s: LockSchedule): void {
      schedule = s
    },
    /** Schedule on: work-hours or off-hours limit, counted from the unlock or from the last input. Else the idle choice. */
    check(): void {
      const now = o.now()
      if (schedule?.on) {
        const limit = scheduleMinutes(schedule, new Date(now)) * 60_000
        const from = schedule.count === 'unlock' ? unlockedAt : last
        if (now - from >= limit) o.onIdle()
        return
      }
      if (minutes === 'manual') return
      if (now - last >= minutes * 60_000) o.onIdle()
    }
  }
}
