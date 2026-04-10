// ─────────────────────────────────────────────────────────────────────────────
// RewardSystem — ofrece 3 cartas para elegir al ganar un combate
// Si el mazo está lleno (10/10), permite INTERCAMBIAR una carta del mazo
// ─────────────────────────────────────────────────────────────────────────────

import { cardsData, TROOPS_BY_RARITY, SPELLS_POOL, RARITY_CONFIG } from "../Data/cardsdata.js"

export class RewardSystem {

    constructor(game) {
        this.game = game
        this._pendingNewCard  = null   // carta de recompensa elegida para intercambio
        this._swapMode        = false
    }

    // ── Generar 3 opciones de recompensa según nivel ─────────────────────────
    generateRewards(level) {
        const pool = this._buildPool(level)
        const shuffled = [...pool].sort(() => Math.random() - 0.5)
        const seen = new Set()
        const rewards = []
        for (const id of shuffled) {
            if (seen.has(id)) continue
            seen.add(id)
            const card = Object.values(cardsData).find(c => c.id === id)
            if (card) rewards.push(card)
            if (rewards.length === 3) break
        }
        while (rewards.length < 3) {
            const fallback = Object.values(cardsData).find(c => c.rarity === "base" && !rewards.find(r => r.id === c.id))
            if (fallback) rewards.push(fallback)
            else break
        }
        return rewards
    }

    _buildPool(level) {
        const pool = []
        if (level <= 3) {
            pool.push(...TROOPS_BY_RARITY.base, ...TROOPS_BY_RARITY.base)
            pool.push(...TROOPS_BY_RARITY.corrupta)
            pool.push(...SPELLS_POOL)
        } else if (level <= 6) {
            pool.push(...TROOPS_BY_RARITY.base)
            pool.push(...TROOPS_BY_RARITY.corrupta, ...TROOPS_BY_RARITY.corrupta)
            pool.push(...TROOPS_BY_RARITY.elite)
            pool.push(...SPELLS_POOL)
        } else if (level <= 8) {
            pool.push(...TROOPS_BY_RARITY.corrupta)
            pool.push(...TROOPS_BY_RARITY.elite, ...TROOPS_BY_RARITY.elite)
            pool.push(...TROOPS_BY_RARITY.mistica)
            pool.push(...SPELLS_POOL)
        } else {
            pool.push(...TROOPS_BY_RARITY.elite)
            pool.push(...TROOPS_BY_RARITY.mistica, ...TROOPS_BY_RARITY.mistica)
            pool.push(...SPELLS_POOL)
        }
        return pool
    }

    // ── Renderizar pantalla de recompensa ────────────────────────────────────
    renderRewardScreen(rewards, onPick) {
        const app = document.getElementById("app")
        if (!app) return

        const deckSize = this.game.deckList?.length || 0
        const deckFull = deckSize >= 10

        this._pendingNewCard = null
        this._swapMode       = false

        app.innerHTML = this._buildRewardHTML(rewards, deckFull, false, null)

        window._rewardPick = (index) => {
            const chosen = rewards[index]
            if (!deckFull) {
                onPick(chosen)
                return
            }
            // Mazo lleno → entrar en modo intercambio
            this._pendingNewCard = chosen
            this._swapMode = true
            app.innerHTML = this._buildRewardHTML(rewards, true, true, chosen)
            this._bindSwapHandlers(onPick, rewards)
        }

        window._rewardSkip = () => {
            onPick(null)
        }

        this._bindSwapHandlers(onPick, rewards)
    }

    _bindSwapHandlers(onPick, rewards) {
        // Estos se registran cuando aparece la sección de intercambio
        window._swapDeckCard = (deckIndex) => {
            if (!this._pendingNewCard) return
            const newCard   = this._pendingNewCard
            const removedCard = this.game.deckList[deckIndex]
            // Eliminar del mazo
            this.game.deckList.splice(deckIndex, 1)
            // Agregar la nueva
            onPick(newCard)
        }

        window._cancelSwap = () => {
            this._pendingNewCard = null
            this._swapMode = false
            const deckSize = this.game.deckList?.length || 0
            const deckFull = deckSize >= 10
            const app = document.getElementById("app")
            if (app) app.innerHTML = this._buildRewardHTML(rewards, deckFull, false, null)
            window._rewardPick = (index) => {
                const chosen = rewards[index]
                if (!deckFull) { onPick(chosen); return }
                this._pendingNewCard = chosen
                this._swapMode = true
                app.innerHTML = this._buildRewardHTML(rewards, true, true, chosen)
                this._bindSwapHandlers(onPick, rewards)
            }
            window._rewardSkip = () => { onPick(null) }
            this._bindSwapHandlers(onPick, rewards)
        }
    }

    _buildRewardHTML(rewards, deckFull, swapMode, pendingCard) {
        const deckSize = this.game.deckList?.length || 0

        return `
        <div class="reward-overlay">
            <div class="reward-box">
                <div class="reward-title">⚔️ VICTORIA</div>
                <div class="reward-subtitle">
                    ${swapMode
                        ? `Elegí una carta de tu <strong style="color:var(--gold)">mazo</strong> para reemplazar`
                        : `Elegí una carta para añadir a tu mazo
                           <span class="reward-deck-count">(${deckSize}/10)</span>`
                    }
                </div>

                ${deckFull && !swapMode ? `
                    <div class="reward-full-warning">
                        ⚠️ Tu mazo está lleno (10/10). Hacé click en una carta para intercambiarla por una del mazo.
                    </div>
                ` : ""}

                ${swapMode && pendingCard ? `
                    <div class="reward-swap-info">
                        🔄 Agregando: <strong style="color:var(--gold)">${pendingCard.name}</strong><br>
                        Hacé click en una carta de tu mazo para reemplazarla — o
                        <button onclick="window._cancelSwap()" style="
                            font-family:var(--font-title); font-size:0.65rem;
                            background:none; color:#e74c3c; border:1px solid #e74c3c;
                            padding:2px 8px; cursor:pointer; margin-left:4px;
                        ">cancelar</button>
                    </div>
                ` : ""}

                ${!swapMode ? `
                <div class="reward-cards">
                    ${rewards.map((card, i) => this._renderRewardCard(card, i, false)).join("")}
                </div>
                ` : ""}

                ${swapMode ? this._renderSwapDeck() : ""}

                ${!swapMode ? `
                <button class="reward-skip" onclick="window._rewardSkip()">
                    Continuar sin elegir →
                </button>
                ` : ""}
            </div>
        </div>`
    }

    _renderSwapDeck() {
        const deckList = this.game.deckList || []
        return `
        <div class="reward-deck-swap-section">
            <div class="reward-deck-swap-title">🗡️ TU MAZO — Elegí cuál reemplazar</div>
            <div class="reward-deck-swap-cards">
                ${deckList.map((card, i) => {
                    const rarity = card.rarity ? RARITY_CONFIG[card.rarity] : null
                    const borderStyle = rarity ? `border-color: ${rarity.border};` : ""
                    const imgHtml = card.image
                        ? `<img src="${card.image}" alt="${card.name}" onerror="this.style.display='none'">`
                        : `<div style="width:100%;height:80px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;opacity:0.4">${card.type === "spell" ? "✨" : "⚔️"}</div>`
                    return `
                    <div class="swap-deck-card" style="${borderStyle}" onclick="window._swapDeckCard(${i})"
                         title="Reemplazar ${card.name}">
                        <div class="swap-deck-card-img">${imgHtml}</div>
                        <div class="swap-deck-card-name">${card.name}</div>
                    </div>`
                }).join("")}
            </div>
        </div>`
    }

    _renderRewardCard(card, index, disabled) {
        const isSpell  = card.type === "spell"
        const rarity   = card.rarity ? RARITY_CONFIG[card.rarity] : null
        const rarityStyle = rarity
            ? `border-color: ${rarity.border}; box-shadow: 0 0 18px ${rarity.glow};`
            : ""
        const rarityLabel = rarity
            ? `<div class="reward-card-rarity" style="color:${rarity.color}; border-color:${rarity.border}">
                   ${rarity.label}
               </div>`
            : `<div class="reward-card-rarity spell-tag">✨ HECHIZO</div>`

        const imgHtml = card.image
            ? `<img src="${card.image}" alt="${card.name}" onerror="this.style.display='none'">`
            : `<div class="reward-card-placeholder">${isSpell ? "✨" : "⚔️"}</div>`

        return `
        <div class="reward-card ${disabled ? 'reward-card-disabled' : ''}"
             style="${disabled ? '' : rarityStyle}"
             onclick="${disabled ? '' : `window._rewardPick(${index})`}">
            <div class="reward-card-img">${imgHtml}</div>
            ${rarityLabel}
            <div class="reward-card-body">
                <div class="reward-card-name">${card.name}</div>
                <div class="reward-card-type">${isSpell ? "✨ Hechizo" : card.subtype === "ranged" ? "🏹 Distancia" : "⚔️ Melee"}</div>
                <div class="reward-card-stats">
                    <span class="rc-cost">⚡${card.cost}</span>
                    ${!isSpell ? `<span class="rc-atk">⚔${card.attack}</span><span class="rc-hp">❤${card.health}</span>` : ""}
                </div>
                <div class="reward-card-effect">${card.effectDescription || "Sin habilidad especial"}</div>
            </div>
        </div>`
    }
}