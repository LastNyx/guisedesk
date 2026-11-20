// Popup windows (D37). Plain TS, no electron: where a link opens, and the registry of open popups.

export type Target = 'popup' | 'same-view' | 'external' | 'deny'

/** Same-service links opened as a background or foreground tab (middle-click, Ctrl+click) get a popup; other dispositions keep today's behaviour. */
export function openTarget(disposition: string, action: 'in-app' | 'external' | 'deny'): Target {
  if (action !== 'in-app') return action
  return disposition === 'background-tab' || disposition === 'foreground-tab' ? 'popup' : 'same-view'
}

/** Open popups by account id. `close` is injected so the registry needs no electron. */
export function createPopups<W>(close: (w: W) => void) {
  const open = new Map<W, string>()
  const closeWhere = (pick: (id: string) => boolean) => {
    for (const [w, id] of [...open]) {
      if (!pick(id)) continue
      open.delete(w)
      close(w)
    }
  }
  return {
    add: (accountId: string, w: W) => void open.set(w, accountId),
    /** A popup that closed itself. */
    forget: (w: W) => void open.delete(w),
    closeFor: (accountId: string) => closeWhere((id) => id === accountId),
    closeAll: () => closeWhere(() => true),
    count: () => open.size
  }
}
