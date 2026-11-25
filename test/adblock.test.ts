import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createAdblock, type Engine } from '../src/main/adblock'
import { createDispatcher } from '../src/main/webrequest'
import { ENGINE_MAX_AGE } from '../src/main/blocking'

const GOOD = new Uint8Array([1, 2, 3])
const fakeEngine = (): Engine => ({
  onBeforeRequest: (d, cb) => cb(d.url.includes('ads') ? { cancel: true } : {}),
  onHeadersReceived: (_d, cb) => cb({}),
  onInjectCosmeticFilters: vi.fn(async () => {}),
  onIsMutationObserverEnabled: vi.fn(async () => true),
  isAdPopup: (url) => url.includes('adclick')
})
// "Deserialize": only the GOOD bytes load; anything else throws like a corrupt or old-version file.
const load = (b: Uint8Array) => {
  if (b.length !== 3 || b[0] !== 1) throw new Error('bad engine')
  return fakeEngine()
}
const session = () => ({ registerPreloadScript: vi.fn(() => 'pre-1'), unregisterPreloadScript: vi.fn() })
const webRequest = () => ({ onBeforeRequest: vi.fn(), onHeadersReceived: vi.fn() })
const setup = (over: Partial<Parameters<typeof createAdblock>[0]> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-ab-'))
  const handlers: Record<string, (e: unknown, ...a: unknown[]) => unknown> = {}
  const ab = createAdblock({
    dir, load, preloadPath: '/p.js', wanted: () => true, log: () => {},
    build: vi.fn(async () => GOOD),
    handle: (ch, fn) => void (handlers[ch] = fn),
    ...over
  })
  return { dir, ab, handlers, cache: join(dir, 'adblock', 'engine.bin') }
}
const writeCache = (file: string, bytes: Uint8Array, ageMs = 0) => {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, bytes)
  const t = (Date.now() - ageMs) / 1000
  utimesSync(file, t, t)
}

describe('adblock engine loading', () => {
  it('a bad cache is deleted and leads to a download, not a null engine', async () => {
    const build = vi.fn(async () => GOOD)
    const { ab, cache } = setup({ build })
    writeCache(cache, new Uint8Array([9, 9]))
    expect(await ab.loadEngine()).not.toBeNull()
    expect(build).toHaveBeenCalledOnce()
    expect([...readFileSync(cache)]).toEqual([...GOOD])
  })
  it('a fresh good cache is used without a download', async () => {
    const build = vi.fn(async () => GOOD)
    const { ab, cache } = setup({ build })
    writeCache(cache, GOOD)
    expect(await ab.loadEngine()).not.toBeNull()
    expect(build).not.toHaveBeenCalled()
  })
  it('a download failure falls back to a good (stale) cache', async () => {
    const { ab, cache } = setup({ build: vi.fn(async () => { throw new Error('offline') }) })
    writeCache(cache, GOOD, ENGINE_MAX_AGE + 1000)
    expect(await ab.loadEngine()).not.toBeNull()
  })
  it('a download failure with no cache gives null; the cache is written atomically on success', async () => {
    const { ab, cache } = setup({ build: vi.fn(async () => { throw new Error('offline') }) })
    expect(await ab.loadEngine()).toBeNull()
    expect(existsSync(cache)).toBe(false)
    expect(existsSync(cache + '.tmp')).toBe(false)
  })
})

describe('adblock sessions', () => {
  it('toggling off during the first load stays off', async () => {
    let release!: (b: Uint8Array) => void
    let wanted = true
    const { ab } = setup({ build: () => new Promise((r) => (release = r)), wanted: () => wanted })
    const ses = session(), wr = webRequest()
    const d = createDispatcher(wr)
    const on = ab.setSession(ses, d, true)
    wanted = false
    await ab.setSession(ses, d, false)
    release(GOOD)
    await on
    expect(ab.isEnabled(ses)).toBe(false)
    expect(ses.registerPreloadScript).not.toHaveBeenCalled()
    expect(d.names()).toEqual([])
  })
  it('turning off removes only its own webRequest handler', async () => {
    const { ab } = setup()
    const ses = session(), wr = webRequest()
    const d = createDispatcher(wr)
    d.add('other', { before: (_d, cb) => cb({}) })
    await ab.setSession(ses, d, true)
    expect(d.names().sort()).toEqual(['adblock', 'other'])
    await ab.setSession(ses, d, false)
    expect(d.names()).toEqual(['other'])
    expect(wr.onBeforeRequest).not.toHaveBeenLastCalledWith(null)
    expect(ses.unregisterPreloadScript).toHaveBeenCalledWith('pre-1')
  })
  it('counts blocked requests per webContents', async () => {
    const onBlocked = vi.fn()
    const { ab } = setup({ onBlocked })
    const ses = session(), wr = webRequest()
    await ab.setSession(ses, createDispatcher(wr), true)
    const listener = wr.onBeforeRequest.mock.calls.at(-1)![1]
    const cb = vi.fn()
    listener({ url: 'https://ads.example/x.js', webContentsId: 7 }, cb)
    listener({ url: 'https://ok.example/x.js', webContentsId: 7 }, cb)
    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(onBlocked).toHaveBeenCalledWith(7, 'https://ads.example/x.js')
    expect(cb.mock.calls).toEqual([[{ cancel: true }], [{}]])
  })
  it('the IPC handlers ignore senders whose session is not enabled', async () => {
    const { ab, handlers } = setup()
    const on = session(), off = session()
    await ab.setSession(on, createDispatcher(webRequest()), true)
    const inject = handlers['@ghostery/adblocker/inject-cosmetic-filters']
    const mo = handlers['@ghostery/adblocker/is-mutation-observer-enabled']
    expect(await mo({ sender: { session: off } })).toBe(false)
    expect(await inject({ sender: { session: off } }, 'https://x/')).toBeUndefined()
    expect(await mo({ sender: { session: on } })).toBe(true)
  })
  it('isAdPopup asks the loaded engine; false before it loads', async () => {
    const { ab } = setup()
    expect(ab.isAdPopup('https://adclick.example/', 'https://x/')).toBe(false)
    await ab.loadEngine()
    expect(ab.isAdPopup('https://adclick.example/', 'https://x/')).toBe(true)
    expect(ab.isAdPopup('https://news.example/', 'https://x/')).toBe(false)
  })
})

describe('webRequest dispatcher', () => {
  it('runs handlers in order; the first non-empty answer wins; empty set clears the listener', () => {
    const wr = webRequest()
    const d = createDispatcher(wr)
    d.add('a', { before: (_x, cb) => cb({}) })
    d.add('b', { before: (_x, cb) => cb({ cancel: true }) })
    const cb = vi.fn()
    wr.onBeforeRequest.mock.calls.at(-1)![1]({}, cb)
    expect(cb).toHaveBeenCalledWith({ cancel: true })
    d.remove('a'); d.remove('b')
    expect(wr.onBeforeRequest).toHaveBeenLastCalledWith(null)
  })
})
