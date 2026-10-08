// Sandboxed preload: must be plain CommonJS (Electron's sandbox cannot load TS/ESM preloads).
// The ONLY surface exposed to the web app is the native folder picker (D-02: all other
// app traffic stays HTTP). Consumed by the media-root setting in Plan 07.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eigen', {
  chooseFolder: () => ipcRenderer.invoke('eigen:choose-folder'),
})
