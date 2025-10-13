import { ipcMain, desktopCapturer, BrowserWindow } from 'electron'
import { startMouseTracking, stopMouseTracking } from './mouseTracking'

// Store selected source
let selectedSource: any = null

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null
) {
  // Get available desktop capturer sources
  ipcMain.handle('get-sources', async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts)
    const processedSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }))
    
    return processedSources
  })

  // Select a source for recording
  ipcMain.handle('select-source', (_, source) => {
    selectedSource = source
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.close()
    }
    return selectedSource
  })

  // Get the currently selected source
  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  // Open the source selector window
  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })

  // Switch from HUD overlay to editor window
  ipcMain.handle('switch-to-editor', () => {
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.close()
    }
    createEditorWindow()
  })

  // Start mouse tracking
  ipcMain.handle('start-mouse-tracking', () => {
    return startMouseTracking()
  })

  // Stop mouse tracking
  ipcMain.handle('stop-mouse-tracking', () => {
    return stopMouseTracking()
  })
}
