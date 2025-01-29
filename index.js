const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { v4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { app, dialog, BrowserWindow, ipcMain } = require('electron');
require('dotenv').config();

const srcDirectory = path.join(__dirname, './src');
const publicDirectory = path.join(__dirname, './public');
const siblingDirectory = process.env.PORTABLE_EXECUTABLE_DIR ?? __dirname;

// indexed by UUID
/** @type {Map<string, WordBank>} */
const bankMap = new Map();

/**
 * @typedef {Object} WordBank
 * @property {string} uuid
 * @property {string} name
 * @property {string} path
 * @property {number} delay
 * @property {Map<string, string[]} words
 */

const settingsFilePath = path.join(siblingDirectory ,`settings.json`);
let settings = {
    tempPath: srcDirectory,
    settingsPath: settingsFilePath,
    delay: 500,
    port: 8095,
    /** @type {WordBank[]} */
    banks: []
}

/** For each property of object A, if object B has a value for that property, apply it to Object A.
 * Returns a new instance/clone of A with the new values.
 * @param {object} a 
 * @param {object} b 
 * @returns {object} - A new instance of A with all properties merged in.
 */
function merge(a, b){
    var c = {}
    for(var prop in a){
        if(b && b[prop]){
            c[prop] = b[prop]
        }else{
            c[prop] = a[prop]
        }
    }
    return c;
}

function save(data) {
    console.log("Saving...");
    settings = merge(settings, data)
    settings.banks = [...[...bankMap.values()].map(val =>  { 
        return {
            uuid: val.uuid,
            name: val.name,
            path: val.path,
            delay: val.delay,
        }
    })];
    console.log(settings);
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings));
}

async function loadGlobalSettings() {
    console.log("Loading...");
    const data = fs.existsSync(settingsFilePath) ? JSON.parse(fs.readFileSync(settingsFilePath).toString()) : {};
    settings = merge(settings, data);
    const banks = [...settings.banks]
    if(banks.length <= 0){
        createWordBank("Default")
    }else{
        for(const bank of banks){
            createWordBank(bank.name, bank.path, bank.uuid);
        }
    }
    save(settings);
}

/**
 * Creates a new Word Bank and loads it into memory.
 * @param {string} name - The name of the bank.
 * @param {string} dir - The root directoy of the bank.
 * @param {string} uuid - The UUID of the bank. If blank, one will be generated.
 */
function createWordBank(name, dir, uuid){
    // TODO, make this just take in a WordBank object, 
    // returning a new instance based on properties from the source
    uuid = uuid ?? v4();
    console.log(`Creating word bank '${name}' from path: ${dir} with UUID ${uuid}`)
    const dict = dir ? parseDictionary(dir) : new Map();
    console.log(`Bank has ${dict.size} words.`);
    bankMap.set(uuid, {
        uuid: uuid,
        name: name,
        path: dir,
        words: dict
    });
    return bankMap.get(uuid);
}

/**
 * 
 * @param {string} name - Bank to find by name
 * @returns {WordBank} - Found bank. Undefined if no such bank exists.
 */
function getWordBankByName(name){
    return [...bankMap.values()].find(b => b.name === name);
}

/**
 * Recursively traverses a folder heirarchy.
 * @param {string} rootDir - The directory the search started in.
 * @param {string} currentDir - The directory of the current search.
 * @param {string[]} collection - Rolling list of all file paths, relative to the root.
 */
function getFiles(rootDir, currentDir, collection) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
        const qualifiedPath = path.join(currentDir, file);
        if (fs.existsSync(qualifiedPath)) {
            if (fs.statSync(qualifiedPath).isDirectory()) {
                getFiles(rootDir, qualifiedPath, collection);
            } else {
                const relativePath = qualifiedPath.replace(rootDir, "");
                collection.push(relativePath);
            }
        } else {
            console.warn(`No such file: ${qualifiedPath}`);
        }
    }
}

/**
 * Parses a root directory for all valid word audio files.
 * @param {string} dir - The root directory to parse for words.
 * @returns {Map<string, string[]} - A map of word variants, indexed by word.
 */
function parseDictionary(dir) {
    const words = []
    getFiles(dir, dir, words);
    const extensions = ['.wav', '.mp3', '.mp4']
    const filteredWords = words.map(word => word.toLowerCase())
        .filter(word => extensions.includes(path.extname(word)));
    filteredWords.sort();
    const dict = new Map();
    for(const word of filteredWords){
        const parse = path.parse(word);
        const split = parse.name.split('_');
        if(dict.has(split[0])){
            dict.get(split[0]).push(word);
        }else{
            dict.set(split[0], [word]);
        }
    }
    console.log(dict);
    return dict;
}

// fs.watch(wordsDirectory, async e => {
//     try{
//         wordsDictionary = await parseDictionary();
//     }catch(e){

//     }
// });

/**
 * @typedef {Object} Command
 * @property {string} path - Path to the file to speak for play commands.
 * @property {number} delay - Delay to wait for delay commands.
 */

/**
 * 
 * @param {string} phrase - The phrase to attempt to say
 * @param {Map<string, string[]>} dictionary - The list of available word variants, indexed by word.
 * @return {Command[]} commands - List of commands to process by the client.
 */
function formSentence(phrase, dictionary){
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const split = [...segmenter.segment(phrase.toLowerCase())]
        .filter((e) => e.segment.trim() !== "");
    console.log(split);
    const commands = []
    for(const word of split){
        if(word.isWordLike){
            if(dictionary.has(word.segment)){
                commands.push({
                    path: dictionary.get(word.segment)[Math.floor(Math.random() * dictionary.get(word.segment).length)]
                })
            }
        }else{
            commands.push({
                delay: settings.delay,
            })
        }
    }
    return commands;
}

async function launchBackend() {
    await loadGlobalSettings();
    const expressServer = express();
    expressServer.use(express.json());
    expressServer.use('/', express.static(publicDirectory));
    expressServer.set('trust proxy', true);

    // Makes an http server out of the express server
    const httpServer = http.createServer(expressServer);
    // Starts the http server
    const server = httpServer.listen(settings.port, () => {
        // code to execute when the server successfully starts
        console.log(`started on ${settings.port}`);
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
        res.status(200).sendFile(path.join(publicDirectory, 'ui.html'));
        return;
    });

    expressServer.get(['/source', '/player', '/speaker'], async (req, res) => {
        res.status(200).sendFile(path.join(publicDirectory, 'speaker.html'));
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
                const bank = bankMap.get(req.body.uuid)
                if(bank){
                    bankMap.set(req.body.uuid, merge(bank, req.body));
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
            bankMap.delete(req.body.uuid);
            save(settings);
            res.status(200).send();
            return;
        }else{
            res.status(400).send();
            return;
        }
    });

    expressServer.post(['/create/bank',], async (req, res) => {
        createWordBank("New Word Bank");
        save(settings);
        res.status(200).send();
        return;
    });

    expressServer.get(['/load',], async (req, res) => {
        res.status(200).send(settings);
        return;
    });

    // get bank data
    expressServer.get(['/banks/:bank',], async (req, res) => {
        if(req.params && req.params.bank){
            const bank = getWordBankByName(req.params.bank)
            if(bank){
                res.status(200).send(bank);
                return;
            }
        }
        res.status(400).send([]);
        return;
    });

    // get list of all words
    expressServer.get(['/banks/:bank/words',], async (req, res) => {
        if(req.params && req.params.bank){
            const bank = getWordBankByName(req.params.bank)
            if(bank){
                // refresh
                const updated = createWordBank(bank.name, bank.path, bank.uuid);
                console.log(`Bank contains ${updated.words.size} words!`);
                res.status(200).send([...updated.words.keys()]);
                return;
            }
        }
        res.status(400).send([]);
        return;
    });

    // get specific word file
    expressServer.get(['/banks/:bank',], async (req, res) => {
        if(req.params && req.params.bank && req.query.wordPath){
            const bank = getWordBankByName(req.params.bank);
            if(bank){
                const filePath = path.join(bank.path, req.query.wordPath);
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
            const bank = getWordBankByName(req.query.bank);
            if(bank){
                const commands = formSentence(req.query.phrase, bank.words, bank.delay);
                sendToWsClients({ 
                    bank: bank.name,
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
                console.log(dir);
                event.returnValue = dir.filePaths[0];
            }else{
                event.returnValue = undefined;
            }
        });
        const win = new BrowserWindow({
            width: 400,
            height: 600,
            webPreferences: {
              preload: path.join(srcDirectory, 'js', 'bridge.js')
            }
        })
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