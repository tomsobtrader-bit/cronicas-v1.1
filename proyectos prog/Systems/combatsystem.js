import { BoardSystem } from "./boardsystem.js"
import { Troop }       from "../Entidades/troop.js"
import { EnemyAI }     from "../AI/enemyAI.js"
import { cardsData, RARITY_CONFIG } from "../Data/cardsdata.js"
import { MAX_HAND_SIZE } from "./decksystem.js"
import {
      spawnDamageFloat,
      spawnCellParticles,
      screenFlash,
      showTurnBanner,
      drawAttackLine,
      shakeHealthBar,
      getCellElement
  } from "../effects.js"

// ─────────────────────────────────────────────────────────────────────────────
// CombatSystem — versión con ciclo Clash Royale + rarezas + visor de mazo
// ─────────────────────────────────────────────────────────────────────────────

export class CombatSystem {

    constructor(game) {
        this.game  = game
        this.board = new BoardSystem()

        this.playerHealth = 30
        this.enemyHealth  = 30

        this.playerEnergy = 5
        this.enemyEnergy  = 5
        this.maxEnergy    = 10

        this.attackLimit = 3
        this.attacksUsed = 0
        this._possibleAttacksAtTurnStart = 0

        this.selectedAttacker        = null
        this.selectedCardIndex       = null
        this.pendingHealTarget       = null
        this.pendingSpell            = null
        this.pendingSacrificeAlly    = null
        this.pendingSacrificeEnemy   = false
        this.pendingGuardianAdjacent = null

        this.turn    = 1
        this.phase   = "play"
        this.gameOver = false
        this.logs    = []

        // ── Mano y decks ──────────────────────────────────────────────────────
        this.playerHand  = []
        this.playerCycle = []

        this.enemyHand = []
        this.enemyDeck = []

        // ── UI ────────────────────────────────────────────────────────────────
        this.showDeckViewer  = false
        this.previewCard     = null

        this._pendingAnims        = []
        this._enemyActionDisplay  = null
        this._enemyActionQueue    = []
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMACIONES
    // ═══════════════════════════════════════════════════════════════════════════

    _queueAnim(side, row, col, type) {
        this._pendingAnims.push({ id: `${side}-${row}-${col}`, type })
    }

    _flushAnims() {
        this._pendingAnims.forEach(({ id, type }) => {
            const el = document.querySelector(`[data-cell="${id}"]`)
            if (!el) return
            el.classList.remove("cell-anim-attack","cell-anim-hit","cell-anim-death","cell-anim-summon")
            void el.offsetWidth
            el.classList.add(`cell-anim-${type}`)
            setTimeout(() => el.classList.remove(`cell-anim-${type}`), 600)
        })
        this._pendingAnims = []
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMACIÓN DE CARTA VOLANDO AL SLOT
    // ═══════════════════════════════════════════════════════════════════════════
    _animateCardToSlot(cardIndex, targetSide, targetRow, targetCol, onComplete) {
        const handCards = document.querySelectorAll(".hand-card")
        const cardEl    = handCards[cardIndex]
        const slotEl = document.querySelector(`[data-cell="${targetSide}-${targetRow}-${targetCol}"]`)

        if (!cardEl || !slotEl) {
            onComplete()
            return
        }

        const cardRect = cardEl.getBoundingClientRect()
        const slotRect = slotEl.getBoundingClientRect()

        cardEl.classList.add("card-playing-out")

        const clone = document.createElement("div")
        clone.className = "card-fly-clone"
        clone.innerHTML = cardEl.innerHTML

        clone.style.cssText = `
            position: fixed;
            left: ${cardRect.left}px;
            top: ${cardRect.top}px;
            width: ${cardRect.width}px;
            height: ${cardRect.height}px;
            pointer-events: none;
            z-index: 9999;
            border: ${window.getComputedStyle(cardEl).border};
            background: ${window.getComputedStyle(cardEl).background};
            overflow: hidden;
            border-radius: 2px;
            transition: none;
            transform-origin: center bottom;
            opacity: 1;
        `

        document.body.appendChild(clone)

        const targetX = slotRect.left + slotRect.width  / 2 - cardRect.width  / 2
        const targetY = slotRect.top  + slotRect.height / 2 - cardRect.height / 2

        const scaleX = slotRect.width  / cardRect.width
        const scaleY = slotRect.height / cardRect.height
        const finalScale = Math.min(scaleX, scaleY) * 0.9

        void clone.offsetWidth

        const duration = 380

        clone.style.transition = `
            left ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
            top ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
            transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
            opacity ${duration * 0.6}ms ease ${duration * 0.4}ms
        `
        clone.style.left      = `${targetX}px`
        clone.style.top       = `${targetY}px`
        clone.style.transform = `scale(${finalScale})`
        clone.style.opacity   = "0"

        setTimeout(() => {
            clone.remove()

            if (slotEl) {
                slotEl.classList.add("cell-receive-card")
                setTimeout(() => slotEl.classList.remove("cell-receive-card"), 500)
            }

            onComplete()
        }, duration + 20)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INICIO DE COMBATE
    // ═══════════════════════════════════════════════════════════════════════════

    startCombat() {
        this.log("⚔️ Comienza el combate")

        const deckList = this.game.deckList || []
        this.playerCycle = [...deckList].sort(() => Math.random() - 0.5)

        for (let i = 0; i < 3; i++) this._drawCard("player")

        this.enemyDeck = this._buildEnemyDeck()
        for (let i = 0; i < 5; i++) this._drawCard("enemy")

        this._possibleAttacksAtTurnStart = 0
        this.render()
    }

    _buildEnemyDeck() {
        const level = this.game?.runManager?.level || 1
        let pool = EnemyAI.getEnemyDeck(level)
        while (pool.length < 20) pool = [...pool, ...pool]
        return [...pool].sort(() => Math.random() - 0.5)
    }

    _drawCard(side) {
        if (side === "player") {
            if (this.playerHand.length >= MAX_HAND_SIZE) return
            if (this.playerCycle.length === 0) {
                this.playerCycle = [...(this.game.deckList || [])].sort(() => Math.random() - 0.5)
            }
            const card = this.playerCycle.shift()
            if (card) this.playerHand.push(card)
        } else {
            if (this.enemyHand.length >= 5) return
            if (this.enemyDeck.length === 0) {
                const level = this.game?.runManager?.level || 1
                let pool = EnemyAI.getEnemyDeck(level)
                while (pool.length < 20) pool = [...pool, ...pool]
                this.enemyDeck = [...pool].sort(() => Math.random() - 0.5)
            }
            const card = this.enemyDeck.shift()
            if (card) this.enemyHand.push(card)
        }
    }

    _playCardFromHand(index) {
        const card = this.playerHand[index]
        if (!card) return null
        this.playerHand.splice(index, 1)
        this.playerCycle.push(card)
        return card
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INICIO DE TURNO
    // ═══════════════════════════════════════════════════════════════════════════

    startTurn() {
        if (this.gameOver) return
        this.turn++
        this.phase        = "play"

        if (this.turn > 1) {
            showTurnBanner("Tu Turno", "FASE DE JUEGO", "#27ae60")
        }
        this.attacksUsed  = 0
        this.selectedAttacker        = null
        this.selectedCardIndex       = null
        this.pendingSpell            = null
        this.pendingSacrificeAlly    = null
        this.pendingSacrificeEnemy   = false
        this.pendingGuardianAdjacent = null
        this._enemyActionDisplay     = null

        this.playerEnergy = Math.min(this.playerEnergy + 3, this.maxEnergy)
        this.enemyEnergy  = Math.min(this.enemyEnergy  + 3, this.maxEnergy)

        this._drawCard("player")
        this._drawCard("player")
        this._drawCard("enemy")
        this._drawCard("enemy")

        this._startTroopTurns("player")
        this._startTroopTurns("enemy")

        const dead = this.board.removeDead()
        this._applyDeathEffects(dead)
        this._checkGameOver()

        this._possibleAttacksAtTurnStart = this._countPossibleAttacks()

        this.log(`── Turno ${this.turn} ──`)
        this.render()
    }

    _startTroopTurns(side) {
        ;["melee","ranged"].forEach(row => {
            this.board.board[side][row].forEach(t => {
                if (t) t.startTurn(this.board, this)
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SELECCIÓN Y JUEGO DE CARTAS
    // ═══════════════════════════════════════════════════════════════════════════

    selectCard(index) {
        if (this.gameOver || this.phase === "enemy") return
        if (this.pendingHealTarget || this.pendingSpell || this.pendingSacrificeAlly || this.pendingSacrificeEnemy || this.pendingGuardianAdjacent) return

        const card = this.playerHand[index]
        if (!card) return
        if (card.cost > this.playerEnergy) {
            this.log("❌ Energía insuficiente")
            this.render()
            return
        }

        if (card.type === "spell") {
            this._handleSpellPlay(index)
            return
        }

        if (this.selectedCardIndex === index) {
            this.selectedCardIndex = null
        } else {
            this.selectedCardIndex = index
            this.selectedAttacker  = null
            this.log(`🃏 Elegí un slot ${card.subtype === "ranged" ? "RANGED" : "MELEE"} para invocar ${card.name}`)
        }
        this.render()
    }

    placeCardInSlot(row, col) {
        if (this.selectedCardIndex === null) return
        const card = this.playerHand[this.selectedCardIndex]
        if (!card || card.type !== "troop") return

        const expectedRow = card.subtype === "ranged" ? "ranged" : "melee"
        if (row !== expectedRow) {
            this.log(`❌ ${card.name} debe ir en fila ${expectedRow.toUpperCase()}`)
            this.render()
            return
        }
        if (this.board.board.player[row][col] !== null) {
            this.log("❌ Ese slot ya está ocupado")
            this.render()
            return
        }

        const cardIndexForAnim = this.selectedCardIndex

        this._animateCardToSlot(cardIndexForAnim, "player", row, col, () => {
            this._executePlaceCard(card, row, col, cardIndexForAnim)
        })

        this.selectedCardIndex = null
        this.render()
    }

    _executePlaceCard(card, row, col, originalIndex) {
        if (this.board.board.player[row][col] !== null) return

        const currentIndex = this.playerHand.findIndex(c => c.id === card.id)
        if (currentIndex === -1) return

        const troop = new Troop(card, "player")
        this.board.board.player[row][col] = troop
        troop.col = col

        this.playerEnergy -= card.cost
        this._playCardFromHand(currentIndex)

        this.log(`✅ Invocaste ${troop.name} en ${row.toUpperCase()} col ${col + 1}`)
        this._queueAnim("player", row, col, "summon")

        this._applyOnPlayEffects(troop, card)

        const dead = this.board.removeDead()
        this._applyDeathEffects(dead)
        this._checkGameOver()
        this.render()
        this._flushAnims()
    }

    _applyOnPlayEffects(troop, card) {
        if (!card.effect) return

        if (card.effect.type === "chargeAttack") {
            const target = this.board.getTroop("enemy", "melee", troop.col)
            if (target) {
                const leaderRef = { health: this.enemyHealth }
                troop.attackTarget(target, this, leaderRef)
                this.log(`🐾 ${troop.name} ataca inmediatamente a ${target.name}`)
                troop.hasAttacked = false
            } else {
                this.enemyHealth -= troop.attack
                this.log(`🐾 ${troop.name} ataca al líder enemigo: -${troop.attack} HP`)
            }
        }

        if (card.effect.type === "shieldAllyOnPlay") {
            const rangedAlly = this.board.getTroop("player", "ranged", troop.col)
            if (rangedAlly) {
                rangedAlly.health += card.effect.healthBonus
                this.log(`🛡️ ${troop.name} otorga +${card.effect.healthBonus} HP a ${rangedAlly.name}`)
            }
        }

        if (card.effect.type === "healAllyOnPlay") {
            const allies = this.board.getTroops("player").filter(({ troop: t }) => t !== troop)
            if (allies.length > 0) {
                this.pendingHealTarget = { amount: card.effect.healAmount }
                this.log(`💚 Elegí una tropa aliada para curar (+${card.effect.healAmount} HP)`)
            }
        }

        if (card.effect.type === "summonSpecterEachTurn") {
            troop._summonSpecter(this.board, this)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HECHIZOS
    // ═══════════════════════════════════════════════════════════════════════════

    _handleSpellPlay(index) {
        const card   = this.playerHand[index]
        const effect = card.effect

        if (effect.type === "buffAllAllies") {
            this.board.getTroops("player").forEach(({ troop }) => {
                troop.attack += effect.attackBonus
            })
            this.playerEnergy -= card.cost
            this._playCardFromHand(index)
            this.log(`⚔️ Furia de Guerra: todas las tropas aliadas ganan +${effect.attackBonus} ATK`)
            this.render()
            return
        }

        if (effect.type === "damageAllEnemies") {
            this.board.getTroops("enemy").forEach(({ troop, row, col }) => {
                troop.takeDamage(effect.damage, this)
                this._queueAnim("enemy", row, col, "hit")
            })
            this.playerEnergy -= card.cost
            this._playCardFromHand(index)
            const dead = this.board.removeDead()
            this._applyDeathEffects(dead)
            this._checkGameOver()
            this.log(`🌩️ Tormenta de Sombras: ${effect.damage} daño a todos los enemigos`)
            this.render()
            this._flushAnims()
            return
        }

        if (effect.type === "healAlly") {
            if (this.board.getTroops("player").length === 0) {
                this.log("❌ No hay tropas aliadas"); this.render(); return
            }
            this.pendingSpell = { cardIndex: index, card }
            this.log(`💙 Elegí una tropa aliada para aplicar ${card.name}`)
            this.render()
            return
        }

        if (effect.type === "curseEnemy") {
            if (this.board.getTroops("enemy").length === 0) {
                this.log("❌ No hay tropas enemigas"); this.render(); return
            }
            this.pendingSpell = { cardIndex: index, card }
            this.log(`💜 Elegí una tropa enemiga para aplicar ${card.name}`)
            this.render()
            return
        }

        if (effect.type === "sacrificeTrade") {
            const allies  = this.board.getTroops("player")
            const enemies = this.board.getTroops("enemy")
            if (allies.length === 0 || enemies.length === 0) {
                this.log("❌ Necesitás tropas aliadas y enemigas"); this.render(); return
            }
            this.pendingSacrificeAlly = { cardIndex: index, card }
            this.log(`💀 Elegí una tropa ALIADA para sacrificar`)
            this.render()
            return
        }
    }

    applySpellToTarget(side, row, col) {
        if (this.pendingSacrificeAlly && side === "player") {
            const ally = this.board.getTroop("player", row, col)
            if (!ally) return
            this.pendingSacrificeEnemy = {
                allyRow: row, allyCol: col,
                card: this.pendingSacrificeAlly.card,
                cardIndex: this.pendingSacrificeAlly.cardIndex
            }
            this.pendingSacrificeAlly = null
            this.log(`💀 ${ally.name} será sacrificado. Ahora elegí una tropa ENEMIGA`)
            this.render()
            return
        }

        if (this.pendingSacrificeEnemy && side === "enemy") {
            const enemy = this.board.getTroop("enemy", row, col)
            if (!enemy) return
            const { allyRow, allyCol, card, cardIndex } = this.pendingSacrificeEnemy
            const ally = this.board.getTroop("player", allyRow, allyCol)
            if (ally) {
                this.log(`💀 ${ally.name} es sacrificado y ${enemy.name} es destruido`)
                this._queueAnim("player", allyRow, allyCol, "death")
                this._queueAnim("enemy",  row,     col,     "death")
                ally.health  = 0
                enemy.health = 0
            }
            this.playerEnergy -= card.cost
            this._playCardFromHand(cardIndex)
            this.pendingSacrificeEnemy = false
            const dead = this.board.removeDead()
            this._applyDeathEffects(dead)
            this._checkGameOver()
            this.render()
            this._flushAnims()
            return
        }

        if (!this.pendingSpell) return
        const { cardIndex, card } = this.pendingSpell
        const effect = card.effect
        const target = this.board.getTroop(side, row, col)
        if (!target) return

        if (effect.type === "healAlly" && side === "player") {
            target.heal(effect.amount)
            this.log(`💙 ${card.name}: ${target.name} recupera +${effect.amount} HP. HP: ${target.health}`)
            this.playerEnergy -= card.cost
            this._playCardFromHand(cardIndex)
            this.pendingSpell = null
        }

        if (effect.type === "curseEnemy" && side === "enemy") {
            target.applyCurse(effect.damagePerTurn, effect.duration)
            this._queueAnim("enemy", row, col, "hit")
            this.log(`💜 ${card.name}: ${target.name} maldito por ${effect.duration} turnos`)
            this.playerEnergy -= card.cost
            this._playCardFromHand(cardIndex)
            this.pendingSpell = null
        }

        this.render()
        this._flushAnims()
    }

    healAllyTarget(row, col) {
        if (!this.pendingHealTarget) return
        const target = this.board.getTroop("player", row, col)
        if (!target) return
        target.heal(this.pendingHealTarget.amount)
        this.log(`💚 ${target.name} recupera ${this.pendingHealTarget.amount} HP. HP: ${target.health}`)
        this.pendingHealTarget = null
        this.render()
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ATAQUES
    // ═══════════════════════════════════════════════════════════════════════════

    _canAttackLeader(troopRow, troopCol) {
        if (troopRow === "melee") {
            const meleeInCol  = this.board.getTroop("enemy", "melee",  troopCol)
            const rangedInCol = this.board.getTroop("enemy", "ranged", troopCol)
            return !meleeInCol && !rangedInCol
        } else {
            return this.board.getTroops("enemy").length === 0
        }
    }

    selectAttacker(row, col) {
        if (this.gameOver) return
        if (this.attacksUsed >= this.attackLimit) return
        if (this.pendingHealTarget || this.pendingSpell || this.selectedCardIndex !== null ||
            this.pendingSacrificeAlly || this.pendingSacrificeEnemy || this.pendingGuardianAdjacent) return
        const troop = this.board.getTroop("player", row, col)
        if (!troop || !troop.canAttack()) return
        this.selectedAttacker = { row, col, troop }
        this.log(`🎯 Seleccionaste: ${troop.name}`)
        this.render()
    }

    attackTarget(row, col) {
        if (!this.selectedAttacker) return
        if (this.attacksUsed >= this.attackLimit) return

        const attacker    = this.selectedAttacker.troop
        const attackerCol = this.selectedAttacker.col
        const attackerRow = this.selectedAttacker.row
        const defender    = this.board.getTroop("enemy", row, col)

        if (attacker.effect && attacker.effect.type === "doubleColumnAttack") {
            this._initiateGuardianAttack(attacker, attackerRow, attackerCol, row, col)
            return
        }

        if (attacker.type === "melee") {
            if (col !== attackerCol) {
                this.log("❌ Melee solo puede atacar su columna")
                this.render()
                return
            }
        }

        this._queueAnim("player", attackerRow, attackerCol, "attack")

        const fromEl3 = getCellElement("player", attackerRow, attackerCol)
        const toEl3   = defender
            ? getCellElement("enemy", row, col)
            : document.querySelector(".btn-leader")
        drawAttackLine(fromEl3, toEl3, "#f5a623")

        if (defender) {
            this._queueAnim("enemy", row, col, "hit")
            const leaderRef = { health: this.enemyHealth }
            attacker.attackTarget(defender, this, leaderRef)
            if (attacker.effect && attacker.effect.type === "excessDamageToLeader") {
                this.enemyHealth = leaderRef.health
            }
            if (defender.isDead()) this._queueAnim("enemy", row, col, "death")

            const defEl = getCellElement("enemy", row, col)
            setTimeout(() => {
                spawnCellParticles(defEl, "#ff4040", 10)
                spawnDamageFloat(defEl, attacker.attack, "damage")
            }, 180)
        } else {
            this.enemyHealth -= attacker.attack
            attacker.hasAttacked = true
            this.log(`⚔️ ${attacker.name} ataca al líder enemigo: -${attacker.attack} HP`)

            setTimeout(() => {
                spawnDamageFloat(document.querySelector(".enemy-bar"), attacker.attack, "leader")
                shakeHealthBar("enemy")
                screenFlash("rgba(255,60,30,0.14)", 280)
            }, 200)
        }

        this._checkSacerdoteHeal(attacker, "player")
        this._finishAttack()
    }

    attackEnemyLeaderDirect() {
        if (!this.selectedAttacker) return
        if (this.attacksUsed >= this.attackLimit) return
        if (this.gameOver) return

        const attacker    = this.selectedAttacker.troop
        const attackerRow = this.selectedAttacker.row
        const attackerCol = this.selectedAttacker.col

        if (!this._canAttackLeader(attackerRow, attackerCol)) {
            if (attackerRow === "melee") {
                this.log("❌ Melee solo puede atacar al líder si su columna está vacía (melee y ranged)")
            } else {
                this.log("❌ Ranged solo puede atacar al líder si no hay ninguna tropa enemiga")
            }
            this.render()
            return
        }

        this._queueAnim("player", attackerRow, attackerCol, "attack")

        const fromElD = getCellElement("player", attackerRow, attackerCol)
        const toElD   = document.querySelector(".btn-leader")
        drawAttackLine(fromElD, toElD, "#f5a623")

        this.enemyHealth -= attacker.attack
        attacker.hasAttacked = true
        this.log(`⚔️ ${attacker.name} ataca al líder enemigo: -${attacker.attack} HP`)

        setTimeout(() => {
            spawnDamageFloat(document.querySelector(".enemy-bar"), attacker.attack, "leader")
            shakeHealthBar("enemy")
            screenFlash("rgba(255,60,30,0.14)", 280)
        }, 200)

        this._checkSacerdoteHeal(attacker, "player")
        this._finishAttack()
    }

    _checkSacerdoteHeal(troop, side) {
        if (!troop.effect) return
        if (!troop.effect.healProtectorOnAttack) return
        if (troop.type !== "ranged") return
        const protector = this.board.getTroop(side, "melee", troop.col)
        if (protector) {
            protector.health += troop.effect.healProtectorAmount || 2
            this.log(`🙏 ${troop.name} cura ${troop.effect.healProtectorAmount || 2} HP a ${protector.name}`)
        }
    }

    _initiateGuardianAttack(attacker, attackerRow, attackerCol, targetRow, targetCol) {
        this._queueAnim("player", attackerRow, attackerCol, "attack")

        const mainTarget = this.board.getTroop("enemy", "melee", attackerCol)
        if (mainTarget) {
            mainTarget.takeDamage(attacker.attack, this)
            this._queueAnim("enemy", "melee", attackerCol, "hit")
            this.log(`⚔️ ${attacker.name} golpea a ${mainTarget.name}`)
            if (mainTarget.isDead()) this._queueAnim("enemy", "melee", attackerCol, "death")
        } else {
            this.enemyHealth -= attacker.attack
            this.log(`⚔️ ${attacker.name} golpea al líder (columna principal vacía)`)
        }

        const dead = this.board.removeDead()
        this._applyDeathEffects(dead)

        const adjCols        = this.board.getAdjacentCols(attackerCol)
        const adjWithTroops  = adjCols.filter(c => this.board.getTroop("enemy", "melee", c))

        if (adjWithTroops.length === 0) {
            attacker.hasAttacked = true
            this._checkGameOver()
            this.render()
            this._flushAnims()
            if (!this.gameOver) this._finishAttackNoDeselect(attacker)
            return
        }

        this.pendingGuardianAdjacent = { attacker, attackerRow, attackerCol, adjCols: adjWithTroops }
        this.log(`🌀 ${attacker.name}: elegí una columna ADYACENTE para el segundo golpe`)
        this._checkGameOver()
        this.render()
        this._flushAnims()
    }

    resolveGuardianAdjacentAttack(col) {
        if (!this.pendingGuardianAdjacent) return
        const { attacker, attackerRow, attackerCol } = this.pendingGuardianAdjacent

        const adjTarget = this.board.getTroop("enemy", "melee", col)
        if (adjTarget) {
            adjTarget.takeDamage(attacker.attack, this)
            this._queueAnim("enemy", "melee", col, "hit")
            this.log(`🌀 ${attacker.name} golpea también a ${adjTarget.name}`)
            if (adjTarget.isDead()) this._queueAnim("enemy", "melee", col, "death")
        }

        this.pendingGuardianAdjacent = null
        attacker.hasAttacked = true
        this._finishAttack()
    }

    _finishAttackNoDeselect(attacker) {
        this.attacksUsed++
        this.selectedAttacker = null
        this.render()
        this._flushAnims()
    }

    _finishAttack() {
        this.attacksUsed++
        this.selectedAttacker = null
        const dead = this.board.removeDead()
        this._applyDeathEffects(dead)
        this._checkGameOver()
        this.render()
        this._flushAnims()
    }

    _applyDeathEffects(deadList) {
        if (deadList.length === 0) return
        ;["player","enemy"].forEach(side => {
            ;["melee","ranged"].forEach(row => {
                this.board.board[side][row].forEach(t => {
                    if (t && t.effect && t.effect.type === "scavengerOnDeath") {
                        t.health += t.effect.healthGain * deadList.length
                        this.log(`🦅 ${t.name} gana +${t.effect.healthGain * deadList.length} HP`)
                    }
                })
            })
        })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FIN DE TURNO
    // ═══════════════════════════════════════════════════════════════════════════

    endTurn() {
        if (this.gameOver) return
        if (this.pendingHealTarget)     { this.log("❌ Debés elegir objetivo para el Sacerdote Oscuro"); this.render(); return }
        if (this.pendingSpell)          { this.log("❌ Debés elegir objetivo para el hechizo");          this.render(); return }
        if (this.pendingSacrificeAlly || this.pendingSacrificeEnemy) { this.log("❌ Debés completar el Sacrificio de Almas"); this.render(); return }
        if (this.pendingGuardianAdjacent) { this.log("❌ Debés elegir la columna adyacente del Guardián"); this.render(); return }

        const possible = this._possibleAttacksAtTurnStart
        const unused   = Math.max(0, Math.min(this.attackLimit, possible) - this.attacksUsed)
        const bonus    = Math.min(unused, 2)
        if (bonus > 0) {
            this.playerEnergy = Math.min(this.playerEnergy + bonus, this.maxEnergy)
            this.log(`⚡ Bonus energía por ${unused} ataque${unused > 1 ? "s" : ""} omitido${unused > 1 ? "s" : ""}: +${bonus}`)
        }

        this.phase = "enemy"
        this.selectedAttacker  = null
        this.selectedCardIndex = null
        this.log("── Turno del enemigo ──")
        this.render()
        setTimeout(() => { this._enemyTurnAnimated() }, 500)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TURNO DEL ENEMIGO
    // ═══════════════════════════════════════════════════════════════════════════

    _enemyTurnAnimated() {
        if (this.gameOver) return
        showTurnBanner("Turno Enemigo", "IA CALCULANDO...", "#ff5a47")
        this._enemyActionQueue = []
        EnemyAI.buildActionQueue(this, this._enemyActionQueue)
        this._processNextEnemyAction()
    }

    _processNextEnemyAction() {
        if (this.gameOver) return

        if (this._enemyActionQueue.length === 0) {
            this._enemyActionDisplay = null
            this._checkGameOver()
            if (!this.gameOver) {
                setTimeout(() => { this.startTurn() }, 600)
            }
            return
        }

        const action = this._enemyActionQueue.shift()

        if (action.type === "summon") {
            this._enemyActionDisplay = { type: "summon", name: action.card.name }
            this.render()
            setTimeout(() => {
                EnemyAI.executeSummon(this, action)
                this._checkGameOver()
                if (this.gameOver) return
                this.render()
                this._flushAnims()
                setTimeout(() => this._processNextEnemyAction(), 700)
            }, 500)

        } else if (action.type === "attack") {
            this._enemyActionDisplay = {
                type: "attack",
                attackerName: action.attackerName,
                targetName:   action.targetName || "Líder"
            }
            this.render()

            if (action.attackerCell) {
                const el = document.querySelector(`[data-cell="${action.attackerCell}"]`)
                if (el) {
                    el.classList.add("cell-enemy-selecting")
                    setTimeout(() => el.classList.remove("cell-enemy-selecting"), 600)
                }
            }

            setTimeout(() => {
                EnemyAI.executeAttack(this, action)

                if (action.targetIsLeader) {
                    const atkVal = action.attackerAtk || 0
                    setTimeout(() => {
                        shakeHealthBar("player")
                        screenFlash("rgba(200,40,40,0.16)", 300)
                        spawnDamageFloat(document.querySelector(".player-bar"), atkVal, "leader")
                    }, 250)
                }

                const dead = this.board.removeDead()
                this._applyDeathEffects(dead)
                this._checkGameOver()
                if (this.gameOver) return
                this.render()
                this._flushAnims()
                setTimeout(() => this._processNextEnemyAction(), 650)
            }, 550)

        } else {
            this._processNextEnemyAction()
        }
    }

    _countPossibleAttacks() {
        let count = 0
        ;["melee","ranged"].forEach(row => {
            this.board.board.player[row].forEach(t => {
                if (t && t.canAttack()) count++
            })
        })
        return Math.min(count, this.attackLimit)
    }

    _checkGameOver() {
        if (this.enemyHealth <= 0) {
            this.gameOver = true
            if (this.game) this.game.savePlayerHealth(this.playerHealth)
            this.log("🏆 ¡VICTORIA!")
            this.render()
        } else if (this.playerHealth <= 0) {
            this.gameOver = true
            this.log("💀 DERROTA. Run terminada.")
            this.render()
        }
    }

    toggleDeckViewer() { this.showDeckViewer = !this.showDeckViewer; this.render() }
    showPreview(card)  { this.previewCard = card; this.render() }
    hidePreview()      { this.previewCard = null; this.render() }

    log(msg) {
        this.logs.unshift(msg)
        if (this.logs.length > 20) this.logs.pop()
    }

    _getEnemyMaxHp() {
        const level = this.game?.runManager?.level || 1
        if (level === 1) return 5
        if (level === 2) return 10
        return level * 5
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    render() {
        const app = document.getElementById("app")
        if (!app) return

        const selId              = this.selectedAttacker ? `${this.selectedAttacker.row}-${this.selectedAttacker.col}` : null
        const healMode           = !!this.pendingHealTarget
        const spellMode          = !!this.pendingSpell
        const sacrificeAllyMode  = !!this.pendingSacrificeAlly
        const sacrificeEnemyMode = !!this.pendingSacrificeEnemy
        const guardianMode       = !!this.pendingGuardianAdjacent
        const placingCard        = this.selectedCardIndex !== null ? this.playerHand[this.selectedCardIndex] : null

        const pHpPct = Math.max(0, Math.round((this.playerHealth / 30) * 100))
        const eHpMax = this._getEnemyMaxHp()
        const eHpPct = Math.max(0, Math.round((this.enemyHealth / eHpMax) * 100))

        const canLeaderAttack = this.selectedAttacker
            ? this._canAttackLeader(this.selectedAttacker.row, this.selectedAttacker.col)
            : false

        const deckSize = this.game?.deckList?.length || 0

        app.innerHTML = `
        <div class="game-wrapper">

            <!-- PANEL IZQUIERDO: LOG -->
            <div class="side-panel left-panel">
                <div class="panel-title">📜 REGISTRO</div>
                <div class="log-section">
                    ${this.logs.slice(0,15).map(l => `<div class="log-line">${l}</div>`).join("")}
                </div>
            </div>

            <!-- CENTRO -->
            <div class="center-panel">

                <!-- Barra enemigo -->
                <div class="leader-bar enemy-bar">
                    <span class="leader-label">👹 ENEMIGO</span>
                    <div class="hp-block">
                        <span class="hp-value ${this.enemyHealth <= 5 ? 'hp-low' : ''}">❤️ ${this.enemyHealth}</span>
                        <div class="hp-bar-wrap"><div class="hp-bar-fill enemy" style="width:${eHpPct}%"></div></div>
                    </div>
                    <div class="energy-block">
                        <span class="energy-label">⚡</span>
                        <div class="energy-pips">${this._renderPips(this.enemyEnergy, this.maxEnergy)}</div>
                    </div>
                    ${this._enemyActionDisplay ? `
                        <div class="enemy-action-banner">
                            ${this._enemyActionDisplay.type === "summon"
                                ? `🃏 Invoca <strong>${this._enemyActionDisplay.name}</strong>`
                                : `⚔️ <strong>${this._enemyActionDisplay.attackerName}</strong> → ${this._enemyActionDisplay.targetName}`
                            }
                        </div>
                    ` : ""}
                </div>

                <!-- Área de tableros: crece automáticamente cuando la mano se colapsa -->
                <div class="battlefield-area">

                <!-- Tablero enemigo -->
                <div class="battlefield">
                    ${this._renderRow("enemy","ranged",selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                    ${this._renderRow("enemy","melee", selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                </div>

                <!-- Divisor -->
                <div class="divider">
                    <button class="btn-leader ${this.selectedAttacker && canLeaderAttack ? 'btn-active' : ''}"
                        onclick="window.game.combatSystem.attackEnemyLeaderDirect()"
                        ${!this.selectedAttacker || !canLeaderAttack ? 'title="' + (!this.selectedAttacker ? 'Seleccioná una tropa primero' : 'Condiciones no cumplidas') + '"' : ''}>
                        ⚡ Atacar Líder
                    </button>
                </div>

                <!-- Tablero jugador -->
                <div class="battlefield">
                    ${this._renderRow("player","melee", selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                    ${this._renderRow("player","ranged",selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                </div>

                </div><!-- /battlefield-area -->

                <!-- Zona colapsable: barra jugador + mano. CSS puro, sin JS -->
                <div class="player-zone-collapse">

                    <!-- Barra jugador (siempre visible, no colapsa) -->
                    <div class="leader-bar player-bar">
                        <span class="leader-label">🧙 JUGADOR</span>
                        <div class="hp-block">
                            <span class="hp-value ${this.playerHealth <= 10 ? 'hp-low' : ''}">❤️ ${this.playerHealth}</span>
                            <div class="hp-bar-wrap"><div class="hp-bar-fill player" style="width:${pHpPct}%"></div></div>
                        </div>
                        <div class="energy-block">
                            <span class="energy-label">⚡${this.playerEnergy}</span>
                            <div class="energy-pips">${this._renderPips(this.playerEnergy, this.maxEnergy)}</div>
                        </div>
                        <div class="attack-block">
                            <span class="attack-label">ATK</span>
                            <div class="atk-pips">${this._renderAtkPips()}</div>
                        </div>
                        <span class="turn-display">T${this.turn}</span>

                        <button class="btn-deck-viewer ${this.showDeckViewer ? 'btn-deck-active' : ''}"
                            onclick="window.game.combatSystem.toggleDeckViewer()">
                            🂠 Mazo (${deckSize}/10)
                        </button>

                        <div style="margin-left:auto">
                            ${this.phase !== "enemy" ? `
                                <button class="btn-end" onclick="window.game.combatSystem.endTurn()">
                                    Fin de Turno →
                                </button>
                            ` : `<span class="enemy-turn-label">⏳ Turno enemigo...</span>`}
                        </div>
                    </div>

                    <!-- Mano: se colapsa con CSS hover en player-zone-collapse -->
                    <div class="hand-collapse-hint">▲ MANO ▲</div>
                    <div class="hand-section">
                        <div class="hand-label">MANO (${this.playerHand.length}/${MAX_HAND_SIZE})</div>
                        <div class="hand">
                            ${this.playerHand.map((card, i) => this._renderCard(card, i)).join("")}
                        </div>
                    </div>

                </div><!-- /player-zone-collapse -->

            </div>

            <!-- PANEL DERECHO -->
            <div class="side-panel right-panel">
                <div class="panel-title">📖 INFO</div>
                <div class="info-content">
                    ${placingCard ? `
                        <div class="info-hint placing">
                            🃏 Colocando:<br><strong>${placingCard.name}</strong><br>
                            <span style="color:var(--text-dim);font-size:0.75rem">Slot ${placingCard.subtype === "ranged" ? "RANGED" : "MELEE"} libre</span>
                        </div>
                    ` : ""}
                    ${this.selectedAttacker ? `
                        <div class="info-hint attacking">
                            ⚔️ Atacando con:<br><strong>${this.selectedAttacker.troop.name}</strong><br>
                            <span style="color:var(--text-dim);font-size:0.75rem">
                                ${this.selectedAttacker.row === "melee" ? "Melee: ataca su columna" : "Ranged: ataca cualquier enemigo"}
                            </span><br>
                            <span style="color:${canLeaderAttack ? 'var(--green)' : 'var(--red-bright)'};font-size:0.72rem">
                                ${canLeaderAttack ? "✅ Puede atacar al líder" : (this.selectedAttacker.row === "melee" ? "❌ Columna no vacía" : "❌ Hay tropas enemigas")}
                            </span>
                        </div>
                    ` : ""}
                    ${healMode           ? `<div class="info-hint heal">💚 Elegí una tropa aliada para curar</div>` : ""}
                    ${spellMode          ? `<div class="info-hint spell">✨ Elegí objetivo para el hechizo</div>` : ""}
                    ${sacrificeAllyMode  ? `<div class="info-hint sacrifice">💀 Elegí tropa ALIADA a sacrificar</div>` : ""}
                    ${sacrificeEnemyMode ? `<div class="info-hint sacrifice">💀 Elegí tropa ENEMIGA a destruir</div>` : ""}
                    ${guardianMode       ? `<div class="info-hint attacking">🌀 <strong>Guardián:</strong><br>Elegí columna ADYACENTE para el segundo golpe</div>` : ""}
                    <div class="info-hint neutral" style="margin-top:auto">
                        <strong style="color:var(--gold)">🖱️ Controles</strong><br>
                        <span style="color:var(--text-dim);font-size:0.72rem">
                            Click izq: seleccionar<br>
                            Click der: ver habilidad<br>
                            ESC: cancelar
                        </span>
                    </div>
                </div>
            </div>

        </div>

        <!-- Visor de mazo -->
        ${this.showDeckViewer ? this._renderDeckViewer() : ""}

        <!-- Preview modal -->
        ${this.previewCard ? this._renderPreviewModal(this.previewCard) : ""}

        <!-- Game Over / Victoria -->
        ${this.gameOver ? this._renderGameOver() : ""}
        `

        document.onkeydown = (e) => {
            if (e.key === "Escape") {
                this.selectedCardIndex       = null
                this.selectedAttacker        = null
                this.pendingSpell            = null
                this.pendingSacrificeAlly    = null
                this.pendingSacrificeEnemy   = false
                this.pendingGuardianAdjacent = null
                this.previewCard             = null
                this.showDeckViewer          = false
                this.render()
            }
        }

        const overlay = document.getElementById("preview-overlay")
        if (overlay) {
            overlay.onclick = (e) => { if (e.target === overlay) { this.previewCard = null; this.render() } }
        }
        const deckOverlay = document.getElementById("deck-viewer-overlay")
        if (deckOverlay) {
            deckOverlay.onclick = (e) => { if (e.target === deckOverlay) { this.showDeckViewer = false; this.render() } }
        }

    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GAME OVER
    // ═══════════════════════════════════════════════════════════════════════════

    _renderGameOver() {
        const isVictory = this.enemyHealth <= 0
        const level     = this.game?.runManager?.level || 1
        const isRunEnd  = level >= 10

        return `
        <div class="game-over-overlay">
            <div class="game-over-box">
                <div class="game-over-title">
                    ${isVictory ? "🏆 VICTORIA" : "💀 DERROTA"}
                </div>
                ${isVictory && !isRunEnd ? `
                    <div class="game-over-subtitle">Nivel ${level} completado</div>
                    <button class="btn-restart btn-next-level" onclick="window.game.advanceLevel()">
                        Siguiente Nivel →
                    </button>
                ` : isVictory ? `
                    <div class="game-over-subtitle">¡Run completada! ¡Felicitaciones!</div>
                    <button class="btn-restart" onclick="location.reload()">Nueva Run</button>
                ` : `
                    <button class="btn-restart" onclick="location.reload()">Reiniciar</button>
                `}
            </div>
        </div>`
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VISOR DE MAZO
    // ═══════════════════════════════════════════════════════════════════════════

    _renderDeckViewer() {
        const deckList  = this.game?.deckList || []
        const handIds   = new Set(this.playerHand.map(c => c.id))

        const slots = []
        for (let i = 0; i < 10; i++) {
            slots.push(deckList[i] || null)
        }

        const cycleMap = {}
        this.playerCycle.forEach((c, idx) => {
            if (!(c.id in cycleMap)) cycleMap[c.id] = idx + 1
        })

        const renderSlot = (card, slotIndex) => {
            if (!card) {
                return `
                <div class="dv-slot dv-slot-empty" title="Slot vacío — ganás más cartas avanzando en la run">
                    <div class="dv-slot-num">${slotIndex + 1}</div>
                    <div class="dv-empty-icon">🔒</div>
                    <div class="dv-empty-label">Vacío</div>
                </div>`
            }

            const isSpell   = card.type === "spell"
            const inHand    = handIds.has(card.id)
            const rarity    = card.rarity ? RARITY_CONFIG[card.rarity] : null
            const cyclePos  = cycleMap[card.id]

            const borderStyle = rarity ? `border-color: ${rarity.border};` : "border-color: #555;"
            const glowStyle   = rarity ? `box-shadow: 0 0 10px ${rarity.glow};` : ""

            const imgHtml = card.image
                ? `<img src="${card.image}" alt="" onerror="this.style.display='none'">`
                : `<div class="dv-img-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

            const rarityDot = rarity
                ? `<div class="dv-rarity-dot" style="background:${rarity.color}" title="${rarity.label}"></div>`
                : `<div class="dv-rarity-dot dv-spell-dot" title="Hechizo">✨</div>`

            return `
            <div class="dv-slot dv-slot-filled ${inHand ? 'dv-slot-inhand' : ''}"
                 style="${borderStyle}${inHand ? '' : glowStyle}"
                 title="${card.name}${inHand ? ' — en mano' : cyclePos ? ` — #${cyclePos} en el ciclo` : ''}"
                 oncontextmenu="event.preventDefault(); window.game.combatSystem.showPreview(${JSON.stringify(card).replace(/"/g,'&quot;')})">

                <div class="dv-slot-num">${slotIndex + 1}</div>
                ${rarityDot}

                <div class="dv-card-img">${imgHtml}</div>

                <div class="dv-card-footer">
                    <span class="dv-card-name">${card.name}</span>
                    <div class="dv-card-stats">
                        <span class="dv-cost">⚡${card.cost}</span>
                        ${!isSpell ? `<span class="dv-atk">⚔${card.attack}</span><span class="dv-hp">❤${card.health}</span>` : ""}
                    </div>
                </div>

                ${inHand ? `<div class="dv-badge dv-badge-hand">MANO</div>` : ""}
                ${!inHand && cyclePos ? `<div class="dv-cycle-pos">#${cyclePos}</div>` : ""}
            </div>`
        }

        return `
        <div class="deck-viewer-overlay" id="deck-viewer-overlay">
            <div class="deck-viewer-modal">
                <div class="dv-header">
                    <span class="dv-title">🂠 MAZO (${deckList.length}/10)</span>
                    <div class="dv-legend">
                        ${Object.entries(RARITY_CONFIG).map(([key, r]) =>
                            `<span class="dv-legend-item">
                                <span class="dv-dot" style="background:${r.color}; box-shadow: 0 0 4px ${r.glow}"></span>
                                ${r.label}
                            </span>`
                        ).join("")}
                        <span class="dv-legend-item">
                            <span class="dv-dot" style="background:#3498db; box-shadow: 0 0 4px rgba(52,152,219,0.6)"></span>
                            EN MANO
                        </span>
                    </div>
                    <button class="dv-close" onclick="window.game.combatSystem.toggleDeckViewer()">✕</button>
                </div>

                <div class="dv-slots-grid">
                    ${slots.map((card, i) => renderSlot(card, i)).join("")}
                </div>

                <div class="dv-footer-info">
                    <span>🔄 Las cartas jugadas vuelven al ciclo automáticamente</span>
                    <span>🔒 Ganás una carta nueva al completar cada combate</span>
                </div>
            </div>
        </div>`
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS DE RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    _renderPips(current, max) {
        let html = ""
        for (let i = 0; i < max; i++) {
            html += `<div class="pip ${i < current ? 'filled' : ''}"></div>`
        }
        return html
    }

    _renderAtkPips() {
        let html = ""
        for (let i = 0; i < this.attackLimit; i++) {
            html += `<span class="atk-pip ${i < this.attacksUsed ? 'used' : ''}">⚔</span>`
        }
        return html
    }

    _renderPreviewModal(card) {
        const isSpell   = card.type === "spell"
        const chargeInfo = this._getChargeInfo(card)
        const rarity    = card.rarity ? RARITY_CONFIG[card.rarity] : null

        const imgTag = card.image
            ? `<img class="preview-card-img" src="${card.image}" alt="${card.name}" onerror="this.style.display='none'">`
            : `<div class="preview-card-img-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

        const liveTroop = this._findLiveTroop(card)

        const rarityBadge = rarity
            ? `<div class="pv2-rarity-badge" style="color:${rarity.color}; border-color:${rarity.border}; box-shadow: 0 0 10px ${rarity.glow}">
                   ${rarity.label}
               </div>`
            : `<div class="pv2-rarity-badge pv2-spell-badge">✨ HECHIZO</div>`

        return `
        <div class="preview-overlay" id="preview-overlay">
            <div class="preview-modal-v2" ${rarity ? `style="border-color:${rarity.border}; box-shadow: 0 0 60px ${rarity.glow}, 0 0 80px rgba(0,0,0,0.9)"` : ""}>
                <div class="pv2-img-wrap">
                    ${imgTag}
                </div>
                <div class="pv2-body">
                    ${rarityBadge}
                    <div class="pv2-name">${card.name}</div>
                    <div class="pv2-type">${isSpell ? "✨ Hechizo" : card.subtype === "ranged" ? "🏹 A Distancia" : "⚔️ Cuerpo a Cuerpo"}</div>

                    ${chargeInfo ? `
                        <div class="pv2-charge">
                            <span class="pv2-charge-label">Carga:</span>
                            <span class="pv2-charge-val">${chargeInfo.current}/${chargeInfo.max}</span>
                            <div class="pv2-charge-bar">
                                <div class="pv2-charge-fill" style="width:${Math.round((chargeInfo.current/chargeInfo.max)*100)}%"></div>
                            </div>
                        </div>
                    ` : ""}

                    ${card.effectDescription ? `
                        <div class="pv2-effect">
                            <span class="pv2-effect-label">Habilidad:</span>
                            <span class="pv2-effect-text">${card.effectDescription}</span>
                        </div>
                    ` : `<div class="pv2-effect"><span class="pv2-effect-text pv2-no-effect">Sin habilidad especial</span></div>`}

                    ${liveTroop && (liveTroop.poisonTurnsLeft > 0 || liveTroop.burnTurnsLeft > 0 || liveTroop.curseTurnsLeft > 0 || liveTroop.isMarked) ? `
                        <div class="pv2-status">
                            ${liveTroop.poisonTurnsLeft > 0 ? `<span class="pv2-status-tag poison">☠ Veneno ${liveTroop.poisonTurnsLeft}t</span>` : ""}
                            ${liveTroop.burnTurnsLeft > 0 ? `<span class="pv2-status-tag burn">🔥 Quemadura ${liveTroop.burnTurnsLeft}t</span>` : ""}
                            ${liveTroop.curseTurnsLeft > 0 ? `<span class="pv2-status-tag curse">💜 Maldición ${liveTroop.curseTurnsLeft}t</span>` : ""}
                            ${liveTroop.isMarked ? `<span class="pv2-status-tag mark">🎯 Marcado</span>` : ""}
                        </div>
                    ` : ""}

                    <button class="pv2-close" onclick="window.game.combatSystem.hidePreview()">✕ Cerrar</button>
                </div>
            </div>
        </div>`
    }

    _findLiveTroop(card) {
        if (!card || !card.id) return null
        for (const side of ["player", "enemy"]) {
            for (const row of ["melee", "ranged"]) {
                for (const t of this.board.board[side][row]) {
                    if (t && t.id === card.id) return t
                }
            }
        }
        return null
    }

    _getChargeInfo(card) {
        const liveTroop = this._findLiveTroop(card)
        if (!liveTroop || !liveTroop.effect) return null
        if (liveTroop.effect.type === "criticalCycle") {
            return { current: liveTroop.shots, max: liveTroop.effect.shotsNeeded }
        }
        if (liveTroop.effect.type === "stunEveryNAttacks") {
            return { current: liveTroop.effect.shotsCount, max: liveTroop.effect.attacksNeeded }
        }
        return null
    }

    _renderRow(side, row, selId, healMode, spellMode, sacrificeAllyMode, sacrificeEnemyMode, placingCard, guardianMode) {
        const cells    = this.board.board[side][row]
        const rowLabel = row === "melee" ? "MELEE" : "RANGED"

        const guardianAdjCols = guardianMode && this.pendingGuardianAdjacent
            ? this.pendingGuardianAdjacent.adjCols
            : []

        return `
        <div class="board-row">
            <div class="row-label">${rowLabel}</div>
            ${cells.map((troop, col) => {
                const cellId             = `${row}-${col}`
                const dataCellId         = `${side}-${row}-${col}`
                const isSelected         = selId === cellId && side === "player"
                const isAttackable       = !!this.selectedAttacker && side === "enemy" && !!troop && !guardianMode
                const isHealable         = healMode && side === "player" && !!troop
                const isSpellTarget      = spellMode && (
                    (this.pendingSpell?.card?.effect?.type === "healAlly"   && side === "player" && !!troop) ||
                    (this.pendingSpell?.card?.effect?.type === "curseEnemy" && side === "enemy"  && !!troop)
                )
                const isSacrificeAlly    = sacrificeAllyMode  && side === "player" && !!troop
                const isSacrificeEnemy   = sacrificeEnemyMode && side === "enemy"  && !!troop
                const isPlaceable        = placingCard && side === "player" && !troop &&
                    ((placingCard.subtype === "ranged" && row === "ranged") ||
                     (placingCard.subtype !== "ranged" && row === "melee"))
                const isGuardianTarget   = guardianMode && side === "enemy" && row === "melee" && guardianAdjCols.includes(col) && !!troop

                let clickFn = ""
                if (isPlaceable) {
                    clickFn = `onclick="window.game.combatSystem.placeCardInSlot('${row}',${col})"`
                } else if (isGuardianTarget) {
                    clickFn = `onclick="window.game.combatSystem.resolveGuardianAdjacentAttack(${col})"`
                } else if (side === "player" && troop && !healMode && !spellMode && !sacrificeAllyMode && !isSacrificeEnemy && !placingCard && !guardianMode) {
                    clickFn = `onclick="window.game.combatSystem.selectAttacker('${row}',${col})"`
                } else if (side === "player" && troop && healMode) {
                    clickFn = `onclick="window.game.combatSystem.healAllyTarget('${row}',${col})"`
                } else if (isSpellTarget || isSacrificeAlly || isSacrificeEnemy) {
                    clickFn = `onclick="window.game.combatSystem.applySpellToTarget('${side}','${row}',${col})"`
                } else if (side === "enemy" && this.selectedAttacker && !guardianMode) {
                    clickFn = `onclick="window.game.combatSystem.attackTarget('${row}',${col})"`
                }

                const rightClickFn = troop
                    ? `oncontextmenu="event.preventDefault(); window.game.combatSystem.showPreview(window._troopCardRef('${troop.id}','${side}','${row}',${col}))"`
                    : ""

                const imgHtml = troop && troop.image
                    ? `<img class="troop-img" src="${troop.image}" alt="" onerror="this.style.display='none'">`
                    : ""

                const chargeTag = troop ? this._getCellChargeTag(troop) : ""

                const rarity = troop?.rarity ? RARITY_CONFIG[troop.rarity] : null
                const rarityStyle = rarity && side === "player"
                    ? `style="--cell-rarity-border: ${rarity.border}; --cell-rarity-glow: ${rarity.glow}"`
                    : ""

                return `
                <div class="cell
                    ${troop ? "cell-filled" : "cell-empty"}
                    ${isSelected        ? "cell-selected"       : ""}
                    ${isAttackable      ? "cell-attackable"     : ""}
                    ${isHealable        ? "cell-healable"       : ""}
                    ${isSpellTarget     ? "cell-spell-target"   : ""}
                    ${isSacrificeAlly   ? "cell-sacrifice"      : ""}
                    ${isSacrificeEnemy  ? "cell-sacrifice-enemy": ""}
                    ${isPlaceable       ? "cell-placeable"      : ""}
                    ${isGuardianTarget  ? "cell-guardian-target": ""}
                    ${side === "enemy"  ? "cell-enemy"          : "cell-player"}
                    ${rarity && side === "player" ? `cell-rarity-${troop.rarity}` : ""}
                " ${clickFn} ${rightClickFn} data-cell="${dataCellId}">
                    ${imgHtml}
                    ${troop ? `
                        <div class="troop-overlay">
                            <div class="troop-name">${troop.name}</div>
                            <div class="troop-stats">
                                <span class="atk">⚔${troop.attack}</span>
                                <span class="hp ${troop.health <= 2 ? 'hp-crit' : ''}">❤${troop.health}</span>
                            </div>
                            ${chargeTag}
                            <div class="troop-tags">
                                ${troop.summonFatigue     ? '<span class="tag tag-fatigue" title="Fatiga">😴</span>'         : ""}
                                ${troop.isStunned         ? '<span class="tag tag-stun" title="Aturdido">⚡</span>'          : ""}
                                ${troop.poisonTurnsLeft > 0  ? `<span class="tag tag-poison">☠${troop.poisonTurnsLeft}</span>` : ""}
                                ${troop.burnTurnsLeft > 0    ? `<span class="tag tag-burn">🔥${troop.burnTurnsLeft}</span>`    : ""}
                                ${troop.curseTurnsLeft > 0   ? `<span class="tag tag-curse">💜${troop.curseTurnsLeft}</span>`  : ""}
                                ${troop.isMarked          ? '<span class="tag tag-mark">🎯</span>'                           : ""}
                                ${troop.effect?.type === "lastStand" && troop.effect?.used ? '<span class="tag tag-used">💔</span>' : ""}
                                ${troop.hasAttacked && !troop.summonFatigue && !troop.isStunned ? '<span class="tag tag-attacked">🗡️</span>' : ""}
                            </div>
                        </div>
                    ` : isPlaceable
                        ? `<div class="cell-placeholder placeable-hint">＋</div>`
                        : `<div class="cell-placeholder">—</div>`
                    }
                </div>`
            }).join("")}
        </div>`
    }

    _getCellChargeTag(troop) {
        if (!troop.effect) return ""
        if (troop.effect.type === "criticalCycle") {
            return `<div class="charge-counter" title="Carga crítico">💥 ${troop.shots}/${troop.effect.shotsNeeded}</div>`
        }
        if (troop.effect.type === "stunEveryNAttacks") {
            return `<div class="charge-counter" title="Carga aturdimiento">⚡ ${troop.effect.shotsCount}/${troop.effect.attacksNeeded}</div>`
        }
        return ""
    }

    _renderCard(card, index) {
        const canAfford  = card.cost <= this.playerEnergy
        const isSelected = this.selectedCardIndex === index
        const isSpell    = card.type === "spell"
        const rarity     = card.rarity ? RARITY_CONFIG[card.rarity] : null

        const rarityClass = card.rarity ? `rarity-${card.rarity}` : ""

        const rarityStyle = rarity
            ? `border-color: ${rarity.border}; ${canAfford ? `box-shadow: 0 0 8px ${rarity.glow};` : ""}`
            : ""

        const rarityBadge = rarity
            ? `<div class="card-rarity-badge" style="color:${rarity.color}; border-color:${rarity.border}">${rarity.label}</div>`
            : `<div class="card-rarity-badge spell-rarity">✨ HECHIZO</div>`

        const imgHtml = card.image
            ? `<div class="card-img-wrap">
                <img src="${card.image}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>${isSpell ? '✨' : '⚔️'}</div>'">
               </div>`
            : `<div class="card-img-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

        return `
        <div class="hand-card
            ${rarityClass}
            ${canAfford  ? "card-playable"    : "card-unaffordable"}
            ${isSelected ? "card-selected"    : ""}
            ${isSpell    ? "card-spell"       : ""}
        "
            style="${isSelected ? `border-color: var(--gold); box-shadow: 0 0 22px rgba(201,168,76,0.55);` : rarityStyle}"
            onclick="window.game.combatSystem.selectCard(${index})"
            oncontextmenu="event.preventDefault(); window.game.combatSystem.showPreview(${JSON.stringify(card).replace(/"/g,'&quot;')})">
            ${imgHtml}
            <div class="card-body">
                ${rarityBadge}
            </div>
        </div>`
    }
}

// ── Referencia global para click derecho en tropas del tablero ────────────────
window._troopCardRef = function(id, side, row, col) {
    const cs    = window.game.combatSystem
    const troop = cs.board.getTroop(side, row, col)
    if (!troop) return null
    const allCards = Object.values(window._cardsDataCache || {})
    const found    = allCards.find(c => c.id === troop.id)
    if (found) return found
    return {
        id:               troop.id,
        name:             troop.name,
        type:             "troop",
        subtype:          troop.type,
        cost:             "?",
        attack:           troop.attack,
        health:           troop.health,
        image:            troop.image || null,
        effectDescription: troop.effect ? `Efecto: ${troop.effect.type}` : "Sin habilidad"
    }
}

import { cardsData as _cd } from "../Data/cardsdata.js"
window._cardsDataCache = _cd