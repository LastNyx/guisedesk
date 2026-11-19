import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { dataDir } from './paths'
import { loadAccounts, loadSelected, orderedAccounts, saveSelected, type Account } from './accounts'
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
  if (attached) win.contentView.removeChildView(attached)
  attached = viewFor(a)
  win.contentView.addChildView(attached)
  attached.setBounds(panelBounds(win))
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
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))

  const accounts = orderedAccounts(loadAccounts(dir))
  let selectedId = loadSelected(dir)
  if (!accounts.some((a) => a.id === selectedId)) selectedId = accounts[0]?.id
  ipcMain.removeHandler('accounts:state')
  ipcMain.handle('accounts:state', () => ({ accounts, selectedId }))
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
          writeFileSync(shot, image.toPNG())
          // Service views are separate surfaces: save the selected one next to it.
          if (attached) {
            const v = await attached.webContents.capturePage()
            writeFileSync(shot.replace(/\.png$/, '') + '-view.png', v.toPNG())
          }
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
