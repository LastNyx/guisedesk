// Tray glue (D4): plain and red-dot icon, menu Show GuiseDesk / Settings / Quit.
import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'

const icon = (name: string) => nativeImage.createFromPath(join(__dirname, '../../resources', name))

export function createTray(onShow: () => void): { setUnread(total: number): void } {
  const tray = new Tray(icon('tray.png'))
  tray.setToolTip('GuiseDesk')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show GuiseDesk', click: onShow },
      { label: 'Settings', click: onShow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
  tray.on('click', onShow)
  return {
    setUnread(total) {
      tray.setImage(icon(total > 0 ? 'tray-dot.png' : 'tray.png'))
      tray.setToolTip(total > 0 ? `GuiseDesk (${total} unread)` : 'GuiseDesk')
    }
  }
}
