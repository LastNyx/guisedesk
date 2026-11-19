// App UI bridge.
import { contextBridge, ipcRenderer, webFrame } from 'electron'

// Service views (flagged by main with --gd-service) get only a notification shim; the app bridge is not exposed to them.
const service = process.argv.includes('--gd-service')

/** Runs in the page's main world: replaces window.Notification and the page-side showNotification. */
const SHIM = `(() => {
  const send = window.__gdNotify
  delete window.__gdNotify
  const fire = (title, o) => { try { send(String(title), String((o && o.body) || ''), String((o && o.icon) || '')) } catch (e) {} }
  class N extends EventTarget {
    constructor(title, o) { super(); this.title = String(title); this.body = (o && o.body) || ''; this.onclick = null; fire(title, o) }
    close() {}
    static get permission() { return 'granted' }
    static requestPermission(cb) { if (cb) cb('granted'); return Promise.resolve('granted') }
  }
  Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true })
  if (window.ServiceWorkerRegistration) {
    ServiceWorkerRegistration.prototype.showNotification = function (title, o) { fire(title, o); return Promise.resolve() }
  }
})()`

// Mouse and wheel input counts as activity for the idle lock (keys are seen by main's before-input-event).
// Runs in the app window and in service views; throttled to one message a second.
let lastTouch = 0
const touch = () => {
  const t = Date.now()
  if (t - lastTouch < 1000) return
  lastTouch = t
  ipcRenderer.send('idle:touch')
}
for (const ev of ['mousemove', 'mousedown', 'wheel', 'touchstart']) window.addEventListener(ev, touch, { capture: true, passive: true })

if (service) {
  contextBridge.exposeInMainWorld('__gdNotify', (title: string, body: string, icon: string) =>
    ipcRenderer.send('notify:show', { title, body, icon })
  )
  webFrame.executeJavaScript(SHIM).catch(() => {})
} else contextBridge.exposeInMainWorld('guisedesk', {
  lockState: () => ipcRenderer.invoke('lock:state'),
  onLock: (cb: (info: unknown) => void) => ipcRenderer.on('lock:changed', (_e, info) => cb(info)),
  unlock: (entry: string) => ipcRenderer.invoke('lock:unlock', entry),
  setupLock: (kind: string, secret: string, repeat: string) => ipcRenderer.invoke('lock:setup', kind, secret, repeat),
  lock: () => ipcRenderer.send('lock:lock'),
  reset: (typed: string) => ipcRenderer.invoke('lock:reset', typed),
  state: () => ipcRenderer.invoke('accounts:state'),
  unread: () => ipcRenderer.invoke('unread:get'),
  onUnread: (cb: (counts: Record<string, number>) => void) =>
    ipcRenderer.on('unread:update', (_e, counts) => cb(counts)),
  sleep: () => ipcRenderer.invoke('sleep:get'),
  onSleep: (cb: (s: unknown) => void) => ipcRenderer.on('sleep:update', (_e, s) => cb(s)),
  select: (id: string) => ipcRenderer.send('accounts:select', id),
  dialog: (open: boolean) => ipcRenderer.send('ui:dialog', open),
  mute: (id: string, muted: boolean) => ipcRenderer.invoke('accounts:mute', id, muted),
  add: (input: unknown) => ipcRenderer.invoke('accounts:add', input),
  onSelected: (cb: (id: string) => void) => ipcRenderer.on('accounts:selected', (_e, id) => cb(id))
})
