// Reset (D14): the file part of "forgot PIN". Plain TS, only ever touches paths inside the data dir.
import { rmSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

export const RESET_WORD = 'RESET'

/** Removes each target (file or dir); throws before removing anything if one is not strictly inside dir. */
export function wipeFiles(dir: string, targets: string[]): void {
  if (!isAbsolute(dir)) throw new Error('data dir must be absolute')
  const root = resolve(dir)
  for (const t of targets) {
    const rel = relative(root, resolve(t))
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`refusing to remove a path outside the data dir: ${t}`)
  }
  for (const t of targets) rmSync(resolve(t), { recursive: true, force: true })
}

/** After RESET is typed: remove accounts.json, lock.json, cached icons and the partition dirs. settings.json stays. */
export function resetData(dir: string, typed: unknown): { ok: true } | { error: string } {
  if (typed !== RESET_WORD) return { error: `Type ${RESET_WORD} to confirm` }
  wipeFiles(dir, [join(dir, 'accounts.json'), join(dir, 'lock.json'), join(dir, 'icons'), join(dir, 'Partitions')])
  return { ok: true }
}
