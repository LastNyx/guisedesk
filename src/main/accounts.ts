import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic, type Fs } from './atomic'
import { checkShare, validateNewAccount, type NewAccountInput } from './validate'

export interface Account {
  id: string
  serviceId: string
  label: string
  colour: string
  order: number
  idlePolicy?: string
  muted?: boolean
  /** Blur media in the service view until hovered (D42, D43). */
  blurMedia?: boolean
  /** Keep the text of messages deleted for everyone (WhatsApp only, D47b). */
  keepDeleted?: boolean
  /** Chromium zoom level (D32); missing = 0 (100%). */
  zoom?: number
  /** Host account id whose session partition this account uses (D36). */
  shareWith?: string
  custom?: { name: string; url: string; hosts: string[]; icon?: string }
}

const file = (dir: string) => join(dir, 'accounts.json')

export function loadAccounts(dir: string): Account[] {
  try {
    const data = JSON.parse(readFileSync(file(dir), 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveAccounts(dir: string, accounts: Account[], fs?: Fs): void {
  writeAtomic(file(dir), JSON.stringify(accounts, null, 2), fs)
}

export function orderedAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.order - b.order)
}

/** Validates (throws Error with the message to show), trims, and appends. icon: cached favicon path for a custom site. */
export function addAccount(dir: string, input: NewAccountInput, icon?: string): Account {
  const v = validateNewAccount(input)
  if (!v.ok) throw new Error(v.error)
  const accounts = loadAccounts(dir)
  const bad = checkShare(v.value.serviceId, v.value.shareWith, accounts)
  if (bad) throw new Error(bad)
  const order = accounts.reduce((m, a) => Math.max(m, a.order + 1), 0)
  const { custom, ...rest } = v.value
  const account: Account = {
    id: randomBytes(8).toString('hex'),
    ...rest,
    ...(custom ? { custom: icon ? { ...custom, icon } : custom } : {}),
    order,
    idlePolicy: 'default',
    muted: false
  }
  saveAccounts(dir, [...accounts, account])
  return account
}

/** Selected account is remembered in settings.json (key selectedAccount). */
export function loadSelected(dir: string): string | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).selectedAccount
  } catch {
    return undefined
  }
}

export function saveSelected(dir: string, id: string): void {
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  } catch {
    /* first write */
  }
  writeAtomic(join(dir, 'settings.json'), JSON.stringify({ ...settings, selectedAccount: id }, null, 2))
}

/** Sets one account's muted flag (D19) and returns the saved list. */
export function setMuted(dir: string, id: string, muted: boolean): Account[] {
  const accounts = loadAccounts(dir).map((a) => (a.id === id ? { ...a, muted } : a))
  saveAccounts(dir, accounts)
  return accounts
}

/** Sets one account's blur-media flag (D42) and returns the saved list. */
export function setBlurMedia(dir: string, id: string, blurMedia: boolean): Account[] {
  const accounts = loadAccounts(dir).map((a) => (a.id === id ? { ...a, blurMedia } : a))
  saveAccounts(dir, accounts)
  return accounts
}

/** Sets one account's keep-deleted-messages flag (D47b) and returns the saved list. */
export function setKeepDeleted(dir: string, id: string, keepDeleted: boolean): Account[] {
  const accounts = loadAccounts(dir).map((a) => (a.id === id ? { ...a, keepDeleted } : a))
  saveAccounts(dir, accounts)
  return accounts
}

/** Global Do Not Disturb (D19) lives in settings.json (key dnd); off when missing. */
export function loadDnd(dir: string): boolean {
  try {
    return JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).dnd === true
  } catch {
    return false
  }
}

export function saveDnd(dir: string, dnd: boolean): void {
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  } catch {
    /* first write */
  }
  writeAtomic(join(dir, 'settings.json'), JSON.stringify({ ...settings, dnd }, null, 2))
}

/** Collapsed sidebar rail (D24) lives in settings.json key sidebarCollapsed; expanded when missing. */
export function loadSidebarCollapsed(dir: string): boolean {
  try {
    return JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).sidebarCollapsed === true
  } catch {
    return false
  }
}

export function saveSidebarCollapsed(dir: string, sidebarCollapsed: boolean): void {
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  } catch {
    /* first write */
  }
  writeAtomic(join(dir, 'settings.json'), JSON.stringify({ ...settings, sidebarCollapsed }, null, 2))
}

/** Idle lock minutes (D15, D17) in settings.json key idleLock: 5, 10, 30 or 'manual'; 10 when missing or invalid. */
export function loadIdleMinutes(dir: string): 5 | 10 | 30 | 'manual' {
  try {
    const v = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).idleLock
    return v === 5 || v === 10 || v === 30 || v === 'manual' ? v : 10
  } catch {
    return 10
  }
}

export function saveIdleMinutes(dir: string, minutes: 5 | 10 | 30 | 'manual'): void {
  updateSettings(dir, { idleLock: minutes })
}

function updateSettings(dir: string, patch: Record<string, unknown>): void {
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  } catch {
    /* first write */
  }
  writeAtomic(join(dir, 'settings.json'), JSON.stringify({ ...settings, ...patch }, null, 2))
}

/** Services switched off in Settings (D6), in settings.json key disabledServices. Accounts and sessions stay. */
export function loadDisabled(dir: string): string[] {
  try {
    const v = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).disabledServices
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function setServiceEnabled(dir: string, serviceId: string, enabled: boolean): string[] {
  const off = loadDisabled(dir).filter((s) => s !== serviceId)
  if (!enabled) off.push(serviceId)
  updateSettings(dir, { disabledServices: off })
  return off
}

export const IDLE_POLICIES = ['default', 'always', '10', '30', '60']

/** Sets one account's hibernation override (D7); throws on a value outside IDLE_POLICIES. */
export function setIdlePolicy(dir: string, id: string, policy: string): Account[] {
  if (!IDLE_POLICIES.includes(policy)) throw new Error('Unknown sleep setting')
  const accounts = loadAccounts(dir).map((a) => (a.id === id ? { ...a, idlePolicy: policy } : a))
  saveAccounts(dir, accounts)
  return accounts
}

/** Drag reorder (D28): rewrites order 0..n-1 by the listed ids; unlisted accounts follow in their old order. Throws on an unknown or duplicate id. */
export function reorderAccounts(dir: string, ids: string[]): Account[] {
  const all = orderedAccounts(loadAccounts(dir))
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate account id')
  if (ids.some((id) => !all.some((a) => a.id === id))) throw new Error('Unknown account id')
  const listed = ids.map((id) => all.find((a) => a.id === id)!)
  const accounts = [...listed, ...all.filter((a) => !ids.includes(a.id))].map((a, order) => ({ ...a, order }))
  saveAccounts(dir, accounts)
  return accounts
}

/** Sets one account's zoom level (D32); 0 removes the key. Returns the saved list. */
export function setZoom(dir: string, id: string, level: number): Account[] {
  const accounts = loadAccounts(dir).map((a) => {
    if (a.id !== id) return a
    const { zoom: _old, ...rest } = a
    return level === 0 ? rest : { ...rest, zoom: level }
  })
  saveAccounts(dir, accounts)
  return accounts
}
