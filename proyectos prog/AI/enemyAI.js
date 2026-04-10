import { Troop } from "../Entidades/troop.js"
import { cardsData } from "../Data/cardsdata.js"

export class EnemyAI {

    static getEnemyDeck(level) {
        const basic = [
            cardsData.carroneroDelCampo,
            cardsData.carroneroDelCampo,
            cardsData.centinelaDeHierro,
            cardsData.berserkerMaldito,
            cardsData.berserkerMaldito,
            cardsData.exploradorAgil,
            cardsData.escuderoLeal,
            cardsData.carroneroDelCampo,
            cardsData.berserkerMaldito,
            cardsData.exploradorAgil,
        ]
        const mid = [
            cardsData.guardianDelAbismo,
            cardsData.portadorDePlagas,
            cardsData.espadachinMaldito,
            cardsData.invocadorDeSombras,
            cardsData.sacerdoteOscuro,
            cardsData.arqueraDelCrepusculo,
            cardsData.lanzaTormentas,
            cardsData.bestiaFrenetica,
            cardsData.guardianDelAbismo,
            cardsData.portadorDePlagas,
        ]
        const hard = [
            cardsData.titan,
            cardsData.espadachinMaldito,
            cardsData.portadorDePlagas,
            cardsData.invocadorDeSombras,
            cardsData.centinelaDeHierro,
            cardsData.gladiadorArcano,
            cardsData.hechiceraIgnea,
            cardsData.colosoBelico,
            cardsData.titan,
            cardsData.gladiadorArcano,
        ]
        if (level <= 1) return [...basic]
        if (level <= 3) return [...basic]
        if (level <= 6) return [...basic, ...mid]
        return [...mid, ...hard]
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CONSTRUIR COLA DE ACCIONES (sin ejecutar nada aún)
    // ──────────────────────────────────────────────────────────────────────────

    static buildActionQueue(cs, queue) {
        const board = cs.board
        const level = cs.game?.runManager?.level || 1

        // ── 1. Invocaciones ──
        EnemyAI._planSummons(cs, board, queue, level)

        // ── 2. Ataques ──
        EnemyAI._planAttacks(cs, board, queue, level)
    }

    static _planSummons(cs, board, queue, level) {
        let cardsPlanned = 0
        const MAX_CARDS = level >= 5 ? 3 : 2  // IA más agresiva en niveles altos

        // Filtrar mano a solo tropas
        cs.enemyHand = cs.enemyHand.filter(c => c.type === "troop")

        // Si mano vacía, robar
        let attempts = 0
        while (cs.enemyHand.length === 0 && attempts < 5) {
            cs._drawCard("enemy")
            cs.enemyHand = cs.enemyHand.filter(c => c.type === "troop")
            attempts++
        }

        // Clonar energía para simular costos sin ejecutar
        let simulatedEnergy = cs.enemyEnergy
        const handCopy = [...cs.enemyHand]

        while (cardsPlanned < MAX_CARDS && handCopy.length > 0 && simulatedEnergy > 0) {
            const affordable = handCopy
                .map((card, i) => ({ card, i }))
                .filter(({ card }) => card.cost <= simulatedEnergy)
                .sort((a, b) => b.card.cost - a.card.cost)

            if (affordable.length === 0) break

            // En niveles altos, el enemigo prioriza cartas más fuertes
            let picked = affordable[0]
            if (level >= 6 && affordable.length > 1) {
                // Priorizar cartas con más ataque
                picked = affordable.sort((a, b) => b.card.attack - a.card.attack)[0]
            }

            const { card, i } = picked
            const row = card.subtype === "ranged" ? "ranged" : "melee"

            if (!board.hasFreeSlot("enemy", row)) {
                // Intentar otra fila o salir
                const altAffordable = affordable.slice(1)
                const next = altAffordable.find(({ card: c }) => {
                    const r = c.subtype === "ranged" ? "ranged" : "melee"
                    return board.hasFreeSlot("enemy", r)
                })
                if (!next) break
                queue.push({ type: "summon", card: next.card, handIndex: handCopy.indexOf(next.card) })
                simulatedEnergy -= next.card.cost
                handCopy.splice(handCopy.indexOf(next.card), 1)
                cardsPlanned++
                break
            }

            queue.push({ type: "summon", card, handIndex: i })
            simulatedEnergy -= card.cost
            handCopy.splice(i, 1)
            cardsPlanned++
        }
    }

    static _planAttacks(cs, board, queue, level) {
        let attacksLeft = cs.attackLimit

        // Estrategia más inteligente para niveles altos
        const aggressive = level >= 4

        ;["melee", "ranged"].forEach(row => {
            board.board.enemy[row].forEach((troop, col) => {
                if (!troop || !troop.canAttack() || attacksLeft <= 0) return

                let targetInfo = null
                let targetIsLeader = false

                if (row === "melee") {
                    const frontTarget = board.getTroop("player", "melee", col)
                    if (frontTarget) {
                        // IA agresiva: si puede matar al objetivo, hacerlo
                        if (aggressive && frontTarget.health <= troop.attack) {
                            targetInfo = { side: "player", row: "melee", col, name: frontTarget.name }
                        } else {
                            targetInfo = { side: "player", row: "melee", col, name: frontTarget.name }
                        }
                    } else {
                        const rangedInCol = board.getTroop("player", "ranged", col)
                        if (!rangedInCol) {
                            targetIsLeader = true
                        } else {
                            targetInfo = { side: "player", row: "ranged", col, name: rangedInCol.name }
                        }
                    }
                } else {
                    // Ranged: elegir objetivo inteligente
                    const playerTroops = board.getTroops("player")
                    if (playerTroops.length > 0) {
                        let target
                        if (aggressive) {
                            // Priorizar matar (tropa con menos vida que pueda destruir)
                            const killable = playerTroops.filter(({ troop: t }) => t.health <= troop.attack)
                            if (killable.length > 0) {
                                target = killable.sort((a, b) => b.troop.health - a.troop.health)[0]
                            } else {
                                // Si no puede matar nada, atacar la más débil
                                target = playerTroops.sort((a, b) => a.troop.health - b.troop.health)[0]
                            }
                        } else {
                            target = playerTroops.sort((a, b) => a.troop.health - b.troop.health)[0]
                        }
                        targetInfo = { side: "player", row: target.row, col: target.col, name: target.troop.name }
                    } else {
                        targetIsLeader = true
                    }
                }

                const attackerCell = `enemy-${row}-${col}`
                if (targetIsLeader) {
                    queue.push({
                        type: "attack",
                        attackerRow: row,
                        attackerCol: col,
                        attackerName: troop.name,
                        attackerAtk: troop.attack,   // PASO 4 — para el float de daño
                        targetName: "Líder Jugador",
                        targetIsLeader: true,
                        attackerCell
                    })
                } else if (targetInfo) {
                    queue.push({
                        type: "attack",
                        attackerRow: row,
                        attackerCol: col,
                        attackerName: troop.name,
                        attackerAtk: troop.attack,   // PASO 4 — para el float de daño
                        targetName: targetInfo.name,
                        targetRow: targetInfo.row,
                        targetCol: targetInfo.col,
                        targetIsLeader: false,
                        attackerCell
                    })
                }

                attacksLeft--
            })
        })
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EJECUTAR ACCIONES INDIVIDUALES
    // ──────────────────────────────────────────────────────────────────────────

    static executeSummon(cs, action) {
        const board = cs.board
        const card = action.card

        // Re-verificar que la carta sigue en mano y hay energía
        const handIdx = cs.enemyHand.findIndex(c => c.id === card.id)
        if (handIdx === -1 || card.cost > cs.enemyEnergy) return

        const row = card.subtype === "ranged" ? "ranged" : "melee"
        if (!board.hasFreeSlot("enemy", row)) return

        const troop = new Troop(card, "enemy")
        const placed = board.placeTroop("enemy", troop)
        if (placed) {
            cs.enemyEnergy -= card.cost
            cs.enemyHand.splice(handIdx, 1)
            cs.log(`🤖 Enemigo invoca ${troop.name}`)
            EnemyAI._applyOnPlayEffects(troop, card, board, cs)
        }
    }

    static executeAttack(cs, action) {
        const board = cs.board
        const { attackerRow, attackerCol, targetIsLeader, targetRow, targetCol } = action

        const attacker = board.getTroop("enemy", attackerRow, attackerCol)
        if (!attacker || !attacker.canAttack()) return

        if (action.attackerRow === "melee" && attacker.effect?.type === "doubleColumnAttack") {
            // Ataque doble columna
            const mainTarget = board.getTroop("player", "melee", attackerCol)
            if (mainTarget) {
                mainTarget.takeDamage(attacker.attack, cs)
                cs._queueAnim("enemy", attackerRow, attackerCol, "attack")
                cs._queueAnim("player", "melee", attackerCol, "hit")
                cs.log(`⚔️ ${attacker.name} golpea a ${mainTarget.name}`)
            } else {
                cs.playerHealth -= attacker.attack
                cs.log(`⚔️ ${attacker.name} golpea al líder jugador`)
            }
            attacker.hasAttacked = true
            return
        }

        cs._queueAnim("enemy", attackerRow, attackerCol, "attack")

        if (targetIsLeader) {
            cs.playerHealth -= attacker.attack
            cs.log(`💀 ${attacker.name} ataca al líder: -${attacker.attack} HP`)
            attacker.hasAttacked = true
        } else {
            const target = board.getTroop("player", targetRow, targetCol)
            if (target) {
                cs._queueAnim("player", targetRow, targetCol, "hit")
                const leaderRef = { health: cs.playerHealth }
                attacker.attackTarget(target, cs, leaderRef)
                if (attacker.effect?.type === "excessDamageToLeader") {
                    cs.playerHealth = leaderRef.health
                }
                cs.log(`⚔️ ${attacker.name} ataca a ${target.name}`)
                if (target.isDead()) {
                    cs._queueAnim("player", targetRow, targetCol, "death")
                }
            } else {
                // Objetivo murió antes (por otra acción), atacar al líder
                cs.playerHealth -= attacker.attack
                attacker.hasAttacked = true
                cs.log(`⚔️ ${attacker.name} ataca al líder (objetivo eliminado)`)
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EFECTOS AL INVOCAR
    // ──────────────────────────────────────────────────────────────────────────

    static _applyOnPlayEffects(troop, card, board, cs) {
        if (!card.effect) return

        if (card.effect.type === "healAllyOnPlay") {
            const troops = board.getTroops("enemy")
            const others = troops.filter(({ troop: t }) => t !== troop)
            if (others.length > 0) {
                const target = others.sort((a, b) => a.troop.health - b.troop.health)[0]
                target.troop.heal(card.effect.healAmount)
                cs.log(`💚 ${troop.name} cura ${card.effect.healAmount} HP a ${target.troop.name}`)
            }
        }
        if (card.effect.type === "summonSpecterEachTurn") {
            troop._summonSpecter(board, cs)
        }
        if (card.effect.type === "shieldAllyOnPlay") {
            const rangedAlly = board.getTroop("enemy", "ranged", troop.col)
            if (rangedAlly) {
                rangedAlly.health += card.effect.healthBonus
                cs.log(`🛡️ ${troop.name} otorga +${card.effect.healthBonus} HP a ${rangedAlly.name}`)
            }
        }
        if (card.effect.type === "chargeAttack") {
            const target = board.getTroop("player", "melee", troop.col)
            if (target) {
                troop.attackTarget(target, cs, { health: cs.playerHealth })
                cs.log(`🐾 ${troop.name} ataca inmediatamente a ${target.name}`)
                troop.hasAttacked = false
            } else {
                cs.playerHealth -= troop.attack
                cs.log(`🐾 ${troop.name} ataca al líder jugador: -${troop.attack} HP`)
            }
        }
    }
}