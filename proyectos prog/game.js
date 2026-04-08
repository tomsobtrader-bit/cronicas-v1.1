import { CombatSystem } from "./Systems/combatsystem.js"

export class Game {

    constructor() {
        this.runManager = { level: 1 }
        this.combatSystem = new CombatSystem(this)
        console.log("Crónicas del Abismo — iniciado")
    }

    // Llamado desde el botón "Siguiente Nivel" en la pantalla de victoria
    advanceLevel() {
        this.runManager.level++
        const level = this.runManager.level

        // Calcular HP del siguiente enemigo
        let newEnemyHp
        if (level === 1) {
            newEnemyHp = 5
        } else {
            newEnemyHp = level * 5
        }

        // Resetear el sistema de combate para el nuevo nivel
        this.combatSystem = new CombatSystem(this)
        this.combatSystem.enemyHealth = newEnemyHp
        this.combatSystem.playerHealth = window._savedPlayerHealth || 30

        // Ocultar pantalla de game over si está visible (será removida por render)
        this.combatSystem.startCombat()

        // Actualizar barra de run
        if (typeof window._updateRunBar === "function") {
            window._updateRunBar(level)
        }
    }

}