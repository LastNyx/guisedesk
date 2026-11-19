import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, nativeImage, WebContentsView } from 'electron'
import { dataDir } from './paths'
import { addAccount, loadAccounts, loadSelected, orderedAccounts, saveSelected, type Account } from './accounts'
import { overlay } from './composite'
import { cacheFavicon, readIcon, type Fetcher } from './favicon'
import { validateNewAccount } from './validate'
import { presetFor, CHROME_UA } from './presets'

// Must run before `ready` so sessions and partitions land in the chosen dir.
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

/** One request to the site for its favicon (Custom URL accounts only, once per host). */
const fetchSite: Fetcher = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!r.ok) return null
  const bytes = new Uint8Array(await r.arrayBuffer())
  return bytes.length > 512 * 1024 ? null : { contentType: r.headers.get('content-type') ?? '', bytes }
}

function viewFor(a: Account): WebContentsView {
  let v = views.get(a.id)
  if (!v) {
    v = new WebContentsView({
      webPreferences: { partition: `persist:${a.id}`, sandbox: true, contextIsolation: true }
    })
    const preset = presetFor(a.serviceId)
    v.webContents.setUserAgent(preset?.userAgent ?? CHROME_UA)
    v.webContents.loadURL(preset?.startUrl ?? a.custom?.url ?? 'about:blank')
    views.set(a.id, v)
  }
  return v
}

function show(win: BrowserWindow, a: Account): void {
  if (attached && !dialogOpen) win.contentView.removeChildView(attached)
  attached = viewFor(a)
  if (dialogOpen) return
  win.contentView.addChildView(attached)
  attached.setBounds(panelBounds(win))
}

function setDialog(win: BrowserWindow, open: boolean): void {
  if (open === dialogOpen) return
  dialogOpen = open
  if (!attached) return
  if (open) win.contentView.removeChildView(attached)
  else {
    win.contentView.addChildView(attached)
    attached.setBounds(panelBounds(win))
  }
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
  ipcMain.removeAllListeners('ui:dialog')
  ipcMain.on('ui:dialog', (_e, open: boolean) => setDialog(win, !!open))
  ipcMain.removeHandler('accounts:add')
  ipcMain.handle('accounts:add', async (_e, input) => {
    const v = validateNewAccount(input)
    if (!v.ok) return { error: v.error }
    const icon = v.value.custom ? await cacheFavicon(dir, v.value.custom.url, fetchSite) : undefined
    const account = addAccount(dir, input, icon)
    accounts = orderedAccounts(loadAccounts(dir))
    selectedId = account.id
    saveSelected(dir, account.id)
    show(win, account)
    return snapshot()
  })
  ipcMain.removeAllListeners('accounts:select')
  ipcMain.on('accounts:select', (_e, id: string) => {
    const a = accounts.find((x) => x.id === id)
    if (!a) return
    selectedId = id
    saveSelected(dir, id)
    show(win, a)
  })
  const first = accounts.find((a) => a.id === selectedId)
  if (first) show(win, first)
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
app.on('window-all-closed', () => app.quit())
