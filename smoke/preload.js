const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("smoke", {
  echo: (msg) => ipcRenderer.invoke("smoke:echo", msg),
  env: () => ({
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  }),
});
