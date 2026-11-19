// App UI bridge.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('guisedesk', {
  state: () => ipcRenderer.invoke('accounts:state'),
  select: (id: string) => ipcRenderer.send('accounts:select', id),
  dialog: (open: boolean) => ipcRenderer.send('ui:dialog', open),
  add: (input: unknown) => ipcRenderer.invoke('accounts:add', input)
})
