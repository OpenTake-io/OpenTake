import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: async (opts: Electron.SourcesOptions) => {
    return await ipcRenderer.invoke('get-sources', opts)
  },
  switchToEditor: () => {
    return ipcRenderer.invoke('switch-to-editor')
  },
  openSourceSelector: () => {
    return ipcRenderer.invoke('open-source-selector')
  },
  selectSource: (source: any) => {
    return ipcRenderer.invoke('select-source', source)
  },
  getSelectedSource: () => {
    return ipcRenderer.invoke('get-selected-source')
  }
})