// Window layout numbers shared by the renderer (Sidebar.vue) and main (service view bounds). D24, D26.
export const SIDE_FULL = 232
export const SIDE_MINI = 64
// Main area padding around the content panel: top 12, left/right 16, bottom 16.
export const PAD_TOP = 12
export const PAD_X = 16
export const PAD_BOTTOM = 16
// Account top bar above the panel (frame 1, v5 compact): 34px tall plus a 12px gap.
export const TOP_BAR_H = 34
export const TOP_BAR_GAP = 12

export const sideWidth = (collapsed: boolean): number => (collapsed ? SIDE_MINI : SIDE_FULL)

/** Where the selected service view goes, inside a window of the given content size. */
export function panelBounds(w: number, h: number, collapsed: boolean) {
  const side = sideWidth(collapsed)
  return { x: side + PAD_X, y: PAD_TOP + TOP_BAR_H + TOP_BAR_GAP, width: Math.max(0, w - side - 2 * PAD_X), height: Math.max(0, h - PAD_TOP - TOP_BAR_H - TOP_BAR_GAP - PAD_BOTTOM) }
}

/** Ctrl+B, as Electron reports it in before-input-event. */
export const isSidebarShortcut = (i: { type: string; control?: boolean; alt?: boolean; meta?: boolean; key: string }): boolean =>
  i.type === 'keyDown' && !!i.control && !i.alt && !i.meta && i.key.toLowerCase() === 'b'
