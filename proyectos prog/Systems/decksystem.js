// ─────────────────────────────────────────────────────────────────────────────
// DeckSystem — rotación cíclica estilo Clash Royale
//
// El mazo tiene hasta MAX_DECK_SIZE cartas.
// Las cartas se usan y vuelven a la cola (rotación infinita).
// La mano se rellena robando de la cola del ciclo.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DECK_SIZE = 10
export const MAX_HAND_SIZE = 5

export class DeckSystem {

    constructor() {
        // Lista maestra de cartas del mazo (hasta 10, objetos card data)
        this.deckList = []

        // Cola de ciclo: las cartas que van saliendo a la mano, en orden circular
        this.cycle = []

        // Mano actual
        this.hand = []
    }

    // ── Añadir carta al mazo (hasta MAX_DECK_SIZE) ───────────────────────────
    addCard(card) {
        if (this.deckList.length >= MAX_DECK_SIZE) return false
        this.deckList.push(card)
        this.cycle.push(card)
        return true
    }

    // ── Iniciar ciclo: barajar y preparar la cola ────────────────────────────
    initCycle() {
        this.cycle = [...this.deckList].sort(() => Math.random() - 0.5)
    }

    // ── Robar 1 carta a la mano ──────────────────────────────────────────────
    draw() {
        if (this.hand.length >= MAX_HAND_SIZE) return null
        if (this.cycle.length === 0) {
            // Reiniciar ciclo si se agotó
            this.cycle = [...this.deckList].sort(() => Math.random() - 0.5)
        }
        const card = this.cycle.shift()
        if (card) {
            this.hand.push(card)
        }
        return card
    }

    // ── Cuando se juega una carta: sacarla de la mano y devolverla al ciclo ──
    playCard(handIndex) {
        const card = this.hand[handIndex]
        if (!card) return null
        this.hand.splice(handIndex, 1)
        // La devolvemos al final del ciclo
        this.cycle.push(card)
        return card
    }

    // ── Robar mano inicial (3 cartas) ────────────────────────────────────────
    drawStartingHand(amount = 3) {
        for (let i = 0; i < amount; i++) {
            this.draw()
        }
    }

    // ── Cantidad de cartas en el mazo ────────────────────────────────────────
    get size() { return this.deckList.length }

    // ── Posición en el ciclo: cuántas cartas hasta que vuelve a salir ────────
    cyclePosition(cardId) {
        return this.cycle.findIndex(c => c.id === cardId)
    }
}