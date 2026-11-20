// Pure validation for the Add account form; shared by the dialog and the store (no fs, no electron).
import { CUSTOM_PRESET_ID, presetFor } from './presets'
import { shareHosts } from './sharing'

export interface NewAccountInput {
  serviceId: string
  label: string
  colour: string
  /** Id of the account whose login this one shares (D36). */
  shareWith?: string
  custom?: { name: string; url: string }
}

export interface ValidNewAccount {
  serviceId: string
  label: string
  colour: string
  shareWith?: string
  custom?: { name: string; url: string; hosts: string[] }
}

export type Validation = { ok: true; value: ValidNewAccount } | { ok: false; error: string }

const fail = (error: string): Validation => ({ ok: false, error })

export function validateNewAccount(input: NewAccountInput): Validation {
  const label = String(input.label ?? '').trim()
  if (!label) return fail('Label is required')
  const colour = String(input.colour ?? '').trim()
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return fail('Pick a colour')
  if (input.serviceId !== CUSTOM_PRESET_ID) {
    if (!presetFor(input.serviceId)) return fail('Unknown service')
    const shareWith = input.shareWith ? String(input.shareWith) : undefined
    return { ok: true, value: { serviceId: input.serviceId, label, colour, ...(shareWith ? { shareWith } : {}) } }
  }
  const name = String(input.custom?.name ?? '').trim()
  if (!name) return fail('Name is required')
  const raw = String(input.custom?.url ?? '').trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return fail('URL must start with http:// or https://')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fail('URL must start with http:// or https://')
  return { ok: true, value: { serviceId: input.serviceId, label, colour, custom: { name, url: raw, hosts: [url.hostname] } } }
}

/** The chosen host must exist, be of a different Meta service and not share itself; null when fine. */
export function checkShare(serviceId: string, shareWith: string | undefined, accounts: { id: string; serviceId: string; label: string; shareWith?: string }[]): string | null {
  if (!shareWith) return null
  return shareHosts(serviceId, accounts).some((a) => a.id === shareWith) ? null : 'That account cannot share its login'
}
