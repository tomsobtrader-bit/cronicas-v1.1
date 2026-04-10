export class BoardSystem {

    constructor() {
        this.board = {
            player: {
                melee:  [null, null, null, null],
                ranged: [null, null, null, null]
            },
            enemy: {
                melee:  [null, null, null, null],
                ranged: [null, null, null, null]
            }
        }
    }

    placeTroop(side, troop) {
        const row = troop.type === "ranged" ? "ranged" : "melee"
        for (let i = 0; i < 4; i++) {
            if (this.board[side][row][i] === null) {
                this.board[side][row][i] = troop
                troop.col = i
                return { row, col: i }
            }
        }
        return null
    }

    placeTroopAtCol(side, troop, preferredCol) {
        const row = troop.type === "ranged" ? "ranged" : "melee"
        if (preferredCol !== null && this.board[side][row][preferredCol] === null) {
            this.board[side][row][preferredCol] = troop
            troop.col = preferredCol
            return { row, col: preferredCol }
        }
        for (let i = 0; i < 4; i++) {
            if (this.board[side][row][i] === null) {
                this.board[side][row][i] = troop
                troop.col = i
                return { row, col: i }
            }
        }
        return null
    }

    removeDead() {
        const dead = []
        ;["player", "enemy"].forEach(side => {
            ;["melee", "ranged"].forEach(row => {
                for (let i = 0; i < 4; i++) {
                    const troop = this.board[side][row][i]
                    if (troop && troop.isDead()) {
                        dead.push({ troop, side, row, col: i })
                        this.board[side][row][i] = null
                    }
                }
            })
        })
        return dead
    }

    getTroop(side, row, col) {
        return this.board[side][row][col]
    }

    hasMeleeInCol(side, col) {
        return this.board[side]["melee"][col] !== null
    }

    getTroops(side) {
        const troops = []
        ;["melee", "ranged"].forEach(row => {
            this.board[side][row].forEach((t, col) => {
                if (t) troops.push({ troop: t, row, col })
            })
        })
        return troops
    }

    getAdjacentCols(col) {
        const adj = []
        if (col > 0) adj.push(col - 1)
        if (col < 3) adj.push(col + 1)
        return adj
    }

    hasFreeSlot(side, row) {
        return this.board[side][row].some(t => t === null)
    }

}