// App UI bridge.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('guisedesk', {
  state: () => ipcRenderer.invoke('accounts:state'),
  select: (id: string) => ipcRenderer.send('accounts:select', id)
})
