const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { v4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const markdownit = require('markdown-it');
const { app, dialog, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { version } = require('./package.json');
const { MenuTemplate } = require('./src/js/menu');
const { isOlderThan, merge } = require('./src/js/utils');
const { parseDictionary, formSentence } = require('./src/js/dictionary');

const SRC_DIR = path.join(__dirname, './src');
const PUB_DIR = path.join(__dirname, './public');
const SIB_DIR = process.env.PORTABLE_EXECUTABLE_DIR ?? __dirname;
const VERSION = version ?? '0.0.0';

// indexed by UUID
/** @type {Map<string, WordBank>} */
const BANK_MAP = new Map();
const NEW_BANK = 'New Word Bank'

/**
 * @typedef {Object} WordBank
 * @property {string} uuid
 * @property {string} name
 * @property {string} path
 * @property {number} delay
 * @property {Map<string, string[]} words
 */

const SETTINGS_FILE_PATH = path.join(SIB_DIR ,`settings.json`);
let settings = {
    tempPath: SRC_DIR,
    settingsPath: SETTINGS_FILE_PATH,
    port: 8095,
    /** @type {WordBank[]} */
    banks: []
}

function save(data) {
    console.log("Saving...");
    settings = merge(settings, data)
    settings.banks = [...[...BANK_MAP.values()].map(val =>  { 
        return {
            uuid: val.uuid,
            name: val.name,
            path: val.path,
            delay: val.delay,
        }
    })];
    console.log(settings);
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings));
}

async function loadGlobalSettings() {
    console.log("Loading...");
    const data = fs.existsSync(SETTINGS_FILE_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH).toString()) : {};
    settings = merge(settings, data);
    const banks = [...settings.banks]
    if(banks.length <= 0){
        createWordBank()
    }else{
        for(const bank of banks){
            createWordBank(bank);
        }
    }
    save(settings);
}

/**
 * Creates a new Word Bank and loads it into memory.
 * @param {WordBank} bankData - Data about the bank. Blank fields will be populated automatically.
 */
function createWordBank(bankData){
    const data = bankData ?? {};
    const uuid = data.uuid ?? v4();
    const name = data.name ?? NEW_BANK;
    const delay = data.delay ?? 500;
    console.log(`Creating word bank '${data.name}' from path: ${data.path} with UUID ${data.uuid}`)
    const dict = data.path ? parseDictionary(data.path) : new Map();
    console.log(`Bank has ${dict.size} words.`);
    BANK_MAP.set(uuid, {
        uuid: uuid,
        name: name,
        path: data.path,
        delay: delay,
        words: dict
    });
    return BANK_MAP.get(uuid);
}

/**
 * 
 * @param {string} name - Bank to find by UUID
 * @returns {WordBank} - Found bank. Undefined if no such bank exists.
 */
function getWordBankByUuid(uuid){
    return BANK_MAP.get(uuid);
}


async function launchBackend() {
    await loadGlobalSettings();
    const expressServer = express();
    expressServer.use(express.json());
    expressServer.use('/', express.static(PUB_DIR));
    expressServer.set('trust proxy', true);

    // Makes an http server out of the express server
    const httpServer = http.createServer(expressServer);
    // Starts the http server
    const server = httpServer.listen(settings.port, () => {
        // code to execute when the server successfully starts
        console.log(`App version: ${VERSION} started on ${settings.port}`);
    });

    // Websocket API
    const wsServer = new WebSocket.Server({server: httpServer, path:'/'});
    wsServer.on('connection', (ws) => {
        console.log('connection!');
    });

    wsServer.on('close', (ws) => {
        console.log('connection closed!');
    });

    const sendToWsClients = (data) => {
        wsServer.clients.forEach(client => {
            client.send(
                JSON.stringify(data)
            );
        });
    }

    // Express Webserver API
    expressServer.get(['/',], async (req, res) => {
        res.status(200).sendFile(path.join(PUB_DIR, 'ui.html'));
        return;
    });

    expressServer.get(['/source', '/player', '/speaker'], async (req, res) => {
        res.status(200).sendFile(path.join(PUB_DIR, 'speaker.html'));
        return;
    });

    expressServer.get(['/readme'], async (req, res) => {
        const readme = fs.readFileSync(path.join(PUB_DIR, "..", "README.md")).toString();
        const md = markdownit()
        res.setHeader("Content-Type", "text/html");
        res.status(200).send(
            `<html>
                <link rel="stylesheet" type="text/css" href='/css/readme.css'>
                ${md.render(readme)}
            </html>`);
        return;
    });

    expressServer.get(['/version',], async (req, res) => {
        let url = undefined;
        const newVersion = await fetch('https://www.skeletom.net/word-salad/version', {
            method: "GET",
        });
        if(newVersion.status >= 200 && newVersion.status < 400){
            const parsed = await newVersion.json();
            if(isOlderThan(VERSION, parsed.version)){
                url = parsed.url;
            }
        }
        res.status(200).send({
            version: VERSION,
            url: url
        });
        return;
    });

    expressServer.post(['/save/global'], async (req, res) => {
        if(req.body){
            save(req.body);
            if(req.body.port){
                res.status(200).send();
                // reboot backend
                console.log("closing http server...");
                server.closeAllConnections();
                server.close(async () => {
                    console.log("closing websocket server...");
                    wsServer.close(async () => {
                        await launchBackend();
                    });
                });
            }
        }else{
            res.status(400).send();
            return;
        }
    });

    expressServer.post(['/save/bank'], async (req, res) => {
        if(req.body && req.body.uuid){
                const bank = BANK_MAP.get(req.body.uuid)
                if(bank){
                    BANK_MAP.set(req.body.uuid, merge(bank, req.body));
                    save(settings);
                    res.status(200).send();
                    return;
                }else{
                    res.status(400).send();
                    return;
                }
        }else{
            res.status(400).send();
            return;
        }
    });

    expressServer.post(['/delete/bank',], async (req, res) => {
        if(req.body && req.body.uuid){
            BANK_MAP.delete(req.body.uuid);
            save(settings);
            res.status(200).send();
            return;
        }else{
            res.status(400).send();
            return;
        }
    });

    expressServer.post(['/create/bank',], async (req, res) => {
        createWordBank();
        save(settings);
        res.status(200).send();
        return;
    });

    expressServer.get(['/load',], async (req, res) => {
        res.status(200).send(settings);
        return;
    });

    // get bank data
    expressServer.get(['/banks/:uuid',], async (req, res) => {
        if(req.params && req.params.uuid){
            const bank = getWordBankByUuid(req.params.uuid)
            // console.log(bank);
            if(bank){
                res.status(200).send(bank);
                return;
            }
        }
        res.status(400).send([]);
        return;
    });

    // get list of all words
    expressServer.get(['/banks/:uuid/words',], async (req, res) => {
        if(req.params && req.params.uuid){
            const bank = getWordBankByUuid(req.params.uuid)
            if(bank){
                // refresh
                const updated = createWordBank(bank);
                console.log(`Bank contains ${updated.words.size} words!`);
                res.status(200).send([...updated.words.keys()]);
                return;
            }
        }
        res.status(400).send([]);
        return;
    });

    // get specific word file
    expressServer.get(['/banks/:uuid/word',], async (req, res) => {
        if(req.params && req.params.uuid && req.query.path){
            const bank = getWordBankByUuid(req.params.uuid);
            if(bank){
                const filePath = path.join(bank.path, req.query.path);
                console.log(`Looking for: ${filePath}`);
                res.status(200).sendFile(filePath);
                return;
            }
        }
        res.status(404).send();
        return;
    });

    expressServer.get(['/speak',], async (req, res) => {
        if(req.query && req.query.phrase && req.query.bank){
            console.log(`Attempting to say: ${req.query.phrase}`);
            const bank = getWordBankByUuid(req.query.bank);
            if(bank){
                const commands = formSentence(req.query.phrase, bank.delay, bank.words);
                sendToWsClients({ 
                    bank: bank.uuid,
                    commands: commands 
                });
                res.status(200).send();
                return;
            }
        }
        res.status(400).send();
        return;
    });

    return server;
}

async function launchFrontend(){
    await launchBackend();
    // Electron API
    app.whenReady().then(() => {
        ipcMain.on('selectDirectory', async (event) => {
            const dir = await dialog.showOpenDialog({ properties: ['openDirectory']});
            if(!dir.canceled && dir.filePaths.length > 0){
                // console.log(dir);
                event.returnValue = dir.filePaths[0];
            }else{
                event.returnValue = undefined;
            }
        });
        const win = new BrowserWindow({
            width: 400,
            height: 640,
            webPreferences: {
              preload: path.join(SRC_DIR, 'js', 'bridge.js')
            }
        })
        win.webContents.setWindowOpenHandler(({ url }) => {
            // if(url.startsWith('http://localhost')){
            //     return { action: 'allow' }
            // }
            shell.openExternal(url);
            return { action: 'deny' };
        });
        const menu = Menu.buildFromTemplate(MenuTemplate(() => {
            return settings.port;
        }));
        Menu.setApplicationMenu(menu)
        win.loadURL(`http://localhost:${settings.port}/`)
        // win.webContents.send('load-settings', {
        //     port: port
        // });
    });

    app.on('window-all-closed', () => {
        app.quit();   
    });
}

launchFrontend();