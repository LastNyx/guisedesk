// Electron side of ad blocking (D45): the engine from serialized bytes, the build worker, and the preload path.
import { createRequire } from 'node:module'
import { ElectronBlocker, Request } from '@ghostery/adblocker-electron'
import createBuildWorker from './adbuild?nodeWorker'
import type { Engine } from './adblock'

/** Serialized bytes to an engine with a $popup check; throws on a corrupt or old-version file. */
export function loadEngineBytes(bytes: Uint8Array): Engine {
  const b = ElectronBlocker.deserialize(bytes)
  return Object.assign(b, {
    isAdPopup: (url: string, sourceUrl: string) => !!b.match(Request.fromRawDetails({ url, sourceUrl, type: 'popup' as never })).match
  })
}

/** Builds the engine in a worker thread (download + parse + serialize), so the UI never freezes. */
export function buildInWorker(): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const w = createBuildWorker({})
    const t = setTimeout(() => { void w.terminate(); reject(new Error('ad blocker build timed out')) }, 120_000)
    w.once('message', (m: { ok: boolean; bytes?: Uint8Array; error?: string }) => {
      clearTimeout(t)
      void w.terminate()
      if (m.ok && m.bytes) resolve(new Uint8Array(m.bytes))
      else reject(new Error(m.error ?? 'ad blocker build failed'))
    })
    w.once('error', (e: Error) => { clearTimeout(t); reject(e) })
  })
}

/** The cosmetic-filter preload ships as its own package (declared in package.json); resolved from node_modules. */
export const PRELOAD_PATH = createRequire(__filename).resolve('@ghostery/adblocker-electron-preload')
