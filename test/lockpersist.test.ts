import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLock } from '../src/main/lock'

const FAST = { N: 1024, r: 8, p: 1, keylen: 32 }

async function setupLocked() {
  const dir = mkdtempSync(join(tmpdir(), 'gd-persist-'))
  const clock = { t: 1_000_000 }
  const open = () => createLock({ dir, now: () => clock.t, params: FAST })
  const first = open()
  await first.setup('pin', '123456', '123456')
  return { dir, clock, open }
}

describe('wrong-try counter survives a restart', () => {
  it('3 wrong tries, restart: only 2 more are plain wrong, the 5th total starts the wait', async () => {
    const { open } = await setupLocked()
    const a = open()
    for (let i = 0; i < 3; i++) expect(await a.unlock('111111')).toEqual({ result: 'wrong' })
    const b = open()
    expect(await b.unlock('111111')).toEqual({ result: 'wrong' })
    expect(await b.unlock('111111')).toMatchObject({ result: 'wait' })
  })

  it('the 30 s wait survives a restart until the clock passes it; then a right PIN works and clears it', async () => {
    const { dir, clock, open } = await setupLocked()
    const a = open()
    for (let i = 0; i < 5; i++) await a.unlock('111111')
    const until = clock.t + 30_000
    clock.t += 10_000
    const b = open()
    expect(b.info().waitUntil).toBe(until)
    expect(await b.unlock('123456')).toEqual({ result: 'wait', until })
    clock.t = until
    expect(await b.unlock('123456')).toEqual({ result: 'ok' })
    const rec = JSON.parse(readFileSync(join(dir, 'lock.json'), 'utf8'))
    expect(rec.fails ?? 0).toBe(0)
    expect(rec.waitUntil ?? 0).toBe(0)
    b.lock()
    const c = open()
    for (let i = 0; i < 4; i++) expect(await c.unlock('111111')).toEqual({ result: 'wrong' })
  })

  it('a correct unlock clears earlier wrong tries, and lock.json stays 0600', async () => {
    const { dir, open } = await setupLocked()
    const a = open()
    await a.unlock('111111')
    await a.unlock('111111')
    expect(await a.unlock('123456')).toEqual({ result: 'ok' })
    expect(statSync(join(dir, 'lock.json')).mode & 0o777).toBe(0o600)
    a.lock()
    const b = open()
    for (let i = 0; i < 4; i++) expect(await b.unlock('111111')).toEqual({ result: 'wrong' })
  })

  it('reset() returns the lock to setup so a new PIN can be set', async () => {
    const { open } = await setupLocked()
    const a = open()
    a.lock()
    a.reset()
    expect(a.state()).toBe('setup')
    expect(await a.setup('pin', '654321', '654321')).toEqual({ ok: true })
  })
})
