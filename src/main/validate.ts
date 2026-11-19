// Pure validation for the Add account form; shared by the dialog and the store (no fs, no electron).
import { CUSTOM_PRESET_ID, presetFor } from './presets'

export interface NewAccountInput {
  serviceId: string
  label: string
  colour: string
  custom?: { name: string; url: string }
}

export interface ValidNewAccount {
  serviceId: string
  label: string
  colour: string
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
    return { ok: true, value: { serviceId: input.serviceId, label, colour } }
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
