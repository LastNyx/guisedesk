// Links to another service (D40): which accounts can open an external link. Plain TS, no electron.
import { unwrap } from './links'
import { presetFor } from './presets'
import { sidebarOrder } from './services'

interface Acc {
  serviceId: string
  order: number
  custom?: { hosts: string[] }
}

/** Accounts (enabled services only, in sidebar order) whose service has the link's host as a home host or subdomain of one. */
export function candidatesFor<T extends Acc>(url: string, accounts: T[], disabled: string[]): T[] {
  let u: URL
  try {
    u = new URL(unwrap(url))
  } catch {
    return []
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return []
  const host = u.hostname.toLowerCase()
  const homes = (a: T) => presetFor(a.serviceId)?.homeHosts ?? a.custom?.hosts ?? []
  return sidebarOrder(accounts.filter((a) => !disabled.includes(a.serviceId))).filter((a) =>
    homes(a).some((h) => host === h || host.endsWith('.' + h))
  )
}
