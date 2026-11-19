import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic, type Fs } from './atomic'
import { validateNewAccount, type NewAccountInput } from './validate'

export interface Account {
  id: string
  serviceId: string
  label: string
  colour: string
  order: number
  idlePolicy?: string
  muted?: boolean
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

/** Idle lock minutes (D15, D17) in settings.json key idleLock: 5, 10, 30 or 'manual'; 10 when missing or invalid. */
export function loadIdleMinutes(dir: string): 5 | 10 | 30 | 'manual' {
  try {
    const v = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).idleLock
    return v === 5 || v === 10 || v === 30 || v === 'manual' ? v : 10
  } catch {
    return 10
  }
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
