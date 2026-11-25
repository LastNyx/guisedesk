// Ad blocking (D45) on account sessions with Ghostery's filter engine (EasyList, uBlock Origin ads + trackers lists).
// One engine for the app; each session gets a network handler (through the webRequest dispatcher) and the cosmetic
// preload. The library's own enableBlockingInSession registers the cosmetic IPC handlers per session, which throws on
// the second session, so the wiring is done here: handlers once, hooks per session.
// No electron import: main injects the engine builder, ipcMain.handle and the sessions, so this file is unit tested.
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic } from './atomic'
import { engineFresh } from './blocking'

/** The parts of the engine this file uses (ElectronBlocker plus a $popup check, see adengine.ts). */
export interface Engine {
  onBeforeRequest(details: any, callback: (r: any) => void): void
  onHeadersReceived(details: any, callback: (r: any) => void): void
  onInjectCosmeticFilters(event: any, url: string, msg?: unknown): Promise<void>
  onIsMutationObserverEnabled(event: any): Promise<boolean>
  isAdPopup(url: string, sourceUrl: string): boolean
}

export interface SessionLike {
  registerPreloadScript(s: { type: 'frame'; filePath: string }): string
  unregisterPreloadScript(id: string): void
}

type Hook = (details: any, callback: (r: any) => void) => void
export interface Dispatcher {
  add(name: string, h: { before?: Hook; headers?: Hook }): void
  remove(name: string): void
}

export interface AdblockDeps {
  dir: string
  /** Downloads the lists and returns the serialized engine; built off the main thread in the app (adbuild.ts worker). */
  build: () => Promise<Uint8Array>
  /** Serialized bytes to an engine; throws on a corrupt or old-version file. */
  load: (bytes: Uint8Array) => Engine
  /** ipcMain.handle */
  handle: (channel: string, fn: (e: any, ...args: any[]) => unknown) => void
  preloadPath: string
  /** Is ad blocking wanted now? Checked again after the engine load, so switching off during the load sticks. */
  wanted: () => boolean
  /** A request was cancelled or redirected in this webContents (the top bar count). */
  onBlocked?: (webContentsId: number, url: string) => void
  now?: () => number
  log?: (msg: string, err?: unknown) => void
}

const NAME = 'adblock'

export function createAdblock(d: AdblockDeps) {
  const now = d.now ?? Date.now
  const log = d.log ?? ((m: string, e?: unknown) => console.warn(m, e ?? ''))
  const enabled = new Map<object, string>() // session -> preload script id
  let engine: Engine | null = null
  let loading: Promise<Engine | null> | null = null
  let handlersOn = false
  const folder = join(d.dir, 'adblock')
  const file = join(folder, 'engine.bin')

  /** The cached engine, or null; an unreadable cache (corrupt, older engine version) is deleted. */
  const readCache = (): Engine | null => {
    try {
      return d.load(new Uint8Array(readFileSync(file)))
    } catch (e) {
      log('[guisedesk] ad blocker cache unreadable, removing it', e)
      try { unlinkSync(file) } catch { /* gone already */ }
      return null
    }
  }

  /** Fresh cache: use it. Bad or stale cache: download and rebuild. Download failed: any readable cache, else null. */
  function loadEngine(): Promise<Engine | null> {
    if (engine) return Promise.resolve(engine)
    if (loading) return loading
    loading = (async () => {
      const mtime = existsSync(file) ? statSync(file).mtimeMs : undefined
      if (engineFresh(mtime, now())) engine = readCache()
      if (!engine) {
        try {
          const bytes = await d.build()
          engine = d.load(bytes)
          mkdirSync(folder, { recursive: true })
          writeAtomic(file, bytes)
        } catch (e) {
          log('[guisedesk] ad blocker lists failed', e)
          if (existsSync(file)) engine = readCache()
        }
      }
      loading = null
      return engine
    })()
    return loading
  }

  /** The cosmetic-filter IPC, once for the app; senders whose session is not enabled get nothing. */
  function wireHandlers(): void {
    if (handlersOn) return
    handlersOn = true
    d.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) =>
      engine && enabled.has(e.sender.session) ? engine.onInjectCosmeticFilters(e, url, msg) : undefined
    )
    d.handle('@ghostery/adblocker/is-mutation-observer-enabled', (e) =>
      engine && enabled.has(e.sender.session) ? engine.onIsMutationObserverEnabled(e) : false
    )
  }

  /** Turns blocking on or off for one session. Safe to call again; only this feature's webRequest handlers are touched. */
  async function setSession(ses: SessionLike, wr: Dispatcher, on: boolean): Promise<void> {
    if (!on) {
      const id = enabled.get(ses)
      if (id === undefined) return
      enabled.delete(ses)
      wr.remove(NAME)
      ses.unregisterPreloadScript(id)
      return
    }
    if (enabled.has(ses)) return
    const b = await loadEngine()
    if (!b || enabled.has(ses) || !d.wanted()) return
    wireHandlers()
    enabled.set(ses, ses.registerPreloadScript({ type: 'frame', filePath: d.preloadPath }))
    wr.add(NAME, {
      before: (details, cb) =>
        b.onBeforeRequest(details, (r: { cancel?: boolean; redirectURL?: string }) => {
          if ((r?.cancel || r?.redirectURL) && typeof details.webContentsId === 'number') d.onBlocked?.(details.webContentsId, details.url)
          cb(r)
        }),
      headers: (details, cb) => b.onHeadersReceived(details, cb)
    })
  }

  return {
    loadEngine,
    setSession,
    isEnabled: (ses: object) => enabled.has(ses),
    /** True when the loaded engine has a $popup rule for this URL opened from sourceUrl (ad click-through pages). */
    isAdPopup: (url: string, sourceUrl: string) => !!engine && engine.isAdPopup(url, sourceUrl),
    cacheFile: file
  }
}
