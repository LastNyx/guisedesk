// Worker thread (D45): downloads the ads + trackers lists and builds the serialized engine, so parsing never blocks main.
import { parentPort } from 'node:worker_threads'
import { FiltersEngine } from '@ghostery/adblocker'

FiltersEngine.fromPrebuiltAdsAndTracking(fetch)
  .then((engine) => {
    const bytes = engine.serialize()
    parentPort?.postMessage({ ok: true, bytes }, [bytes.buffer as ArrayBuffer])
  })
  .catch((e) => parentPort?.postMessage({ ok: false, error: String(e?.message ?? e) }))
