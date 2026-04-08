import { BoardSystem } from "./boardsystem.js"
import { Troop } from "../Entidades/troop.js"
import { EnemyAI } from "../AI/enemyAI.js"
import { cardsData } from "../Data/cardsdata.js"

export class CombatSystem {

    constructor(game) {
        this.game = game
        this.board = new BoardSystem()

        this.playerHealth = 30
        this.enemyHealth = 30

        this.playerEnergy = 5
        this.enemyEnergy = 5
        this.maxEnergy = 10

        this.attackLimit = 3
        this.attacksUsed = 0

        this._possibleAttacksAtTurnStart = 0

        this.selectedAttacker = null
        this.selectedCardIndex = null
        this.pendingHealTarget = null
        this.pendingSpell = null
        this.pendingSacrificeAlly = null
        this.pendingSacrificeEnemy = false

        // FIX 5: modo de selección de columna adyacente para el Guardián
        this.pendingGuardianAdjacent = null  // { attacker, attackerRow, attackerCol, mainTargetName }

        this.turn = 1
        this.phase = "play"
        this.gameOver = false
        this.logs = []

        this.playerHand = []
        this.enemyHand = []
        this.playerDeck = []
        this.enemyDeck = []

        this.previewCard = null

        this._pendingAnims = []

        this._enemyActionDisplay = null
        this._enemyActionQueue   = []
    }

    // ─── Animaciones ─────────────────────────────────────────────────────────

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

    // ─── Combate ─────────────────────────────────────────────────────────────

    startCombat() {
        this.log("⚔️ Comienza el combate")
        this.playerDeck = this._buildDeck("player")
        this.enemyDeck  = this._buildDeck("enemy")
        // FIX 1: mano inicial de 5 cartas
        for (let i = 0; i < 5; i++) this._drawCard("player")
        for (let i = 0; i < 5; i++) this._drawCard("enemy")
        this._possibleAttacksAtTurnStart = 0
        this.render()
    }

    _buildDeck(side) {
        const all = Object.values(cardsData)
        let pool
        if (side === "player") {
            pool = all
        } else {
            const level = this.game?.runManager?.level || 1
            pool = EnemyAI.getEnemyDeck(level)
        }
        if (side === "enemy") {
            while (pool.length < 20) {
                pool = [...pool, ...pool]
            }
        }
        return [...pool].sort(() => Math.random() - 0.5)
    }

    _drawCard(side) {
        if (side === "player") {
            if (this.playerDeck.length === 0) return
            const card = this.playerDeck.shift()
            // FIX 1: límite de mano = 5
            if (this.playerHand.length < 5) this.playerHand.push(card)
        } else {
            if (this.enemyDeck.length === 0) {
                const level = this.game?.runManager?.level || 1
                let pool = EnemyAI.getEnemyDeck(level)
                while (pool.length < 20) pool = [...pool, ...pool]
                this.enemyDeck = [...pool].sort(() => Math.random() - 0.5)
            }
            const card = this.enemyDeck.shift()
            if (this.enemyHand.length < 7) this.enemyHand.push(card)
        }
    }

    startTurn() {
        if (this.gameOver) return
        this.turn++
        this.phase = "play"
        this.attacksUsed = 0
        this.selectedAttacker = null
        this.selectedCardIndex = null
        this.pendingSpell = null
        this.pendingSacrificeAlly = null
        this.pendingSacrificeEnemy = false
        this.pendingGuardianAdjacent = null
        this._enemyActionDisplay = null

        this.playerEnergy = Math.min(this.playerEnergy + 3, this.maxEnergy)
        this.enemyEnergy  = Math.min(this.enemyEnergy  + 3, this.maxEnergy)

        this._drawCard("player")
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

    // ─── Selección de carta ───────────────────────────────────────────────────

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
            this.selectedAttacker = null
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

        const troop = new Troop(card, "player")
        this.board.board.player[row][col] = troop
        troop.col = col

        this.playerEnergy -= card.cost
        this.playerHand.splice(this.selectedCardIndex, 1)
        this.selectedCardIndex = null

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

    // ─── Hechizos ─────────────────────────────────────────────────────────────

    _handleSpellPlay(index) {
        const card   = this.playerHand[index]
        const effect = card.effect

        if (effect.type === "buffAllAllies") {
            this.board.getTroops("player").forEach(({ troop }) => {
                troop.attack += effect.attackBonus
            })
            this.playerEnergy -= card.cost
            this.playerHand.splice(index, 1)
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
            this.playerHand.splice(index, 1)
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
            this.pendingSacrificeEnemy = { allyRow: row, allyCol: col, card: this.pendingSacrificeAlly.card, cardIndex: this.pendingSacrificeAlly.cardIndex }
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
            this.playerHand.splice(cardIndex, 1)
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
            this.playerHand.splice(cardIndex, 1)
            this.pendingSpell = null
        }

        if (effect.type === "curseEnemy" && side === "enemy") {
            target.applyCurse(effect.damagePerTurn, effect.duration)
            this._queueAnim("enemy", row, col, "hit")
            this.log(`💜 ${card.name}: ${target.name} maldito por ${effect.duration} turnos`)
            this.playerEnergy -= card.cost
            this.playerHand.splice(cardIndex, 1)
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

    // ─── Lógica de ataque al líder ────────────────────────────────────────────

    _canAttackLeader(troopRow, troopCol) {
        if (troopRow === "melee") {
            const meleeInCol  = this.board.getTroop("enemy", "melee",  troopCol)
            const rangedInCol = this.board.getTroop("enemy", "ranged", troopCol)
            return !meleeInCol && !rangedInCol
        } else {
            const allEnemyTroops = this.board.getTroops("enemy")
            return allEnemyTroops.length === 0
        }
    }

    // ─── Ataques ──────────────────────────────────────────────────────────────

    selectAttacker(row, col) {
        if (this.gameOver) return
        if (this.attacksUsed >= this.attackLimit) return
        if (this.pendingHealTarget || this.pendingSpell || this.selectedCardIndex !== null || this.pendingSacrificeAlly || this.pendingSacrificeEnemy || this.pendingGuardianAdjacent) return
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

        // FIX 5: Guardián del Abismo — ataque doble columna interactivo
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
        if (defender) {
            this._queueAnim("enemy", row, col, "hit")
            const leaderRef = { health: this.enemyHealth }
            attacker.attackTarget(defender, this, leaderRef)
            if (attacker.effect && attacker.effect.type === "excessDamageToLeader") {
                this.enemyHealth = leaderRef.health
            }
            if (defender.isDead()) {
                this._queueAnim("enemy", row, col, "death")
            }
        } else {
            this.enemyHealth -= attacker.attack
            attacker.hasAttacked = true
            this.log(`⚔️ ${attacker.name} ataca al líder enemigo: -${attacker.attack} HP`)
        }

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
        this.enemyHealth -= attacker.attack
        attacker.hasAttacked = true
        this.log(`⚔️ ${attacker.name} ataca al líder enemigo: -${attacker.attack} HP`)
        this._finishAttack()
    }

    // ─── FIX 5: Guardián del Abismo interactivo ───────────────────────────────

    _initiateGuardianAttack(attacker, attackerRow, attackerCol, targetRow, targetCol) {
        // Primero atacamos la columna principal (la del guardián mismo, sin elegir)
        const mainTarget = this.board.getTroop("enemy", "melee", attackerCol)
        let mainTargetName = "Líder"

        this._queueAnim("player", attackerRow, attackerCol, "attack")

        if (mainTarget) {
            mainTarget.takeDamage(attacker.attack, this)
            this._queueAnim("enemy", "melee", attackerCol, "hit")
            mainTargetName = mainTarget.name
            this.log(`⚔️ ${attacker.name} golpea a ${mainTarget.name}`)
            if (mainTarget.isDead()) this._queueAnim("enemy", "melee", attackerCol, "death")
        } else {
            this.enemyHealth -= attacker.attack
            this.log(`⚔️ ${attacker.name} golpea al líder (columna principal vacía)`)
        }

        // Limpiar muertes de la columna principal antes de pedir el segundo objetivo
        const dead = this.board.removeDead()
        this._applyDeathEffects(dead)

        // Calcular columnas adyacentes con tropas (posibles segundos objetivos)
        const adjCols = this.board.getAdjacentCols(attackerCol)
        const adjWithTroops = adjCols.filter(c => this.board.getTroop("enemy", "melee", c))

        if (adjWithTroops.length === 0) {
            // No hay columnas adyacentes con tropas — igual golpea la adyacente si la eligió
            // Pero si ya habían elegido una columna (del click original), la usamos
            // En este caso simplemente terminamos el ataque
            attacker.hasAttacked = true
            this._checkGameOver()
            this.render()
            this._flushAnims()
            if (!this.gameOver) this._finishAttackNoDeselect(attacker)
            return
        }

        // Hay columnas adyacentes: pedir al jugador que elija
        this.pendingGuardianAdjacent = {
            attacker,
            attackerRow,
            attackerCol,
            adjCols: adjWithTroops
        }
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

    endTurn() {
        if (this.gameOver) return
        if (this.pendingHealTarget) { this.log("❌ Debés elegir objetivo para el Sacerdote Oscuro"); this.render(); return }
        if (this.pendingSpell)      { this.log("❌ Debés elegir objetivo para el hechizo");         this.render(); return }
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
        this.selectedAttacker = null
        this.selectedCardIndex = null
        this.log("── Turno del enemigo ──")
        this.render()
        setTimeout(() => { this._enemyTurnAnimated() }, 500)
    }

    // ─── Turno del enemigo ────────────────────────────────────────────────────

    _enemyTurnAnimated() {
        if (this.gameOver) return
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
            this.log("🏆 ¡VICTORIA!")
            this.render()
        } else if (this.playerHealth <= 0) {
            this.gameOver = true
            this.log("💀 DERROTA. Run terminada.")
            this.render()
        }
    }

    showPreview(card) { this.previewCard = card; this.render() }
    hidePreview()     { this.previewCard = null; this.render() }

    log(msg) {
        this.logs.unshift(msg)
        if (this.logs.length > 20) this.logs.pop()
    }

    // ─── FIX 3: HP máximo del enemigo ────────────────────────────────────────
    _getEnemyMaxHp() {
        const level = this.game?.runManager?.level || 1
        if (level === 1) return 5
        if (level === 2) return 10
        return 20 + (level * 5)
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

        // FIX 3: usar el HP máximo real del nivel actual para la barra
        const eHpMax = this._getEnemyMaxHp()
        const eHpPct = Math.max(0, Math.round((this.enemyHealth / eHpMax) * 100))

        const canLeaderAttack = this.selectedAttacker
            ? this._canAttackLeader(this.selectedAttacker.row, this.selectedAttacker.col)
            : false

        app.innerHTML = `
        <div class="game-wrapper">

            <!-- PANEL IZQUIERDO: LOG -->
            <div class="side-panel left-panel">
                <div class="panel-title">📜 REGISTRO</div>
                <div class="log-section">
                    ${this.logs.slice(0,15).map(l => `<div class="log-line">${l}</div>`).join("")}
                </div>
            </div>

            <!-- CENTRO: CAMPO DE BATALLA -->
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

                <!-- Tablero enemigo -->
                <div class="battlefield">
                    ${this._renderRow("enemy","ranged",selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                    ${this._renderRow("enemy","melee", selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                </div>

                <!-- Divisor con botón atacar líder -->
                <div class="divider">
                    <button class="btn-leader ${this.selectedAttacker && canLeaderAttack ? 'btn-active' : ''}"
                        onclick="window.game.combatSystem.attackEnemyLeaderDirect()"
                        ${!this.selectedAttacker || !canLeaderAttack ? 'title="' + (!this.selectedAttacker ? 'Seleccioná una tropa primero' : (this.selectedAttacker.row === 'melee' ? 'Melee: su columna debe estar vacía' : 'Ranged: no debe haber tropas enemigas')) + '"' : ''}>
                        ⚡ Atacar Líder
                    </button>
                </div>

                <!-- Tablero jugador -->
                <div class="battlefield">
                    ${this._renderRow("player","melee", selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                    ${this._renderRow("player","ranged",selId,healMode,spellMode,sacrificeAllyMode,sacrificeEnemyMode,placingCard,guardianMode)}
                </div>

                <!-- Barra jugador -->
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
                    <div style="margin-left:auto">
                        ${this.phase !== "enemy" ? `
                            <button class="btn-end" onclick="window.game.combatSystem.endTurn()">
                                Fin de Turno →
                            </button>
                        ` : `<span class="enemy-turn-label">⏳ Turno enemigo...</span>`}
                    </div>
                </div>

                <!-- Mano -->
                <div class="hand-section">
                    <!-- FIX 1: límite 5 -->
                    <div class="hand-label">MANO (${this.playerHand.length}/5)</div>
                    <div class="hand">
                        ${this.playerHand.map((card, i) => this._renderCard(card, i)).join("")}
                    </div>
                </div>

            </div>

            <!-- PANEL DERECHO: INFO -->
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
                                ${this.selectedAttacker.row === "melee"
                                    ? "Melee: ataca su columna"
                                    : "Ranged: ataca cualquier enemigo"}
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
                    ${guardianMode ? `<div class="info-hint attacking">🌀 <strong>Guardián:</strong><br>Elegí columna ADYACENTE para el segundo golpe</div>` : ""}
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

        <!-- FIX 2: Preview modal mejorado -->
        ${this.previewCard ? this._renderPreviewModal(this.previewCard) : ""}

        <!-- Game Over / Victoria -->
        ${this.gameOver ? `
            <div class="game-over-overlay">
                <div class="game-over-box">
                    <div class="game-over-title">
                        ${this.enemyHealth <= 0 ? "🏆 VICTORIA" : "💀 DERROTA"}
                    </div>
                    ${this.enemyHealth <= 0 && (this.game?.runManager?.level || 1) < 10 ? `
                        <div class="game-over-subtitle">Nivel ${this.game?.runManager?.level || 1} completado</div>
                        <button class="btn-restart btn-next-level" onclick="window.game.advanceLevel()">Siguiente Nivel →</button>
                        <button class="btn-restart" style="font-size:0.75rem;padding:8px 24px;opacity:0.6" onclick="location.reload()">Reiniciar Run</button>
                    ` : `
                        <button class="btn-restart" onclick="location.reload()">Reiniciar</button>
                    `}
                </div>
            </div>
        ` : ""}
        `

        document.onkeydown = (e) => {
            if (e.key === "Escape") {
                this.selectedCardIndex     = null
                this.selectedAttacker      = null
                this.pendingSpell          = null
                this.pendingSacrificeAlly  = null
                this.pendingSacrificeEnemy = false
                this.pendingGuardianAdjacent = null
                this.previewCard           = null
                this.render()
            }
        }

        const overlay = document.getElementById("preview-overlay")
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) { this.previewCard = null; this.render() }
            }
        }
    }

    // ─── Helpers de render ────────────────────────────────────────────────────

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

    // ─── FIX 2: Preview modal rediseñado ─────────────────────────────────────
    _renderPreviewModal(card) {
        const isSpell = card.type === "spell"

        // Detectar si la carta tiene un efecto activo con contador
        const chargeInfo = this._getChargeInfo(card)

        const imgTag = card.image
            ? `<img class="preview-card-img" src="${card.image}" alt="${card.name}" onerror="this.style.display='none'">`
            : `<div class="preview-card-img-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

        // Buscar si la carta tiene una tropa en el tablero para mostrar estado real
        const liveTroop = this._findLiveTroop(card)

        return `
        <div class="preview-overlay" id="preview-overlay">
            <div class="preview-modal-v2">
                <div class="pv2-img-wrap">
                    ${imgTag}
                    <div class="pv2-cost-badge">⚡${card.cost}</div>
                    ${!isSpell ? `
                        <div class="pv2-stats-overlay">
                            <span class="pv2-atk">⚔ ${liveTroop ? liveTroop.attack : card.attack}</span>
                            <span class="pv2-hp">❤ ${liveTroop ? liveTroop.health : card.health}</span>
                        </div>
                    ` : ""}
                </div>
                <div class="pv2-body">
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

    // FIX 4: buscar tropa viva en tablero para mostrar estado de carga real
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

    // FIX 4: obtener info de carga para el contador visual
    _getChargeInfo(card) {
        const liveTroop = this._findLiveTroop(card)
        if (!liveTroop || !liveTroop.effect) return null

        if (liveTroop.effect.type === "criticalCycle") {
            return { current: liveTroop.shots, max: liveTroop.effect.shotsNeeded, label: "Crítico" }
        }
        if (liveTroop.effect.type === "stunEveryNAttacks") {
            return { current: liveTroop.effect.shotsCount, max: liveTroop.effect.attacksNeeded, label: "Aturdimiento" }
        }
        return null
    }

    _renderRow(side, row, selId, healMode, spellMode, sacrificeAllyMode, sacrificeEnemyMode, placingCard, guardianMode) {
        const cells    = this.board.board[side][row]
        const rowLabel = row === "melee" ? "MELEE" : "RANGED"

        // FIX 5: columnas adyacentes seleccionables para el Guardián
        const guardianAdjCols = guardianMode && this.pendingGuardianAdjacent
            ? this.pendingGuardianAdjacent.adjCols
            : []

        return `
        <div class="board-row">
            <div class="row-label">${rowLabel}</div>
            ${cells.map((troop, col) => {
                const cellId        = `${row}-${col}`
                const dataCellId    = `${side}-${row}-${col}`
                const isSelected    = selId === cellId && side === "player"
                const isAttackable  = !!this.selectedAttacker && side === "enemy" && !!troop && !guardianMode
                const isHealable    = healMode && side === "player" && !!troop
                const isSpellTarget = spellMode && (
                    (this.pendingSpell?.card?.effect?.type === "healAlly"   && side === "player" && !!troop) ||
                    (this.pendingSpell?.card?.effect?.type === "curseEnemy" && side === "enemy"  && !!troop)
                )
                const isSacrificeAlly  = sacrificeAllyMode  && side === "player" && !!troop
                const isSacrificeEnemy = sacrificeEnemyMode && side === "enemy"  && !!troop
                const isPlaceable      = placingCard && side === "player" && !troop &&
                    ((placingCard.subtype === "ranged" && row === "ranged") ||
                     (placingCard.subtype !== "ranged" && row === "melee"))

                // FIX 5: celda adyacente del Guardián (solo melee del enemigo)
                const isGuardianTarget = guardianMode && side === "enemy" && row === "melee" && guardianAdjCols.includes(col) && !!troop

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

                // FIX 4: mostrar contador de carga en la celda
                const chargeTag = troop ? this._getCellChargeTag(troop) : ""

                return `
                <div class="cell
                    ${troop ? "cell-filled" : "cell-empty"}
                    ${isSelected      ? "cell-selected"       : ""}
                    ${isAttackable    ? "cell-attackable"     : ""}
                    ${isHealable      ? "cell-healable"       : ""}
                    ${isSpellTarget   ? "cell-spell-target"   : ""}
                    ${isSacrificeAlly   ? "cell-sacrifice"       : ""}
                    ${isSacrificeEnemy  ? "cell-sacrifice-enemy" : ""}
                    ${isPlaceable     ? "cell-placeable"      : ""}
                    ${isGuardianTarget ? "cell-guardian-target" : ""}
                    ${side === "enemy" ? "cell-enemy" : "cell-player"}
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
                                ${troop.summonFatigue              ? '<span class="tag tag-fatigue" title="Fatiga de invocación">😴</span>'         : ""}
                                ${troop.isStunned                  ? '<span class="tag tag-stun" title="Aturdido">⚡</span>'            : ""}
                                ${troop.poisonTurnsLeft > 0        ? `<span class="tag tag-poison" title="Envenenado ${troop.poisonTurnsLeft} turnos">☠${troop.poisonTurnsLeft}</span>` : ""}
                                ${troop.burnTurnsLeft > 0          ? `<span class="tag tag-burn" title="Quemado ${troop.burnTurnsLeft} turnos">🔥${troop.burnTurnsLeft}</span>`    : ""}
                                ${troop.curseTurnsLeft > 0         ? `<span class="tag tag-curse" title="Maldito ${troop.curseTurnsLeft} turnos">💜${troop.curseTurnsLeft}</span>`  : ""}
                                ${troop.isMarked                   ? '<span class="tag tag-mark" title="Marcado permanentemente">🎯</span>'            : ""}
                                ${troop.effect?.type === "lastStand" && troop.effect?.used ? '<span class="tag tag-used" title="Coloso agotado">💔</span>' : ""}
                                ${troop.hasAttacked && !troop.summonFatigue && !troop.isStunned ? '<span class="tag tag-attacked" title="Ya atacó">🗡️</span>' : ""}
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

    // FIX 4: generar tag de contador de carga en la celda
    _getCellChargeTag(troop) {
        if (!troop.effect) return ""
        if (troop.effect.type === "criticalCycle") {
            const cur = troop.shots
            const max = troop.effect.shotsNeeded
            return `<div class="charge-counter" title="Carga crítico">💥 ${cur}/${max}</div>`
        }
        if (troop.effect.type === "stunEveryNAttacks") {
            const cur = troop.effect.shotsCount
            const max = troop.effect.attacksNeeded
            return `<div class="charge-counter" title="Carga aturdimiento">⚡ ${cur}/${max}</div>`
        }
        return ""
    }

    _renderCard(card, index) {
        const canAfford = card.cost <= this.playerEnergy
        const isSelected = this.selectedCardIndex === index
        const isSpell    = card.type === "spell"

        const imgHtml = card.image
            ? `<div class="card-img-wrap">
                <img src="${card.image}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>${isSpell ? '✨' : '⚔️'}</div>'">
                <div class="card-cost-badge">⚡${card.cost}</div>
               </div>`
            : `<div class="card-img-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

        return `
        <div class="hand-card
            ${canAfford ? "card-playable" : "card-unaffordable"}
            ${isSelected ? "card-selected" : ""}
            ${isSpell    ? "card-spell"    : ""}
        "
            onclick="window.game.combatSystem.selectCard(${index})"
            oncontextmenu="event.preventDefault(); window.game.combatSystem.showPreview(${JSON.stringify(card).replace(/"/g,'&quot;')})">
            ${imgHtml}
            <div class="card-body">
                <div class="card-name">${card.name}</div>
                <div class="card-type">${isSpell ? "✨ Hechizo" : card.subtype}</div>
                ${!isSpell ? `
                    <div class="card-stats">
                        <span>⚔${card.attack}</span>
                        <span>❤${card.health}</span>
                    </div>
                ` : `<div class="card-spell-icon">✨</div>`}
            </div>
        </div>`
    }
}

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