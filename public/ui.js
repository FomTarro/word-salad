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

document.getElementById('source').value = `http://${window.location.host}/speaker`;
const dropdown = document.getElementById('selectDropdown');
function getSelectedWordBank(){
    return dropdown.options[dropdown.selectedIndex] ?? {};
}
dropdown.addEventListener('change', async () => {
    await populateWordBankData();
});

document.getElementById('createButton').addEventListener('click', async () => {
    const response = await fetch("/create/bank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }
    });
    await load();
    dropdown.value = dropdown.options[dropdown.options.length - 1].value;
    await populateWordBankData()
});

document.getElementById('deleteButton').addEventListener('click', async () => {
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
    await load();
});

async function getWordListForBank(bank) {
    const settings = await fetch(`/banks/${bank}/words`, {
        method: "GET",
    });
    const body = await settings.json();
    const list = document.getElementById("wordList");
    list.innerHTML = "";
    for(const word of body){
        const li = document.createElement("li");
        li.innerHTML = word;
        list.append(li);
        li.addEventListener('click', () => {
            speakInput.value = `${speakInput.value} ${word}`.trim();
            var event = new Event('change')
            speakInput.dispatchEvent(event);
        })
    }
    document.getElementById("wordCount").innerHTML = `(${body.length} words total)`;
}

async function populateWordBankData(){
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
    await getWordListForBank(bank.uuid);
    updateSpeakUrl();
}


document.getElementById("wordRefresh").addEventListener('click', async () => {
    getWordListForBank(getSelectedWordBank().value);
});

document.getElementById("wordCopy").addEventListener('click', async () => {
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

document.getElementById("wordFilter").addEventListener('change', async () => {
    const list = document.getElementById("wordList");
    for(const li of list.querySelectorAll('li')){
        if(li.innerHTML.includes(document.getElementById("wordFilter").value)){
            li.classList.remove("hidden");
        }else{
            li.classList.add("hidden");
        }
    }
})

async function load(){
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
            dropdown.append(option);
        }else{
            // update the display name of an existing element
            existingOption.innerHTML = bank.name;
        }
    }
    await populateWordBankData();
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
    await load();
}

for(const setting of document.getElementsByClassName('globalSetting')){
    setting.addEventListener("change", async () => {
        await saveGlobalSetting(setting.id, setting.value);
    });
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
    await load();
}

for(const setting of document.getElementsByClassName('bankSetting')){
    setting.addEventListener("change", async () => {
        await saveBankSetting(setting.id, setting.value);
    });
}

document.getElementById("directorySelect").addEventListener('click', async () => {
    const dir = await window.electronAPI.selectDirectory();
    if(dir){
        await saveBankSetting('path', dir);
    }
})

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

const speakInput = document.getElementById('speak');
function updateSpeakUrl(){
    document.getElementById("speakUrl").value = `${window.location.href}speak?bank=${getSelectedWordBank().value}&phrase=${speakInput.value}`;
}

speakInput.addEventListener('change', async () => {
    updateSpeakUrl();
})

document.getElementById('speakButton').addEventListener('click', async () => {
    console.log(`Saying: ${speakInput.value}`);
    const response = await fetch(`/speak?bank=${getSelectedWordBank().value}&phrase=${speakInput.value}`, {
        method: "GET",
    });
});

// Speak from the UI, rather than a browser source
window.electronAPI.onSpeakCommand((message) => {
    SPEAKER_QUEUE.push(message);
});

load();
openTab('mainTab');
checkVersion();

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