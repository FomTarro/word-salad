let IS_SPEAKING = false;
const SPEAKER_QUEUE = [];

function speak(request) {
    const chunks = []
    const ready = [];
    const setReady = () => {
        ready.push(true);
        if (ready.length == chunks.length) {
            chunks[0].play();
        }
    }
    console.log("Processing sentence...");
    for (const command of request.commands) {
        // if it's a word file
        if (command.path) {
            const clip = new Audio(`./banks/${request.bank}/word?word=${command.word}&path=${command.path}`);
            clip.oncanplaythrough = () => {
                setReady();
            }
            chunks.push({
                onended() {
                    console.warn("OnEnded Callback not initialized.")
                    IS_SPEAKING = false;
                },
                play() {
                    clip.onended = this.onended;
                    clip.play().catch((r) => { 
                        console.error(r);
                        clip.onended(); 
                    });
                }
            });
            // else, it's punctuation
        } else {
            chunks.push({
                onended() {
                    console.warn("OnEnded Callback not initialized.")
                    IS_SPEAKING = false;
                },
                play() {
                    setTimeout(this.onended, command.delay ?? 250);
                }
            });
            setReady();
        }
    }

    if(chunks.length > 0){
        console.log(`Sentence starting with ${chunks.length} parts!`);
        for (let i = 0; i < chunks.length; i++) {
            chunks[i].onended = () => {
                if (i + 1 < chunks.length) {
                    chunks[i + 1].play();
                } else {
                    console.log("Sentence ended!");
                    IS_SPEAKING = false;
                }
            }
        }
    }
}

const PARAMS = Object.fromEntries(new URLSearchParams(location.search).entries());
const USE_QUEUE = PARAMS.queue === 'false' ? false : true;
const PROCESSOR = setInterval(
    () => {
        try {
            if (SPEAKER_QUEUE.length > 0 
            // && (!IS_SPEAKING || !USE_QUEUE)
            ) {
                speak(SPEAKER_QUEUE.shift());
            }
        } catch (e) {
            console.warn(e);
        }
    },
100);