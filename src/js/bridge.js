const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    saveSetting: (setting) => { 
        ipcRenderer.send('save-settings', setting); 
    }
});

ipcRenderer.on('load-settings', (event, message) => {
    console.log(`Setting port to ${PORT}`);
});