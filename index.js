const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');
require('dotenv').config();

const srcDirectory = path.join(__dirname, './src');
const publicDirectory = path.join(__dirname, './public');
const wordsDirectory = path.join(publicDirectory, "words");
let wordsDictionary = new Map();

let settings = {
    delay: 500,
}

/** * For each property of object A, if object B has a value for that property, apply it to Object A.
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
    settings = merge(settings, data)
    fs.writeFileSync('./settings.json', JSON.stringify(settings));
}

function load() {
    if (fs.existsSync('./settings.json')) {
        const data = JSON.parse(fs.readFileSync('./settings.json').toString());
        settings = merge(settings, data)
    }
}

async function getFiles(dir, collection) {
    console.log(dir);
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const qualifiedPath = path.join(dir, file);
        if (fs.existsSync(qualifiedPath)) {
            if (fs.statSync(qualifiedPath).isDirectory()) {
                getFiles(qualifiedPath, collection);
            } else {
                collection.push(qualifiedPath.replace(wordsDirectory, ""));
            }
        } else {
            console.warn(`No such file: ${qualifiedPath}`);
        }
    }
}

async function parseDictionary() {
    const words = []
    getFiles(wordsDirectory, words);
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
    return dict;
}

fs.watch(wordsDirectory, async e => {
    try{
        wordsDictionary = await parseDictionary();
    }catch(e){

    }
});

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
            // punctuation, push a pause!
            // TODO: make this dynamic based on settings
            commands.push({
                delay: settings.delay,
            })
        }
    }
    return commands;
}

async function launchBackend() {
    load();
    wordsDictionary = await parseDictionary();
    const port = process.env.PORT || 8095;
    const expressServer = express();
    expressServer.use(express.json());
    expressServer.use('/', express.static(publicDirectory));
    expressServer.set('trust proxy', true);

    // Makes an http server out of the express server
    const httpServer = http.createServer(expressServer);

    // Starts the http server
    httpServer.listen(port, () => {
        // code to execute when the server successfully starts
        console.log(`started on ${port}`);
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

    expressServer.get(['/source', '/player',], async (req, res) => {
        res.status(200).sendFile(path.join(publicDirectory, 'player.html'));
        return;
    });

    expressServer.get(['/speak',], async (req, res) => {
        if(req.query.phrase && req.query){
            console.log(`Attempting to say: ${req.query.phrase}`);
            const files = formSentence(req.query.phrase, wordsDictionary);
            sendToWsClients({ files: files });
            res.status(200).send();
            return;
        }
        res.status(400).send();
        return;
    });

    expressServer.post(['/save',], async (req, res) => {
        if(req.body){
            save(req.body);
        }
        res.status(200).send();
        return;
    });

    expressServer.get(['/load',], async (req, res) => {
        res.status(200).send(settings);
        return;
    });


    expressServer.get(['/words',], async (req, res) => {
        console.log(wordsDictionary);
        res.status(200).send([...wordsDictionary.keys()]);
        return;
    });

    // Electron API
    app.whenReady().then(() => {
        // ipcMain.on('save-settings', (event, setting) => {
        //     console.log(setting);
        // });
        const win = new BrowserWindow({
            width: 400,
            height: 600,
            // webPreferences: {
            //   preload: path.join(srcDirectory, 'js', 'bridge.js')
            // }
          })
        win.loadURL(`http://localhost:${port}/`)
        // win.webContents.send('load-settings', {
        //     port: port
        // });
    });

    app.on('window-all-closed', () => {
        app.quit();   
    });
}

async function launchFrontend() {
    
}

launchBackend();
launchFrontend();