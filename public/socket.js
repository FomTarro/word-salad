let KEEP_ALIVE;
const PROTOCOL = (window.location.protocol === 'https:') ? 'wss:' : 'ws:';
function createSocket() {
    const socket = new WebSocket(PROTOCOL + '//' + location.host);
    socket.onopen = function () {
        console.log("Connected to server!");
    }
    socket.onmessage = (message) => {
        console.log(message.data)
        const data = JSON.parse(message.data);
        if (data.commands && data.bank) {
            SPEAKER_QUEUE.push(data);
        }
    }
    socket.onclose = () => {
        createSocket();
    }
    const send = (obj) => {
        if (socket && socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(obj));
        }
    }
    if (KEEP_ALIVE) {
        clearInterval(KEEP_ALIVE);
    }
    KEEP_ALIVE = setInterval(
        () => {
            try {
                send({ pulse: 1 });
            } catch (e) {
                console.warn(e);
            }
        },
        10000);
}
// createSocket();