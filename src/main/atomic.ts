import * as nodeFs from 'node:fs'

export type Fs = Pick<typeof nodeFs, 'writeFileSync' | 'renameSync'>

/** Write via temp file then rename, so a crash never leaves a half-written file. */
export function writeAtomic(path: string, data: string, fs: Fs = nodeFs): void {
  const tmp = `${path}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, path)
}
