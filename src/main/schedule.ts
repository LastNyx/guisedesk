// Lock schedule (D51). Plain TS, no electron: settings.json key lockSchedule, and the lock limit at a given time.
// During work hours (chosen days, start..end) the app locks after `workMinutes`; outside them after `offMinutes`.
// `count` picks what the minutes count: 'unlock' = time since the last unlock, 'idle' = time without input.

export interface LockSchedule {
  on: boolean
  /** 0 = Sunday ... 6 = Saturday. */
  days: number[]
  /** "HH:MM", 24 h. An end before the start runs past midnight. */
  start: string
  end: string
  workMinutes: number
  offMinutes: number
  count: 'unlock' | 'idle'
}

export const DEFAULT_SCHEDULE: LockSchedule = {
  on: false,
  days: [1, 2, 3, 4, 5],
  start: '08:00',
  end: '17:00',
  workMinutes: 15,
  offMinutes: 480,
  count: 'unlock'
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const clampMin = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 24 * 60 ? (v as number) : d)

/** Any input to a valid schedule; bad fields fall back to the defaults. */
export function normalizeSchedule(v: unknown): LockSchedule {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[])].sort() : DEFAULT_SCHEDULE.days
  return {
    on: o.on === true,
    days,
    start: typeof o.start === 'string' && TIME.test(o.start) ? o.start : DEFAULT_SCHEDULE.start,
    end: typeof o.end === 'string' && TIME.test(o.end) ? o.end : DEFAULT_SCHEDULE.end,
    workMinutes: clampMin(o.workMinutes, DEFAULT_SCHEDULE.workMinutes),
    offMinutes: clampMin(o.offMinutes, DEFAULT_SCHEDULE.offMinutes),
    count: o.count === 'idle' ? 'idle' : 'unlock'
  }
}

/** Is this local time inside work hours? A night shift (end <= start) counts from start to midnight and on to end. */
export function inWorkHours(s: LockSchedule, d: Date): boolean {
  const t = d.getHours() * 60 + d.getMinutes()
  const a = mins(s.start)
  const b = mins(s.end)
  if (a === b) return false
  if (a < b) return s.days.includes(d.getDay()) && t >= a && t < b
  // Overnight: the evening part belongs to today, the early part to yesterday's shift.
  if (t >= a) return s.days.includes(d.getDay())
  if (t < b) return s.days.includes((d.getDay() + 6) % 7)
  return false
}

/** Minutes until the app locks at this moment (schedule on only). */
export function scheduleMinutes(s: LockSchedule, d: Date): number {
  return inWorkHours(s, d) ? s.workMinutes : s.offMinutes
}

/** One-line summary for Settings. */
export function describeSchedule(s: LockSchedule): string {
  const what = s.count === 'unlock' ? 'after unlocking' : 'without use'
  return `Work hours: locks ${s.workMinutes} min ${what}. Other times: ${fmt(s.offMinutes)} ${what}.`
}

function fmt(m: number): string {
  if (m % 60 === 0) return `${m / 60} h`
  return m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
