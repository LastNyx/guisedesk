// Tray glue (D4): plain and red-dot icon, menu from traymenu.ts.
import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { trayLook, trayTemplate } from './traymenu'

const icon = (name: string) => nativeImage.createFromPath(join(__dirname, '../../resources', name))

export function createTray(onShow: () => void, onLock: () => void, onSettings: () => void, dnd: boolean, onDnd: (on: boolean) => void): { setUnread(total: number, locked: boolean): void; setDnd(on: boolean): void } {
  const tray = new Tray(icon('tray.png'))
  tray.setToolTip('GuiseDesk')
  const menu = (on: boolean) => tray.setContextMenu(Menu.buildFromTemplate(trayTemplate({ dnd: on, onLock, onShow, onSettings, onDnd, onQuit: () => app.quit() })))
  menu(dnd)
  tray.on('click', onShow)
  return {
    // Settings changed Do Not Disturb: rebuild the menu so the checkbox follows.
    setDnd: menu,
    setUnread(total, locked) {
      const look = trayLook(total, locked)
      tray.setImage(icon(look.icon))
      tray.setToolTip(look.tooltip)
    }
  }
}
