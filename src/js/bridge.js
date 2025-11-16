const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: async(context) => {
        return ipcRenderer.sendSync("selectDirectory");
    },

    log: async(context) => {
        return ipcRenderer.sendSync("log", context);
    },

    warn: async(context) => {
        return ipcRenderer.sendSync("warn", context);
    },

    error: async(context) => {
        return ipcRenderer.sendSync("error", context);
    },

    onSpeakStart: async(context) => {
        return ipcRenderer.sendSync("onSpeakStart");
    },

    onSpeakStop: async(context) => {
        return ipcRenderer.sendSync("onSpeakStop");
    },

    onSpeakCommand: async(callback) => {
        return ipcRenderer.on("onSpeakCommand", (event, ...args) => callback(...args))
    },
    onLog: async(callback) => {
        return ipcRenderer.on("onLog", (event, ...args) => callback(...args))
    }
});

// ipcRenderer.on('load-settings', (event, message) => {
//     console.log(`Setting port to ${PORT}`);
// });