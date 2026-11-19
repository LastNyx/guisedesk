import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Notification, nativeImage, shell, WebContentsView } from 'electron'
import { dataDir } from './paths'
import { addAccount, loadAccounts, loadDnd, loadSelected, orderedAccounts, saveDnd, saveSelected, setMuted, type Account } from './accounts'
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

// Both must run before `ready`. setName first: it resets the default userData path, which setPath then overrides,
// so sessions and partitions still land in the chosen dir. The name is what notifications and the tray show.
app.setName('GuiseDesk')
app.setDesktopName('guisedesk.desktop')
const dir = dataDir(process.env, homedir())
mkdirSync(dir, { recursive: true })
app.setPath('userData', dir)

// Content panel inside the renderer layout (D26 compact): sidebar 232px, main padding 12/16/16/16.
const SIDE = 232
function panelBounds(win: BrowserWindow) {
  const [w, h] = win.getContentSize()
  return { x: SIDE + 16, y: 12, width: Math.max(0, w - SIDE - 32), height: Math.max(0, h - 28) }
}

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
// Which account a service view's webContents belongs to, for notification IPC.
const owner = new Map<number, Account>()
// Hibernation (D7): sleep = view destroyed, partition kept. sleepState feeds the sidebar (ZZ) and the asleep panel.
const hib = createHibernator(Date.now)
const sleepState: Record<string, { minutes: number; waking: boolean }> = {}
let attachedId: string | undefined
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
  wc.on('before-input-event', () => hib.touch(a.id))
  wc.on('page-title-updated', (_e, title) => {
    if (fakeCounts) return
    counts[a.id] = parseUnread(title, presetFor(a.serviceId))
    onCounts()
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
        preload: join(__dirname, '../preload/index.js'),
        additionalArguments: ['--gd-service']
      }
    })
    owner.set(v.webContents.id, a)
    const ses = v.webContents.session
    ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permissionAllowed(permission)))
    ses.setPermissionCheckHandler((_wc, permission) => permissionAllowed(permission))
    const preset = presetFor(a.serviceId)
    v.webContents.setUserAgent(preset?.userAgent ?? CHROME_UA)
    hookLinks(v, a)
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
    { muted: a.muted, dnd, asleep: hib.isAsleep(a.id) }
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
  if (win.isDestroyed() || dialogOpen || attached !== v || (attachedId && sleepState[attachedId]?.waking)) return
  win.contentView.addChildView(v)
  v.setBounds(panelBounds(win))
}

function show(win: BrowserWindow, a: Account, push: () => void): void {
  if (attached && !dialogOpen) win.contentView.removeChildView(attached)
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

function sleepAccount(a: Account): void {
  const v = views.get(a.id)
  if (v) {
    owner.delete(v.webContents.id)
    views.delete(a.id)
    v.webContents.close()
  }
  sleepState[a.id] = { minutes: limitMinutes(a) ?? 0, waking: false }
}

function setDialog(win: BrowserWindow, open: boolean): void {
  if (open === dialogOpen) return
  dialogOpen = open
  if (!attached) return
  if (open) win.contentView.removeChildView(attached)
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })
  // Dev-only: GUISEDESK_SHOT_DIALOG=add opens the Add account dialog for the screenshot.
  const dialogQuery = process.env.GUISEDESK_SHOT && process.env.GUISEDESK_SHOT_DIALOG === 'add' ? 'dialog=add' : ''
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL + (dialogQuery && `?${dialogQuery}`))
  else win.loadFile(join(__dirname, '../renderer/index.html'), { search: dialogQuery })

  const showWindow = () => {
    win.show()
    win.focus()
  }
  dnd = loadDnd(dir)
  const tray = createTray(showWindow, dnd, (on) => {
    dnd = on
    saveDnd(dir, on)
  })
  // Close hides to the tray; only quitting (tray Quit, session end) really closes.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    win.hide()
  })

  let accounts = orderedAccounts(loadAccounts(dir))
  let selectedId = loadSelected(dir)
  if (!accounts.some((a) => a.id === selectedId)) selectedId = accounts[0]?.id
  // Custom icons are cached files; the renderer gets them as data URLs.
  const snapshot = () => ({
    accounts: accounts.map((a) =>
      a.custom ? { ...a, custom: { ...a.custom, icon: readIcon(dir, a.custom.icon) } } : a
    ),
    selectedId
  })
  ipcMain.removeHandler('accounts:state')
  ipcMain.handle('accounts:state', snapshot)
  const push = () => {
    tray.setUnread(totalUnread(counts))
    if (!win.isDestroyed()) win.webContents.send('unread:update', counts)
  }
  const pushSleep = () => {
    if (!win.isDestroyed()) win.webContents.send('sleep:update', { ...sleepState })
  }
  ipcMain.removeHandler('sleep:get')
  ipcMain.handle('sleep:get', () => ({ ...sleepState }))
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
  ipcMain.removeHandler('unread:get')
  ipcMain.handle('unread:get', () => ({ ...counts }))
  push()
  ipcMain.removeAllListeners('ui:dialog')
  ipcMain.on('ui:dialog', (_e, open: boolean) => setDialog(win, !!open))
  ipcMain.removeHandler('accounts:mute')
  ipcMain.handle('accounts:mute', (_e, id: string, muted: boolean) => {
    if (!accounts.some((a) => a.id === id)) return snapshot()
    accounts = orderedAccounts(setMuted(dir, id, !!muted))
    // The notification path reads the Account captured when the view was built: keep it current.
    const held = owner.get(views.get(id)?.webContents.id ?? -1)
    if (held) held.muted = !!muted
    return snapshot()
  })
  ipcMain.removeHandler('accounts:add')
  ipcMain.handle('accounts:add', async (_e, input) => {
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
  ipcMain.removeAllListeners('accounts:select')
  ipcMain.on('accounts:select', (_e, id: string) => {
    const a = accounts.find((x) => x.id === id)
    if (!a) return
    selectedId = id
    saveSelected(dir, id)
    show(win, a, pushSleep)
  })
  const selectFromNotification = (a: Account) => {
    win.show()
    win.focus()
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
          if (attached && !dialogOpen) {
            const v = await attached.webContents.capturePage()
            writeFileSync(shot.replace(/\.png$/, '') + '-view.png', v.toPNG())
            const b = attached.getBounds()
            const sw = image.getSize()
            const k = sw.width / win.getContentSize()[0]
            const vs = v.getSize()
            const c = overlay(
              { ...sw, data: image.toBitmap() },
              { ...vs, data: v.toBitmap() },
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
