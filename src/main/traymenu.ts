// Tray menu template (D4, D19). Plain TS: no electron import, so it is testable.
export interface TrayMenuItem {
  label?: string
  type?: 'checkbox' | 'separator'
  checked?: boolean
  click?: (item: { checked: boolean }) => void
}

export function trayTemplate(o: { dnd: boolean; onShow: () => void; onDnd: (on: boolean) => void; onQuit: () => void }): TrayMenuItem[] {
  return [
    { label: 'Show GuiseDesk', click: o.onShow },
    { label: 'Do Not Disturb', type: 'checkbox', checked: o.dnd, click: (m) => o.onDnd(m.checked) },
    { label: 'Settings', click: o.onShow },
    { type: 'separator' },
    { label: 'Quit', click: o.onQuit }
  ]
}
