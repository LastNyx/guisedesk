// Per-account proxy (D63): address parsing, the rules handed to session.setProxy, the menu labels and
// proxy sign-in matching. Plain TS, no electron import: the renderer validates with the same code.
import { partitionKey } from './sharing'

export const PROXY_SCHEMES = ['http', 'https', 'socks5'] as const
export type ProxyScheme = (typeof PROXY_SCHEMES)[number]

export interface ProxyParts {
  scheme: ProxyScheme
  host: string
  port: number
  username?: string
  password?: string
}

export interface ProxyCredential {
  username: string
  password: string
}

export type ProxyResult = { ok: true; value: ProxyParts } | { ok: false; error: string }

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Reads a proxy address like `socks5://host:1080` or `http://user:pass@host:8080`.
 * The port is required: a missing one is the most common typo, and defaults differ per app.
 */
export function parseProxy(input: unknown): ProxyResult {
  if (typeof input !== 'string') return { ok: false, error: 'Type the proxy like socks5://host:port.' }
  const text = input.trim()
  if (!text) return { ok: false, error: 'Type a proxy address, or choose Direct.' }
  if (/\s/.test(text)) return { ok: false, error: 'A proxy address cannot contain spaces.' }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, error: 'Type the proxy like socks5://host:port.' }
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  if (!(PROXY_SCHEMES as readonly string[]).includes(scheme)) return { ok: false, error: 'Use http://, https:// or socks5:// at the start.' }
  if ((url.pathname && url.pathname !== '/') || url.search || url.hash) return { ok: false, error: 'Enter only the proxy host and port.' }
  if (!url.hostname) return { ok: false, error: 'Type the proxy host, like proxy.local:1080.' }
  if (!url.port) return { ok: false, error: 'Add the port, like host:1080.' }
  const port = Number(url.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'Use a port from 1 to 65535.' }
  const username = decode(url.username)
  const password = decode(url.password)
  if (!!username !== !!password) return { ok: false, error: 'Enter both the proxy user and password, or neither.' }
  return {
    ok: true,
    value: {
      scheme: scheme as ProxyScheme,
      host: url.hostname,
      port,
      ...(username ? { username, password } : {})
    }
  }
}

/** What session.setProxy gets: the address without credentials (those go through the login event). */
export const proxyRules = (p: ProxyParts): string => `${p.scheme}://${p.host}:${p.port}`

/** Short text for the top bar and the menu: host:port only, never the credentials. */
export const proxyLabel = (p: ProxyParts): string => `${p.host}:${p.port}`

/** Host and port as one key, for matching an authentication challenge to its proxy. */
export const proxyEndpoint = (p: ProxyParts): string => `${p.host.toLowerCase()}:${p.port}`

/** True when two addresses point at the same proxy (credentials ignored). */
export function sameProxy(a: ProxyParts | undefined, b: ProxyParts | undefined): boolean {
  return !!a && !!b && proxyEndpoint(a) === proxyEndpoint(b)
}

interface ProxyHolder {
  id: string
  shareWith?: string
  proxy?: string
}

/** The account whose session (and proxy) this one uses (D36): its shared-login host, else itself. */
export function proxyHostOf<T extends ProxyHolder>(a: ProxyHolder, accounts: T[]): T | undefined {
  return a.shareWith ? accounts.find((x) => x.id === a.shareWith) : (a as T)
}

/** The proxy address in effect for an account; a shared login follows its host. */
export function effectiveProxy(a: ProxyHolder, accounts: ProxyHolder[]): string | undefined {
  return proxyHostOf(a, accounts)?.proxy
}

/**
 * The saved sign-in for a proxy that just asked for one. Chromium reports only the proxy host and port in the
 * login event, so the account list decides which partition's credentials belong to this challenge.
 */
export function findProxyCredential(
  accounts: ProxyHolder[],
  auth: Record<string, ProxyCredential>,
  host: string,
  port: number
): ProxyCredential | undefined {
  const want = `${host.toLowerCase()}:${port}`
  for (const a of accounts) {
    const owner = proxyHostOf(a, accounts)
    if (!owner?.proxy) continue
    const p = parseProxy(owner.proxy)
    if (!p.ok || proxyEndpoint(p.value) !== want) continue
    const cred = auth[partitionKey(owner)]
    if (cred) return cred
  }
  return undefined
}

export interface ProxyMenuItem {
  label: string
  action: 'none' | 'test' | 'change'
  enabled: boolean
  separator?: boolean
}

/** The top bar chip's native menu: the address, then test and change. */
export function proxyMenu(p: ProxyParts | undefined): ProxyMenuItem[] {
  return [
    { label: p ? proxyLabel(p) : 'Direct connection', action: 'none', enabled: false },
    { label: '', action: 'none', enabled: false, separator: true },
    { label: 'Test connection', action: 'test', enabled: !!p },
    { label: 'Change...', action: 'change', enabled: true }
  ]
}
