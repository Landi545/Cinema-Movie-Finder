// Jedyna brama interfejsu do Electron; kanały obsługuje desktop/main.cjs.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("cinema", {
  search: (input) => ipcRenderer.invoke("search", input),
  detail: (id) => ipcRenderer.invoke("detail", id),
  prices: (key) => ipcRenderer.invoke("prices", key),
  cancel: () => ipcRenderer.invoke("cancel"),
  openTicket: (url) => ipcRenderer.invoke("open-ticket", url),
  openMovie: (key) => ipcRenderer.invoke("open-movie", key),
  promote: () => ipcRenderer.invoke("promote"),
  getPromotions: () => ipcRenderer.invoke("get-promotions"),
  openPromotion: (id) => ipcRenderer.invoke("open-promotion", id),
  quit: () => ipcRenderer.invoke("quit"),
});
