// Keyboard shortcuts seen by before-input-event (D32 zoom, D33 switching). Plain TS: no electron, no fs.
export interface KeyInput {
  type: string
  key: string
  code?: string
  control?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export type ZoomDir = 'in' | 'out' | 'reset'
export const ZOOM_MIN = -3
export const ZOOM_MAX = 5

/** Ctrl+=, Ctrl++ (with Shift), Ctrl+-, Ctrl+0, also the numpad keys; anything else is null. */
export function zoomKey(i: KeyInput): ZoomDir | null {
  if (i.type !== 'keyDown' || !i.control || i.alt || i.meta) return null
  if (i.key === '=' || i.key === '+' || i.code === 'NumpadAdd') return 'in'
  if (i.key === '-' || i.code === 'NumpadSubtract') return 'out'
  if (i.key === '0' || i.code === 'Numpad0') return 'reset'
  return null
}

/** One zoom step of 0.5, kept inside -3..5; reset gives 0. */
export function nextZoom(level: number, dir: ZoomDir): number {
  if (dir === 'reset') return 0
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level + (dir === 'in' ? 0.5 : -0.5)))
}

/** Chromium zoom level as the percent people know: 1 -> 120. */
export const zoomPercent = (level: number): number => Math.round(100 * 1.2 ** level)
