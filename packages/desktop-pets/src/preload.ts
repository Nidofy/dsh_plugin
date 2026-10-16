/** Sandboxed Electron preload: only the pet IPC methods cross into its document. */
import { contextBridge, ipcRenderer } from 'electron'
if (location.protocol === 'dsh-app:' && location.hostname === 'app'
  && location.pathname.startsWith('/api/nidofy-pets/assets/pet/')) {
  contextBridge.exposeInMainWorld('nidofyPet', {
    invoke: (method: string, data?: object) => {
      if (!['pet_snapshot', 'pet_resource', 'pet_ready', 'pet_action'].includes(method)) return Promise.reject(Error('PET_ACTION_REFUSED'))
      return ipcRenderer.invoke('nidofy:pet', method, data)
    },
    listen: (name: string, listener: (event: { payload: unknown }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, key: string, payload: unknown): void => { if (name === key) listener({ payload }) }
      ipcRenderer.on('nidofy:pet-event', handler)
      return Promise.resolve(() => ipcRenderer.removeListener('nidofy:pet-event', handler))
    },
  })
}
