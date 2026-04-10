/* ═══════════════════════════════════════════════════
   effects.js — Sistema de efectos visuales épicos
   - Canvas de fondo animado (nebulosa + estrellas)
   - Números de daño flotantes
   - Partículas de impacto en combate
   - Flash de pantalla al atacar líder
   - Transición cinematográfica entre turnos
═══════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────
   1. CANVAS DE FONDO — nebulosa + estrellas
──────────────────────────────────────────────── */
export function initBackgroundCanvas() {
    let canvas = document.getElementById("bg-canvas")
    if (!canvas) {
        canvas = document.createElement("canvas")
        canvas.id = "bg-canvas"
        canvas.style.cssText = `
            position:fixed;inset:0;z-index:0;pointer-events:none;
            width:100%;height:100%;
        `
        document.body.prepend(canvas)
    }

    const ctx = canvas.getContext("2d")
    let W, H, stars, nebulae, animId

    function resize() {
        W = canvas.width  = window.innerWidth
        H = canvas.height = window.innerHeight
        buildScene()
    }

    function buildScene() {
        // Estrellas
        stars = Array.from({ length: 220 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.4 + 0.2,
            a: Math.random(),
            speed: Math.random() * 0.4 + 0.1,
            twinkleOffset: Math.random() * Math.PI * 2
        }))

        // Nebulosas
        nebulae = [
            { x: W * 0.2, y: H * 0.3, rx: W * 0.35, ry: H * 0.4, color: "rgba(80,20,160,0.06)" },
            { x: W * 0.75, y: H * 0.65, rx: W * 0.28, ry: H * 0.35, color: "rgba(20,60,140,0.05)" },
            { x: W * 0.5, y: H * 0.5, rx: W * 0.45, ry: H * 0.45, color: "rgba(40,10,80,0.04)" },
        ]
    }

    let t = 0
    function draw() {
        t += 0.006
        ctx.clearRect(0, 0, W, H)

        // Fondo base
        const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.8)
        bg.addColorStop(0, "#0f1228")
        bg.addColorStop(0.5, "#090c18")
        bg.addColorStop(1, "#080b14")
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, W, H)

        // Nebulosas
        nebulae.forEach(n => {
            const g = ctx.createRadialGradient(
                n.x + Math.sin(t * 0.2) * 30,
                n.y + Math.cos(t * 0.15) * 20,
                0,
                n.x, n.y,
                Math.max(n.rx, n.ry)
            )
            g.addColorStop(0, n.color)
            g.addColorStop(1, "transparent")
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.ellipse(n.x, n.y, n.rx, n.ry, 0, 0, Math.PI * 2)
            ctx.fill()
        })

        // Estrellas
        stars.forEach(s => {
            const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed + s.twinkleOffset))
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,255,255,${s.a * twinkle})`
            ctx.fill()

            // Halo en estrellas brillantes
            if (s.r > 1.1) {
                ctx.beginPath()
                ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(200,180,255,${s.a * twinkle * 0.15})`
                ctx.fill()
            }
        })

        animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener("resize", resize)
    draw()

    return () => {
        cancelAnimationFrame(animId)
        window.removeEventListener("resize", resize)
    }
}

/* ────────────────────────────────────────────────
   2. NÚMEROS DE DAÑO FLOTANTES
──────────────────────────────────────────────── */
export function spawnDamageFloat(element, amount, type = "damage") {
    if (!element) return

    const rect = element.getBoundingClientRect()
    const el = document.createElement("div")

    const configs = {
        damage:  { color: "#ff5a47", glow: "rgba(255,90,71,0.8)",  prefix: "-", size: "1.1rem" },
        heal:    { color: "#4ade80", glow: "rgba(74,222,128,0.8)", prefix: "+", size: "1rem"   },
        poison:  { color: "#4ade80", glow: "rgba(74,222,128,0.7)", prefix: "☠", size: "0.9rem" },
        burn:    { color: "#fb923c", glow: "rgba(251,146,60,0.7)", prefix: "🔥", size: "0.85rem" },
        curse:   { color: "#c084fc", glow: "rgba(192,132,252,0.7)", prefix: "💜", size: "0.85rem" },
        leader:  { color: "#ffd700", glow: "rgba(255,215,0,0.9)",  prefix: "⚡", size: "1.3rem" },
        critical:{ color: "#fff200", glow: "rgba(255,242,0,1)",    prefix: "💥", size: "1.5rem" },
    }

    const cfg = configs[type] || configs.damage
    const offsetX = (Math.random() - 0.5) * 30

    el.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width/2 + offsetX}px;
        top: ${rect.top + rect.height * 0.3}px;
        color: ${cfg.color};
        font-family: 'Cinzel', serif;
        font-size: ${cfg.size};
        font-weight: 900;
        pointer-events: none;
        z-index: 9999;
        text-shadow: 0 0 12px ${cfg.glow}, 0 0 24px ${cfg.glow};
        transform: translateX(-50%);
        animation: dmg-float 1.1s cubic-bezier(0.2,0.8,0.1,1) forwards;
        white-space: nowrap;
    `
    el.textContent = `${cfg.prefix}${amount}`

    if (!document.getElementById("dmg-float-style")) {
        const style = document.createElement("style")
        style.id = "dmg-float-style"
        style.textContent = `
            @keyframes dmg-float {
                0%   { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.6); }
                15%  { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1.25); }
                60%  { opacity: 1; transform: translateX(-50%) translateY(-30px) scale(1); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-52px) scale(0.85); }
            }
        `
        document.head.appendChild(style)
    }

    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1200)
}

/* ────────────────────────────────────────────────
   3. EXPLOSIÓN DE PARTÍCULAS en una celda
──────────────────────────────────────────────── */
export function spawnCellParticles(element, color = "#ff4040", count = 12) {
    if (!element) return
    const rect = element.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div")
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
        const dist  = 30 + Math.random() * 50
        const size  = 3 + Math.random() * 4
        const dur   = 400 + Math.random() * 400

        p.style.cssText = `
            position: fixed;
            left: ${cx}px;
            top: ${cy}px;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${color};
            box-shadow: 0 0 ${size * 2}px ${color};
            pointer-events: none;
            z-index: 9998;
            transform: translate(-50%,-50%);
            animation: particle-burst ${dur}ms ease-out forwards;
            --dx: ${Math.cos(angle) * dist}px;
            --dy: ${Math.sin(angle) * dist}px;
        `
        if (!document.getElementById("particle-style")) {
            const style = document.createElement("style")
            style.id = "particle-style"
            style.textContent = `
                @keyframes particle-burst {
                    0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
                    100% {
                        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2);
                        opacity: 0;
                    }
                }
            `
            document.head.appendChild(style)
        }
        document.body.appendChild(p)
        setTimeout(() => p.remove(), dur + 50)
    }
}

/* ────────────────────────────────────────────────
   4. FLASH DE PANTALLA
──────────────────────────────────────────────── */
export function screenFlash(color = "rgba(255,90,71,0.18)", duration = 300) {
    const el = document.createElement("div")
    el.style.cssText = `
        position: fixed; inset: 0;
        background: ${color};
        pointer-events: none;
        z-index: 9990;
        animation: screen-flash ${duration}ms ease-out forwards;
    `
    if (!document.getElementById("flash-style")) {
        const s = document.createElement("style")
        s.id = "flash-style"
        s.textContent = `
            @keyframes screen-flash {
                0%   { opacity: 1; }
                100% { opacity: 0; }
            }
        `
        document.head.appendChild(s)
    }
    document.body.appendChild(el)
    setTimeout(() => el.remove(), duration + 50)
}

/* ────────────────────────────────────────────────
   5. BANNER CINEMATOGRÁFICO DE TURNO
──────────────────────────────────────────────── */
export function showTurnBanner(text, sub = "", color = "#f0c84a") {
    const existing = document.getElementById("turn-banner")
    if (existing) existing.remove()

    const el = document.createElement("div")
    el.id = "turn-banner"
    el.style.cssText = `
        position: fixed;
        top: 50%;
        left: 0; right: 0;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        pointer-events: none;
        z-index: 9995;
        animation: banner-epic 1.6s cubic-bezier(0.2,0.8,0.2,1) forwards;
    `

    el.innerHTML = `
        <div style="
            font-family:'Cinzel',serif;
            font-size:clamp(1.4rem,4vw,2.8rem);
            font-weight:900;
            color:${color};
            letter-spacing:0.2em;
            text-shadow: 0 0 30px ${color}99, 0 0 60px ${color}44;
            position:relative;
        ">
            <div style="
                position:absolute;
                top:50%;left:-80px;right:-80px;
                height:1px;
                background:linear-gradient(90deg,transparent,${color}66,transparent);
                transform:translateY(-50%);
            "></div>
            ${text}
        </div>
        ${sub ? `<div style="
            font-family:'Cinzel',serif;
            font-size:0.75rem;
            color:rgba(255,255,255,0.5);
            letter-spacing:0.25em;
            text-transform:uppercase;
        ">${sub}</div>` : ""}
    `

    if (!document.getElementById("banner-epic-style")) {
        const s = document.createElement("style")
        s.id = "banner-epic-style"
        s.textContent = `
            @keyframes banner-epic {
                0%   { opacity:0; transform:translateY(-50%) scaleX(0.4); filter:blur(8px); }
                20%  { opacity:1; transform:translateY(-50%) scaleX(1.02); filter:blur(0); }
                70%  { opacity:1; transform:translateY(-50%) scaleX(1); }
                100% { opacity:0; transform:translateY(-50%) scaleX(0.95); }
            }
        `
        document.head.appendChild(s)
    }

    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1700)
}

/* ────────────────────────────────────────────────
   6. LÍNEA DE ATAQUE animada entre dos elementos
──────────────────────────────────────────────── */
export function drawAttackLine(fromEl, toEl, color = "#f5a623") {
    if (!fromEl || !toEl) return
    const r1 = fromEl.getBoundingClientRect()
    const r2 = toEl.getBoundingClientRect()

    const x1 = r1.left + r1.width / 2
    const y1 = r1.top  + r1.height / 2
    const x2 = r2.left + r2.width / 2
    const y2 = r2.top  + r2.height / 2

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.style.cssText = `
        position:fixed;inset:0;width:100%;height:100%;
        pointer-events:none;z-index:9993;
        overflow:visible;
    `

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    arrow.setAttribute("id", "atk-arrow")
    arrow.setAttribute("markerWidth", "6")
    arrow.setAttribute("markerHeight", "6")
    arrow.setAttribute("refX", "3")
    arrow.setAttribute("refY", "3")
    arrow.setAttribute("orient", "auto")
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    arrowPath.setAttribute("d", "M0,0 L6,3 L0,6 Z")
    arrowPath.setAttribute("fill", color)
    arrow.appendChild(arrowPath)
    defs.appendChild(arrow)
    svg.appendChild(defs)

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
    line.setAttribute("x1", x1); line.setAttribute("y1", y1)
    line.setAttribute("x2", x2); line.setAttribute("y2", y2)
    line.setAttribute("stroke", color)
    line.setAttribute("stroke-width", "2")
    line.setAttribute("stroke-dasharray", "6 4")
    line.setAttribute("marker-end", "url(#atk-arrow)")
    line.setAttribute("opacity", "0.85")
    line.style.animation = "attack-line-fade 0.5s ease-out forwards"
    svg.appendChild(line)

    if (!document.getElementById("atk-line-style")) {
        const s = document.createElement("style")
        s.id = "atk-line-style"
        s.textContent = `
            @keyframes attack-line-fade {
                0%   { opacity:0.9; stroke-dashoffset:30; }
                60%  { opacity:0.9; }
                100% { opacity:0; }
            }
        `
        document.head.appendChild(s)
    }

    document.body.appendChild(svg)
    setTimeout(() => svg.remove(), 550)
}

/* ────────────────────────────────────────────────
   7. SHAKE de la barra de vida (cuando el líder recibe daño)
──────────────────────────────────────────────── */
export function shakeHealthBar(side = "player") {
    const bar = document.querySelector(side === "player" ? ".player-bar" : ".enemy-bar")
    if (!bar) return
    bar.classList.remove("bar-shake")
    void bar.offsetWidth
    bar.classList.add("bar-shake")

    if (!document.getElementById("shake-style")) {
        const s = document.createElement("style")
        s.id = "shake-style"
        s.textContent = `
            @keyframes bar-shake-anim {
                0%,100% { transform:translateX(0); }
                20%     { transform:translateX(-5px); }
                40%     { transform:translateX(5px); }
                60%     { transform:translateX(-4px); }
                80%     { transform:translateX(3px); }
            }
            .bar-shake { animation: bar-shake-anim 0.35s ease !important; }
        `
        document.head.appendChild(s)
    }
    setTimeout(() => bar.classList.remove("bar-shake"), 400)
}

/* ────────────────────────────────────────────────
   8. HELPER — resolver celda DOM desde posición
──────────────────────────────────────────────── */
export function getCellElement(side, row, col) {
    return document.querySelector(`[data-cell="${side}-${row}-${col}"]`)
}