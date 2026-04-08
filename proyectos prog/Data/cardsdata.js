export const cardsData = {

    // ─────────────────────────────────────────
    // TROPAS ORIGINALES
    // ─────────────────────────────────────────

    arqueroEspectral: {
        id: "arquero_espectral",
        name: "Arquero Espectral",
        type: "troop",
        subtype: "ranged",
        cost: 2,
        attack: 3,
        health: 2,
        image: "assets/cards/Arquero_Espectral.jpg",
        effectDescription: "Cada 3 ataques, el siguiente disparo hace el doble de daño.",
        effect: { type: "criticalCycle", shotsNeeded: 3, multiplier: 2 }
    },

    berserkerMaldito: {
        id: "berserker_maldito",
        name: "Berserker Maldito",
        type: "troop",
        subtype: "melee",
        cost: 2,
        attack: 3,
        health: 3,
        image: "assets/cards/Berserker_Maldito.jpg",
        effectDescription: "Al recibir daño, gana +2 de ataque.",
        effect: { type: "rageOnDamage", attackGain: 2 }
    },

    carroneroDelCampo: {
        id: "carronero_del_campo",
        name: "Carroñero del Campo",
        type: "troop",
        subtype: "melee",
        cost: 2,
        attack: 2,
        health: 3,
        image: "assets/cards/Carroñero_del_Campo.jpg",
        effectDescription: "Al morir cualquier tropa, gana +1 de vida.",
        effect: { type: "scavengerOnDeath", healthGain: 1 }
    },

    centinelaDeHierro: {
        id: "centinela_de_hierro",
        name: "Centinela de Hierro",
        type: "troop",
        subtype: "melee",
        cost: 3,
        attack: 2,
        health: 6,
        image: "assets/cards/Centinela_de_Hierro.jpg",
        effectDescription: "Inmune a efectos negativos (veneno, quemadura, etc.).",
        effect: { type: "immuneToDebuffs" }
    },

    espadachinMaldito: {
        id: "espadachin_maldito",
        name: "Espadachín Maldito",
        type: "troop",
        subtype: "melee",
        cost: 4,
        attack: 4,
        health: 10,
        image: "assets/cards/Espadachin_Maldito.jpg",
        effectDescription: "Si mata una tropa, puede volver a atacar ese mismo turno.",
        effect: { type: "reattackOnKill" }
    },

    guardianDelAbismo: {
        id: "guardian_del_abismo",
        name: "Guardián del Abismo",
        type: "troop",
        subtype: "melee",
        cost: 3,
        attack: 1,
        health: 6,
        image: "assets/cards/Guardian_del_Abismo.jpg",
        effectDescription: "Al atacar, golpea su columna y una columna adyacente.",
        effect: { type: "doubleColumnAttack" }
    },

    invocadorDeSombras: {
        id: "invocador_de_sombras",
        name: "Invocador de Sombras",
        type: "troop",
        subtype: "ranged",
        cost: 3,
        attack: 2,
        health: 3,
        image: "assets/cards/Invocador_de_Sombras.jpg",
        effectDescription: "Al inicio de cada turno, invoca un Espectro 1/1 melee.",
        effect: {
            type: "summonSpecterEachTurn",
            specterStats: { attack: 1, health: 1, subtype: "melee" }
        }
    },

    portadorDePlagas: {
        id: "portador_de_plagas",
        name: "Portador de Plagas",
        type: "troop",
        subtype: "melee",
        cost: 3,
        attack: 2,
        health: 5,
        image: "assets/cards/Portador_de_Plagas.jpg",
        effectDescription: "Al atacar, aplica veneno: 1 de daño por 2 turnos.",
        effect: { type: "poisonOnAttack", poisonDamage: 1, poisonDuration: 2 }
    },

    sacerdoteOscuro: {
        id: "sacerdote_oscuro",
        name: "Sacerdote Oscuro",
        type: "troop",
        subtype: "ranged",
        cost: 2,
        attack: 1,
        health: 4,
        image: "assets/cards/Sacerdote_Oscuro.jpg",
        effectDescription: "Al entrar al campo, cura +3 de vida a una tropa aliada elegida.",
        effect: { type: "healAllyOnPlay", healAmount: 3 }
    },

    titan: {
        id: "titan",
        name: "Titán",
        type: "troop",
        subtype: "melee",
        cost: 7,
        attack: 8,
        health: 20,
        image: "assets/cards/Titan.jpg",
        effectDescription: "El daño excedente al matar una tropa se transfiere al líder enemigo.",
        effect: { type: "excessDamageToLeader" }
    },

    // ─────────────────────────────────────────
    // NUEVAS TROPAS
    // ─────────────────────────────────────────

    arqueraDelCrepusculo: {
        id: "arquera_del_crepusculo",
        name: "Arquera del Crepúsculo",
        type: "troop",
        subtype: "ranged",
        cost: 3,
        attack: 2,
        health: 4,
        image: "assets/cards/Arquera_del_Crepusculo.jpg",
        effectDescription: "Al atacar una tropa, la marca: recibe +1 de daño de todas las fuentes hasta el fin del turno.",
        effect: { type: "markOnAttack", bonusDamage: 1 }
    },

    bestiaFrenetica: {
        id: "bestia_frenetica",
        name: "Bestia Frenética",
        type: "troop",
        subtype: "melee",
        cost: 4,
        attack: 4,
        health: 7,
        image: "assets/cards/Bestia_Frenetica.jpg",
        effectDescription: "Al entrar al campo, ataca inmediatamente a la tropa enemiga de su columna ignorando la fatiga. Si no hay tropa, ataca al líder.",
        effect: { type: "chargeAttack" }
    },

    colosoBelico: {
        id: "coloso_belico",
        name: "Coloso Bélico",
        type: "troop",
        subtype: "melee",
        cost: 6,
        attack: 6,
        health: 16,
        image: "assets/cards/Coloso_Belico.jpg",
        effectDescription: "La primera vez que llegaría a 0 vida, sobrevive con 1 HP pero queda aturdido. Solo ocurre una vez.",
        effect: { type: "lastStand", used: false }
    },

    escuderoLeal: {
        id: "escudero_leal",
        name: "Escudero Leal",
        type: "troop",
        subtype: "melee",
        cost: 2,
        attack: 1,
        health: 4,
        image: "assets/cards/Escudero_Leal.jpg",
        effectDescription: "Al entrar al campo, si hay una tropa a distancia aliada en su misma columna, le otorga +2 de vida.",
        effect: { type: "shieldAllyOnPlay", healthBonus: 2 }
    },

    exploradorAgil: {
        id: "explorador_agil",
        name: "Explorador Ágil",
        type: "troop",
        subtype: "melee",
        cost: 1,
        attack: 2,
        health: 2,
        image: "assets/cards/Explorador_Agil.jpg",
        effectDescription: "No tiene fatiga de invocación. Puede atacar el mismo turno que es desplegado.",
        effect: { type: "noSummonFatigue" }
    },

    gladiadorArcano: {
        id: "gladiador_arcano",
        name: "Gladiador Arcano",
        type: "troop",
        subtype: "melee",
        cost: 4,
        attack: 4,
        health: 8,
        image: "assets/cards/Gladiador_Arcano.jpg",
        effectDescription: "Si no ataca en su turno, gana +2 de vida al final del turno.",
        effect: { type: "defensiveStance", healthGain: 2 }
    },

    hechiceraIgnea: {
        id: "hechicera_ignea",
        name: "Hechicera Ignea",
        type: "troop",
        subtype: "ranged",
        cost: 4,
        attack: 2,
        health: 3,
        image: "assets/cards/Hechicera_Ignea.jpg",
        effectDescription: "Al atacar una tropa, le aplica quemadura: 1 de daño por 2 turnos.",
        effect: { type: "burnOnAttack", burnDamage: 1, burnDuration: 2 }
    },

    lanzaTormentas: {
        id: "lanza_tormentas",
        name: "Lanza Tormentas",
        type: "troop",
        subtype: "ranged",
        cost: 3,
        attack: 3,
        health: 3,
        image: "assets/cards/Lanza_Tormentas.jpg",
        effectDescription: "Cada 2 ataques, el siguiente golpe aturde al objetivo: no puede atacar el próximo turno.",
        effect: { type: "stunEveryNAttacks", attacksNeeded: 2, shotsCount: 0 }
    },

    // ─────────────────────────────────────────
    // HECHIZOS
    // ─────────────────────────────────────────

    escudoEspectral: {
        id: "escudo_espectral",
        name: "Escudo Espectral",
        type: "spell",
        cost: 2,
        image: "assets/spells/Escudo_Espectral.jpg",
        effectDescription: "Una tropa aliada elegida gana +3 de vida permanentemente.",
        effect: { type: "healAlly", amount: 3 }
    },

    furiaDeGuerra: {
        id: "furia_de_guerra",
        name: "Furia de Guerra",
        type: "spell",
        cost: 2,
        image: "assets/spells/Furia_de_Guerra.jpg",
        effectDescription: "Todas las tropas aliadas en el campo ganan +1 de ataque permanentemente.",
        effect: { type: "buffAllAllies", attackBonus: 1 }
    },

    maldicion: {
        id: "maldicion",
        name: "Maldición",
        type: "spell",
        cost: 2,
        image: "assets/spells/Maldicion.jpg",
        effectDescription: "Una tropa enemiga elegida pierde 1 de vida al inicio de cada turno durante 4 turnos.",
        effect: { type: "curseEnemy", damagePerTurn: 1, duration: 4 }
    },

    sacrificioDeAlmas: {
        id: "sacrificio_de_almas",
        name: "Sacrificio de Almas",
        type: "spell",
        cost: 4,
        image: "assets/spells/Sacrificio_de_Almas.jpg",
        effectDescription: "Destruye una tropa aliada elegida y a cambio destruye una tropa enemiga elegida.",
        effect: { type: "sacrificeTrade" }
    },

    tormentaDeSombras: {
        id: "tormenta_de_sombras",
        name: "Tormenta de Sombras",
        type: "spell",
        cost: 4,
        image: "assets/spells/Tormenta_de_Sombras.jpg",
        effectDescription: "Inflige 2 de daño a todas las tropas enemigas en el campo.",
        effect: { type: "damageAllEnemies", damage: 2 }
    }

}