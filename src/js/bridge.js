const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: async(context) => {
        return ipcRenderer.sendSync("selectDirectory");
    }
});

ipcRenderer.on('load-settings', (event, message) => {
    console.log(`Setting port to ${PORT}`);
});