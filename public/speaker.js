let IS_SPEAKING = false;
const SPEAKER_QUEUE = [];

function setSpeakingStatus(status){
    IS_SPEAKING = status;
    // start playing next sentence if there's one in the queue
    if(!IS_SPEAKING && SPEAKER_QUEUE.length > 0){
        speak(SPEAKER_QUEUE.shift());
    }
}

function speak(request) {
    try{
        setSpeakingStatus(true);
        const chunks = []
        const ready = [];
        const setReady = () => {
            ready.push(true);
            // once all clips are loaded, begin playtrhough of first clip
            if (ready.length == chunks.length) {
                chunks[0].play();
            }
        }
        console.log(`[${request.uuid}] Speak request queue length: ${SPEAKER_QUEUE.length}`);
        console.log(`[${request.uuid}] Processing sentence: ${request.phrase}`);
        for (const command of request.commands) {
            // if it's a word file
            if (command.path) {
                const clip = new Audio(`./banks/${request.bank}/word?word=${command.word}&path=${command.path}`);
                clip.volume = request.volume ? request.volume : 1.0;
                clip.oncanplaythrough = () => {
                    // clip is loaded, flag it as ready
                    setReady();
                }
                chunks.push({
                    onended() {
                        console.warn(`[${request.uuid}] OnEnded Callback not initialized.`)
                        setSpeakingStatus(false);
                    },
                    play() {
                        clip.onended = this.onended;
                        clip.play().then(() => {
                            setSpeakingStatus(true);
                        }).catch((r) => { 
                            console.error(`[${request.uuid}] Error: ${r}`);
                            this.onended(); 
                        });
                    }
                });
                // else, it's punctuation
            } else {
                chunks.push({
                    onended() {
                        console.warn(`[${request.uuid}] OnEnded Callback not initialized.`)
                        setSpeakingStatus(false);
                    },
                    play() {
                        setTimeout(this.onended, command.delay ?? 250);
                    }
                });
                setReady();
            }
        }

        if(chunks.length > 0){
            for (let i = 0; i < chunks.length; i++) {
                // connect chunks such that they each play in to the next
                chunks[i].onended = () => {
                    if (i + 1 < chunks.length) {
                        chunks[i + 1].play();
                    } else {
                        console.log(`[${request.uuid}] Ending sentence: ${request.phrase}`);
                        setSpeakingStatus(false);
                    }
                }
            }
        }
    }catch(e){
        console.error(`[${request.uuid}] Error coccured while processing sentence: ${e}.`);
        setSpeakingStatus(false);
    }
}

function handleSpeakRequest(request){
    console.log(`[${request.uuid}] Handling speak request...`);
    if(!IS_SPEAKING){
        speak(request)
    }else{
        SPEAKER_QUEUE.push(request);
    }
}