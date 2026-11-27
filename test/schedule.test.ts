import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE, inWorkHours, normalizeSchedule, scheduleMinutes } from '../src/main/schedule'
import { createIdle } from '../src/main/idle'

// Local-time dates: 2026-11-23 is a Monday.
const at = (day: number, hh: number, mm = 0) => new Date(2026, 10, 22 + day, hh, mm)

describe('lock schedule (D51)', () => {
  const s = { ...DEFAULT_SCHEDULE, on: true }
  it('defaults: Mon-Fri 08:00-17:00, 15 min at work, 8 h outside, counted from unlock', () => {
    expect(normalizeSchedule(undefined)).toEqual({ ...DEFAULT_SCHEDULE, on: false })
    expect(DEFAULT_SCHEDULE).toMatchObject({ workMinutes: 15, offMinutes: 480, start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5], count: 'unlock' })
  })
  it('work hours by day and time; end is exclusive', () => {
    expect(inWorkHours(s, at(1, 9))).toBe(true)
    expect(inWorkHours(s, at(1, 7, 59))).toBe(false)
    expect(inWorkHours(s, at(1, 17))).toBe(false)
    expect(inWorkHours(s, at(6, 10))).toBe(false) // Saturday
    expect(scheduleMinutes(s, at(1, 9))).toBe(15)
    expect(scheduleMinutes(s, at(6, 10))).toBe(480)
  })
  it('overnight shift belongs to the day it started', () => {
    const n = { ...s, start: '22:00', end: '06:00', days: [5] } // Friday night
    expect(inWorkHours(n, at(5, 23))).toBe(true)
    expect(inWorkHours(n, at(6, 3))).toBe(true) // Saturday early = Friday's shift
    expect(inWorkHours(n, at(1, 3))).toBe(false)
  })
  it('bad fields fall back to defaults', () => {
    expect(normalizeSchedule({ on: true, start: '25:00', workMinutes: 0, offMinutes: 'x', days: [9, 1, 1], count: 'zz' })).toEqual({ ...DEFAULT_SCHEDULE, on: true, days: [1] })
  })
  it('the timer locks 15 min after unlock at work even while in use, and 8 h outside', () => {
    let t = at(1, 9).getTime()
    let locked = 0
    const idle = createIdle({ now: () => t, minutes: 10, schedule: s, onIdle: () => locked++ })
    idle.unlocked()
    t += 14 * 60_000; idle.touch(); idle.check()
    expect(locked).toBe(0)
    t += 60_000; idle.touch(); idle.check()
    expect(locked).toBe(1)
    t = at(6, 10).getTime(); idle.unlocked(); locked = 0
    t += 7 * 3600_000; idle.check()
    expect(locked).toBe(0)
    t += 3600_000; idle.check()
    expect(locked).toBe(1)
  })
  it('idle counting only locks after no input', () => {
    let t = at(1, 9).getTime()
    let locked = 0
    const idle = createIdle({ now: () => t, minutes: 10, schedule: { ...s, count: 'idle' }, onIdle: () => locked++ })
    idle.unlocked()
    for (let i = 0; i < 30; i++) { t += 60_000; idle.touch(); idle.check() }
    expect(locked).toBe(0)
    t += 15 * 60_000; idle.check()
    expect(locked).toBe(1)
  })
})
