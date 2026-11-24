// App UI bridge.
import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { countsAsInput } from './touch'
import { parseHint, pickPostLink } from './postlink'
import { blurCss, parseBlurHint, watchBlur } from './blur'
import { parseDragHint, watchDragScroll } from './dragscroll'

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
const touch = (e: Event) => {
  if (!countsAsInput(e)) return
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
  // D38: a middle-click on a JS-routed post (not inside a real <a>) asks main for a popup of its permalink.
  const hint = parseHint(process.argv)
  if (hint) {
    window.addEventListener('auxclick', (e) => {
      const t = e.target
      if (e.button !== 1 || !(t instanceof Element) || t.closest('a')) return
      const url = pickPostLink(t, hint)
      if (!url) return
      e.preventDefault()
      ipcRenderer.send('popup:request', url)
    }, true)
  }
  // D44: drag to scroll sideways media rows (X).
  if (parseDragHint(process.argv)) {
    window.addEventListener('DOMContentLoaded', () => watchDragScroll(window, (e) => {
      const s = getComputedStyle(e)
      return { overflowX: s.overflowX, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }
    }), { once: true })
  }
  // D42/D43: blur media until hovered. Main owns the flag (blur:state at start, blur:set live).
  const blur = parseBlurHint(process.argv)
  if (blur) {
    let key: string | null = null
    let watcher: { stop: () => void } | null = null
    let want = false
    // webFrame.insertCSS needs a document: wait for it and retry, and say so when it still fails.
    const insert = async (): Promise<string | null> => {
      for (let i = 0; i < 5; i++) {
        try { return await webFrame.insertCSS(blurCss()) } catch (e) {
          if (i === 4) console.warn('[guisedesk] blur css failed', e)
          else await new Promise((r) => setTimeout(r, 200 * (i + 1)))
        }
      }
      return null
    }
    const apply = async (next: boolean) => {
      want = next
      if (want && !watcher) {
        if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }))
        if (!want || watcher) return
        watcher = watchBlur(window, blur)
        if (key === null) { const k = await insert(); if (want) key = k; else if (k) webFrame.removeInsertedCSS(k) }
      } else if (!want) {
        watcher?.stop()
        watcher = null
        if (key !== null) { const k = key; key = null; webFrame.removeInsertedCSS(k) }
      }
    }
    ipcRenderer.invoke('blur:state').then((s) => apply(!!s)).catch((e) => console.warn('[guisedesk] blur state failed', e))
    ipcRenderer.on('blur:set', (_e, s) => void apply(!!s))
  }
} else contextBridge.exposeInMainWorld('guisedesk', {
  lockState: () => ipcRenderer.invoke('lock:state'),
  onLock: (cb: (info: unknown) => void) => ipcRenderer.on('lock:changed', (_e, info) => cb(info)),
  unlock: (entry: string) => ipcRenderer.invoke('lock:unlock', entry),
  setupLock: (kind: string, secret: string, repeat: string) => ipcRenderer.invoke('lock:setup', kind, secret, repeat),
  lock: () => ipcRenderer.send('lock:lock'),
  prefs: () => ipcRenderer.invoke('prefs:get'),
  setIdle: (minutes: unknown) => ipcRenderer.invoke('prefs:idle', minutes),
  setDnd: (on: boolean) => ipcRenderer.invoke('prefs:dnd', on),
  onDnd: (cb: (on: boolean) => void) => ipcRenderer.on('prefs:dnd-changed', (_e, on) => cb(on)),
  setStartOnLogin: (on: boolean) => ipcRenderer.invoke('prefs:autostart', on),
  changeLock: (current: string, kind: string, secret: string, repeat: string) => ipcRenderer.invoke('lock:change', current, kind, secret, repeat),
  reset: (typed: string) => ipcRenderer.invoke('lock:reset', typed),
  state: () => ipcRenderer.invoke('accounts:state'),
  unread: () => ipcRenderer.invoke('unread:get'),
  onUnread: (cb: (counts: Record<string, number>) => void) =>
    ipcRenderer.on('unread:update', (_e, counts) => cb(counts)),
  sleep: () => ipcRenderer.invoke('sleep:get'),
  onSleep: (cb: (s: unknown) => void) => ipcRenderer.on('sleep:update', (_e, s) => cb(s)),
  setSidebar: (collapsed: boolean) => ipcRenderer.send('sidebar:set', collapsed),
  onSidebar: (cb: (collapsed: boolean) => void) => ipcRenderer.on('sidebar:changed', (_e, c) => cb(c)),
  select: (id: string) => ipcRenderer.send('accounts:select', id),
  dialog: (open: boolean) => ipcRenderer.send('ui:dialog', open),
  reload: (id: string) => ipcRenderer.send('accounts:reload', id),
  sleepNow: (id: string) => ipcRenderer.send('accounts:sleep', id),
  rowMenu: (id: string) => ipcRenderer.send('sidebar:menu', id),
  onRowMenuPick: (cb: (p: { id: string; action: string }) => void) => ipcRenderer.on('sidebar:menu-pick', (_e, p) => cb(p)),
  reorder: (ids: string[]) => ipcRenderer.invoke('accounts:reorder', ids),
  resetZoom: (id: string) => ipcRenderer.invoke('accounts:zoom-reset', id),
  onZoom: (cb: (s: unknown) => void) => ipcRenderer.on('accounts:zoom', (_e, s) => cb(s)),
  mute: (id: string, muted: boolean) => ipcRenderer.invoke('accounts:mute', id, muted),
  setBlur: (id: string, on: boolean) => ipcRenderer.invoke('accounts:blur', id, on),
  onOpenSettings: (cb: () => void) => ipcRenderer.on('settings:open', () => cb()),
  setServiceEnabled: (serviceId: string, enabled: boolean) => ipcRenderer.invoke('services:set', serviceId, enabled),
  setPolicy: (id: string, policy: string) => ipcRenderer.invoke('accounts:policy', id, policy),
  logout: (id: string) => ipcRenderer.invoke('accounts:logout', id),
  remove: (id: string) => ipcRenderer.invoke('accounts:remove', id),
  updateState: () => ipcRenderer.invoke('update:state'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateApply: () => ipcRenderer.invoke('update:apply'),
  onUpdate: (cb: (u: unknown) => void) => ipcRenderer.on('update:changed', (_e, u) => cb(u)),
  downloads: () => ipcRenderer.invoke('downloads:get'),
  setDownloadsAsk: (ask: boolean) => ipcRenderer.invoke('downloads:set', { ask }),
  pickDownloadsDir: () => ipcRenderer.invoke('downloads:pick'),
  blocking: () => ipcRenderer.invoke('blocking:get'),
  setBlocking: (v: { ads?: boolean; popups?: boolean }) => ipcRenderer.invoke('blocking:set', v),
  blockState: () => ipcRenderer.invoke('block:state'),
  onBlock: (cb: (s: unknown) => void) => ipcRenderer.on('block:update', (_e, s) => cb(s)),
  openBlockedPopup: (id: string) => ipcRenderer.invoke('block:open-popup', id),
  add: (input: unknown) => ipcRenderer.invoke('accounts:add', input),
  onLinkChoose: (cb: (r: unknown) => void) => ipcRenderer.on('links:choose', (_e, r) => cb(r)),
  chooseLink: (id: number, choice: string | null) => ipcRenderer.send('links:chosen', id, choice),
  onSelected: (cb: (id: string) => void) => ipcRenderer.on('accounts:selected', (_e, id) => cb(id))
})
