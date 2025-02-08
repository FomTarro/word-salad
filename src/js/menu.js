const { app, Menu, shell } = require('electron')

const isMac = process.platform === 'darwin'
/**
 * @param {*} getPort 
 * @returns {Menu}
 */
const template = (getPort) => [
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
    // { role: 'fileMenu' }
    {
        label: 'File',
        submenu: [
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    // { role: 'editMenu' }
    // {
    //     label: 'Edit',
    //     submenu: [
    //         { role: 'undo' },
    //         { role: 'redo' },
    //         { type: 'separator' },
    //         { role: 'cut' },
    //         { role: 'copy' },
    //         { role: 'paste' },
    //         ...(isMac
    //             ? [
    //                 { role: 'pasteAndMatchStyle' },
    //                 { role: 'delete' },
    //                 { role: 'selectAll' },
    //                 { type: 'separator' },
    //                 {
    //                     label: 'Speech',
    //                     submenu: [
    //                         { role: 'startSpeaking' },
    //                         { role: 'stopSpeaking' }
    //                     ]
    //                 }
    //             ]
    //             : [
    //                 { role: 'delete' },
    //                 { type: 'separator' },
    //                 { role: 'selectAll' }
    //             ])
    //     ]
    // },
    // { role: 'viewMenu' }
    {
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
    // { role: 'windowMenu' }
    // {
    //     label: 'Window',
    //     submenu: [
    //         { role: 'minimize' },
    //         { role: 'zoom' },
    //         ...(isMac
    //             ? [
    //                 { type: 'separator' },
    //                 { role: 'front' },
    //                 { type: 'separator' },
    //                 { role: 'window' }
    //             ]
    //             : [
    //                 { role: 'close' }
    //             ])
    //     ]
    // },
    {
        role: 'help',
        label: 'Help',
        submenu: [
            {
                label: 'Setup Guide',
                click: async () => {
                    await shell.openExternal(`http://localhost:${getPort()}/readme`)
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

module.exports.MenuTemplate = template;