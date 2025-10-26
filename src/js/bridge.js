const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: async(context) => {
        return ipcRenderer.sendSync("selectDirectory");
    },
    onSpeakCommand: async(callback) => {
        return ipcRenderer.on('onSpeakCommand', (event, ...args) => callback(...args))
    }
});

// ipcRenderer.on('load-settings', (event, message) => {
//     console.log(`Setting port to ${PORT}`);
// });