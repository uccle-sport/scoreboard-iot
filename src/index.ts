import './style.css';

import io, {Socket} from 'socket.io-client'

const fdg = (n: number) => n < 10 ? '0' + n : '' + n

function formatTime(time: number, paused: boolean) {
    return fdg(Math.floor(time / 60)) + (paused && ((+new Date()) / 1000) % 2 === 0 ? "<span style=\"visibility: hidden;\">:</span>" : "<span>:</span>") + fdg(time % 60);
}

interface Message {
    home: number
    away: number
    remaining?: number
    paused: boolean
    homeTeam?: string
    awayTeam?: string
}

export class ScoreBoard {
    params: URLSearchParams = new URLSearchParams(window.location.href.split("?")[1])
    socket: Socket = io({query: {token: this.params?.get('secret') ?? "", uuid: this.params?.get('uuid') ?? ""}});
    endDate: Date = new Date(+new Date() + 35 * 60 * 1000)
    home: number = 0
    away: number = 0
    remaining: number = 35 * 60
    paused: boolean = true
    homeTeam: string = "Uccle Sport"
    awayTeam: string = "Visiteurs"

    init() {
        setInterval(() => {
            this.updateScore()
        }, 1000)

        setInterval(() => {
            this.syncState();
        }, 120000)

        this.socket.on('update', (msg: Message) => {
            this.updateState(msg);
        });

        const root = document.getElementById("root");
        root && (root.style.display = "block")
        this.syncState();
    }

    private syncState() {
        this.socket.emit('sync', {
                token: this.params?.get("secret"),
                uuid: this.params?.get("uuid"),
            }, ({status, resp}: { status: number, resp: any }) => {
                if (status === 200) {
                    this.updateState(resp)
                } else {
                    console.log(JSON.stringify(resp, null, ' '));
                }
            }
        )
    }

    private updateState(msg: Message) {
        ;(msg.home!== undefined) && (this.home = msg.home)
        ;(msg.away!== undefined) && (this.away = msg.away)
        ;(msg.paused !== undefined) && (this.paused = msg.paused)
        msg.homeTeam && (this.homeTeam = msg.homeTeam)
        msg.awayTeam && (this.awayTeam = msg.awayTeam)

        if (msg.remaining !== undefined) {
            this.remaining = Math.floor(msg.remaining)
            this.endDate = new Date(+new Date() + this.remaining * 1000)
        }
    }

    private updateScore() {
        if (this.paused) {
            this.endDate = new Date(+new Date() + this.remaining * 1000)
        } else {
            this.remaining = Math.floor(((+this.endDate) - (+new Date())) / 1000)
        }

        const homeName = document.getElementById("home-name");
        const awayName = document.getElementById("away-name");
        const homeScore = document.getElementById("home-score");
        const awayScore = document.getElementById("away-score");
        const time = document.getElementById("time");

        homeName && (homeName.innerText = this.homeTeam)
        awayName && (awayName.innerText = this.awayTeam)
        homeScore && (homeScore.innerText = this.home.toString())
        awayScore && (awayScore.innerText = this.away.toString())
        time && (time.innerHTML = formatTime(Math.max(this.remaining, 120), this.paused))
    }
}

export const scoreBoard = new ScoreBoard()
// @ts-ignore
window.scoreBoard = scoreBoard

scoreBoard.init()
