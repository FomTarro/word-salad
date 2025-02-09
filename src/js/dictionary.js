const path = require('path');
const fs = require('fs');

const UNKNOWN_WORD = '_';

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
        const key = split[0].length > 0 ? split[0] : UNKNOWN_WORD;
        if(dict.has(key)){
            dict.get(key).push(word);
        }else{
            dict.set(key, [word]);
        }
    }
    // console.log(dict);
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
function formSentence(phrase, delay, dictionary){
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const split = [...segmenter.segment(phrase.toLowerCase())]
        .filter((e) => e.segment.trim() !== "");
    console.log(split);
    const commands = []
    for(const word of split){
        if(word.isWordLike || word.segment === UNKNOWN_WORD){
            if(dictionary.has(word.segment)){
                commands.push({
                    path: dictionary.get(word.segment)[Math.floor(Math.random() * dictionary.get(word.segment).length)]
                })
            }else if(dictionary.has(UNKNOWN_WORD)){
                commands.push({
                    path: dictionary.get(UNKNOWN_WORD)[Math.floor(Math.random() * dictionary.get(UNKNOWN_WORD).length)]
                })
            }
        }else{
            commands.push({
                delay: delay,
            })
        }
    }
    return commands;
}

module.exports.formSentence = formSentence;
module.exports.parseDictionary = parseDictionary;
module.exports.getFiles = getFiles;