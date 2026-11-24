// Per-account blocking indicators (D45): requests blocked since the view last loaded, and the last dropped pop-up.
// Plain TS, no electron: main feeds it, the renderer gets snapshots for the top bar chips.

export interface BlockInfo {
  /** Ad and tracker requests blocked since the view last loaded (shown only while ad blocking is on). */
  blocked: number
  /** The last dropped pop-up URL, until the next navigation or until "open anyway" uses it. */
  popup?: string
}

export function createBlockState(onChange: () => void) {
  const state: Record<string, BlockInfo> = {}
  const get = (id: string) => (state[id] ??= { blocked: 0 })
  // Many blocked requests arrive in a burst: push at most every 250 ms.
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    if (timer) return
    timer = setTimeout(() => { timer = undefined; onChange() }, 250)
  }
  return {
    snapshot: (): Record<string, BlockInfo> => JSON.parse(JSON.stringify(state)),
    blocked(id: string) { get(id).blocked++; soon() },
    popup(id: string, url: string) { get(id).popup = url; onChange() },
    /** A new page load in the main frame: count restarts, the pop-up chip clears. */
    navigated(id: string) {
      const s = get(id)
      if (s.blocked === 0 && s.popup === undefined) return
      state[id] = { blocked: 0 }
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
