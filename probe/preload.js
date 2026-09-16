// WAYFINDER PROBE (ticket #5) — contextIsolation-safe bridge.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("probe", {
  echo: (payload) => ipcRenderer.invoke("probe:echo", payload),
  getUsers: () => ipcRenderer.invoke("probe:get-users"),
  getTasks: () => ipcRenderer.invoke("probe:get-tasks"),
  env: () => ipcRenderer.invoke("probe:env"),
});
