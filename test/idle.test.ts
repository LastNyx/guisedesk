import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { loadIdleMinutes } from '../src/main/accounts'
import { createIdle, describeIdleRule } from '../src/main/idle'
import { createLock } from '../src/main/lock'
import { wireTriggers } from '../src/main/triggers'

const MIN = 60_000

describe('idle rule', () => {
  it('locks once the chosen minutes pass with no input, not before (fake clock)', () => {
    const clock = { t: 1_000_000 }
    const onIdle = vi.fn()
    const idle = createIdle({ now: () => clock.t, minutes: 5, onIdle })
    clock.t += 5 * MIN - 1
    idle.check()
    expect(onIdle).not.toHaveBeenCalled()
    clock.t += 1
    idle.check()
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('input resets the timer', () => {
    const clock = { t: 0 }
    const onIdle = vi.fn()
    const idle = createIdle({ now: () => clock.t, minutes: 10, onIdle })
    clock.t += 9 * MIN
    idle.touch()
    clock.t += 9 * MIN
    idle.check()
    expect(onIdle).not.toHaveBeenCalled()
    clock.t += MIN
    idle.check()
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('Manual never locks on idle, and the setting can change later', () => {
    const clock = { t: 0 }
    const onIdle = vi.fn()
    const idle = createIdle({ now: () => clock.t, minutes: 'manual', onIdle })
    clock.t += 24 * 60 * MIN
    idle.check()
    expect(onIdle).not.toHaveBeenCalled()
    idle.setMinutes(30)
    idle.touch()
    clock.t += 30 * MIN
    idle.check()
    expect(onIdle).toHaveBeenCalledTimes(1)
  })
})

describe('idle setting in settings.json', () => {
  const read = (json?: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-idle-'))
    if (json !== undefined) writeFileSync(join(dir, 'settings.json'), JSON.stringify(json))
    return loadIdleMinutes(dir)
  }
  it('defaults to 10; accepts 5, 10, 30 and manual; anything else is 10', () => {
    expect(read()).toBe(10)
    expect(read({ idleLock: 5 })).toBe(5)
    expect(read({ idleLock: 30 })).toBe(30)
    expect(read({ idleLock: 'manual' })).toBe('manual')
    expect(read({ idleLock: 7 })).toBe(10)
    expect(read({ idleLock: 'soon' })).toBe(10)
  })
})

describe('lock triggers', () => {
  // lock() needs a lock.json to exist, so set one up first.
  const withPin = async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gd-trig-'))
    const lock = createLock({ dir, params: { N: 1024, r: 8, p: 1, keylen: 32 } })
    await lock.setup('pin', '123456', '123456')
    return lock
  }

  it('powerMonitor lock-screen locks the app', async () => {
    const lock = await withPin()
    const power = new EventEmitter()
    wireTriggers({ lock, power, now: () => 0, minutes: 'manual' })
    expect(lock.state()).toBe('unlocked')
    power.emit('lock-screen')
    expect(lock.state()).toBe('locked')
  })

  it('the idle sweep locks the app after the chosen minutes, and input keeps it unlocked', async () => {
    const lock = await withPin()
    const clock = { t: 0 }
    const t = wireTriggers({ lock, power: new EventEmitter(), now: () => clock.t, minutes: 10 })
    clock.t += 9 * MIN
    t.touch()
    clock.t += 9 * MIN
    t.check()
    expect(lock.state()).toBe('unlocked')
    clock.t += MIN
    t.check()
    expect(lock.state()).toBe('locked')
  })

  it('unlocking restarts the idle timer', async () => {
    const lock = await withPin()
    const clock = { t: 0 }
    const t = wireTriggers({ lock, power: new EventEmitter(), now: () => clock.t, minutes: 5 })
    clock.t += 6 * MIN
    t.check()
    expect(lock.state()).toBe('locked')
    clock.t += 60 * MIN
    expect(await lock.unlock('123456')).toEqual({ result: 'ok' })
    t.check()
    expect(lock.state()).toBe('unlocked')
  })
})

describe('lock countdown and Add 15 minutes (D57)', () => {
  const MIN = 60_000
  const monday10 = new Date(2026, 0, 5, 10, 0).getTime()
  const sched = {
    on: true,
    days: [1, 2, 3, 4, 5],
    start: '08:00',
    end: '17:00',
    workMinutes: 15,
    offMinutes: 480,
    count: 'unlock' as const
  }

  it('no rule for Manual and no schedule: nothing to count down', () => {
    const idle = createIdle({ now: () => monday10, minutes: 'manual', onIdle: () => {} })
    expect(idle.remainingMs()).toBeNull()
    expect(idle.rule()).toBeNull()
    const scheduled = createIdle({ now: () => monday10, minutes: 'manual', onIdle: () => {}, schedule: { ...sched, on: false } })
    expect(scheduled.remainingMs()).toBeNull()
  })

  it('counts the work-hours schedule from the unlock and names the rule', () => {
    const clock = { t: monday10 }
    const idle = createIdle({ now: () => clock.t, minutes: 'manual', onIdle: () => {}, schedule: sched })
    expect(idle.remainingMs()).toBe(15 * MIN)
    expect(idle.rule()).toBe('Work hours: 15 min after unlock')
    clock.t += 3 * MIN
    expect(idle.remainingMs()).toBe(12 * MIN)
    clock.t += 12 * MIN
    expect(idle.remainingMs()).toBe(0)
  })

  it('extend(ms) pushes the current period back and is dropped by the next unlock', () => {
    const clock = { t: monday10 }
    const idle = createIdle({ now: () => clock.t, minutes: 'manual', onIdle: () => {}, schedule: sched })
    clock.t += 3 * MIN
    idle.extend(15 * MIN)
    expect(idle.remainingMs()).toBe(27 * MIN)
    clock.t += 10 * MIN
    expect(idle.remainingMs()).toBe(17 * MIN)
    idle.unlocked()
    expect(idle.remainingMs()).toBe(15 * MIN)
  })

  it('uses the off-hours limit outside work hours', () => {
    const clock = { t: new Date(2026, 0, 5, 20, 0).getTime() }
    const idle = createIdle({ now: () => clock.t, minutes: 'manual', onIdle: () => {}, schedule: sched })
    expect(idle.remainingMs()).toBe(480 * MIN)
    expect(idle.rule()).toBe('Off hours: 8 h after unlock')
  })

  it('the idle choice counts from the last input, and a touch starts a fresh unextended period', () => {
    const clock = { t: 0 }
    const idle = createIdle({ now: () => clock.t, minutes: 5, onIdle: () => {} })
    expect(idle.rule()).toBe('Idle: 5 min without use')
    clock.t += 4 * MIN
    expect(idle.remainingMs()).toBe(MIN)
    idle.extend(15 * MIN)
    expect(idle.remainingMs()).toBe(16 * MIN)
    idle.touch()
    expect(idle.remainingMs()).toBe(5 * MIN)
  })

  it('ignores a bad extend value', () => {
    const clock = { t: 0 }
    const idle = createIdle({ now: () => clock.t, minutes: 5, onIdle: () => {} })
    idle.extend(0)
    idle.extend(-5)
    idle.extend(Number.NaN)
    expect(idle.remainingMs()).toBe(5 * MIN)
  })

  it('describeIdleRule is pure and picks the schedule branch over the idle choice', () => {
    expect(describeIdleRule(10, sched, new Date(monday10))).toEqual({ rule: 'Work hours: 15 min after unlock', count: 'unlock' })
    expect(describeIdleRule(10, { ...sched, count: 'idle' }, new Date(monday10))!.rule).toBe('Work hours: 15 min without use')
    expect(describeIdleRule('manual', undefined, new Date(monday10))).toBeNull()
  })
})
