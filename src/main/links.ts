// Link policy (D8): same-service hosts stay in-app, the rest goes to the default browser. No electron import.
import type { Account } from './accounts'
import { presetFor } from './presets'

export type Decision = 'in-app' | 'external'
export interface Route {
  action: Decision | 'deny'
  /** The URL to act on (the unwrapped target for redirect wrappers). */
  url: string
}

// Redirect wrappers whose real target is in the `u` query parameter.
const WRAPPERS = new Set(['l.facebook.com', 'l.instagram.com', 'l.threads.net', 'l.threads.com'])

function hostsOf(account: Account): string[] {
  return presetFor(account.serviceId)?.hosts ?? account.custom?.hosts ?? []
}

function sameService(host: string, account: Account): boolean {
  return hostsOf(account).some((h) => host === h || host.endsWith('.' + h))
}

/** The real target of a redirect wrapper (one level), else the url as given. */
export function unwrap(raw: string): string {
  try {
    const u = new URL(raw)
    const target = u.searchParams.get('u')
    return WRAPPERS.has(u.hostname.toLowerCase()) && target ? target : raw
  } catch {
    return raw
  }
}

export function route(raw: string, account: Account, depth = 0): Route {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { action: 'deny', url: raw }
  }
  if (u.protocol === 'mailto:') return { action: 'external', url: raw }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { action: 'deny', url: raw }
  const host = u.hostname.toLowerCase()
  const target = u.searchParams.get('u')
  if (WRAPPERS.has(host) && target) {
    return depth < 1 ? route(target, account, depth + 1) : { action: 'deny', url: raw }
  }
  return { action: sameService(host, account) ? 'in-app' : 'external', url: raw }
}

/** Where a link goes. Denied links (non-http(s), except mailto) report 'external' here; use route() to tell them apart. */
export function decide(url: string, account: Account): Decision {
  return route(url, account).action === 'in-app' ? 'in-app' : 'external'
}

/** Main-frame redirect: allow only what loads in this account; external targets are handed out, a wrapper's real target is loaded. */
export function redirectAllowed(url: string, account: Account): { allow: boolean; open?: string; load?: string } {
  const r = route(url, account)
  if (r.action === 'in-app') return r.url === url ? { allow: true } : { allow: false, load: r.url }
  return r.action === 'external' ? { allow: false, open: r.url } : { allow: false }
}
