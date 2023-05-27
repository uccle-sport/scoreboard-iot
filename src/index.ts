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
    signage?: boolean
    tournament?: boolean
    slides?: string[]
}

interface Team {
    name: string,
    logo: string,
    score: number,
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
    signage: boolean = false
    tournament: boolean = true
    slides: string[] = []
    currentSlide = 0
    matches: {id: number, time: string, location:string, locationColor:string, match: {aTeam: Team, bTeam: Team}}[] = []

    init() {
        setInterval(() => {
            this.updateScore()
        }, 1000)

        setInterval(() => {
            this.syncState();
        }, 120000)

        setInterval(() => {
            this.signage && this.switchSlideUsingDoubleBuffer()
        }, 15000)

        setInterval(() => {
            this.tournament && this.updateResults()
        }, 15000)

        this.socket.on('update', (msg: Message) => {
            this.updateState(msg);
        });

        const root = document.getElementById("root");
        root && (root.style.display = "block")
        this.syncState();
    }

    private updateResults() {
        const http = new XMLHttpRequest();
        const url = 'https://www.mitivu.com/data/data';
        const params = `mod%5B330%5D%5Btimestamp%5D=${+new Date()}&assets=false&lang=fr-BE&dispId=129`

        http.open('POST', url, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.setRequestHeader('x-requested-with', 'XMLHttpRequest');
        http.onreadystatechange = () => {
            if (http.readyState === 4 && http.status === 200) {
                const data = JSON.parse(http.responseText)
                this.matches = data.data["330"].data.data[0].matches.slice(0,6)
                this.updateResultsDom()
            }
        };

        http.send(params);
    }

    private switchSlideUsingDoubleBuffer() {
        const root = document.getElementById("signage");
        if (root) {
            const current = root.querySelector(".slide")
            const next = root.querySelector(".slide-next")

            if (current && next) {
                current.classList.remove("slide")
                current.classList.add("slide-next")
                next.classList.remove("slide-next")
                next.classList.add("slide")

                this.currentSlide = (this.currentSlide + 1) % this.slides.length
                ;(current as HTMLImageElement).src = this.slides[(this.currentSlide + 1) % this.slides.length]
            }
        }
    }

    private resetSlidesUsingDoubleBuffer() {
        const root = document.getElementById("signage");
        if (root) {
            const current = root.querySelector(".slide")
            const next = root.querySelector(".slide-next")
            if (current && next) {
                ;(current as HTMLImageElement).src = this.slides[0]
                ;(next as HTMLImageElement).src = this.slides[1 % this.slides.length]
            }
        }
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

        if (msg.signage !== undefined) {
            if (msg.signage !== this.signage) {
                this.currentSlide = 0
                this.resetSlidesUsingDoubleBuffer()
            }
            this.signage = msg.signage
            const root = document.getElementById("signage")
            root && (root.style.visibility = msg.signage ? "visible" : "hidden")
        }

        if (msg.tournament !== undefined) {
            this.tournament = msg.tournament
            const root = document.getElementById("tournament")
            root && (root.style.visibility = msg.tournament ? "visible" : "hidden")
        }

        if (msg.slides !== undefined) {
            this.slides = msg.slides
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

    private updateResultsDom() {
        for (let i=1;i<=6;i++) {
            const time = document.getElementById(`time${i}`);
            const team = document.getElementById(`team${i}`);
            const field = document.getElementById(`field${i}`);
            time && (time.innerText = this.matches[i-1]?.time)
            team && (team.innerText = (this.matches[i-1]?.match?.aTeam?.name ?? '') + '-' + (this.matches[i-1]?.match?.bTeam?.name ?? ''))
            field && (field.innerText = this.matches[i-1].location)
        }
    }
}

export const scoreBoard = new ScoreBoard()
// @ts-ignore
window.scoreBoard = scoreBoard

scoreBoard.init()
