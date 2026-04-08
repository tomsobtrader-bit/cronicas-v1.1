export class Troop {

    constructor(card, owner = "player") {
        this.id = card.id
        this.name = card.name
        this.attack = card.attack
        this.health = card.health
        this.maxHealth = card.health
        this.type = card.subtype || "melee"
        this.effect = card.effect ? { ...card.effect } : null
        this.owner = owner
        this.col = null

        this.image = card.image || null

        // noSummonFatigue: Explorador Ágil
        this.summonFatigue = !(card.effect && card.effect.type === "noSummonFatigue")

        this.hasAttacked = false
        this.isStunned = false
        this.canReattack = false

        this.poisonTurnsLeft = 0
        this.poisonDamage = 0

        this.burnTurnsLeft = 0
        this.burnDamage = 0

        this.curseTurnsLeft = 0
        this.curseDamage = 0

        // FIX 6: marca permanente (no se resetea cada turno)
        this.isMarked = false

        // FIX 4: contador de carga visible
        this.shots = 0          // criticalCycle y stunEveryNAttacks usan este campo
    }

    startTurn(board, combatSystem) {
        this.hasAttacked = false
        this.canReattack = false
        // FIX 6: NO resetear isMarked aquí — la marca es permanente

        if (this.isStunned) {
            this.isStunned = false
        }

        if (this.summonFatigue) {
            this.summonFatigue = false
        }

        // Veneno
        if (this.poisonTurnsLeft > 0) {
            const dmg = this.poisonDamage
            this.health -= dmg
            this.poisonTurnsLeft--
            combatSystem.log(`☠️ ${this.name} sufre ${dmg} de veneno. HP: ${this.health}`)
        }

        // Quemadura
        if (this.burnTurnsLeft > 0) {
            const dmg = this.burnDamage
            this.health -= dmg
            this.burnTurnsLeft--
            combatSystem.log(`🔥 ${this.name} sufre ${dmg} de quemadura. HP: ${this.health}`)
        }

        // Maldición
        if (this.curseTurnsLeft > 0) {
            const dmg = this.curseDamage
            this.health -= dmg
            this.curseTurnsLeft--
            combatSystem.log(`💜 ${this.name} sufre ${dmg} de maldición. HP: ${this.health}`)
        }

        // Invocador de Sombras
        if (this.effect && this.effect.type === "summonSpecterEachTurn" && !this.summonFatigue) {
            this._summonSpecter(board, combatSystem)
        }

        // Gladiador Arcano
        if (this.effect && this.effect.type === "defensiveStance" && this.effect._didNotAttackLastTurn) {
            this.health += this.effect.healthGain
            combatSystem.log(`🛡️ ${this.name} gana +${this.effect.healthGain} HP por Postura Defensiva. HP: ${this.health}`)
        }
        if (this.effect && this.effect.type === "defensiveStance") {
            this.effect._didNotAttackLastTurn = true
        }
    }

    canAttack() {
        if (this.summonFatigue) return false
        if (this.health <= 0)   return false
        if (this.isStunned)     return false
        if (this.hasAttacked && this.canReattack) return true
        return !this.hasAttacked
    }

    attackTarget(target, combatSystem, enemyLeader = null) {
        let damage = this.attack

        // FIX 6: daño extra si está marcado (permanente)
        if (target.isMarked) damage += 1

        // criticalCycle — FIX 4: shots se actualiza ANTES para mostrar contador
        if (this.effect && this.effect.type === "criticalCycle") {
            this.shots++
            if (this.shots >= this.effect.shotsNeeded) {
                damage = this.attack * this.effect.multiplier
                if (target.isMarked) damage += 1
                this.shots = 0
                combatSystem.log(`💥 ${this.name} hace GOLPE CRÍTICO: ${damage} daño`)
            }
        }

        // stunEveryNAttacks — FIX 4: shots se actualiza para el contador
        if (this.effect && this.effect.type === "stunEveryNAttacks") {
            this.effect.shotsCount++
            if (this.effect.shotsCount >= this.effect.attacksNeeded) {
                this.effect.shotsCount = 0
                target.isStunned = true
                combatSystem.log(`⚡ ${this.name} aturde a ${target.name}`)
            }
        }

        const targetPrevHealth = target.health

        // Veneno
        if (this.effect && this.effect.type === "poisonOnAttack") {
            if (!target.isImmuneToDebuffs()) {
                target.applyPoison(this.effect.poisonDamage, this.effect.poisonDuration)
                combatSystem.log(`☠️ ${target.name} envenenado por ${this.effect.poisonDuration} turnos`)
            }
        }

        // Quemadura
        if (this.effect && this.effect.type === "burnOnAttack") {
            if (!target.isImmuneToDebuffs()) {
                target.applyBurn(this.effect.burnDamage, this.effect.burnDuration)
                combatSystem.log(`🔥 ${target.name} quemado por ${this.effect.burnDuration} turnos`)
            }
        }

        // FIX 6: Marca permanente — no se limita a un turno
        if (this.effect && this.effect.type === "markOnAttack") {
            target.isMarked = true
            combatSystem.log(`🎯 ${target.name} marcado permanentemente: recibe +${this.effect.bonusDamage} daño extra`)
        }

        target.takeDamage(damage, combatSystem)

        // Daño excedente al líder
        if (this.effect && this.effect.type === "excessDamageToLeader" && enemyLeader !== null) {
            const excess = damage - targetPrevHealth
            if (excess > 0 && target.isDead()) {
                enemyLeader.health -= excess
                combatSystem.log(`⚡ ${this.name} transfiere ${excess} de daño excedente al líder`)
            }
        }

        // Reattack on kill
        if (this.effect && this.effect.type === "reattackOnKill") {
            if (target.isDead()) {
                this.canReattack = true
                combatSystem.log(`⚔️ ${this.name} puede atacar de nuevo`)
            }
        }

        // Gladiador Arcano
        if (this.effect && this.effect.type === "defensiveStance") {
            this.effect._didNotAttackLastTurn = false
        }

        this.hasAttacked = true
    }

    takeDamage(dmg, combatSystem) {
        // Last Stand
        if (this.effect && this.effect.type === "lastStand" && !this.effect.used) {
            if (this.health - dmg <= 0) {
                this.health = 1
                this.effect.used = true
                this.isStunned = true
                if (combatSystem) combatSystem.log(`🗿 ${this.name} activa COLOSO INDESTRUCTIBLE. Sobrevive con 1 HP pero queda aturdido`)
                return
            }
        }

        this.health -= dmg

        // Furia
        if (this.health > 0 && this.effect && this.effect.type === "rageOnDamage") {
            this.attack += this.effect.attackGain
            if (combatSystem) combatSystem.log(`😡 ${this.name} entra en FURIA. ATK: ${this.attack}`)
        }
    }

    heal(amount)              { this.health += amount }

    applyPoison(damage, duration) {
        if (this.isImmuneToDebuffs()) return
        this.poisonTurnsLeft = duration
        this.poisonDamage    = damage
    }

    applyBurn(damage, duration) {
        if (this.isImmuneToDebuffs()) return
        this.burnTurnsLeft = duration
        this.burnDamage    = damage
    }

    applyCurse(damage, duration) {
        if (this.isImmuneToDebuffs()) return
        this.curseTurnsLeft = duration
        this.curseDamage    = damage
    }

    isImmuneToDebuffs() {
        return this.effect && this.effect.type === "immuneToDebuffs"
    }

    isDead() { return this.health <= 0 }

    // FIX 7: Espectros invocados sin fatiga de invocación
    _summonSpecter(board, combatSystem) {
        const stats      = this.effect.specterStats
        const specterCard = {
            id:      "espectro",
            name:    "Espectro",
            attack:  stats.attack,
            health:  stats.health,
            subtype: stats.subtype,
            image:   null,
            effect:  null
        }
        const specter = new Troop(specterCard, this.owner)
        // FIX 7: sin fatiga — los espectros pueden atacar al turno que aparecen
        specter.summonFatigue = false
        const placed = board.placeTroopAtCol(this.owner, specter, this.col)
        if (placed) {
            combatSystem.log(`👻 ${this.name} invoca un Espectro en columna ${specter.col}`)
        }
    }
}