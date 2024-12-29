const http = require('http');
const path = require('path');
const express = require('express');
const app = express();
require('dotenv').config();


async function launch(){
    const port = process.env.PORT || 8080;;
    const baseDirectory = path.join(__dirname, './public');
    app.use('/', express.static(baseDirectory));
    app.set('trust proxy', true);
    app.get(['/speak',], async (req, res) => {
        if(req.query.phrase && req.query){
            console.log(req.query.phrase);
            res.status(200).sendFile(path.join(baseDirectory, 'index.html'));
            return;
        }
        res.status(400).send();
        return;
    });

    // Makes an http server out of the express server
    const httpServer = http.createServer(app);

    // Starts the http server
    httpServer.listen(port, () => {
        // code to execute when the server successfully starts
        console.log(`started on ${port}`);
    });
}

launch();