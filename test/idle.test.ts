import { EventEmitter } from 'node:events'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { loadIdleMinutes } from '../src/main/accounts'
import { createIdle } from '../src/main/idle'
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
