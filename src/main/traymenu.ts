// Tray menu template (D4, D19). Plain TS: no electron import, so it is testable.
export interface TrayMenuItem {
  label?: string
  accelerator?: string
  /** false = the label only; the shortcut itself is handled by the window, not registered by the menu. */
  registerAccelerator?: boolean
  type?: 'checkbox' | 'separator'
  checked?: boolean
  click?: (item: { checked: boolean }) => void
}

export function trayTemplate(o: { dnd: boolean; onLock: () => void; onShow: () => void; onSettings: () => void; onDnd: (on: boolean) => void; onQuit: () => void }): TrayMenuItem[] {
  return [
    { label: 'Show GuiseDesk', click: o.onShow },
    { label: 'Lock now', accelerator: 'Ctrl+L', registerAccelerator: false, click: o.onLock },
    { label: 'Do Not Disturb', type: 'checkbox', checked: o.dnd, click: (m) => o.onDnd(m.checked) },
    { label: 'Settings', click: o.onSettings },
    { type: 'separator' },
    { label: 'Quit', click: o.onQuit }
  ]
}

/** Tray icon file and tooltip: the unread dot is hidden while locked (D16). */
export function trayLook(total: number, locked: boolean): { icon: string; tooltip: string } {
  return total > 0 && !locked
    ? { icon: 'tray-dot.png', tooltip: `GuiseDesk (${total} unread)` }
    : { icon: 'tray.png', tooltip: 'GuiseDesk' }
}
