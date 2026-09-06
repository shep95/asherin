// Narrow, explicit bridge. The renderer gets storage, a pending queue, and two
// events — never node, never the filesystem, never the shell.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  getStore: () => ipcRenderer.invoke("store:get"),
  setStore: (patch) => ipcRenderer.invoke("store:set", patch),
  clearToken: () => ipcRenderer.invoke("store:clear-token"),
  writePending: (id, payload) => ipcRenderer.invoke("pending:write", id, payload),
  listPending: (limit) => ipcRenderer.invoke("pending:list", limit),
  countPending: () => ipcRenderer.invoke("pending:count"),
  donePending: (id) => ipcRenderer.invoke("pending:done", id),
  reportState: (state) => ipcRenderer.send("companion:state", state),
  onToggle: (fn) => ipcRenderer.on("companion:toggle", () => fn()),
  onPower: (fn) => ipcRenderer.on("companion:power", (_e, kind) => fn(kind)),
});
