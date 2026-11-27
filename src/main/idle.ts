// In-app idle tracker (D15, D17) and the lock schedule (D51). Plain TS, injected clock. Main feeds touch() from input
// in the app window and every service view, unlocked() at each unlock, and calls check() on a timer.
import { inWorkHours, scheduleMinutes, type LockSchedule } from './schedule'

export type IdleMinutes = 5 | 10 | 30 | 'manual'

/** The rule that locks the app right now, as a short line for the top-bar menu (D57). */
export interface IdleRule {
  rule: string
  /** Whether the minutes count from the last unlock or from the last input. */
  count: 'unlock' | 'idle'
}

function fmt(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} h`
  return minutes > 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`
}

/** The active rule (schedule first, then the idle choice); null when only Ctrl+L and the tray lock. */
export function describeIdleRule(minutes: IdleMinutes, schedule: LockSchedule | undefined, d: Date): IdleRule | null {
  if (schedule?.on) {
    const what = schedule.count === 'unlock' ? 'after unlock' : 'without use'
    const part = inWorkHours(schedule, d) ? 'Work hours' : 'Off hours'
    return { rule: `${part}: ${fmt(scheduleMinutes(schedule, d))} ${what}`, count: schedule.count }
  }
  if (minutes === 'manual') return null
  return { rule: `Idle: ${fmt(minutes)} without use`, count: 'idle' }
}

export function createIdle(o: { now: () => number; minutes: IdleMinutes; onIdle: () => void; schedule?: LockSchedule }) {
  let minutes = o.minutes
  let schedule = o.schedule
  let last = o.now()
  let unlockedAt = o.now()
  // Milliseconds until the current period locks; null when no rule is active.
  function remaining(now: number): number | null {
    const r = describeIdleRule(minutes, schedule, new Date(now))
    if (!r) return null
    const limit = (schedule?.on ? scheduleMinutes(schedule, new Date(now)) : (minutes as number)) * 60_000
    const from = r.count === 'unlock' ? unlockedAt : last
    return Math.max(0, limit - (now - from))
  }
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
    /** Time left under the current rule (D57): the top-bar countdown. Null when no rule is active. */
    remainingMs(): number | null {
      return remaining(o.now())
    },
    /** The rule in effect right now, for the top-bar menu. */
    rule(): string | null {
      return describeIdleRule(minutes, schedule, new Date(o.now()))?.rule ?? null
    },
    /**
     * Push the current period back by ms (the "Add 15 minutes" action, D57). Both clocks move so it works for the
     * unlock and the idle count, and the next user input or unlock starts a fresh, unextended period.
     */
    extend(ms: number): void {
      if (!Number.isFinite(ms) || ms <= 0) return
      last += ms
      unlockedAt += ms
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
