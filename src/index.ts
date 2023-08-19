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

interface Match {
    id: number,
    time: string,
    start_at: number,
    location: string,
    locationColor: string,
    match: { catShortName: string, aTeam: Team, bTeam: Team }
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
    matches: Match[] = []
    pool1: Element | null = null;
    pool2: Element | null = null;
    tournamentScreen: number = 0;
    tournamentSubScreen: number = 0;

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
            if (this.tournament && this.tournamentScreen == 0) {
                if (this.tournamentSubScreen === 0) {
                    this.updateSchedules()
                } else {
                    this.updateSchedulesDom()
                    this.rotateTournamentScreen()
                }
            }
            if (this.tournament && this.tournamentScreen > 0) { this.updateResults() }
        }, 10000)

        this.socket.on('update', (msg: Message) => {
            this.updateState(msg);
        });

        const root = document.getElementById("root");
        root && (root.style.display = "block")
        this.syncState();
    }

    private updateSchedules() {
        const http = new XMLHttpRequest();
        const url = 'https://www.mitivu.com/data/data';
        const params = `mod%5B330%5D%5Btimestamp%5D=${+new Date()}&assets=false&lang=fr-BE&dispId=129`

        http.open('POST', url, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.setRequestHeader('x-requested-with', 'XMLHttpRequest');
        http.onreadystatechange = () => {
            if (http.readyState === 4 && http.status === 200) {
                const data = JSON.parse(http.responseText)
                const allMatches = data.data["330"].data.data[0].matches;
                this.matches = allMatches.filter((m: Match) => m.start_at < allMatches[0].start_at + 61 * 60)
                this.updateSchedulesDom()
                this.rotateTournamentScreen()
            } else if (http.readyState === 4) {
                this.rotateTournamentScreen()
            }
        };

        http.send(params);
    }

    private rotateTournamentScreen(target?: number) {
        document.getElementById('schedules')!.style.visibility = this.tournamentScreen == 0 ? 'visible' : 'hidden'
        document.getElementById('pool1')!.style.visibility = this.tournamentScreen == 1 ? 'visible' : 'hidden'
        document.getElementById('pool2')!.style.visibility = this.tournamentScreen == 2 ? 'visible' : 'hidden'

        if (target === undefined && this.tournamentScreen == 0) {
            this.tournamentSubScreen++
            if (this.tournamentSubScreen * 6 >= this.matches.length) {
                this.tournamentSubScreen = 0
                this.tournamentScreen = (this.tournamentScreen + 1) % 3
            }
        } else {
            this.tournamentScreen = target !== undefined ? target : (this.tournamentScreen + 1) % 3
        }
    }

    private updateResults() {
        const http = new XMLHttpRequest();
        const url = 'https://www.mitivu.com/data/data';
        const start = new Date()
        start.setHours(0,0,0,0)
        const params = `mod%5B328%5D%5Btimestamp%5D=${(+start)/1000}&assets=false&lang=fr-BE&dispId=129`

        http.open('POST', url, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.setRequestHeader('x-requested-with', 'XMLHttpRequest');
        http.onreadystatechange = () => {
            if (http.readyState === 4 && http.status === 200) {
                const data = JSON.parse(http.responseText)

                const content = data.data["328"].medias["10406"]?.contents
                if (content) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(content, "text/html");
                    this.pool1 = doc.querySelector('[data-idx="0-2"]') ?? doc.querySelectorAll('table')[0]
                    this.pool2 = doc.querySelector('[data-idx="1-2"]') ?? doc.querySelectorAll('table')[1]

                    document.getElementById('pool1')!.innerHTML = ''
                    this.pool1 && document.getElementById('pool1')!.appendChild(this.pool1)
                    document.getElementById('pool2')!.innerHTML = ''
                    this.pool2 && document.getElementById('pool2')!.appendChild(this.pool2)
                    this.rotateTournamentScreen()
                } else {
                    document.getElementById('pool1')!.innerHTML = ''
                    document.getElementById('pool2')!.innerHTML = ''
                    this.rotateTournamentScreen(0)
                }
                this.rotateTournamentScreen(0)
            } else if (http.readyState === 4) {
                this.rotateTournamentScreen()
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

    private updateSchedulesDom() {
        const normalize = (s?:string) =>
            s?.replace(/ ?boys/ig, 'B')?.replace(/ ?girls/ig, 'G')?.replace(/ ?- ?/ig, '.')?.substring(0,12)
        for (let i=1;i<=6;i++) {
            const time = document.getElementById(`time${i}`)
            const team = document.getElementById(`team${i}`)
            const field = document.getElementById(`field${i}`)
            const match = this.matches[this.tournamentSubScreen * 6 + i-1]
            time && (time.innerText = match?.time ?? '')
            const cat = match?.match?.catShortName;
            const aTeam = normalize(match?.match?.aTeam?.name)
            const bTeam = normalize(match?.match?.bTeam?.name)
            team && (team.innerText = (cat ? `${cat} `: '') + (aTeam ?? '') + '-' + (bTeam ?? ''))
            field && (field.innerText = match?.location ?? '')
        }
    }
}

export const scoreBoard = new ScoreBoard()
// @ts-ignore
window.scoreBoard = scoreBoard

scoreBoard.init()
