const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const app = express();
require('dotenv').config();

const baseDirectory = path.join(__dirname, './public');
async function parseDictionary(){
    const extensions = ['.wav', '.mp3', '.mp4']
    const words = fs.readdirSync(path.join(baseDirectory, "words"));
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

/**
 * 
 * @param {string} phrase 
 * @param {Map<string, string[]>} dictionary 
 */
function formSentence(phrase, dictionary){
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const split = [...segmenter.segment(phrase.toLowerCase())]
        .filter((e) => e.segment.trim() !== "");
    console.log(split);
    const files = []
    for(const word of split){
        if(word.isWordLike){
            if(dictionary.has(word.segment)){
                files.push(dictionary.get(word.segment)[Math.floor(Math.random() * dictionary.get(word.segment).length)])
            }
        }else{
            // punctuation, push a pause!
        }
    }
    return files;
}

async function launch(){
    const dict = await parseDictionary();
    const port = process.env.PORT || 8095;
    app.use('/', express.static(baseDirectory));
    app.set('trust proxy', true);

    // Makes an http server out of the express server
    const httpServer = http.createServer(app);

    // Starts the http server
    httpServer.listen(port, () => {
        // code to execute when the server successfully starts
        console.log(`started on ${port}`);
    });

    const server = new WebSocket.Server({server: httpServer, path:'/'});
    server.on('connection', (ws) => {
        console.log('connection!');
    });

    server.on('close', (ws) => {
        console.log('connection closed!');
    });

    app.get(['/source', '/player',], async (req, res) => {
        res.status(200).sendFile(path.join(baseDirectory, 'index.html'));
        return;
    });

    app.get(['/speak',], async (req, res) => {
        if(req.query.phrase && req.query){
            console.log(req.query.phrase);
            const files = formSentence(req.query.phrase, dict);
            server.clients.forEach(client => {
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

    app.get(['/words',], async (req, res) => {
        res.status(200).send([...dict.keys()]);
        return;
    });
}

launch();