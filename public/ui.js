/**
 * ===== Helper Functions =====
 */

/**
 * Takes a string over x characters and inserts a ... in the center.
 * @param {string} word - The word to abridge.
 * @param {number} maxLength - The maximum length to allow.
 * @returns {string} The abridged word.
 */
function abridgeString(word, maxLength) {
    const half = Math.floor((maxLength - 3) / 2)
    if (word.length > maxLength) {
    return word.substring(0, half) + '...' + word.substring(word.length-half, word.length);
    }
    return word;
}

/**
 * Checks to see if a new version of the application is available.
 */
const checkVersion = async() => {
    const response = await fetch(`/version`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });
    const versionData = await response.json();
    document.getElementById('currentVersion').innerHTML = `v${versionData.version}`
    if(versionData.url){
        document.getElementById('newVersion').classList.remove('hidden');
        document.getElementById('newVersionLink').href = versionData.url;
    }
}

function getSelectedWordBank(){
    return SELECT_BANK_DROPDOWN.options[SELECT_BANK_DROPDOWN.selectedIndex] ?? {};
}

async function getWordListForWordBank(bankUuid) {
    const response = await fetch(`/banks/${bankUuid}/words`, {
        method: "GET",
    });
    const body = await response.json();;
    BANK_WORD_LIST.innerHTML = "";
    for(const word of body){
        const li = document.createElement("li");
        li.innerHTML = word;
        BANK_WORD_LIST.append(li);
        li.addEventListener('click', () => {
            SPEAK_COMMAND_INPUT.value = `${SPEAK_COMMAND_INPUT.value} ${word}`.trim();
            var event = new Event('change')
            SPEAK_COMMAND_INPUT.dispatchEvent(event);
        })
    }
    document.getElementById("wordCount").innerHTML = `(${body.length} words total)`;
}

function updateSpeakUrl(){
    SPEAK_COMMAND_URL.value = `${window.location.href}speak?bank=${getSelectedWordBank().value}&phrase=${SPEAK_COMMAND_INPUT.value}`;
}

/**
 * ===== Saving and Loading settings ====
 */

async function loadGlobalSettings(){
    const response = await fetch(`/load`, {
        method: "GET",
    });
    const settings = await response.json()
    for(const property in settings){
        const elem = document.getElementById(property);
        if(elem){
            elem.value = settings[property];
        }
    }
    // prune deleted word banks
    for(const option of document.getElementsByClassName("bankOption")){
        if(!settings.banks.find(b => b.uuid === option.value)){
            option.remove();
        }
    }
    // make/update existing word banks
    for(const bank of settings.banks){
        const existingOption = document.querySelector(`[value="${bank.uuid}"]`);
        if(!existingOption){
            // create new HTML element using the name/UUID/path found here
            const option = document.createElement("option");
            option.classList.add("bankOption")
            option.value = bank.uuid;
            option.innerHTML = bank.name;
            SELECT_BANK_DROPDOWN.append(option);
        }else{
            // update the display name of an existing element
            existingOption.innerHTML = bank.name;
        }
    }
    await loadWordBankSettings();
}

async function saveGlobalSetting(key, value){
    const data = {
        [key] : value
    };
    const response = await fetch("/save/global", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    });
    if(key === "port"){
        window.location.href = `http://localhost:${value}/`
    }
    await loadGlobalSettings();
}

for(const setting of document.getElementsByClassName('globalSetting')){
    setting.addEventListener("change", async () => {
        await saveGlobalSetting(setting.id, setting.value);
    });
}

async function loadWordBankSettings(){
    console.log("Populating for word bank:" + getSelectedWordBank().value);
    const response = await fetch(`/banks/${getSelectedWordBank().value}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });
    const bank = await response.json();
    for(const property in bank){
        const elem = document.getElementById(property);
        if(elem){
            elem.value = bank[property];
        }
    }
    document.getElementById("path").innerHTML = bank.path ? abridgeString(bank.path, 32) : "...";
    await getWordListForWordBank(bank.uuid);
    updateSpeakUrl();
}

async function saveBankSetting(key, value){
    const data = {
        uuid: getSelectedWordBank().value,
        [key]: value,
    };
    const response = await fetch("/save/bank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    });
    await loadGlobalSettings();
}

for(const setting of document.getElementsByClassName('bankSetting')){
    setting.addEventListener("change", async () => {
        await saveBankSetting(setting.id, setting.value);
    });
}

/**
 * ===== Elements =====
 */
const SELECT_BANK_DROPDOWN = document.getElementById('selectDropdown');
const SPEAK_COMMAND_INPUT = document.getElementById('speak');
const SPEAK_COMMAND_BUTTON = document.getElementById('speakButton');
const SPEAK_COMMAND_URL = document.getElementById('speakUrl');
const BROWSER_SOURCE_URL = document.getElementById('source');
const CREATE_BANK_BUTTON = document.getElementById('createButton');
const DELETE_BANK_BUTTON = document.getElementById('deleteButton');
const REFRESH_BANK_BUTTON = document.getElementById("wordRefresh");
const COPY_BANK_BUTTON = document.getElementById("wordCopy");
const BANK_WORD_FILTER = document.getElementById("wordFilter");
const BANK_WORD_LIST = document.getElementById("wordList");
const DIRECTORY_SELECT_BUTTON = document.getElementById("directorySelect");
/**
 * ===== Electron API =====
 */
// Speak from the UI, rather than a browser source
window.electronAPI.onSpeakCommand((message) => {
    SPEAKER_QUEUE.push(message);
});

window.electronAPI.onLog((message) => {
    document.getElementById('ticker').innerHTML = message;
    console.log(message);
});

/**
 * ===== Event Listener Hookups =====
 */

BROWSER_SOURCE_URL.value = `http://${window.location.host}/speaker`;
SELECT_BANK_DROPDOWN.addEventListener('change', async () => {
    await loadWordBankSettings();
});

CREATE_BANK_BUTTON.addEventListener('click', async () => {
    const response = await fetch("/create/bank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }
    });
    await loadGlobalSettings();
    SELECT_BANK_DROPDOWN.value = SELECT_BANK_DROPDOWN.options[SELECT_BANK_DROPDOWN.options.length - 1].value;
    await loadWordBankSettings()
});

DELETE_BANK_BUTTON.addEventListener('click', async () => {
    const data = {
        uuid: getSelectedWordBank().value
    };
    const response = await fetch("/delete/bank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    });
    await loadGlobalSettings();
});

REFRESH_BANK_BUTTON.addEventListener('click', async () => {
    getWordListForWordBank(getSelectedWordBank().value);
});

COPY_BANK_BUTTON.addEventListener('click', async () => {
    const response = await fetch(`/banks/${getSelectedWordBank().value}/words`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });
    const bank = await response.json();
    navigator.clipboard.writeText(
        JSON.stringify(bank, null, 2)
    );
});

BANK_WORD_FILTER.addEventListener('change', async () => {
    for(const li of BANK_WORD_LIST.querySelectorAll('li')){
        if(li.innerHTML.includes(BANK_WORD_FILTER.value)){
            li.classList.remove("hidden");
        }else{
            li.classList.add("hidden");
        }
    }
});

DIRECTORY_SELECT_BUTTON.addEventListener('click', async () => {
    const dir = await window.electronAPI.selectDirectory();
    if(dir){
        await saveBankSetting('path', dir);
    }
});

SPEAK_COMMAND_INPUT.addEventListener('change', async () => {
    updateSpeakUrl();
})

SPEAK_COMMAND_BUTTON.addEventListener('click', async () => {
    const response = await fetch(`/speak?bank=${getSelectedWordBank().value}&phrase=${SPEAK_COMMAND_INPUT.value}`, {
        method: "GET",
    });
});

/**
 * ===== Generic Component Hookups =====
 */

function openTab(tabName){
    const tabs = document.getElementsByClassName('contentTab');
    for(const tab of tabs){
        if(tab.id !== tabName){
            tab.classList.add('hidden')
        }else{
            tab.classList.remove('hidden');
        }
    }
}

for(const button of document.getElementsByClassName('tabButton')){
    button.addEventListener("click", async () => {
        openTab(button.getAttribute('target'));
    });
}

for(const button of document.getElementsByClassName('copy')){
    button.addEventListener("click", async () => {
        const target = document.getElementById(button.getAttribute("target"));
        target.select();
        navigator.clipboard.writeText(
            target.value
        );
    })
}

for(const slider of document.getElementsByClassName('slider')){
    const values = slider.parentElement.querySelectorAll('.sliderValue');
    slider.addEventListener("input", async () => {
        for(const value of values){
            value.innerHTML = `${(slider.value * 100).toFixed(0)}%`;
        }
    });
}

const tooltips = {
    source: "This URL is for the Speaker, which plays the spoken audio.\nUse it as a Browser Source in OBS.",
    speakUrl: "This URL issues a Speak command to the Speaker, for the specified Word Bank with the specified phrase.\nUse this as the target of a Web Request when setting up your redeem, but do not use this as a Browser Soruce.",
    uuid: "This ID represents the bank, and will not change, even if you edit the bank's display name.\nYou can use this ID when setting up a Speak command, as seen in the above URL."
}
for(const tooltip of document.getElementsByClassName('tooltip')){
    const text =  tooltips[tooltip.getAttribute('target')];
    if(text){
        tooltip.title = text;
    }
}

/**
 * ===== Execution =====
 */

loadGlobalSettings();
openTab('mainTab');
checkVersion();