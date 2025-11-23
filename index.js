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
 * @property {number} volumeRelative
 * @property {Map<string, string[]} words
 */

// indexed by UUID
/** @type {Map<string, WordBank>} */
const BANK_MAP = new Map();
const NEW_BANK = 'New Word Bank'

/**
 * @callback OnSpeakCallback
 * @param {Command} command - The speak command passed to the callback.
 * @returns {void}
 */

/** @type {OnSpeakCallback[]} */
const ON_SPEAK_CALLBACKS = [];


/**
 * @callback OnLogCallback
 * @param {string} message - The message to log.
 * @returns {void}
 */

const originalLog = console.log;
/** @type {OnLogCallback[]} */
const ON_LOG_CALLBACKS = [];
const originalWarn = console.warn;
/** @type {OnLogCallback[]} */
const ON_WARN_CALLBACKS = [];
const originalError = console.error;
/** @type {OnLogCallback[]} */
const ON_ERROR_CALLBACKS = [];

const formatMessage = (msg) => {
    const timestamp = Date.now();
    const dateObject = new Date(timestamp);
    const isoString = dateObject.toISOString();
    msg = typeof msg === 'object' ? JSON.stringify(msg) : msg;
    return `[${isoString}] ${msg}`;
}

const LOG_FILE_PATH = path.join(SIB_DIR ,'logs');
const CLIENT_FORMAT = '[CLIENT]';
const SERVER_FORMAT = '[SERVER]';
const configureLogger = () => {
    if(!fs.existsSync(LOG_FILE_PATH)){
        fs.mkdirSync(LOG_FILE_PATH);
    }

    const timestamp = Date.now();
    const dateObject = new Date(timestamp);
    const isoString = dateObject.toISOString();
    const formatted = isoString
    .replace(/:/g, '') // Remove colons
    .replace(/\./g, '') // Remove periods (for milliseconds)
    .replace(/T/g, '_') // Replace 'T' with underscore
    .replace(/Z/g, ''); // Remove 'Z' (Zulu time indicator)
    const LOG_FILE_NAME = `${formatted}_log.txt`;

    const appendLog = (msg) => {
        fs.appendFile(path.join(LOG_FILE_PATH, LOG_FILE_NAME), msg + '\n', (err) => {
            if(err){
                originalError(err)
            }
        });
    }

    ON_LOG_CALLBACKS.length = 0;
    ON_LOG_CALLBACKS.push(originalLog);
    ON_LOG_CALLBACKS.push(appendLog);
    console.log = (msg) => {
        const formatted = `${SERVER_FORMAT} [INFO] ${formatMessage(msg)}`;
        for(const callback of ON_LOG_CALLBACKS){
            callback(formatted);
        }
    }
    ON_WARN_CALLBACKS.length = 0;;
    ON_WARN_CALLBACKS.push(originalWarn);
    ON_WARN_CALLBACKS.push(appendLog);
    console.warn = (msg) => {
        const formatted = `${SERVER_FORMAT} [WARN] ${formatMessage(msg)}`;
        for(const callback of ON_WARN_CALLBACKS){
            callback(formatted);
        }
    }
    ON_ERROR_CALLBACKS.length = 0;;
    ON_ERROR_CALLBACKS.push(originalError);
    ON_ERROR_CALLBACKS.push(appendLog);
    console.error = (msg) => {
        const formatted = `${SERVER_FORMAT} [ERR!] ${formatMessage(msg)}`;
        for(const callback of ON_ERROR_CALLBACKS){
            callback(formatted);
        }
    }
    const logs = fs.readdirSync(LOG_FILE_PATH).sort().reverse();
    const MAX_LOGS = 5;
    for(let i = logs.length; i > MAX_LOGS; i--){
        try{
            fs.rmSync(path.join(LOG_FILE_PATH, logs[i-1]));
            console.log(`Deleting log file: ${logs[i-1]}`);
        }catch(e){
            originalError(e);
        }
    }
}

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
    console.log('Saving...');
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
    console.log('Loading...');
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
    const volumeRelative = data.volumeRelative ?? 1.0;
    console.log(`Creating word bank '${data.name}' from path: ${data.path} with UUID ${data.uuid}`)
    const dict = data.path ? parseDictionary(data.path) : new Map();
    console.log(`Bank has ${dict.size} words.`);
    BANK_MAP.set(uuid, {
        uuid: uuid,
        name: name,
        path: data.path,
        delay: delay,
        volumeRelative,
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
        const readme = fs.readFileSync(path.join(PUB_DIR, '..', 'README.md')).toString();
        const md = new showdown.Converter({
            metadata: false,
        });
        res.setHeader('Content-Type', 'text/html');
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
            method: 'GET',
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
                console.log('Closing HTTP server...');
                server.closeAllConnections();
                server.close(async () => {
                    console.log('Closing Websocket server...');
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
            const uuid = v4();
            console.log(`[${uuid}] Request received for: ${req.query.phrase}`);
            const bank = getWordBankByUuid(req.query.bank);
            if(bank){
                const commands = formSentence(req.query.phrase, bank.delay, bank.words);
                for(const callback of ON_SPEAK_CALLBACKS){
                    callback({ 
                        phrase: req.query.phrase,
                        uuid,
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
    const powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
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

        ipcMain.on('openLogsDirectory', async (event) => {
            shell.openPath(LOG_FILE_PATH);
            event.returnValue = undefined;
        });

        ipcMain.on('log', async (event, msg) => {
            const formatted = `${CLIENT_FORMAT} [INFO] ${formatMessage(msg)}`;
            for(const callback of ON_LOG_CALLBACKS){
                callback(formatted);
            }
            event.returnValue = undefined;
        });

        ipcMain.on('warn', async (event, msg) => {
            const formatted = `${CLIENT_FORMAT} [WARN] ${formatMessage(msg)}`;
            for(const callback of ON_WARN_CALLBACKS){
                callback(formatted);
            }
            event.returnValue = undefined;
        });

        ipcMain.on('error', async (event, msg) => {
            const formatted = `${CLIENT_FORMAT} [ERR!] ${formatMessage(msg)}`;
            for(const callback of ON_ERROR_CALLBACKS){
                callback(formatted);
            }
            event.returnValue = undefined;
        });

        // Toolbar
        Menu.setApplicationMenu(
            Menu.buildFromTemplate(menuTemplate(shell, () => {
                return SETTINGS.port;
            })
        ));

        // Window
        const win = new BrowserWindow({
            width: 500,
            height: 640,
            webPreferences: {
                preload: path.join(SRC_DIR, 'js', 'bridge.js'),
                backgroundThrottling: false
            }
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
            // if(url.startsWith('http://localhost')){
            //     return { action: 'allow' }
            // }
            shell.openExternal(url);
            return { action: 'deny' };
        });

        ON_SPEAK_CALLBACKS.push((command) => {
            win.webContents.send('onSpeakCommand', command);
        });
        // Pipe console logging to the frontend,
        // unless the logs originated from the frontend
        ON_LOG_CALLBACKS.push((msg) => {
            if(!msg.includes(CLIENT_FORMAT)){
                win.webContents.send('onLog', msg);
            }
        });
        ON_WARN_CALLBACKS.push((msg) => {
            if(!msg.includes(CLIENT_FORMAT)){
                win.webContents.send('onLog', msg);
            }
        });
        ON_ERROR_CALLBACKS.push((msg) => {
            if(!msg.includes(CLIENT_FORMAT)){
                win.webContents.send('onLog', msg);
            }
        });
        win.loadURL(`http://localhost:${SETTINGS.port}/`);
    });

    app.on('window-all-closed', () => {
        powerSaveBlocker.stop(powerSaveBlockerId);
        app.quit();   
    });
}

const launchApp = async () => {
    configureLogger();
    launchBackend();
    launchFrontend();
}

launchApp();
