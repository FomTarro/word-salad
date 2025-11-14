const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const showdown = require('showdown');
const { v4 } = require('uuid');
const { app, dialog, BrowserWindow, ipcMain, shell, Menu, powerSaveBlocker} = require('electron');
const { version } = require('./package.json');
const { menuTemplate } = require('./src/js/menu');
const { isOlderThan, merge } = require('./src/js/utils');
const { parseDictionary, formSentence, Command } = require('./src/js/dictionary');

const SRC_DIR = path.join(__dirname, './src');
const PUB_DIR = path.join(__dirname, './public');
const SIB_DIR = process.env.PORTABLE_EXECUTABLE_DIR ?? __dirname;
const VERSION = version ?? '0.0.0';

/**
 * @typedef {Object} WordBank
 * @property {string} uuid
 * @property {string} name
 * @property {string} path
 * @property {number} delay
 * @property {Map<string, string[]} words
 */

// indexed by UUID
/** @type {Map<string, WordBank>} */
const BANK_MAP = new Map();
const NEW_BANK = 'New Word Bank'

/**
 * @callback OnSpeakCallback
 * @param {Command} command - The speak command passed to the callback.
 */

/** @type {OnSpeakCallback[]} */
const ON_SPEAK_CALLBACKS = [];

const SETTINGS_FILE_PATH = path.join(SIB_DIR ,`settings.json`);
let SETTINGS = {
    tempPath: SRC_DIR,
    settingsPath: SETTINGS_FILE_PATH,
    port: 8095,
    volumeMaster: 1,
    /** @type {WordBank[]} */
    banks: []
}

const save = (data) => {
    console.log("Saving...");
    SETTINGS = merge(SETTINGS, data)
    SETTINGS.banks = [...[...BANK_MAP.values()].map(val =>  { 
        return {
            uuid: val.uuid,
            name: val.name,
            path: val.path,
            delay: val.delay,
        }
    })];
    console.log(SETTINGS);
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(SETTINGS));
}

const loadGlobalSettings = () => {
    console.log("Loading...");
    const data = fs.existsSync(SETTINGS_FILE_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH).toString()) : {};
    SETTINGS = merge(SETTINGS, data);
    const banks = [...SETTINGS.banks];
    if(banks.length <= 0){
        createWordBank();
    }else{
        for(const bank of banks){
            createWordBank(bank);
        }
    }
    save(SETTINGS);
}

/**
 * Creates a new Word Bank and loads it into memory.
 * @param {WordBank} bankData - Data about the bank. Blank fields will be populated automatically.
 */
const createWordBank = (bankData) => {
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
const getWordBankByUuid = (uuid) => {
    return BANK_MAP.get(uuid);
}

const launchBackend = () => {
    loadGlobalSettings();
    const expressServer = express();
    expressServer.use(express.json());
    expressServer.use('/', express.static(PUB_DIR));
    expressServer.set('trust proxy', true);

    // Makes an http server out of the express server
    const httpServer = http.createServer(expressServer);
    // Starts the http server
    const server = httpServer.listen(SETTINGS.port, () => {
        // code to execute when the server successfully starts
        console.log(`App version: ${VERSION} started on ${SETTINGS.port}`);
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

    ON_SPEAK_CALLBACKS.push(sendToWsClients);

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
        const md = new showdown.Converter({
            metadata: false,
        });
        res.setHeader("Content-Type", "text/html");
        res.status(200).send(
            `<html>
                <link rel="stylesheet" type="text/css" href='/css/readme.css'>
                ${md.makeHtml(readme)}
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
            // if we're changing our port
            if(req.body.port){
                res.status(200).send();
                // reboot backend
                console.log("closing http server...");
                server.closeAllConnections();
                server.close(async () => {
                    console.log("closing websocket server...");
                    wsServer.close(async () => {
                        launchBackend();
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
                    save(SETTINGS);
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
            save(SETTINGS);
            res.status(200).send();
            return;
        }else{
            res.status(400).send();
            return;
        }
    });

    expressServer.post(['/create/bank',], async (req, res) => {
        createWordBank();
        save(SETTINGS);
        res.status(200).send();
        return;
    });

    expressServer.get(['/load',], async (req, res) => {
        res.status(200).send(SETTINGS);
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
        res.status(400).send({});
        return;
    });

    // get list of all words
    expressServer.get(['/banks/:uuid/words',], async (req, res) => {
        if(req.params && req.params.uuid){
            const bank = getWordBankByUuid(req.params.uuid)
            if(bank){
                // refresh
                const updated = createWordBank(bank);
                console.log(`Word List for bank ${bank.name} has ${updated.words.size} words.`);
                res.status(200).send([...updated.words.keys()]);
                return;
            }
        }
        res.status(400).send([]);
        return;
    });

    // get specific word file
    expressServer.get(['/banks/:uuid/word',], async (req, res) => {
        if(req.params && req.params.uuid && req.query.path && req.query.word){
            const bank = getWordBankByUuid(req.params.uuid);
            if(bank){
                const filePath = path.join(bank.path, req.query.path);
                console.log(`${req.query.word} -> ${filePath}`);
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
                for(const callback of ON_SPEAK_CALLBACKS){
                    callback({ 
                        phrase: req.query.phrase,
                        bank: bank.uuid,
                        commands: commands 
                    });
                }
                res.status(200).send();
                return;
            }
        }
        res.status(400).send();
        return;
    });

    return server;
}

const launchFrontend = () => {
    const powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    app.whenReady().then(() => {
        // Electron API
        ipcMain.on('selectDirectory', async (event) => {
            const dir = await dialog.showOpenDialog({ properties: ['openDirectory']});
            if(!dir.canceled && dir.filePaths.length > 0){
                event.returnValue = dir.filePaths[0];
            }else{
                event.returnValue = undefined;
            }
        });

        // Toolbar
        Menu.setApplicationMenu(
            Menu.buildFromTemplate(menuTemplate(shell, () => {
                return SETTINGS.port;
            })
        ));

        // Window
        const win = new BrowserWindow({
            width: 400,
            height: 640,
            webPreferences: {
                preload: path.join(SRC_DIR, 'js', 'bridge.js'),
                backgroundThrottling: false
            }
        })
        win.webContents.setWindowOpenHandler(({ url }) => {
            // if(url.startsWith('http://localhost')){
            //     return { action: 'allow' }
            // }
            shell.openExternal(url);
            return { action: 'deny' };
        });
        ON_SPEAK_CALLBACKS.push((command) => {
            win.webContents.send("onSpeakCommand", command);
        });
        win.loadURL(`http://localhost:${SETTINGS.port}/`);
        const originalConsole = console.log;
        console.log = (msg) => {
            const timestamp = Date.now();
            const dateObject = new Date(timestamp);
            const isoString = dateObject.toISOString();
            msg = `[${isoString}] ${msg}`
            win.webContents.send("onLog", msg);
            originalConsole(msg);
        }
    });

    app.on('window-all-closed', () => {
        powerSaveBlocker.stop(powerSaveBlockerId);
        app.quit();   
    });
}

const launchApp = async () => {
    launchBackend();
    launchFrontend();
}

launchApp();
