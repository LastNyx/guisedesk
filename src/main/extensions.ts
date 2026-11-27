// Chrome extensions (D49). Installed once from a Chrome Web Store link into <data>/extensions, then turned on per
// account (Account.extensions). electron-chrome-extensions adds the chrome.tabs / windows / action APIs Electron lacks.
// Plain TS, no electron import.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface InstalledExtension {
  id: string
  name: string
  version: string
  path: string
}

/** A Chrome Web Store link (old or new store) or a bare 32-letter id, to the extension id; null when neither. */
export function parseExtensionId(input: string): string | null {
  const s = String(input ?? '').trim()
  if (/^[a-p]{32}$/.test(s)) return s
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.hostname !== 'chromewebstore.google.com' && u.hostname !== 'chrome.google.com') return null
  const m = /\/([a-p]{32})(?:\/|$)/.exec(u.pathname)
  return m ? m[1] : null
}

/** The extension ids an account has on, limited to installed ones. */
export function enabledFor(a: { extensions?: string[] }, installed: string[]): string[] {
  return (a.extensions ?? []).filter((id) => installed.includes(id))
}

/** Returns the new list with id turned on or off (no duplicates, stable order). */
export function toggled(list: string[] | undefined, id: string, on: boolean): string[] {
  const rest = (list ?? []).filter((x) => x !== id)
  return on ? [...rest, id] : rest
}

export const extensionsDir = (dataDir: string) => join(dataDir, 'extensions')

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

/** Parsed manifest.json of an unpacked extension; {} when missing or unreadable. */
export function readManifest(path: string): Record<string, unknown> {
  try {
    const m = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'))
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

export type ActionClick = { kind: 'popup'; popup: string } | { kind: 'onClicked' }

/**
 * What a toolbar click does for this manifest (D54): open action.default_popup when the manifest has one, else
 * dispatch onClicked. MV3 reads `action`, MV2 `browser_action`; a malformed or missing action means onClicked.
 */
export function actionClick(manifest: unknown): ActionClick {
  const m = (manifest && typeof manifest === 'object' ? manifest : {}) as {
    manifest_version?: unknown
    action?: { default_popup?: unknown }
    browser_action?: { default_popup?: unknown }
  }
  const action = m.manifest_version === 3 ? m.action : m.manifest_version === 2 ? m.browser_action : undefined
  const popup = action && typeof action === 'object' ? action.default_popup : undefined
  return typeof popup === 'string' && popup.trim() ? { kind: 'popup', popup: popup.trim() } : { kind: 'onClicked' }
}

/** Manifest name, resolving __MSG_key__ from _locales (default_locale, then en). */
export function manifestName(path: string): string {
  try {
    const m = readManifest(path)
    const raw = String(m.name ?? '')
    const key = /^__MSG_(.+)__$/.exec(raw)?.[1]
    if (!key) return raw
    for (const loc of [m.default_locale, 'en', 'en_US'].filter((x): x is string => typeof x === 'string' && !!x)) {
      try {
        const msgs = JSON.parse(readFileSync(join(path, '_locales', loc, 'messages.json'), 'utf8'))
        const hit = Object.entries(msgs).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1] as { message?: string } | undefined
        if (hit?.message) return hit.message
      } catch { /* next locale */ }
    }
    return key
  } catch {
    return ''
  }
}

/** Every installed extension (complete copies only), sorted by name. */
export function listInstalled(extDir: string): InstalledExtension[] {
  if (!existsSync(extDir)) return []
  const out: InstalledExtension[] = []
  for (const id of readdirSync(extDir)) {
    if (!/^[a-p]{32}$/.test(id)) continue
    const path = readyCopy(extDir, id)
    if (!path) continue
    out.push({ id, name: manifestName(path) || id, version: path.split('/').pop()!.replace(/_0$/, ''), path })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * One download per extension at a time, shared by every caller: concurrent callers wait for the same promise.
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
