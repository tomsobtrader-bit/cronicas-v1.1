import { CombatSystem } from "./Systems/combatsystem.js"
import { RewardSystem }  from "./Systems/rewardsystem.js"
import { cardsData, STARTER_TROOPS, SPELLS_POOL } from "./Data/cardsdata.js"
import { initBackgroundCanvas } from "./effects.js"

export class Game {

    constructor() {
        this.runManager = { level: 1 }

        this.deckList = this._buildStarterDeck()

        this.playerHealth = 30

        this.combatSystem = new CombatSystem(this)
        this.rewardSystem = new RewardSystem(this)

        initBackgroundCanvas()

        console.log("Crónicas del Abismo — iniciado")
        console.log("Mazo inicial:", this.deckList.map(c => c.name).join(", "))
    }

    _buildStarterDeck() {
        const troopIds = [...STARTER_TROOPS].sort(() => Math.random() - 0.5)
        const spellIds = [...SPELLS_POOL].sort(() => Math.random() - 0.5)
        const allCards = Object.values(cardsData)

        const deck = []

        for (const id of troopIds) {
            if (deck.length >= 4) break
            const card = allCards.find(c => c.id === id)
            if (card) deck.push(card)
        }

        const spellCard = allCards.find(c => c.id === spellIds[0])
        if (spellCard) deck.push(spellCard)

        return deck
    }

    addCardToDeck(card) {
        if (!card) return
        if (this.deckList.length >= 10) return
        this.deckList.push(card)
        console.log(`Carta añadida al mazo: ${card.name} (${this.deckList.length}/10)`)
    }

    // ── Avanzar nivel: mostrar recompensa → mostrar mapa → iniciar combate ──
    advanceLevel() {
        this.runManager.level++
        const level = this.runManager.level

        // Actualizar badge de nivel en la run-bar
        if (typeof window._updateRunBar === "function") {
            window._updateRunBar()
        }

        // Mostrar pantalla de recompensa
        this.rewardSystem.renderRewardScreen(
            this.rewardSystem.generateRewards(level - 1),
            (chosenCard) => {
                this.addCardToDeck(chosenCard)

                // Después de elegir carta → mostrar mapa brevemente
                this._showMapThenCombat(level)
            }
        )
    }

    // ── Muestra el mapa 0.8s y luego arranca el combate automáticamente ─────
    // (El jugador también puede presionar "Continuar" en cualquier momento)
    _showMapThenCombat(level) {
        const overlay = document.getElementById("run-map-overlay")
        const runMap  = window.runMap

        if (overlay && runMap) {
            overlay.classList.add("visible")
            runMap.show()

            // Reemplazar el handler del botón continuar para este nivel
            const btn = document.getElementById("run-map-continue")
            const handler = () => {
                overlay.classList.remove("visible")
                runMap.hide()
                this._startNextCombat(level)
                btn.removeEventListener("click", handler)
            }
            btn.addEventListener("click", handler)
        } else {
            // Fallback si el mapa no está disponible
            this._startNextCombat(level)
        }
    }

    _startNextCombat(level) {
        let newEnemyHp
        if (level === 1)      newEnemyHp = 5
        else if (level === 2) newEnemyHp = 10
        else                  newEnemyHp = level * 5

        this.combatSystem = new CombatSystem(this)
        this.combatSystem.enemyHealth  = newEnemyHp
        this.combatSystem.playerHealth = this.playerHealth

        this.combatSystem.startCombat()
    }

    savePlayerHealth(hp) {
        this.playerHealth = Math.max(0, hp)
    }
}