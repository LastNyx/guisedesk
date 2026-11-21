// Drag to scroll sideways rows of media (D44). Plain TS, no electron: row finder, drag state machine and the DOM watcher.
export interface RowStyle { overflowX: string; scrollWidth: number; clientWidth: number }

const THRESHOLD = 5

/** True when main passed `--gd-dragscroll`. */
export function parseDragHint(argv: string[]): boolean {
  return argv.includes('--gd-dragscroll')
}

/** The nearest ancestor (or el itself) that scrolls sideways: overflow-x auto/scroll and wider inside than shown. */
export function scrollRowOf(el: Element | null, getStyle: (e: Element) => RowStyle): Element | null {
  for (let e = el; e; e = e.parentElement) {
    const s = getStyle(e)
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && s.scrollWidth > s.clientWidth) return e
  }
  return null
}

/** Pointer x moves -> scrollLeft. move() is null until the pointer is more than 5 px from where it went down. */
export function createDrag() {
  let startX = 0
  let startLeft = 0
  let tracking = false
  let drag = false
  return {
    down(x: number, scrollLeft: number) { startX = x; startLeft = scrollLeft; tracking = true; drag = false },
    move(x: number): number | null {
      if (!tracking) return null
      if (!drag && Math.abs(x - startX) <= THRESHOLD) return null
      drag = true
      return startLeft - (x - startX)
    },
    dragging: () => drag,
    up(): { dragged: boolean } { const dragged = drag; tracking = false; drag = false; return { dragged } },
    tracking: () => tracking
  }
}

/** Mouse drag on a sideways scrolling row scrolls it (snap off while dragging, back on at release); a drag swallows the next click. */
export function watchDragScroll(win: Window & typeof globalThis, getStyle: (e: Element) => RowStyle): { stop: () => void } {
  const drag = createDrag()
  let row: HTMLElement | null = null
  let snap = ''
  let swallow = false
  let swallowTimer: ReturnType<typeof setTimeout> | null = null
  const clearSwallow = () => { swallow = false; if (swallowTimer) clearTimeout(swallowTimer); swallowTimer = null }

  const onDown = (ev: Event) => {
    const e = ev as PointerEvent
    clearSwallow()
    if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof win.Element)) return
    const r = scrollRowOf(e.target, getStyle)
    if (!(r instanceof win.HTMLElement)) return
    row = r
    snap = r.style.scrollSnapType
    drag.down(e.clientX, r.scrollLeft)
  }
  const onMove = (ev: Event) => {
    if (!row) return
    const left = drag.move((ev as PointerEvent).clientX)
    if (left === null) return
    row.style.scrollSnapType = 'none'
    row.scrollLeft = left
  }
  const onUp = () => {
    if (!row) return
    row.style.scrollSnapType = snap
    row = null
    if (drag.up().dragged) {
      swallow = true
      swallowTimer = setTimeout(clearSwallow, 400)
    }
  }
  const onDragStart = (e: Event) => { if (drag.tracking()) e.preventDefault() }
  const onClick = (e: Event) => {
    if (!swallow) return
    clearSwallow()
    e.preventDefault()
    e.stopPropagation()
  }
  win.addEventListener('pointerdown', onDown, true)
  win.addEventListener('pointermove', onMove, true)
  win.addEventListener('pointerup', onUp, true)
  win.addEventListener('pointercancel', onUp, true)
  win.addEventListener('dragstart', onDragStart, true)
  win.addEventListener('click', onClick, true)
  return {
    stop() {
      for (const [t, f] of [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['dragstart', onDragStart], ['click', onClick]] as const) win.removeEventListener(t, f, true)
      if (row) row.style.scrollSnapType = snap
      clearSwallow()
    }
  }
}
