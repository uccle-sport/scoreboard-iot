import {io} from "socket.io-client";
import * as process from "node:process";
import { exec } from "child_process";

const server = process.argv[2] || 'ws://127.0.0.1:5000'
const SECRET = process.argv[3] || 'Secret'
const sound = process.argv[4] || '/tmp/alarm.wav'

const socket = io(server, { autoConnect: false, path: '/alarm/socket.io', query:  { token: SECRET } });

let noisy = false

socket.on('connect', () => {
    console.log('connected')
    socket.emit('ping')
})

socket.on('notify', (msg: string) => {
    console.log(msg)
    if (msg === 'alarm' && !noisy) {
        noisy = true
        exec(`aplay ${sound}`, (error: any, stdout: any, stderr: any) => {
            if (error) {
                console.log(`error: ${error.message}`);
                noisy = false
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                noisy = false
                return;
            }
            noisy = false
            console.log(`stdout: ${stdout}`);
        });
    }
})

console.log("Connecting")
socket.connect()
