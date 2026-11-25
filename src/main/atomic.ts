import * as nodeFs from 'node:fs'

export type Fs = Pick<typeof nodeFs, 'writeFileSync' | 'renameSync' | 'chmodSync'>

/** Write via temp file then rename, so a crash never leaves a half-written file. With a mode, the file ends up with exactly that mode. */
export function writeAtomic(path: string, data: string | Uint8Array, fs: Fs = nodeFs, mode?: number): void {
  const tmp = `${path}.tmp`
  fs.writeFileSync(tmp, data, mode === undefined ? undefined : { mode })
  if (mode !== undefined) fs.chmodSync(tmp, mode) // a leftover temp file keeps its old mode otherwise
  fs.renameSync(tmp, path)
}
