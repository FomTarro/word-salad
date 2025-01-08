const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const { app, BrowserWindow } = require('electron');
const expressServer = express();
require('dotenv').config();

const baseDirectory = path.join(__dirname, './public');
const wordsDirectory = path.join(baseDirectory, "words");
let wordsDictionary = new Map();

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
    // console.log(dict);
    return dict;
}

fs.watch(wordsDirectory, async e => {
    try{
        wordsDictionary = await parseDictionary();
    }catch(e){

    }
});

/**
 * @typedef {Command}
 * @property {string} path
 * @property {number} delay
 */

/**
 * 
 * @param {string} phrase 
 * @param {Map<string, string[]>} dictionary 
 * @return {Command[]} commands
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
            commands.push({
                delay: 500,
            })
        }
    }
    return commands;
}

async function launch() {
    wordsDictionary = await parseDictionary();
    const port = process.env.PORT || 8095;
    expressServer.use('/', express.static(baseDirectory));
    expressServer.set('trust proxy', true);
    expressServer.use(express.json());

    // Makes an http server out of the express server
    const httpServer = http.createServer(expressServer);

    // Starts the http server
    httpServer.listen(port, () => {
        // code to execute when the server successfully starts
        console.log(`started on ${port}`);
    });

    const wsServer = new WebSocket.Server({server: httpServer, path:'/'});
    expressServer.on('connection', (ws) => {
        console.log('connection!');
    });

    expressServer.on('close', (ws) => {
        console.log('connection closed!');
    });

    expressServer.post(['/delay'], async (req, res) => {
        console.log(req.body);
        res.sendStatus(200);
    })

    expressServer.get(['/source', '/player',], async (req, res) => {
        res.status(200).sendFile(path.join(baseDirectory, 'index.html'));
        return;
    });

    expressServer.get(['/speak',], async (req, res) => {
        if(req.query.phrase && req.query){
            console.log(req.query.phrase);
            const files = formSentence(req.query.phrase, wordsDictionary);
            wsServer.clients.forEach(client => {
                client.send(
                    JSON.stringify({
                        files
                    })
                );
            });
            res.status(200).send();
            return;
        }
        res.status(400).send();
        return;
    });

    expressServer.get(['/words',], async (req, res) => {
        console.log(wordsDictionary);
        res.status(200).send([...wordsDictionary.keys()]);
        return;
    });

    const createWindow = () => {
        const win = new BrowserWindow({
          width: 800,
          height: 600
        })
      
        win.loadFile('home.html');
    }

    app.whenReady().then(() => {
        createWindow()
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();   
        }
    });
}

launch();