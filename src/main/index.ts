import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, openSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, ipcMain, Menu, Notification, nativeImage, powerMonitor, session, shell, WebContentsView } from 'electron'
import { dataDir, devUnlocked } from './paths'
import { addAccount, IDLE_POLICIES, loadAccounts, loadDisabled, loadDnd, loadIdleMinutes, loadSelected, loadSidebarCollapsed, saveSidebarCollapsed, orderedAccounts, saveDnd, saveSelected, setIdlePolicy, reorderAccounts, setMuted, setServiceEnabled, type Account } from './accounts'
import { logOut, removeAccount } from './accountops'
import { overlay } from './composite'
import { cacheFavicon, readIcon, type Fetcher } from './favicon'
import { validateNewAccount } from './validate'
import { presetFor, CHROME_UA } from './presets'
import { redirectAllowed, route } from './links'
import { parseUnread, totalUnread } from './unread'
import { createTray } from './tray'
import { decideNotification } from './notify'
import { permissionAllowed } from './permissions'
import { createHibernator, limitMinutes } from './hibernate'
import { createLock, isLockShortcut } from './lock'
import { createGuardedIpc } from './guard'
import { wireTriggers } from './triggers'
import { resetData, RESET_WORD } from './reset'
import { isAutostart, setAutostart, startsHidden } from './autostart'
import { applyIdle } from './prefs'
import { checkForUpdate, realRun, type UpdateInfo } from './updater'
import { version } from '../../package.json'
import { buildContextMenu } from './contextmenu'
import { isSidebarShortcut, panelBounds as layoutBounds } from './layout'

// Both must run before `ready`. setName first: it resets the default userData path, which setPath then overrides,
// so sessions and partitions still land in the chosen dir. The name is what notifications and the tray show.
app.setName('GuiseDesk')
app.setDesktopName('guisedesk.desktop')
const dir = dataDir(process.env, homedir())
mkdirSync(dir, { recursive: true })
app.setPath('userData', dir)

// Content panel inside the renderer layout (D26 compact): numbers in layout.ts, shared with Sidebar.vue.
// Sidebar rail state (D24), loaded from settings in createWindow.
let sidebarCollapsed = false
function panelBounds(win: BrowserWindow) {
  const [w, h] = win.getContentSize()
  return layoutBounds(w, h, sidebarCollapsed)
}
// The account page's corners match the rounded inset panel (10px in tokens.css).
const VIEW_RADIUS = 10

// App lock (D9): main is the source of truth. Locked or in setup, no account data goes to the renderer and no service view
// is on the window. GUISEDESK_DEV_UNLOCKED=1 (dev only, honoured only with GUISEDESK_DATA plus GUISEDESK_DEV or GUISEDESK_SHOT, never for ~/.config/GuiseDesk) skips the lock for screenshot runs.
const lock = createLock({ dir, startUnlocked: devUnlocked(process.env, dir, homedir()) })
const isUnlocked = () => lock.state() === 'unlocked'
// Every channel that returns or acts on account data is registered through this: it refuses while locked.
const gipc = createGuardedIpc(ipcMain, isUnlocked)

// No application menu (its default has Reload and DevTools); DevTools only in dev runs.
Menu.setApplicationMenu(null)
const devTools = process.env.GUISEDESK_DEV === '1'

const views = new Map<string, WebContentsView>()
let attached: WebContentsView | undefined
// While a dialog is open the service view is detached (it would draw over the dialog).
let dialogOpen = false
// Unread count per account id, from page titles. GUISEDESK_FAKE_COUNTS="id=3,id2=12" (dev only) pins them instead.
const counts: Record<string, number> = {}
const fakeCounts = process.env.GUISEDESK_FAKE_COUNTS
let onCounts: () => void = () => {}
let quitting = false
// Global Do Not Disturb (D19), loaded from settings in createWindow.
let dnd = false
// Services switched off in Settings (D6): hidden from the sidebar, no notifications, sessions kept.
let disabled = new Set<string>()
// Which account a service view's webContents belongs to, for notification IPC.
const owner = new Map<number, Account>()
// Hibernation (D7): sleep = view destroyed, partition kept. sleepState feeds the sidebar (ZZ) and the asleep panel.
const hib = createHibernator(Date.now)
const sleepState: Record<string, { minutes: number; waking: boolean }> = {}
let attachedId: string | undefined
// Input anywhere in the app (window or a service view) restarts the idle period; set once the triggers are wired.
let touchIdle: () => void = () => {}
let toggleSidebar: () => void = () => {}
const live = new Set<Notification>() // keep references so click handlers survive GC

/** One request to the site for its favicon (Custom URL accounts only, once per host). */
const fetchSite: Fetcher = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!r.ok) return null
  const bytes = new Uint8Array(await r.arrayBuffer())
  return bytes.length > 512 * 1024 ? null : { contentType: r.headers.get('content-type') ?? '', bytes }
}

/** Link policy (D8): in-app loads in this view, never a new window; mailto goes out; the rest is denied or external. */
function hookLinks(v: WebContentsView, a: Account): void {
  const wc = v.webContents
  const go = (url: string): boolean => {
    const r = route(url, a)
    if (r.action === 'in-app') {
      if (r.url !== url) wc.loadURL(r.url)
      return r.url === url
    }
    if (r.action === 'external') void shell.openExternal(r.url)
    return false
  }
  wc.setWindowOpenHandler(({ url }) => {
    const r = route(url, a)
    if (r.action === 'in-app') wc.loadURL(r.url)
    else go(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (e, url) => {
    if (!go(url)) e.preventDefault()
  })
  wc.on('will-redirect', (e, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return
    const d = redirectAllowed(url, a)
    if (d.allow) return
    e.preventDefault()
    if (d.open) void shell.openExternal(d.open)
    if (d.load) wc.loadURL(d.load)
  })
  wc.on('before-input-event', (e, input) => {
    hib.touch(a.id)
    touchIdle()
    // Ctrl+B toggles the sidebar, but never while locked (the view is off the window then anyway).
    if (isSidebarShortcut(input) && isUnlocked()) {
      e.preventDefault()
      toggleSidebar()
      return
    }
    // Ctrl+L locks even while focus is inside a service page (the page never sees the key).
    if (isLockShortcut(input)) {
      e.preventDefault()
      lock.lock()
    }
  })
  wc.on('page-title-updated', (_e, title) => {
    if (fakeCounts) return
    counts[a.id] = parseUnread(title, presetFor(a.serviceId))
    onCounts()
  })
}

/** Right-click menu (D30): the template builder gives action ids; they map to webContents, clipboard and shell calls here. */
function hookContextMenu(v: WebContentsView): void {
  const wc = v.webContents
  wc.on('context-menu', (_e, p) => {
    const nav = wc.navigationHistory
    const items = buildContextMenu(p, { canGoBack: nav.canGoBack(), canGoForward: nav.canGoForward(), locked: !isUnlocked() })
    if (!items.length) return
    const run = (action: string, value?: string) => {
      switch (action) {
        case 'open-link':
          if (/^https?:\/\//i.test(p.linkURL)) void shell.openExternal(p.linkURL)
          break
        case 'copy-link': clipboard.writeText(p.linkURL); break
        case 'save-image': wc.downloadURL(p.srcURL); break
        case 'copy-image': wc.copyImageAt(p.x, p.y); break
        case 'copy-image-address': clipboard.writeText(p.srcURL); break
        case 'spell': if (value) wc.replaceMisspelling(value); break
        case 'undo': wc.undo(); break
        case 'redo': wc.redo(); break
        case 'cut': wc.cut(); break
        case 'copy': wc.copy(); break
        case 'paste': wc.paste(); break
        case 'select-all': wc.selectAll(); break
        case 'back': nav.goBack(); break
        case 'forward': nav.goForward(); break
        case 'reload': wc.reload(); break
      }
    }
    Menu.buildFromTemplate(
      items.map((i) => ('type' in i ? { type: 'separator' as const } : { label: i.label, enabled: i.enabled, click: () => run(i.action, i.value) }))
    ).popup()
  })
}

function viewFor(a: Account): WebContentsView {
  let v = views.get(a.id)
  if (!v) {
    v = new WebContentsView({
      webPreferences: {
        partition: `persist:${a.id}`,
        sandbox: true,
        contextIsolation: true,
        devTools,
        preload: join(__dirname, '../preload/index.js'),
        additionalArguments: ['--gd-service']
      }
    })
    owner.set(v.webContents.id, a)
    const ses = v.webContents.session
    ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permissionAllowed(permission)))
    ses.setPermissionCheckHandler((_wc, permission) => permissionAllowed(permission))
    const preset = presetFor(a.serviceId)
    v.setBorderRadius(VIEW_RADIUS)
    v.webContents.setUserAgent(preset?.userAgent ?? CHROME_UA)
    hookLinks(v, a)
    hookContextMenu(v)
    v.webContents.loadURL(preset?.startUrl ?? a.custom?.url ?? 'about:blank')
    views.set(a.id, v)
  }
  return v
}

/** Page notification (D4): decide, then show a native one; click shows the window and selects the account. */
function notify(win: BrowserWindow, a: Account, p: { title?: string; body?: string; icon?: string }, onClick: () => void): void {
  const d = decideNotification(
    {
      accountId: a.id,
      serviceName: presetFor(a.serviceId)?.name ?? a.custom?.name ?? a.serviceId,
      label: a.label,
      title: String(p.title ?? '').slice(0, 200),
      body: String(p.body ?? '').slice(0, 1000),
      icon: p.icon
    },
    { muted: a.muted, dnd, asleep: hib.isAsleep(a.id), locked: !isUnlocked(), disabled: disabled.has(a.serviceId) }
  )
  if (d.action === 'drop' || !Notification.isSupported()) return
  // Linux has no subtitle: the service line goes under the body (frame 7).
  const n = new Notification({ title: d.title, body: [d.body, d.subtitle].filter(Boolean).join('\n') })
  live.add(n)
  n.on('click', onClick)
  n.on('close', () => live.delete(n))
  n.show()
}

/** Puts the selected view in the panel. A view rebuilt from sleep is attached only once its page has loaded; the asleep panel covers the gap. */
function attach(win: BrowserWindow, v: WebContentsView): void {
  if (win.isDestroyed() || dialogOpen || !isUnlocked() || attached !== v || (attachedId && sleepState[attachedId]?.waking)) return
  win.contentView.addChildView(v)
  v.setBounds(panelBounds(win))
}

function detach(win: BrowserWindow, v: WebContentsView): void {
  if (!win.isDestroyed() && win.contentView.children.includes(v)) win.contentView.removeChildView(v)
}

function show(win: BrowserWindow, a: Account, push: () => void): void {
  if (attached) detach(win, attached)
  hib.touch(a.id)
  const wasAsleep = hib.isAsleep(a.id)
  if (wasAsleep) {
    hib.wake(a.id)
    sleepState[a.id] = { ...sleepState[a.id], waking: true }
  }
  const v = viewFor(a)
  attached = v
  attachedId = a.id
  if (wasAsleep) {
    const done = () => {
      if (!sleepState[a.id]?.waking) return
      delete sleepState[a.id]
      push()
      attach(win, v)
    }
    v.webContents.once('did-finish-load', done)
    v.webContents.once('did-fail-load', done)
    push()
    return
  }
  attach(win, v)
}

function sleepAccount(a: Account, minutes = limitMinutes(a) ?? 0): void {
  const v = views.get(a.id)
  if (v) {
    owner.delete(v.webContents.id)
    views.delete(a.id)
    v.webContents.close()
  }
  sleepState[a.id] = { minutes, waking: false }
}

function setDialog(win: BrowserWindow, open: boolean): void {
  if (open === dialogOpen) return
  dialogOpen = open
  if (!attached) return
  if (open) detach(win, attached)
  else attach(win, attached)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#15151c',
    autoHideMenuBar: true,
    title: 'GuiseDesk',
    icon: join(__dirname, '../../resources/icon.png'),
    // Started on login (--hidden): stay in the tray. The lock still starts locked.
    show: !startsHidden(process.argv),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      devTools
    }
  })
  // Dev-only: GUISEDESK_SHOT_DIALOG=add opens the Add account dialog, =reset the reset confirm screen, for the screenshot.
  // =settings opens Settings with the sheet of account GUISEDESK_SHOT_SHEET.
  const dialogQuery =
    process.env.GUISEDESK_SHOT && ['add', 'reset', 'settings'].includes(process.env.GUISEDESK_SHOT_DIALOG ?? '')
      ? `dialog=${process.env.GUISEDESK_SHOT_DIALOG}&sheet=${encodeURIComponent(process.env.GUISEDESK_SHOT_SHEET ?? '')}&tab=${encodeURIComponent(process.env.GUISEDESK_SHOT_TAB ?? '')}`
      : ''
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL + (dialogQuery && `?${dialogQuery}`))
  else win.loadFile(join(__dirname, '../renderer/index.html'), { search: dialogQuery })

  const showWindow = () => {
    win.show()
    win.focus()
  }
  dnd = loadDnd(dir)
  // Tray Settings: raise the window, and open the screen only when unlocked (the renderer ignores it otherwise too).
  const openSettings = () => {
    showWindow()
    if (isUnlocked()) win.webContents.send('settings:open')
  }
  const tray = createTray(showWindow, () => lock.lock(), openSettings, dnd, (on) => {
    dnd = on
    saveDnd(dir, on)
    if (!win.isDestroyed() && isUnlocked()) win.webContents.send('prefs:dnd-changed', on)
  })
  // Close hides to the tray; only quitting (tray Quit, session end) really closes.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })

  disabled = new Set(loadDisabled(dir))
  sidebarCollapsed = loadSidebarCollapsed(dir)
  // The rail changes the panel width: tell the renderer and resize the attached view at once.
  const setSidebar = (c: boolean) => {
    if (c === sidebarCollapsed) return
    sidebarCollapsed = c
    saveSidebarCollapsed(dir, c)
    attached?.setBounds(panelBounds(win))
    if (!win.isDestroyed()) win.webContents.send('sidebar:changed', c)
  }
  toggleSidebar = () => setSidebar(!sidebarCollapsed)
  let accounts = orderedAccounts(loadAccounts(dir))
  const enabled = () => accounts.filter((a) => !disabled.has(a.serviceId))
  let selectedId = loadSelected(dir)
  if (!enabled().some((a) => a.id === selectedId)) selectedId = enabled()[0]?.id
  // Custom icons are cached files; the renderer gets them as data URLs.
  const snapshot = () => ({
    accounts: accounts.map((a) =>
      a.custom ? { ...a, custom: { ...a.custom, icon: readIcon(dir, a.custom.icon) } } : a
    ),
    selectedId,
    disabledServices: [...disabled],
    sidebarCollapsed
  })
  const fromApp = (e: { sender: { id: number } }) => e.sender.id === win.webContents.id
  ipcMain.removeHandler('lock:state')
  ipcMain.handle('lock:state', (e) => (fromApp(e) ? lock.info() : { state: 'locked' }))
  ipcMain.removeHandler('lock:setup')
  ipcMain.handle('lock:setup', (e, kind, secret, repeat) => (fromApp(e) ? lock.setup(kind, secret, repeat) : { error: 'Refused' }))
  ipcMain.removeHandler('lock:unlock')
  ipcMain.handle('lock:unlock', (e, entry) => (fromApp(e) ? lock.unlock(entry) : { result: 'wrong' }))
  ipcMain.removeAllListeners('lock:lock')
  ipcMain.on('lock:lock', (e) => fromApp(e) && lock.lock())
  // Idle (D15): the app window and service views report mouse input through the preload; keys come from before-input-event.
  // The setting is read at start; Settings changes it through applyIdle (setMinutes).
  const triggers = wireTriggers({ lock, power: powerMonitor, now: Date.now, minutes: loadIdleMinutes(dir) })
  touchIdle = triggers.touch
  setInterval(triggers.check, 10_000).unref()
  ipcMain.removeAllListeners('idle:touch')
  ipcMain.on('idle:touch', (e) => (fromApp(e) || owner.has(e.sender.id)) && triggers.touch())
  // Self-update (D29): check once the window is up and every 12 h; apply hands over to a temp copy of update.sh and quits.
  const root = app.getAppPath()
  let update: UpdateInfo | { state: 'checking' } = { state: 'checking' }
  const setUpdate = (u: UpdateInfo) => {
    update = u
    if (!win.isDestroyed() && isUnlocked()) win.webContents.send('update:changed', u)
  }
  const runCheck = async () => {
    const u = await checkForUpdate({ root, current: version, env: process.env, run: realRun })
    setUpdate(u)
    return u
  }
  win.webContents.once('did-finish-load', () => void runCheck())
  setInterval(() => void runCheck(), 12 * 3600_000).unref()
  gipc.handle('update:state', (e: { sender: { id: number } }) => (fromApp(e) ? update : undefined))
  gipc.handle('update:check', (e: { sender: { id: number } }) => (fromApp(e) ? runCheck() : undefined))
  gipc.handle('update:apply', (e: { sender: { id: number } }) => {
    if (!fromApp(e) || update.state !== 'available' || !('latest' in update) || !update.latest) return false
    // update.sh is copied first: the checkout rewrites launchers/update.sh while the script runs.
    const copy = join(mkdtempSync(join(tmpdir(), 'guisedesk-update-')), 'update.sh')
    copyFileSync(join(root, 'launchers', 'update.sh'), copy)
    const log = openSync(join(dir, 'update.log'), 'a')
    spawn('sh', [copy, update.latest, String(process.pid), root, join(dir, 'update.log')], { detached: true, stdio: ['ignore', log, log] }).unref()
    app.quit()
    return true
  })
  // Settings > Lock, Notifications, General. All behind the guard; the idle choice reaches the running timer.
  const autostartOpts = () => ({ env: process.env, home: homedir(), appPath: app.getAppPath() })
  gipc.handle('prefs:get', (e: { sender: { id: number } }) =>
    fromApp(e) ? { idleLock: loadIdleMinutes(dir), dnd, startOnLogin: isAutostart(autostartOpts()) } : undefined
  )
  gipc.handle('prefs:idle', (e: { sender: { id: number } }, v: unknown) => fromApp(e) && applyIdle(dir, v, triggers))
  gipc.handle('prefs:dnd', (e: { sender: { id: number } }, on: unknown) => {
    if (!fromApp(e)) return false
    dnd = !!on
    saveDnd(dir, dnd)
    tray.setDnd(dnd)
    return true
  })
  gipc.handle('prefs:autostart', (e: { sender: { id: number } }, on: unknown) => {
    if (!fromApp(e)) return false
    try {
      setAutostart(autostartOpts(), !!on)
      return true
    } catch (err) {
      console.error('autostart failed:', err)
      return false
    }
  })
  gipc.handle('lock:change', (e: { sender: { id: number } }, current: string, kind: 'pin' | 'password', secret: string, repeat: string) =>
    fromApp(e) ? lock.change(String(current ?? ''), kind, String(secret ?? ''), String(repeat ?? '')) : { error: 'Refused' }
  )
  // Reset (D14): after RESET is typed, drop every view, wipe the partitions' storage, delete the files, back to setup.
  ipcMain.removeHandler('lock:reset')
  ipcMain.handle('lock:reset', async (e, typed) => {
    if (!fromApp(e) || lock.state() === 'setup') return { error: 'Refused' }
    if (typed !== RESET_WORD) return { error: `Type ${RESET_WORD} to confirm` }
    const ids = new Set([...loadAccounts(dir).map((a) => a.id), ...views.keys()])
    if (attached) detach(win, attached)
    attached = undefined
    attachedId = undefined
    for (const v of views.values()) {
      owner.delete(v.webContents.id)
      v.webContents.close()
    }
    views.clear()
    for (const id of ids) {
      const ses = session.fromPartition(`persist:${id}`)
      await ses.clearStorageData().catch(() => {})
      await ses.clearCache().catch(() => {})
    }
    const r = resetData(dir, typed)
    if ('error' in r) return r
    accounts = []
    selectedId = undefined
    for (const k of Object.keys(counts)) delete counts[k]
    for (const k of Object.keys(sleepState)) delete sleepState[k]
    lock.reset()
    return r
  })
  // Ctrl+L inside the app UI (a focused service view is handled in hookLinks).
  win.webContents.on('before-input-event', (e, input) => {
    touchIdle()
    if (isSidebarShortcut(input) && isUnlocked()) {
      e.preventDefault()
      toggleSidebar()
      return
    }
    if (!isLockShortcut(input)) return
    e.preventDefault()
    lock.lock()
  })
  lock.onChange(() => {
    if (win.isDestroyed()) return
    if (isUnlocked()) {
      if (attached) attach(win, attached)
    } else {
      // Views keep running; they just leave the window. The renderer wipes its own account data on 'locked'.
      dialogOpen = false
      if (attached) detach(win, attached)
      win.webContents.focus()
    }
    tray.setUnread(totalUnread(counts), !isUnlocked())
    win.webContents.send('lock:changed', lock.info())
  })
  gipc.handle('accounts:state', snapshot)
  const push = () => {
    tray.setUnread(totalUnread(counts), !isUnlocked())
    if (!win.isDestroyed() && isUnlocked()) win.webContents.send('unread:update', counts)
  }
  const pushSleep = () => {
    if (!win.isDestroyed() && isUnlocked()) win.webContents.send('sleep:update', { ...sleepState })
  }
  gipc.handle('sleep:get', () => ({ ...sleepState }))
  // Dev-only: GUISEDESK_FAKE_ASLEEP=<id> starts that account asleep (stays asleep even if selected, so the panel can be shot).
  const fakeAsleep = process.env.GUISEDESK_FAKE_ASLEEP
  if (accounts.some((a) => a.id === fakeAsleep)) {
    hib.sleep(fakeAsleep!)
    sleepState[fakeAsleep!] = { minutes: 30, waking: false }
  }
  // GUISEDESK_SLEEP_TICK_MS (dev-only) shortens the one-minute sweep.
  setInterval(() => {
    for (const id of hib.sweep(accounts, selectedId)) sleepAccount(accounts.find((a) => a.id === id)!)
    pushSleep()
  }, Number(process.env.GUISEDESK_SLEEP_TICK_MS) || 60_000).unref()
  onCounts = push
  for (const pair of fakeCounts?.split(',') ?? []) {
    const [id, n] = pair.split('=')
    if (id) counts[id] = Number(n) || 0
  }
  gipc.handle('unread:get', () => ({ ...counts }))
  push()
  // Selected account gone or its service switched off: show the first account still in the sidebar, or none.
  const reconcile = () => {
    if (enabled().some((a) => a.id === selectedId)) return
    if (attached) detach(win, attached)
    attached = undefined
    attachedId = undefined
    const next = enabled()[0]
    selectedId = next?.id
    if (!next) return
    saveSelected(dir, next.id)
    show(win, next, pushSleep)
  }
  gipc.handle('services:set', (_e: unknown, serviceId: string, on: boolean) => {
    if (typeof serviceId !== 'string') return snapshot()
    disabled = new Set(setServiceEnabled(dir, serviceId, !!on))
    reconcile()
    return snapshot()
  })
  // Drag reorder (D28): a bad id list is ignored and the current snapshot returned.
  gipc.handle('accounts:reorder', (_e: unknown, ids: unknown) => {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return snapshot()
    try {
      accounts = orderedAccounts(reorderAccounts(dir, ids))
    } catch (err) {
      console.error('reorder failed:', err)
    }
    push()
    return snapshot()
  })
  gipc.handle('accounts:policy', (_e: unknown, id: string, policy: string) => {
    if (!accounts.some((a) => a.id === id) || !IDLE_POLICIES.includes(policy)) return snapshot()
    accounts = orderedAccounts(setIdlePolicy(dir, id, policy))
    const held = owner.get(views.get(id)?.webContents.id ?? -1)
    if (held) held.idlePolicy = policy
    return snapshot()
  })
  const clearStorage = async (id: string) => {
    const ses = session.fromPartition(`persist:${id}`)
    await ses.clearStorageData().catch(() => {})
    await ses.clearCache().catch(() => {})
  }
  gipc.handle('accounts:logout', async (_e: unknown, id: string) => {
    const a = accounts.find((x) => x.id === id)
    if (!a) return snapshot()
    await logOut(dir, id, {
      clearStorage,
      closeView: () => {},
      reloadView: () => {
        const preset = presetFor(a.serviceId)
        void views.get(id)?.webContents.loadURL(preset?.startUrl ?? a.custom?.url ?? 'about:blank')
      }
    })
    return snapshot()
  })
  gipc.handle('accounts:remove', async (_e: unknown, id: string) => {
    if (!accounts.some((a) => a.id === id)) return snapshot()
    try {
      await removeAccount(dir, id, {
        clearStorage,
        reloadView: () => {},
        closeView: () => {
          const v = views.get(id)
          if (!v) return
          if (attached === v) {
            detach(win, v)
            attached = undefined
            attachedId = undefined
          }
          owner.delete(v.webContents.id)
          views.delete(id)
          v.webContents.close()
        }
      })
    } catch (err) {
      console.error('remove account failed:', err)
    }
    accounts = orderedAccounts(loadAccounts(dir))
    delete counts[id]
    delete sleepState[id]
    reconcile()
    push()
    pushSleep()
    return snapshot()
  })
  gipc.on('sidebar:set', (e: { sender: { id: number } }, c: unknown) => fromApp(e) && setSidebar(!!c))
  // Reload (top bar): an asleep account wakes through the normal show path, otherwise its view reloads.
  gipc.on('accounts:reload', (e: { sender: { id: number } }, id: string) => {
    const a = fromApp(e) && enabled().find((x) => x.id === id)
    if (!a) return
    if (hib.isAsleep(a.id)) show(win, a, pushSleep)
    else views.get(a.id)?.webContents.reload()
  })
  // Sleep now (D27): works on any account; minutes 0 marks it manual. The selected one is detached so the asleep panel shows.
  gipc.on('accounts:sleep', (e: { sender: { id: number } }, id: string) => {
    const a = fromApp(e) && enabled().find((x) => x.id === id)
    if (!a || hib.isAsleep(a.id)) return
    if (attachedId === a.id && attached) {
      detach(win, attached)
      attached = undefined
      attachedId = undefined
    }
    hib.sleep(a.id)
    sleepAccount(a, 0)
    pushSleep()
  })
  gipc.on('ui:dialog', (_e: unknown, open: boolean) => setDialog(win, !!open))
  gipc.handle('accounts:mute', (_e: unknown, id: string, muted: boolean) => {
    if (!accounts.some((a) => a.id === id)) return snapshot()
    accounts = orderedAccounts(setMuted(dir, id, !!muted))
    // The notification path reads the Account captured when the view was built: keep it current.
    const held = owner.get(views.get(id)?.webContents.id ?? -1)
    if (held) held.muted = !!muted
    return snapshot()
  })
  gipc.handle('accounts:add', async (_e: unknown, input: any) => {
    const v = validateNewAccount(input)
    if (!v.ok) return { error: v.error }
    const icon = v.value.custom ? await cacheFavicon(dir, v.value.custom.url, fetchSite) : undefined
    const account = addAccount(dir, input, icon)
    accounts = orderedAccounts(loadAccounts(dir))
    selectedId = account.id
    saveSelected(dir, account.id)
    show(win, account, pushSleep)
    return snapshot()
  })
  gipc.on('accounts:select', (_e: unknown, id: string) => {
    const a = enabled().find((x) => x.id === id)
    if (!a) return
    selectedId = id
    saveSelected(dir, id)
    show(win, a, pushSleep)
  })
  const selectFromNotification = (a: Account) => {
    win.show()
    win.focus()
    if (!isUnlocked() || disabled.has(a.serviceId)) return // a click while locked only raises the window
    selectedId = a.id
    saveSelected(dir, a.id)
    show(win, a, pushSleep)
    win.webContents.send('accounts:selected', a.id)
  }
  ipcMain.removeAllListeners('notify:show')
  ipcMain.on('notify:show', (e, p) => {
    const a = owner.get(e.sender.id)
    if (a && p && typeof p === 'object') notify(win, a, p, () => selectFromNotification(a))
  })
  // Dev-only: GUISEDESK_FAKE_NOTIFY=<account id> fires one fake notification 4 s after load.
  const fake = accounts.find((a) => a.id === process.env.GUISEDESK_FAKE_NOTIFY)
  if (fake)
    win.webContents.once('did-finish-load', () =>
      setTimeout(() => notify(win, fake, { title: 'Alice', body: 'Lunch at 12?' }, () => selectFromNotification(fake)), 4000)
    )
  const first = accounts.find((a) => a.id === selectedId)
  if (first && !hib.isAsleep(first.id)) show(win, first, pushSleep)
  win.on('resize', () => attached?.setBounds(panelBounds(win)))

  const shot = process.env.GUISEDESK_SHOT
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage()
          // Service views are separate surfaces: paste the selected one into the content panel, and save it raw next to it.
          if (attached && !dialogOpen && isUnlocked()) {
            const v = await attached.webContents.capturePage()
            writeFileSync(shot.replace(/\.png$/, '') + '-view.png', v.toPNG())
            const b = attached.getBounds()
            const sw = image.getSize()
            const k = sw.width / win.getContentSize()[0]
            // HiDPI: the window capture is k times the DIP size; bring the view capture to the same scale before pasting.
            const tw = Math.round(b.width * k)
            const th = Math.round(b.height * k)
            const scaled = v.getSize().width === tw ? v : v.resize({ width: tw, height: th, quality: 'best' })
            const vs = scaled.getSize()
            const c = overlay(
              { ...sw, data: image.toBitmap() },
              { ...vs, data: scaled.toBitmap() },
              Math.round(b.x * k),
              Math.round(b.y * k)
            )
            writeFileSync(shot, nativeImage.createFromBitmap(c.data, { width: c.width, height: c.height }).toPNG())
          } else writeFileSync(shot, image.toPNG())
        } finally {
          app.quit()
        }
      }, 3000)
    })
  }
  return win
}

app.whenReady().then(createWindow)
app.on('before-quit', () => {
  quitting = true
})
