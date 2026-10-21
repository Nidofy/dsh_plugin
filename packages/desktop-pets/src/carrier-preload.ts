/** App-only notification bridge. It exposes no native command or Host credentials. */
import { contextBridge, ipcRenderer } from 'electron'
if (process.isMainFrame && location.protocol === 'dsh-app:' && location.hostname === 'app'
  && (location.pathname === '/' || location.pathname === '/index.html')) {
  contextBridge.exposeInMainWorld('nidofyPetDesktop', {
    protocolVersion: 1,
    onNavigate(listener: (sessionId: string) => void) {
      const handle = (_event: Electron.IpcRendererEvent, sessionId: unknown): void => {
        if (typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 1024) listener(sessionId)
      }
      ipcRenderer.on('nidofy:pet-navigate', handle)
      return () => ipcRenderer.removeListener('nidofy:pet-navigate', handle)
    },
  })
}
