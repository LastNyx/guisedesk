// Per-account blocking indicators (D45): requests blocked since the view last loaded, and the last dropped pop-up.
// Plain TS, no electron: main feeds it, the renderer gets snapshots for the top bar chips.

export interface BlockInfo {
  /** Ad and tracker requests blocked since the view last loaded (shown only while ad blocking is on). */
  blocked: number
  /** The last dropped pop-up URL, until the next navigation or until "open anyway" uses it. */
  popup?: string
  /** Blocked since the app started (survives reloads). */
  total: number
  /** Pop-ups dropped since the app started. */
  popups: number
  /** Blocked requests per host since the view last loaded. */
  hosts: Record<string, number>
}

/** Host of a URL without a leading www., or the raw string when it does not parse. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** The shield menu (D45): plain items; main maps them to a native menu. */
export function shieldMenuItems(s: BlockInfo | undefined, adsOn: boolean): { label: string; enabled: boolean; action?: string; separator?: true }[] {
  const b = s ?? { blocked: 0, total: 0, popups: 0, hosts: {} }
  const top = Object.entries(b.hosts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 5)
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  return [
    { label: adsOn ? 'Ad blocking is on' : 'Ad blocking is off', enabled: false },
    { label: `This page: ${plural(b.blocked, 'request')} blocked`, enabled: false },
    { label: `Since GuiseDesk started: ${b.total}`, enabled: false },
    { label: `Pop-ups blocked: ${b.popups}`, enabled: false },
    ...(top.length ? [{ label: '', enabled: false, separator: true as const }, { label: 'Most blocked on this page', enabled: false }, ...top.map(([h, n]) => ({ label: `${h}  ·  ${n}`, enabled: false }))] : []),
    { label: '', enabled: false, separator: true },
    ...(b.popup ? [{ label: 'Open blocked pop-up', enabled: true, action: 'open-popup' }] : []),
    { label: 'Blocking settings...', enabled: true, action: 'settings' }
  ]
}

export function createBlockState(onChange: () => void) {
  const state: Record<string, BlockInfo> = {}
  const get = (id: string) => (state[id] ??= { blocked: 0, total: 0, popups: 0, hosts: {} })
  // Many blocked requests arrive in a burst: push at most every 250 ms.
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    if (timer) return
    timer = setTimeout(() => { timer = undefined; onChange() }, 250)
  }
  return {
    snapshot: (): Record<string, BlockInfo> => JSON.parse(JSON.stringify(state)),
    blocked(id: string, url?: string) {
      const s = get(id)
      s.blocked++
      s.total++
      if (url) { const h = hostOf(url); s.hosts[h] = (s.hosts[h] ?? 0) + 1 }
      soon()
    },
    popup(id: string, url: string) { const s = get(id); s.popup = url; s.popups++; onChange() },
    get: (id: string): BlockInfo | undefined => state[id],
    /** A new page load in the main frame: count restarts, the pop-up chip clears. */
    navigated(id: string) {
      const s = get(id)
      if (s.blocked === 0 && s.popup === undefined) return
      state[id] = { ...s, blocked: 0, hosts: {}, popup: undefined }
      delete state[id].popup
      onChange()
    },
    /** "Open anyway": hands back the dropped URL once and clears the chip. */
    take(id: string): string | undefined {
      const url = state[id]?.popup
      if (url === undefined) return undefined
      delete state[id].popup
      onChange()
      return url
    },
    forget(id: string) { if (state[id]) { delete state[id]; onChange() } },
    clear() { for (const k of Object.keys(state)) delete state[k] }
  }
}
