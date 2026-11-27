// Chrome extensions per account (D49). First one: WA Web Plus on WhatsApp accounts, switched on in the account sheet.
// The extension is downloaded once from the Chrome Web Store into <data>/extensions and loaded only into the sessions
// of accounts that turned it on. electron-chrome-extensions adds the chrome.tabs / windows / action APIs that
// Electron lacks (WA Web Plus's background script crashes without chrome.windows).
import { existsSync } from 'node:fs'
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
