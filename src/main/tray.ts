// Tray glue (D4): plain and red-dot icon, menu from traymenu.ts.
import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { trayLook, trayTemplate } from './traymenu'

const icon = (name: string) => nativeImage.createFromPath(join(__dirname, '../../resources', name))

export function createTray(onShow: () => void, onLock: () => void, onSettings: () => void, dnd: boolean, onDnd: (on: boolean) => void): { setUnread(total: number, locked: boolean): void } {
  const tray = new Tray(icon('tray.png'))
  tray.setToolTip('GuiseDesk')
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate({ dnd, onLock, onShow, onSettings, onDnd, onQuit: () => app.quit() })))
  tray.on('click', onShow)
  return {
    setUnread(total, locked) {
      const look = trayLook(total, locked)
      tray.setImage(icon(look.icon))
      tray.setToolTip(look.tooltip)
    }
  }
}
