const { app, Menu} = require('electron')

const isMac = process.platform === 'darwin'
/**
 * @param {Electron.Shell} shell 
 * @param {Promise<number>} getPort 
 * @returns {Menu}
 */
const template = (shell, getPort) => [
    // { role: 'appMenu' }
    ...(isMac
        ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }]
        : []),
    {
        role: 'fileMenu',
        label: 'File',
        submenu: [
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    {
        role: 'viewMenu',
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    {
        role: 'help',
        label: 'Help',
        submenu: [
            {
                label: 'Setup Guide',
                click: async () => {
                    await shell.openExternal(`http://localhost:${await getPort()}/readme`)
                }
            },
            {
                label: 'GitHub Repo',
                click: async () => {
                    await shell.openExternal('https://github.com/FomTarro/word-salad')
                }
            },
            {
                label: 'Contact',
                click: async () => {
                    await shell.openExternal('https://skeletom.net')
                }
            }
        ]
    }
]

module.exports.menuTemplate = template;