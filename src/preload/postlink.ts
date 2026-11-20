// Post link hint (D38). Plain TS, no electron: finds the permalink of a JS-routed post that is not itself a link.
export interface PostLinkHint { container: string; link: string }

/** The first `link` match inside the closest `container` of `target`, as an absolute href; null when there is none. */
export function pickPostLink(target: Element, hint: PostLinkHint): string | null {
  const a = target.closest(hint.container)?.querySelector<HTMLAnchorElement>(hint.link)
  return a ? a.href : null
}

/** Reads main's `--gd-postlink=<json>` argument. */
export function parseHint(argv: string[]): PostLinkHint | null {
  const raw = argv.find((x) => x.startsWith('--gd-postlink='))
  if (!raw) return null
  try {
    const h = JSON.parse(raw.slice('--gd-postlink='.length))
    return typeof h?.container === 'string' && typeof h?.link === 'string' ? { container: h.container, link: h.link } : null
  } catch {
    return null
  }
}
