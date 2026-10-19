// Jedyna brama interfejsu do Electron; kanały obsługuje desktop/main.cjs.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cinema', {
  search: input => ipcRenderer.invoke('search', input),
  detail: id => ipcRenderer.invoke('detail', id),
  cancel: () => ipcRenderer.invoke('cancel'),
  openTicket: url => ipcRenderer.invoke('open-ticket', url),
  promote: () => ipcRenderer.invoke('promote'),
  quit: () => ipcRenderer.invoke('quit')
});
