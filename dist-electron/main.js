import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let sourceSelectorWindow = null;
let selectedSource = null;
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
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.setResizable(false);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
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
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"), {
      query: { windowType: "editor" }
    });
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
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  if (VITE_DEV_SERVER_URL) {
    sourceSelectorWindow.loadURL(VITE_DEV_SERVER_URL + "?windowType=source-selector");
  } else {
    sourceSelectorWindow.loadFile(path.join(RENDERER_DIST, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return sourceSelectorWindow;
}
function createWindow() {
  createHudOverlayWindow();
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("get-sources", async (_, opts) => {
  const sources = await desktopCapturer.getSources(opts);
  const processedSources = sources.map((source) => ({
    id: source.id,
    name: source.name,
    display_id: source.display_id,
    thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null
  }));
  return processedSources;
});
ipcMain.handle("select-source", (_, source) => {
  selectedSource = source;
  if (sourceSelectorWindow) {
    sourceSelectorWindow.close();
    sourceSelectorWindow = null;
  }
  return selectedSource;
});
ipcMain.handle("get-selected-source", () => {
  return selectedSource;
});
ipcMain.handle("open-source-selector", () => {
  if (sourceSelectorWindow) {
    sourceSelectorWindow.focus();
    return;
  }
  createSourceSelectorWindow();
});
ipcMain.handle("switch-to-editor", () => {
  if (win) {
    win.close();
    win = null;
  }
  createEditorWindow();
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
