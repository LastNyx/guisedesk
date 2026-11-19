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
