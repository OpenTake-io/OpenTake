"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  },
  switchToEditor: () => {
    return electron.ipcRenderer.invoke("switch-to-editor");
  }
});
