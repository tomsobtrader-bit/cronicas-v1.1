export class Enemy {

    constructor(level){

        this.level = level

        // Nivel 1: 5 HP (jefe tutorial)
        // Nivel 2: 10 HP
        // Niveles superiores: escalan normalmente
        if (level === 1) {
            this.health = 5
        } else if (level === 2) {
            this.health = 10
        } else {
            this.health = 20 + (level * 5)
        }

        this.board = [null, null, null]
    }

}