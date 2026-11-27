// WhatsApp login check (D50 amendment). Plain TS, no electron: the partition store and the loaded page decide.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** LevelDB folder WhatsApp Web writes its login to inside the partition's IndexedDB. */
export const WA_STORE = 'https_web.whatsapp.com_0.indexeddb.leveldb'

/** Path of that folder under <data>/Partitions/<partition key>/IndexedDB. */
export const waStorePath = (dataDir: string, key: string): string => join(dataDir, 'Partitions', key, 'IndexedDB', WA_STORE)

/** Non-empty folder check from a directory listing. */
export function storeHasData(files: string[] | null | undefined): boolean {
  return Array.isArray(files) && files.length > 0
}

/** Reads a folder listing; a missing or unreadable folder becomes null. */
export function readDirSafe(path: string): string[] | null {
  try {
    return readdirSync(path)
  } catch {
    return null
  }
}

export interface WaPage {
  /** The QR screen is showing. */
  qr: boolean
  /** The logged-in chat panel is showing. */
  side: boolean
}

/**
 * Runs after the page loaded: WhatsApp's QR code is a canvas with an aria-label or an element with data-ref; the
 * logged-in app has #side. The login itself lives in IndexedDB, not in cookies.
 */
export const WA_PAGE_SCRIPT = `(() => ({
  qr: !!(document.querySelector('canvas[aria-label]') || document.querySelector('[data-ref]')),
  side: !!document.querySelector('#side')
}))()`

/** The result of WA_PAGE_SCRIPT, or undefined when the page answered something unexpected. */
export function parseWaPage(v: unknown): WaPage | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as { qr?: unknown; side?: unknown }
  return { qr: o.qr === true, side: o.side === true }
}

/**
 * Logged in? false = lost, true = present, undefined = the page has neither marker (still loading): keep the last
 * state. With no view, the stored IndexedDB folder is the only evidence.
 */
export function whatsappLoggedIn(store: boolean, page?: WaPage): boolean | undefined {
  if (!store) return false
  if (!page) return true
  if (page.qr) return false
  if (page.side) return true
  return undefined
}
