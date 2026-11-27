// Backup worker (D61): packing, decrypting and staging a large backup would freeze the UI, so they run here.
import { readFileSync } from 'node:fs'
import { parentPort } from 'node:worker_threads'
import { buildBackupArchive, inspectBackupBytes, prepareRestore, type BackupManifest } from './backup'

export type BackupWorkerRequest =
  | { op: 'export'; dataDir: string; includeLogins: boolean; password: string; version: string }
  | { op: 'inspect'; file: string; password: string }
  | { op: 'prepare'; dataDir: string; file: string; password: string }

interface Reply {
  ok: boolean
  bytes?: Uint8Array
  manifest?: BackupManifest
  error?: string
}

function reply(m: Reply, transfer?: ArrayBuffer[]): void {
  if (transfer) parentPort?.postMessage(m, transfer)
  else parentPort?.postMessage(m)
}

parentPort?.on('message', (m: BackupWorkerRequest) => {
  try {
    if (m.op === 'export') {
      const r = buildBackupArchive({ dataDir: m.dataDir, includeLogins: m.includeLogins, password: m.password, version: m.version })
      const bytes = new Uint8Array(r.bytes.length)
      bytes.set(r.bytes)
      reply({ ok: true, bytes, manifest: r.manifest }, [bytes.buffer])
    } else if (m.op === 'inspect') {
      reply({ ok: true, manifest: inspectBackupBytes(m.password, readFileSync(m.file)) })
    } else if (m.op === 'prepare') {
      reply({ ok: true, manifest: prepareRestore({ dataDir: m.dataDir, file: m.file, password: m.password }) })
    } else {
      reply({ ok: false, error: 'Unknown backup operation.' })
    }
  } catch (err) {
    reply({ ok: false, error: String((err as Error)?.message ?? err) })
  }
})
