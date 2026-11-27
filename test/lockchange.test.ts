import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadIdleMinutes } from '../src/main/accounts'
import { createIdle } from '../src/main/idle'
import { createLock } from '../src/main/lock'
import { applyIdle } from '../src/main/prefs'

const FAST = { N: 1024, r: 8, p: 1, keylen: 32 }
const tmp = () => mkdtempSync(join(tmpdir(), 'gd-chg-'))

async function unlocked(dir = tmp()) {
  const clock = { t: 1_000_000 }
  const lock = createLock({ dir, now: () => clock.t, params: FAST })
  await lock.setup('pin', '123456', '123456')
  return { dir, clock, lock }
}

describe('Change PIN or password', () => {
  it('needs the current one: a wrong current changes nothing; the right one rewrites the hash', async () => {
    const { lock, dir } = await unlocked()
    const before = readFileSync(join(dir, 'lock.json'), 'utf8')
    expect(await lock.change('000000', 'pin', '654321', '654321')).toHaveProperty('error')
    expect(JSON.parse(readFileSync(join(dir, 'lock.json'), 'utf8')).hash).toBe(JSON.parse(before).hash)
    expect(await lock.change('123456', 'pin', '654321', '654321')).toEqual({ ok: true })
    const after = JSON.parse(readFileSync(join(dir, 'lock.json'), 'utf8'))
    expect(after.hash).not.toBe(JSON.parse(before).hash)
    lock.lock()
    expect(await lock.unlock('123456')).toEqual({ result: 'wrong' })
    expect(await lock.unlock('654321')).toEqual({ result: 'ok' })
  })

  it('applies the setup rules to the new secret (typed twice) and keeps the old one when they fail', async () => {
    const { lock } = await unlocked()
    expect(await lock.change('123456', 'pin', '123', '123')).toHaveProperty('error')
    expect(await lock.change('123456', 'pin', '654321', '654322')).toEqual({ error: 'The two entries do not match' })
    lock.lock()
    expect(await lock.unlock('123456')).toEqual({ result: 'ok' })
  })

  it('switching PIN to Password is a change too and updates the kind', async () => {
    const { lock } = await unlocked()
    expect(await lock.change('123456', 'password', 'longenough', 'longenough')).toEqual({ ok: true })
    expect(lock.info()).toMatchObject({ state: 'unlocked', kind: 'password' })
    expect(lock.info().pinLength).toBeUndefined()
    lock.lock()
    expect(await lock.unlock('longenough')).toEqual({ result: 'ok' })
  })

  it('keeps the rate limit: 5 wrong currents start the wait, and the right one is refused during it', async () => {
    const { lock, clock } = await unlocked()
    for (let i = 0; i < 4; i++) expect(await lock.change('111111', 'pin', '654321', '654321')).toEqual({ error: 'Wrong current entry' })
    expect(await lock.change('111111', 'pin', '654321', '654321')).toMatchObject({ waitUntil: clock.t + 30_000 })
    expect(await lock.change('123456', 'pin', '654321', '654321')).toMatchObject({ waitUntil: clock.t + 30_000 })
    clock.t += 30_000
    expect(await lock.change('123456', 'pin', '654321', '654321')).toEqual({ ok: true })
  })

  it('is refused while locked or in setup', async () => {
    const { lock } = await unlocked()
    lock.lock()
    expect(await lock.change('123456', 'pin', '654321', '654321')).toHaveProperty('error')
    const fresh = createLock({ dir: tmp(), params: FAST })
    expect(await fresh.change('123456', 'pin', '654321', '654321')).toHaveProperty('error')
  })
})

describe('Idle choice', () => {
  it('is saved to settings.json idleLock and reaches the running lock timer at once', () => {
    const dir = tmp()
    const clock = { t: 0 }
    let locked = 0
    const idle = createIdle({ now: () => clock.t, minutes: 10, onIdle: () => locked++ })
    clock.t = 6 * 60_000
    idle.check()
    expect(locked).toBe(0)
    expect(applyIdle(dir, 5, idle)).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).idleLock).toBe(5)
    expect(loadIdleMinutes(dir)).toBe(5)
    idle.check()
    expect(locked).toBe(1)
    expect(applyIdle(dir, 'manual', idle)).toBe(true)
    locked = 0
    clock.t = 99 * 60_000
    idle.check()
    expect(locked).toBe(0)
  })

  it('refuses a value that is not 5, 10, 30 or manual', () => {
    const dir = tmp()
    const idle = createIdle({ now: () => 0, minutes: 10, onIdle: () => {} })
    expect(applyIdle(dir, 7 as never, idle)).toBe(false)
    expect(loadIdleMinutes(dir)).toBe(10)
  })
})
