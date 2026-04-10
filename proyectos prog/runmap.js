// ─────────────────────────────────────────────────────────────────────────────
// runmap.js — Mapa dark fantasy animado para Crónicas del Abismo
// Reemplaza la run-bar superior con un canvas ilustrado
// ─────────────────────────────────────────────────────────────────────────────

export class RunMap {

    constructor(canvasId, game) {
        this.canvas  = document.getElementById(canvasId)
        this.ctx     = this.canvas.getContext("2d")
        this.game    = game
        this.animId  = null
        this.t       = 0
        this.visible = false

        this.W = 680
        this.H = 440

        this.canvas.width  = this.W
        this.canvas.height = this.H

        this.NODES = [
            { id:1,  x:100, y:340, type:"combat",   name:"Bosque Podrido",      lore:"Primeros muertos caminan entre árboles negros." },
            { id:2,  x:230, y:300, type:"combat",   name:"Aldea en Llamas",     lore:"Los gritos ya callaron. Solo quedan cenizas." },
            { id:3,  x:180, y:210, type:"event",    name:"El Mercader Sombrío", lore:"Vende lo que no debería existir." },
            { id:4,  x:340, y:260, type:"combat",   name:"Puente Roto",         lore:"Algo acecha bajo el río de sangre." },
            { id:5,  x:420, y:180, type:"miniboss", name:"La Torre Maldita",    lore:"El Hechicero Vacío aguarda en lo alto." },
            { id:6,  x:300, y:140, type:"shop",     name:"Cripta del Avaro",    lore:"Oro por conocimiento. Siempre hay un precio." },
            { id:7,  x:470, y:310, type:"combat",   name:"Pantano Eterno",      lore:"El veneno florece aquí. Todo muere lento." },
            { id:8,  x:560, y:230, type:"miniboss", name:"Guarida del Señor",   lore:"El Señor de los Cadáveres invoca sin parar." },
            { id:9,  x:590, y:120, type:"combat",   name:"Cima del Abismo",     lore:"El viento trae susurros de lo que viene." },
            { id:10, x:340, y:55,  type:"boss",     name:"El Trono Oscuro",     lore:"La Bruja del Eclipse espera desde siempre." },
        ]

        this.EDGES = [
            [1,2],[2,3],[2,4],[3,6],[4,5],[4,7],[5,6],[5,8],[6,10],[7,8],[8,9],[9,10]
        ]

        this.TYPE = {
            combat:   { fill:"#3a1a1a", stroke:"#7a2a2a", glyph:"⚔", glowCol:"rgba(160,50,50,0.5)" },
            event:    { fill:"#1a1a3a", stroke:"#3a3a8a", glyph:"?", glowCol:"rgba(60,60,180,0.5)" },
            shop:     { fill:"#2a1a0a", stroke:"#7a5010", glyph:"$", glowCol:"rgba(180,130,20,0.5)" },
            miniboss: { fill:"#250a35", stroke:"#7a30b0", glyph:"◆", glowCol:"rgba(140,60,200,0.55)" },
            boss:     { fill:"#1a0505", stroke:"#8a0a0a", glyph:"☠", glowCol:"rgba(200,30,30,0.7)" },
        }

        this.stars = Array.from({ length: 120 }, () => ({
            x:   Math.random() * this.W,
            y:   Math.random() * this.H,
            r:   Math.random() * 1.2 + 0.2,
            a:   Math.random() * 0.6 + 0.15,
            sp:  Math.random() * 0.012 + 0.004,
            off: Math.random() * Math.PI * 2
        }))

        this.MOUNTAINS = [
            { pts:[[0,this.H],[60,260],[120,300],[180,220],[240,280],[300,200],[360,240],[420,190],[480,250],[540,195],[600,230],[660,210],[this.W,280],[this.W,this.H]] },
            { pts:[[0,this.H],[80,310],[160,340],[220,290],[310,330],[400,280],[500,310],[580,270],[650,300],[this.W,320],[this.W,this.H]] },
        ]

        this.FOG = [
            { x:50,  y:280, rx:160, ry:60 },
            { x:280, y:310, rx:200, ry:55 },
            { x:520, y:260, rx:150, ry:50 },
            { x:140, y:170, rx:120, ry:45 },
            { x:440, y:140, rx:130, ry:40 },
        ]
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _currentLevel() {
        return this.game?.runManager?.level || 1
    }

    _nodeReached(id) { return id < this._currentLevel() }
    _nodeActive(id)  { return id === this._currentLevel() }

    _nodeReachable(id) {
        if (id === 1) return true
        return this.EDGES.some(([a, b]) =>
            (b === id && this._nodeReached(a)) ||
            (a === id && this._nodeReached(b))
        )
    }

    // ── Dibujo ────────────────────────────────────────────────────────────────

    _drawBackground() {
        const ctx = this.ctx
        ctx.fillStyle = "#050309"
        ctx.fillRect(0, 0, this.W, this.H)
    }

    _drawStars() {
        const ctx = this.ctx, t = this.t
        this.stars.forEach(s => {
            const a = s.a * (0.5 + 0.5 * Math.sin(t * s.sp + s.off))
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(200,180,255,${a})`
            ctx.fill()
        })
    }

    _drawMoon() {
        const ctx = this.ctx
        const mx = 590, my = 65, mr = 28
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2)
        ctx.fillStyle = "#d8c88a"; ctx.fill()
        ctx.beginPath(); ctx.arc(mx + 10, my - 6, mr - 4, 0, Math.PI * 2)
        ctx.fillStyle = "#060410"; ctx.fill()
    }

    _drawMountains() {
        const ctx = this.ctx
        this.MOUNTAINS.forEach((m, i) => {
            ctx.beginPath()
            ctx.moveTo(m.pts[0][0], m.pts[0][1])
            m.pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
            ctx.closePath()
            ctx.fillStyle = i === 0 ? "#110c1e" : "#0d0918"
            ctx.fill()
        })
    }

    _drawDeadTree(x, y, h) {
        const ctx = this.ctx
        ctx.strokeStyle = "#1e1428"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke()
        ctx.lineWidth = 1
        ;[[-18, -h*0.7],[12, -h*0.55],[-10, -h*0.4],[15, -h*0.25]].forEach(([dx, dy]) => {
            ctx.beginPath()
            ctx.moveTo(x, y + dy)
            ctx.lineTo(x + dx, y + dy - 14)
            ctx.stroke()
        })
    }

    _drawFog() {
        const ctx = this.ctx, t = this.t
        this.FOG.forEach(f => {
            const fx = f.x + Math.sin(t * 0.3 + f.x) * 8
            const grad = ctx.createRadialGradient(fx, f.y, 0, fx, f.y, f.rx)
            grad.addColorStop(0, "rgba(60,40,90,0.18)")
            grad.addColorStop(1, "rgba(60,40,90,0)")
            ctx.beginPath()
            ctx.ellipse(fx, f.y, f.rx, f.ry, 0, 0, Math.PI * 2)
            ctx.fillStyle = grad; ctx.fill()
        })
    }

    _drawEdges() {
        const ctx = this.ctx, t = this.t
        this.EDGES.forEach(([a, b]) => {
            const na = this.NODES[a - 1], nb = this.NODES[b - 1]
            const done   = this._nodeReached(na.id) && this._nodeReached(nb.id)
            const active = this._nodeReached(na.id) && !this._nodeReached(nb.id)

            ctx.beginPath()
            ctx.moveTo(na.x, na.y)
            ctx.lineTo(nb.x, nb.y)

            if (done) {
                ctx.strokeStyle = "rgba(140,90,200,0.55)"
                ctx.lineWidth = 1.5
                ctx.setLineDash([])
            } else if (active) {
                const pulse = 0.4 + 0.4 * Math.sin(t * 2)
                ctx.strokeStyle = `rgba(160,100,220,${pulse})`
                ctx.lineWidth = 1
                ctx.setLineDash([4, 5])
            } else {
                ctx.strokeStyle = "rgba(60,40,80,0.35)"
                ctx.lineWidth = 0.8
                ctx.setLineDash([3, 6])
            }
            ctx.stroke()
            ctx.setLineDash([])
        })
    }

    _drawNodes() {
        const ctx = this.ctx, t = this.t

        this.NODES.forEach(n => {
            const cfg       = this.TYPE[n.type]
            const reached   = this._nodeReached(n.id)
            const active    = this._nodeActive(n.id)
            const reachable = this._nodeReachable(n.id)
            const R = n.type === "boss" ? 22 : n.type === "miniboss" ? 18 : 14

            // Glow para nodo activo
            if (active) {
                const pulse = 0.3 + 0.3 * Math.sin(t * 3)
                ctx.beginPath()
                ctx.arc(n.x, n.y, R + 10 + pulse * 4, 0, Math.PI * 2)
                ctx.fillStyle = cfg.glowCol.replace("0.5", String(0.15 + pulse * 0.12))
                ctx.fill()
            }

            // Halo exterior
            if (reached || active) {
                ctx.beginPath()
                ctx.arc(n.x, n.y, R + 4, 0, Math.PI * 2)
                ctx.fillStyle = cfg.glowCol; ctx.fill()
            }

            // Círculo principal
            ctx.beginPath()
            ctx.arc(n.x, n.y, R, 0, Math.PI * 2)
            ctx.fillStyle  = (reached || active) ? cfg.fill : "#0d0918"
            ctx.fill()
            ctx.strokeStyle = (reached || active) ? cfg.stroke : "#2a1e3a"
            ctx.lineWidth   = active ? 2 : 1
            ctx.stroke()

            // Ícono / check
            if (reached && !active) {
                ctx.font = "10px Georgia"
                ctx.fillStyle = "#5a4a6a"
                ctx.textAlign = "center"; ctx.textBaseline = "middle"
                ctx.fillText("✓", n.x, n.y)
            } else if (!reached && reachable) {
                ctx.font = `${R}px Georgia`
                ctx.fillStyle = "rgba(160,130,200,0.35)"
                ctx.textAlign = "center"; ctx.textBaseline = "middle"
                ctx.fillText(cfg.glyph, n.x, n.y)
            } else if (active) {
                ctx.font = `${R - 2}px Georgia`
                ctx.fillStyle = "#e0c870"
                ctx.textAlign = "center"; ctx.textBaseline = "middle"
                ctx.fillText(cfg.glyph, n.x, n.y)
            }

            // Triángulo indicador sobre nodo activo
            if (active) {
                const by = n.y - R - 14
                const pulse = 0.7 + 0.3 * Math.sin(t * 4)
                ctx.beginPath()
                ctx.moveTo(n.x, by + 2)
                ctx.lineTo(n.x - 5, by + 10)
                ctx.lineTo(n.x + 5, by + 10)
                ctx.closePath()
                ctx.fillStyle = `rgba(220,190,80,${pulse})`
                ctx.fill()
            }

            // Etiqueta del nodo
            if (reached || active || reachable) {
                ctx.font = "11px Georgia"
                ctx.fillStyle = active ? "#c9a84c" : reached ? "#6a5a7a" : "#4a3a5a"
                ctx.textAlign = "center"; ctx.textBaseline = "middle"
                ctx.fillText(n.name, n.x, n.y + R + 13)
            }

            // Lore del nodo activo
            if (active) {
                ctx.font = "10px Georgia"
                ctx.fillStyle = "rgba(160,130,180,0.7)"
                ctx.textAlign = "center"; ctx.textBaseline = "middle"
                const words = n.lore.split(" ")
                let line = "", lines = []
                words.forEach(w => {
                    const test = line ? line + " " + w : w
                    if (ctx.measureText(test).width > 160) { lines.push(line); line = w }
                    else line = test
                })
                lines.push(line)
                lines.forEach((l, i) => ctx.fillText(l, n.x, n.y + R + 26 + i * 13))
            }
        })
    }

    _drawFrame() {
        this.t += 0.018
        const ctx = this.ctx

        this._drawBackground()
        this._drawStars()
        this._drawMoon()
        this._drawMountains()

        ;[[55, this.H - 8, 55],[620, this.H - 8, 45],[160, this.H - 8, 40],[500, this.H - 8, 50],[380, this.H - 8, 35]]
            .forEach(([x, y, h]) => this._drawDeadTree(x, y, h))

        this._drawFog()
        this._drawEdges()
        this._drawNodes()

        // Pie del mapa
        const lvl  = this._currentLevel()
        const node = this.NODES[lvl - 1]
        ctx.font = "12px Georgia"
        ctx.fillStyle = "rgba(100,80,140,0.7)"
        ctx.textAlign = "left"; ctx.textBaseline = "bottom"
        ctx.fillText(`Nivel ${lvl} / 10  —  ${node.name}`, 14, this.H - 10)

        // Leyenda superior
        const legend = [
            { col:"#7a2a2a", label:"Combate" },
            { col:"#3a3a8a", label:"Evento" },
            { col:"#7a5010", label:"Tienda" },
            { col:"#7a30b0", label:"Mini jefe" },
            { col:"#8a0a0a", label:"Jefe final" },
        ]
        ctx.font = "10px Georgia"
        ctx.textBaseline = "top"
        let lx = 14
        legend.forEach(({ col, label }) => {
            ctx.beginPath(); ctx.arc(lx + 5, 14, 4, 0, Math.PI * 2)
            ctx.fillStyle = col; ctx.fill()
            ctx.fillStyle = "rgba(120,100,150,0.7)"
            ctx.textAlign = "left"
            ctx.fillText(label, lx + 13, 10)
            lx += ctx.measureText(label).width + 28
        })

        if (this.visible) {
            this.animId = requestAnimationFrame(() => this._drawFrame())
        }
    }

    // ── API pública ───────────────────────────────────────────────────────────

    show() {
        this.visible = true
        this._drawFrame()
    }

    hide() {
        this.visible = false
        if (this.animId) cancelAnimationFrame(this.animId)
    }

    update() {
        // Llamar después de ganar un combate para reflejar el nuevo nivel
        // El canvas se actualiza solo en el próximo frame si está visible
    }
}