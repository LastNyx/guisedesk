// Blur media hint (D42). Plain TS, no electron: the CSS that blurs media and the click-to-reveal target.
export interface BlurHint { container: string; media: string; skip?: string }

/** CSS that blurs unrevealed media inside the container, except skipped ones (avatars). */
export function blurCss(hint: BlurHint): string {
  const skip = hint.skip ? `:not(:is(${hint.skip}))` : ''
  return `${hint.container} :is(${hint.media}):not([data-gd-shown], [data-gd-shown] *)${skip} { filter: blur(28px); cursor: pointer; }`
}

/** The outermost blurred media element holding `target`, or null when the click is not on unrevealed media. */
export function revealTarget(target: Element, hint: BlurHint): Element | null {
  if (target.closest('[data-gd-shown]')) return null
  let found: Element | null = null
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.matches(hint.media) && !(hint.skip && el.matches(hint.skip)) && el.parentElement?.closest(hint.container)) found = el
  }
  return found
}

/** Reads main's `--gd-blur=<json>` argument. */
export function parseBlurHint(argv: string[]): BlurHint | null {
  const raw = argv.find((x) => x.startsWith('--gd-blur='))
  if (!raw) return null
  try {
    const h = JSON.parse(raw.slice('--gd-blur='.length))
    if (typeof h?.container !== 'string' || typeof h?.media !== 'string') return null
    return typeof h.skip === 'string' ? { container: h.container, media: h.media, skip: h.skip } : { container: h.container, media: h.media }
  } catch {
    return null
  }
}
