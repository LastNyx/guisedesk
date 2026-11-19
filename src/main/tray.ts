// Tray glue (D4): plain and red-dot icon, menu from traymenu.ts.
import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { trayTemplate } from './traymenu'

const icon = (name: string) => nativeImage.createFromPath(join(__dirname, '../../resources', name))

export function createTray(onShow: () => void, dnd: boolean, onDnd: (on: boolean) => void): { setUnread(total: number): void } {
  const tray = new Tray(icon('tray.png'))
  tray.setToolTip('GuiseDesk')
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate({ dnd, onShow, onDnd, onQuit: () => app.quit() })))
  tray.on('click', onShow)
  return {
    setUnread(total) {
      tray.setImage(icon(total > 0 ? 'tray-dot.png' : 'tray.png'))
      tray.setToolTip(total > 0 ? `GuiseDesk (${total} unread)` : 'GuiseDesk')
    }
  }
}
