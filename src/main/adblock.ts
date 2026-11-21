// Ad blocking (D45) on account sessions with Ghostery's filter engine (EasyList, uBlock Origin lists).
// One engine for the app; each session gets the network hooks and the cosmetic preload. The library's own
// enableBlockingInSession registers the cosmetic IPC handlers per session, which throws on the second session,
// so the wiring is done here: handlers once, hooks per session.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ipcMain, type Session } from 'electron'
import { ElectronBlocker, Request } from '@ghostery/adblocker-electron'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { engineFresh } from './blocking'

const enabled = new Map<Session, string>() // session -> preload script id
let engine: ElectronBlocker | null = null
let loading: Promise<ElectronBlocker | null> | null = null
let handlersOn = false
// The cosmetic-filter preload ships as its own package; resolved at run time from node_modules.
const PRELOAD_PATH = createRequire(__filename).resolve('@ghostery/adblocker-electron-preload')

/** Loads the cached engine (dir/adblock/engine.bin) or builds it from the lists and caches it. Null when offline with no cache. */
export function loadEngine(dir: string): Promise<ElectronBlocker | null> {
  if (engine) return Promise.resolve(engine)
  if (loading) return loading
  const folder = join(dir, 'adblock')
  const file = join(folder, 'engine.bin')
  loading = (async () => {
    const mtime = existsSync(file) ? statSync(file).mtimeMs : undefined
    const fromCache = () => ElectronBlocker.deserialize(new Uint8Array(readFileSync(file)))
    try {
      if (engineFresh(mtime, Date.now())) engine = fromCache()
      else {
        engine = await ElectronBlocker.fromPrebuiltFull(fetch)
        mkdirSync(folder, { recursive: true })
        await writeFile(file, engine.serialize())
      }
    } catch (e) {
      console.warn('[guisedesk] ad blocker lists failed', e)
      try { if (mtime !== undefined) engine = fromCache() } catch { engine = null }
    }
    loading = null
    return engine
  })()
  return loading
}

function wireHandlers(b: ElectronBlocker): void {
  if (handlersOn) return
  handlersOn = true
  ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) => 
    enabled.has(e.sender.session) ? b.onInjectCosmeticFilters(e, url, msg) : undefined
  )
  ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', (e) =>
    enabled.has(e.sender.session) ? b.onIsMutationObserverEnabled(e) : false
  )
}

/** Turns blocking on or off for one session. Safe to call again. */
export async function setSessionBlocking(dir: string, ses: Session, on: boolean): Promise<void> {
  if (!on) {
    const id = enabled.get(ses)
    if (id === undefined) return
    enabled.delete(ses)
    ses.webRequest.onBeforeRequest(null)
    ses.webRequest.onHeadersReceived(null)
    ses.unregisterPreloadScript(id)
    return
  }
  if (enabled.has(ses)) return
  const b = await loadEngine(dir)
  if (!b || enabled.has(ses)) return
  wireHandlers(b)
  const id = ses.registerPreloadScript({ type: 'frame', filePath: PRELOAD_PATH })
  enabled.set(ses, id)
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => b.onBeforeRequest(d, cb))
  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (d, cb) => b.onHeadersReceived(d, cb))
}

/** True when the loaded engine has a rule for this URL opened as a pop-up from sourceUrl (ad click-through pages). */
export function isAdPopup(url: string, sourceUrl: string): boolean {
  if (!engine) return false
  const r = Request.fromRawDetails({ url, sourceUrl, type: 'popup' as never })
  return !!engine.match(r).match
}
