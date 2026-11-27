// Chrome extensions per account (D49). First one: WA Web Plus on WhatsApp accounts, switched on in the account sheet.
// The extension is downloaded once from the Chrome Web Store into <data>/extensions and loaded only into the sessions
// of accounts that turned it on. electron-chrome-extensions adds the chrome.tabs / windows / action APIs that
// Electron lacks (WA Web Plus's background script crashes without chrome.windows).
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface KnownExtension {
  id: string
  name: string
  /** Service ids whose accounts may turn it on. */
  services: string[]
  /** Settings line under the switch. */
  hint: string
}

export const KNOWN_EXTENSIONS: KnownExtension[] = [
  {
    id: 'ekcgkejcjdcmonfpmnljobemcbpnkamh',
    name: 'WA Web Plus',
    services: ['whatsapp'],
    hint: 'Chrome extension by Elbruz Technologies. Its button is in the WhatsApp sidebar. Changing it reloads WhatsApp'
  }
]

export const extensionsFor = (serviceId: string) => KNOWN_EXTENSIONS.filter((x) => x.services.includes(serviceId))
export const isKnownFor = (id: string, serviceId: string) => extensionsFor(serviceId).some((x) => x.id === id)

/** The extension ids an account has on, filtered to the ones allowed for its service. */
export function enabledFor(a: { serviceId: string; extensions?: string[] }): string[] {
  return (a.extensions ?? []).filter((id) => isKnownFor(id, a.serviceId))
}

/** Returns the new list with id turned on or off (no duplicates, stable order). */
export function toggled(list: string[] | undefined, id: string, on: boolean): string[] {
  const rest = (list ?? []).filter((x) => x !== id)
  return on ? [...rest, id] : rest
}

export const extensionsDir = (dataDir: string) => join(dataDir, 'extensions')
export const isDownloaded = (dataDir: string, id: string) => existsSync(join(extensionsDir(dataDir), id))

/** Numeric version compare: >0 when a is newer. */
export function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0)
  return 0
}

/**
 * The newest complete unpacked copy (<dir>/<id>/<version>_0 with a manifest.json), or null. Leftovers from an
 * interrupted install (temp uuid folders, version folders without a manifest) are removed so the next download can
 * rename into place (ENOTEMPTY otherwise).
 */
export function readyCopy(extDir: string, id: string): string | null {
  const root = join(extDir, id)
  if (!existsSync(root)) return null
  let best: { path: string; v: number[] } | null = null
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    const m = /^(\d+(?:\.\d+)*)_0$/.exec(name)
    if (!m || !existsSync(join(path, 'manifest.json'))) {
      rmSync(path, { recursive: true, force: true })
      continue
    }
    const v = m[1].split('.').map(Number)
    if (!best || compareVersions(v, best.v) > 0) best = { path, v }
  }
  return best?.path ?? null
}

/**
 * One download per extension at a time, shared by every account: concurrent callers wait for the same promise.
 * download(id, extDir) unpacks into <extDir>/<id>/<version>_0 and returns that path.
 */
export function createExtensionFetcher(extDir: string, download: (id: string, dir: string) => Promise<string>) {
  const inFlight = new Map<string, Promise<string>>()
  return (id: string): Promise<string> => {
    const ready = inFlight.has(id) ? null : readyCopy(extDir, id)
    if (ready) return Promise.resolve(ready)
    let p = inFlight.get(id)
    if (!p) {
      p = download(id, extDir).finally(() => inFlight.delete(id))
      inFlight.set(id, p)
    }
    return p
  }
}
