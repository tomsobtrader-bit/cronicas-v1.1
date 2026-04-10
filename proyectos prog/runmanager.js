import { Player } from "./Entidades/player.js"
import { Enemy } from "./Entidades/enemy.js"
import { CombatSystem } from "./Systems/combatsystem.js"
import { ShopSystem } from "./Systems/shopSystem.js"

export class RunManager {

    constructor() {
        this.level = 1
        this.maxLevel = 10
    }

    startRun() {

        this.player = new Player()

        this.startLevel()
    }

    startLevel() {

        console.log("Nivel:", this.level)

        const enemy = new Enemy(this.level)

        const combat = new CombatSystem(this.player, enemy)

        const result = combat.startCombat()

        if(result === "victory"){

            this.player.gold += 5

            this.level++

            if(this.level > this.maxLevel){
                console.log("Run completada")
                return
            }

            const shop = new ShopSystem(this.player)
            shop.openShop()

            this.startLevel()

        }else{

            console.log("Derrota. Run terminada.")
        }
    }
}