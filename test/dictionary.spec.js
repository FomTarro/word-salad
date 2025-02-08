const { parseDictionary, formSentence } = require("../src/js/dictionary");
const path = require('path');

describe("Dictionary Parse Tests", () => {
    test("Dictionary Test 1", async() => {
        const dictionary = parseDictionary(path.join(__dirname));
        expect(dictionary.size).toBe(2);
        expect(dictionary.get('blank')).toBeDefined();
        expect(dictionary.get('blank').length).toBe(2);
        expect(dictionary.get('dummy')).toBeDefined();
    })
});

describe("Sentence Formulation", () => {
    test("Sentence Test Happy Path", async() => {
        const dictionary = new Map([
            ["hello", ['path1']],
            ["world", ['path2']]
        ]);
        const sentence = formSentence("hello, world!", 250, dictionary);
        expect(sentence.length).toBe(4);
        expect(sentence[0].path).toBe('path1');
        expect(sentence[1].delay).toBe(250);
        expect(sentence[2].path).toBe('path2');
        expect(sentence[3].delay).toBe(250);
    })
    test("Sentence Test with Unknown Word, no default", async() => {
        const dictionary = new Map([
            ["hello", ['path1']],
            ["world", ['path2']]
        ]);
        const sentence = formSentence("hello there, world!", 250, dictionary);
        expect(sentence.length).toBe(4);
        expect(sentence[0].path).toBe('path1');
        expect(sentence[1].delay).toBe(250);
        expect(sentence[2].path).toBe('path2');
        expect(sentence[3].delay).toBe(250);
    })
    test("Sentence Test with Unknown Word, set default", async() => {
        const dictionary = new Map([
            ["hello", ['path1']],
            ["world", ['path2']],
            ["_", ['path3']]
        ]);
        const sentence = formSentence("hello there, world!", 250, dictionary);
        expect(sentence.length).toBe(5);
        expect(sentence[0].path).toBe('path1');
        expect(sentence[1].path).toBe('path3');
        expect(sentence[2].delay).toBe(250);
        expect(sentence[3].path).toBe('path2');
        expect(sentence[4].delay).toBe(250);
    })
});