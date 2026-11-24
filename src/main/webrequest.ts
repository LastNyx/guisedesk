// One webRequest dispatcher per session (D45). Electron keeps a single listener per webRequest event, so features add
// named handlers here instead of calling ses.webRequest directly; removing one never wipes another. No electron import.

type Cb<R> = (r: R) => void
type Handler<D, R> = (details: D, callback: Cb<R>) => void

export interface WebRequestLike<D1, R1, D2, R2> {
  onBeforeRequest(filter: { urls: string[] }, listener: Handler<D1, R1>): void
  onBeforeRequest(listener: null): void
  onHeadersReceived(filter: { urls: string[] }, listener: Handler<D2, R2>): void
  onHeadersReceived(listener: null): void
}

const empty = (r: object | undefined) => !r || Object.keys(r).length === 0

/** Runs handlers in insertion order; the first non-empty answer wins, else the request goes on unchanged. */
function chain<D, R extends object>(handlers: Map<string, Handler<D, R>>): Handler<D, R> {
  return (details, callback) => {
    const list = [...handlers.values()]
    const next = (i: number) => {
      if (i >= list.length) return callback({} as R)
      list[i](details, (r) => (empty(r) ? next(i + 1) : callback(r)))
    }
    next(0)
  }
}

export function createDispatcher<D1, R1 extends object, D2, R2 extends object>(wr: WebRequestLike<D1, R1, D2, R2>) {
  const before = new Map<string, Handler<D1, R1>>()
  const headers = new Map<string, Handler<D2, R2>>()
  const sync = () => {
    if (before.size) wr.onBeforeRequest({ urls: ['<all_urls>'] }, chain(before))
    else wr.onBeforeRequest(null)
    if (headers.size) wr.onHeadersReceived({ urls: ['<all_urls>'] }, chain(headers))
    else wr.onHeadersReceived(null)
  }
  return {
    add(name: string, h: { before?: Handler<D1, R1>; headers?: Handler<D2, R2> }) {
      if (h.before) before.set(name, h.before)
      if (h.headers) headers.set(name, h.headers)
      sync()
    },
    remove(name: string) {
      const had = before.delete(name) || headers.delete(name)
      headers.delete(name)
      if (had) sync()
    },
    names: () => [...new Set([...before.keys(), ...headers.keys()])]
  }
}
