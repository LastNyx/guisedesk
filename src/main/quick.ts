// Quick switcher matching (D59). Plain TS: no electron, no fs.
export interface QuickRow {
  id: string
  label: string
  service: string
}

const WORD = /[\s._@\-/]/

/** How well one query token matches a piece of text; -1 = no match, higher is better. */
export function tokenScore(text: string, token: string): number {
  const t = text.toLowerCase()
  const q = token.toLowerCase()
  if (!q) return 0
  if (t === q) return 1000
  if (t.startsWith(q)) return 600
  let at = t.indexOf(q)
  if (at >= 0) return WORD.test(t[at - 1] ?? ' ') && at > 0 ? 450 : 250 - Math.min(at, 100)
  // Subsequence: every query character, in order (the loose "fuzzy" match).
  let cursor = 0
  let gaps = 0
  let last = -1
  for (const ch of q) {
    at = t.indexOf(ch, cursor)
    if (at < 0) return -1
    if (last >= 0) gaps += at - last - 1
    last = at
    cursor = at + 1
  }
  return Math.max(1, 100 - gaps)
}

/** Best of the label and the service name; every whitespace-separated token must match one of them. */
export function scoreRow(row: QuickRow, query: string): number {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return 0
  let total = 0
  for (const token of tokens) {
    // A label hit is a better signal than a service hit, so a service match counts less.
    const label = tokenScore(row.label, token)
    const service = tokenScore(row.service, token)
    const best = Math.max(label, service < 0 ? -1 : Math.round(service * 0.6))
    if (best < 0) return -1
    total += best
  }
  return total
}

/** Accounts matching the query, best first; an empty query keeps the given (sidebar) order. */
export function filterAccounts<T extends QuickRow>(rows: T[], query: string): T[] {
  const scored = rows.map((row, index) => ({ row, index, score: scoreRow(row, query) })).filter((x) => x.score >= 0)
  if (!query.trim()) return scored.map((x) => x.row)
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((x) => x.row)
}

/** Move the highlight by `delta`, wrapping at both ends. */
export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return (current + delta + length) % length
}
