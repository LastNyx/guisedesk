export function initials(label: string): string {
  const words = label.replace(/[^\p{L}\p{N}\s._-]/gu, '').split(/[\s._-]+/).filter(Boolean)
  const chars = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return chars.toUpperCase()
}
