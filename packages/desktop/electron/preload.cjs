const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectSource: (sourceId) => ipcRenderer.send('screen-source-selected', sourceId),
  cancelSourcePicker: () => ipcRenderer.send('screen-source-cancelled'),
  isElectron: true,
});
