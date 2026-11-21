// Blur media hint (D42, D43). Plain TS, no electron: the CSS, the size rule and the DOM watcher (blur by rendered size, reveal on hover).
export interface BlurHint { container: string }

const MIN = 100
const HOVER_MS = 300
const MOVE_MS = 50
const SCAN_MS = 50

/** CSS that blurs media marked by the watcher until it is hovered. */
export function blurCss(): string {
  return '[data-gd-blur]:not([data-gd-hover]) { filter: blur(28px); }'
}

/** True for img, video and background tiles (tag 'bg') whose rendered box is at least 100x100. */
export function shouldBlur(box: { w: number; h: number }, tag: string): boolean {
  return ['img', 'video', 'bg'].includes(tag.toLowerCase()) && box.w >= MIN && box.h >= MIN
}

/** Reads main's `--gd-blur=<json>` argument. */
export function parseBlurHint(argv: string[]): BlurHint | null {
  const raw = argv.find((x) => x.startsWith('--gd-blur='))
  if (!raw) return null
  try {
    const h = JSON.parse(raw.slice('--gd-blur='.length))
    return typeof h?.container === 'string' ? { container: h.container } : null
  } catch {
    return null
  }
}

/**
 * Marks big media inside the container with data-gd-blur (kept current by observers) and un-blurs what the pointer
 * rests on for 300 ms (data-gd-hover). elementsFromPoint is used so overlays above a photo do not block the hover.
 */
export function watchBlur(win: Window & typeof globalThis, hint: BlurHint): { stop: () => void } {
  const doc = win.document
  const marked = new Set<Element>()
  const ro = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => schedule()) : null
  const observed = new WeakSet<Element>()

  const tagOf = (e: Element): string | null => {
    const t = e.tagName.toLowerCase()
    if (t === 'img' || t === 'video') return t
    return e instanceof win.HTMLElement && /url\(/.test(e.style.backgroundImage) && !e.textContent?.trim() ? 'bg' : null
  }
  const scan = () => {
    const found = new Set<Element>()
    for (const e of doc.querySelectorAll(`${hint.container} img, ${hint.container} video, ${hint.container} [style*="background-image"]`)) {
      const tag = tagOf(e)
      if (!tag) continue
      if (ro && !observed.has(e)) { observed.add(e); ro.observe(e) }
      const r = e.getBoundingClientRect()
      if (shouldBlur({ w: r.width, h: r.height }, tag)) found.add(e)
    }
    for (const e of [...found]) if ([...found].some((o) => o !== e && o.contains(e))) found.delete(e)
    for (const e of marked) if (!found.has(e)) { e.removeAttribute('data-gd-blur'); e.removeAttribute('data-gd-hover'); marked.delete(e) }
    for (const e of found) if (!marked.has(e)) { e.setAttribute('data-gd-blur', ''); marked.add(e) }
  }
  let scanTimer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => { if (scanTimer === null) scanTimer = setTimeout(() => { scanTimer = null; scan() }, SCAN_MS) }
  scan()
  const mo = new win.MutationObserver(schedule)
  mo.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'src', 'srcset'] })

  let hovered: Element[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  const unhover = () => { for (const e of hovered) e.removeAttribute('data-gd-hover'); hovered = [] }
  let pending: { x: number; y: number } | null = null
  let last = -Infinity
  let moveTimer: ReturnType<typeof setTimeout> | null = null
  const probe = (x: number, y: number) => {
    const stack = doc.elementsFromPoint(x, y)
    // Some sites give media pointer-events none (Threads), so it is missing from the stack: use the box that holds it.
    const under = [...marked].filter((e) => {
      const r = e.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false
      if (stack.includes(e)) return true
      let box = e.parentElement
      while (box && !(box.getBoundingClientRect().width > 0 && box.getBoundingClientRect().height > 0)) box = box.parentElement
      return !!box && stack.includes(box)
    })
    if (under.length === hovered.length && under.every((e) => hovered.includes(e))) return
    if (timer) clearTimeout(timer)
    timer = null
    unhover()
    if (!under.length) return
    hovered = under
    timer = setTimeout(() => { timer = null; for (const e of hovered) e.setAttribute('data-gd-hover', '') }, HOVER_MS)
  }
  const onMove = (ev: Event) => {
    const m = ev as MouseEvent
    pending = { x: m.clientX, y: m.clientY }
    const wait = last + MOVE_MS - Date.now()
    if (wait <= 0) { last = Date.now(); const p = pending; pending = null; probe(p.x, p.y) }
    else if (moveTimer === null) moveTimer = setTimeout(() => { moveTimer = null; last = Date.now(); if (pending) { const p = pending; pending = null; probe(p.x, p.y) } }, wait)
  }
  const onLeave = () => { if (timer) clearTimeout(timer); timer = null; unhover() }
  win.addEventListener('pointermove', onMove, { capture: true, passive: true })
  doc.documentElement.addEventListener('mouseleave', onLeave)

  return {
    stop() {
      mo.disconnect()
      ro?.disconnect()
      win.removeEventListener('pointermove', onMove, { capture: true })
      doc.documentElement.removeEventListener('mouseleave', onLeave)
      for (const t of [scanTimer, timer, moveTimer]) if (t) clearTimeout(t)
      for (const e of marked) { e.removeAttribute('data-gd-blur'); e.removeAttribute('data-gd-hover') }
      marked.clear()
    }
  }
}
