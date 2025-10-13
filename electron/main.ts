import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let sourceSelectorWindow: BrowserWindow | null = null
let selectedSource: any = null

function createHudOverlayWindow() {
  win = new BrowserWindow({
    width: 250,
    height: 80,
    minWidth: 250,
    maxWidth: 250,
    minHeight: 80,
    maxHeight: 80,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })

  // Absolutely lock the size
  win.setResizable(false)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=hud-overlay')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'hud-overlay' } 
    })
  }
}

function createEditorWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + '?windowType=editor')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'editor' } 
    })
  }
}

function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  sourceSelectorWindow = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  sourceSelectorWindow.on('closed', () => {
    sourceSelectorWindow = null;
  });

  if (VITE_DEV_SERVER_URL) {
    sourceSelectorWindow.loadURL(VITE_DEV_SERVER_URL + '?windowType=source-selector');
  } else {
    sourceSelectorWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { 
      query: { windowType: 'source-selector' } 
    });
  }

  return sourceSelectorWindow;
}

function createWindow() {
  createHudOverlayWindow()
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

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

ipcMain.handle('select-source', (_, source) => {
  selectedSource = source
  if (sourceSelectorWindow) {
    sourceSelectorWindow.close();
    sourceSelectorWindow = null;
  }
  return selectedSource
})

ipcMain.handle('get-selected-source', () => {
  return selectedSource
})

ipcMain.handle('open-source-selector', () => {
  if (sourceSelectorWindow) {
    sourceSelectorWindow.focus();
    return;
  }
  createSourceSelectorWindow();
})

ipcMain.handle('switch-to-editor', () => {
  if (win) {
    win.close()
    win = null
  }
  createEditorWindow()
})

app.whenReady().then(createWindow)
