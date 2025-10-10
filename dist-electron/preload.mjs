"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  }
});
