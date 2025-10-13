import { BrowserWindow, screen, ipcMain, desktopCapturer, app } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { uIOhook } from "uiohook-napi";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST$1 = path.join(APP_ROOT, "dist");
function createHudOverlayWindow() {
  const win = new BrowserWindow({
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
  }
  return win;
}
function createEditorWindow() {
  const win = new BrowserWindow({
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "editor" }
    });
  }
  return win;
}
function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
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
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return win;
}
let isMouseTrackingActive = false;
let isHookStarted = false;
function startMouseTracking() {
  if (isMouseTrackingActive) {
    console.log("⚠️ Mouse tracking already active");
    return { success: false, message: "Already tracking" };
  }
  console.log("🎯 Starting mouse tracking...");
  isMouseTrackingActive = true;
  if (!isHookStarted) {
    setupMouseEventListeners();
    try {
      uIOhook.start();
      isHookStarted = true;
      console.log("✅ Mouse tracking started successfully");
      console.log('💡 If you see "Accessibility API is disabled" error:');
      console.log("   Go to System Settings → Privacy & Security → Accessibility");
      console.log("   Enable permissions for Electron/Terminal/VS Code");
      return { success: true, message: "Mouse tracking started" };
    } catch (error) {
      console.error("❌ Failed to start mouse tracking:", error);
      isMouseTrackingActive = false;
      return { success: false, message: "Failed to start hook", error };
    }
  } else {
    console.log("✅ Mouse tracking resumed");
    return { success: true, message: "Mouse tracking resumed" };
  }
}
function stopMouseTracking() {
  if (!isMouseTrackingActive) {
    console.log("⚠️ Mouse tracking not active");
    return { success: false, message: "Not currently tracking" };
  }
  console.log("🛑 Stopping mouse tracking...");
  isMouseTrackingActive = false;
  console.log("✅ Mouse tracking stopped (events will still be captured but not logged)");
  return { success: true, message: "Mouse tracking stopped" };
}
function setupMouseEventListeners() {
  uIOhook.on("mousemove", (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE MOVE] x: ${e.x}, y: ${e.y}`);
    }
  });
  uIOhook.on("mousedown", (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE DOWN] x: ${e.x}, y: ${e.y}, button: ${e.button}, clicks: ${e.clicks}`);
    }
  });
  uIOhook.on("mouseup", (e) => {
    if (isMouseTrackingActive) {
      console.log(`[MOUSE UP] x: ${e.x}, y: ${e.y}, button: ${e.button}`);
    }
  });
  uIOhook.on("click", (e) => {
    if (isMouseTrackingActive) {
      console.log(`[CLICK] x: ${e.x}, y: ${e.y}, button: ${e.button}, clicks: ${e.clicks}`);
    }
  });
  uIOhook.on("wheel", (e) => {
    if (isMouseTrackingActive) {
      console.log(`[WHEEL] x: ${e.x}, y: ${e.y}, amount: ${e.amount}, direction: ${e.direction}, rotation: ${e.rotation}`);
    }
  });
}
function cleanupMouseTracking() {
  if (isHookStarted) {
    try {
      uIOhook.stop();
      isHookStarted = false;
      isMouseTrackingActive = false;
      console.log("🧹 Mouse tracking cleaned up");
    } catch (error) {
      console.error("Error cleaning up mouse tracking:", error);
    }
  }
}
let selectedSource = null;
function registerIpcHandlers(createEditorWindow2, createSourceSelectorWindow2, getMainWindow, getSourceSelectorWindow) {
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
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.close();
    }
    return selectedSource;
  });
  ipcMain.handle("get-selected-source", () => {
    return selectedSource;
  });
  ipcMain.handle("open-source-selector", () => {
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.focus();
      return;
    }
    createSourceSelectorWindow2();
  });
  ipcMain.handle("switch-to-editor", () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      mainWin.close();
    }
    createEditorWindow2();
  });
  ipcMain.handle("start-mouse-tracking", () => {
    return startMouseTracking();
  });
  ipcMain.handle("stop-mouse-tracking", () => {
    return stopMouseTracking();
  });
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
function createWindow() {
  mainWindow = createHudOverlayWindow();
}
function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  mainWindow = createEditorWindow();
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    cleanupMouseTracking();
    app.quit();
    mainWindow = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("will-quit", () => {
  cleanupMouseTracking();
});
app.whenReady().then(() => {
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow
  );
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
