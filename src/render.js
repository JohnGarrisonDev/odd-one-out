// Canvas renderer. Reads the run state, never changes it. All art is drawn in code, flat Oddvale print style:
// chunky shapes, ink outlines, brand palette on a dark plum floor.
// Sprites that never change (Matchers, pickups, cogs) are drawn once to small off-screen canvases and stamped.
import { C, FONT, fitCanvas, drawOddFace } from '../kit/kit.js'
import { WEAPONS } from './game/data/weapons.js'
import { ENEMIES } from './game/data/enemies.js'
import { getCharacter } from './game/stats.js'
import { orbitCount, orbitRadius } from './game/weapons.js'
import { drawIcon } from './icons.js'

const TAU = Math.PI * 2
const FLOOR = '#1B1525', FLOOR_LINE = '#261E33', FLOOR_DOT = '#33294A'
const BODY = { plain: '#93A1C9', runner: '#93A1C9', tank: '#7E8CB6', splitter: '#93A1C9', shooter: '#93A1C9', charger: '#93A1C9', swarm: '#AAB6D6', foreman: '#8694BF', auditor: '#8694BF', template: '#7E8CB6' }
const SHADE = '#6F7DA8'

function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h) }
function cog(g, r, teeth, inner = 0.72) {
  g.beginPath()
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * TAU, a1 = ((i + 1) / (teeth * 2)) * TAU, rad = i % 2 ? r : r * inner
    g.lineTo(Math.cos(a0) * rad, Math.sin(a0) * rad); g.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad)
  }
  g.closePath()
}
function hex(g, r) { g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i / 6 * TAU) * r, Math.sin(i / 6 * TAU) * r); g.closePath() }

/** One Matcher, centred on 0,0 with body half-width r. Same box, same two square eyes, every time. */
function drawMatcher(g, r, look, elite) {
  const ink = C.ink, lw = Math.max(1.8, r * 0.15)
  g.lineJoin = 'round'; g.lineCap = 'round'
  g.fillStyle = 'rgba(8,5,14,.38)'; g.beginPath(); g.ellipse(0, r * 0.98, r * 0.92, r * 0.26, 0, 0, TAU); g.fill()
  // feet
  g.fillStyle = ink
  const fh = look === 'runner' ? 0.56 : 0.42
  rr(g, -r * 0.74, r * 0.6, r * 0.5, r * fh, r * 0.1); g.fill(); rr(g, r * 0.24, r * 0.6, r * 0.5, r * fh, r * 0.1); g.fill()
  // things that stick out behind the body
  g.strokeStyle = ink; g.lineWidth = lw
  if (look === 'charger') {
    g.fillStyle = C.orange
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * 0.95, -r * 0.7); g.lineTo(sx * r * 1.25, -r * 1.5); g.lineTo(sx * r * 0.35, -r * 0.95); g.closePath(); g.fill(); g.stroke() }
  }
  if (look === 'shooter') {
    g.beginPath(); g.moveTo(0, -r); g.lineTo(0, -r * 1.45); g.stroke()
    g.fillStyle = C.pink; g.beginPath(); g.arc(0, -r * 1.5, r * 0.3, 0, TAU); g.fill(); g.stroke()
  }
  if (elite) { g.strokeStyle = C.yellow; g.lineWidth = lw * 3.2; rr(g, -r, -r, r * 2, r * 1.8, r * 0.3); g.stroke(); g.strokeStyle = ink; g.lineWidth = lw }
  // body
  g.fillStyle = BODY[look] || BODY.plain
  rr(g, -r, -r, r * 2, r * 1.8, r * 0.3); g.fill()
  g.fillStyle = SHADE; rr(g, -r, r * 0.32, r * 2, r * 0.48, [0, 0, r * 0.3, r * 0.3]); g.fill()
  if (look === 'tank') { g.fillStyle = SHADE; rr(g, -r, -r, r * 2, r * 0.3, [r * 0.3, r * 0.3, 0, 0]); g.fill() }
  if (look === 'runner') { g.fillStyle = C.yellow; g.fillRect(-r, r * 0.36, r * 2, r * 0.2) }
  if (look === 'template') {
    g.strokeStyle = 'rgba(91,91,255,.55)'; g.lineWidth = lw * 0.5
    g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * r * 0.4, -r); g.lineTo(i * r * 0.4, r * 0.8); g.moveTo(-r, i * r * 0.36 - r * 0.1); g.lineTo(r, i * r * 0.36 - r * 0.1) } g.stroke()
    g.strokeStyle = ink; g.lineWidth = lw
  }
  rr(g, -r, -r, r * 2, r * 1.8, r * 0.3); g.stroke()
  if (look === 'splitter') {
    g.strokeStyle = C.mint; g.lineWidth = lw; g.setLineDash([r * 0.2, r * 0.22])
    g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, r * 0.72); g.moveTo(-r * 0.9, r * 0.2); g.lineTo(r * 0.9, r * 0.2); g.stroke()
    g.setLineDash([]); g.strokeStyle = ink
  }
  if (look === 'tank') { g.fillStyle = ink; for (const sx of [-1, 1]) for (const sy of [-0.84, 0.6]) { g.beginPath(); g.arc(sx * r * 0.78, sy * r, r * 0.07, 0, TAU); g.fill() } }
  // the eyes: two identical squares
  const es = r * 0.5, ey = -r * 0.36, ex = r * 0.46
  g.lineWidth = lw * 0.85
  for (const sx of [-1, 1]) {
    g.fillStyle = C.paper; g.fillRect(sx * ex - es / 2, ey - es / 2, es, es); g.strokeRect(sx * ex - es / 2, ey - es / 2, es, es)
    g.fillStyle = ink; g.fillRect(sx * ex - es * 0.2, ey - es * 0.2, es * 0.4, es * 0.4)
  }
  const boss = look === 'foreman' || look === 'auditor' || look === 'template'
  if (boss) { g.lineWidth = lw * 1.2; g.beginPath(); for (const sx of [-1, 1]) { g.moveTo(sx * ex - es * 0.7, ey - es * 0.85); g.lineTo(sx * ex + es * 0.7, ey - es * 0.85) } g.stroke() }
  if (look === 'auditor') { g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(-ex + es / 2, ey); g.lineTo(ex - es / 2, ey); g.stroke(); for (const sx of [-1, 1]) g.strokeRect(sx * ex - es * 0.72, ey - es * 0.72, es * 1.44, es * 1.44) }
  // the mouth: a flat line (or a nozzle, for the ones that shoot)
  g.lineWidth = lw
  if (look === 'shooter') { g.fillStyle = C.pink; g.fillRect(-r * 0.2, r * 0.02, r * 0.4, r * 0.3); g.strokeRect(-r * 0.2, r * 0.02, r * 0.4, r * 0.3) }
  else { g.beginPath(); g.moveTo(-r * 0.32, r * 0.14); g.lineTo(r * 0.32, r * 0.14); g.stroke() }
  if (look === 'charger') { g.fillStyle = C.orange; rr(g, -r * 1.08, r * 0.5, r * 2.16, r * 0.26, r * 0.1); g.fill(); g.stroke() }
  if (look === 'auditor') { g.fillStyle = C.pink; g.beginPath(); g.moveTo(-r * 0.12, r * 0.3); g.lineTo(r * 0.12, r * 0.3); g.lineTo(r * 0.2, r * 0.72); g.lineTo(0, r * 0.86); g.lineTo(-r * 0.2, r * 0.72); g.closePath(); g.fill(); g.stroke() }
  if (look === 'foreman') {
    g.fillStyle = C.yellow
    g.beginPath(); g.arc(0, -r * 0.92, r * 0.78, Math.PI, 0); g.closePath(); g.fill(); g.stroke()
    rr(g, -r * 1.08, -r * 1.02, r * 2.16, r * 0.2, r * 0.08); g.fill(); g.stroke()
  }
  if (look === 'template' || elite) {
    g.fillStyle = look === 'template' ? C.blue : C.yellow
    const cw = r * (elite ? 1.1 : 1.3), cy = -r * 1.02
    g.beginPath(); g.moveTo(-cw / 2, cy); g.lineTo(-cw / 2, cy - r * 0.42); g.lineTo(-cw / 4, cy - r * 0.2); g.lineTo(0, cy - r * 0.5); g.lineTo(cw / 4, cy - r * 0.2); g.lineTo(cw / 2, cy - r * 0.42); g.lineTo(cw / 2, cy); g.closePath(); g.fill(); g.stroke()
  }
}

const PICKUP_DRAW = {
  bolt0(g) { g.fillStyle = '#7F7FFF'; g.strokeStyle = '#D4D4FF'; g.lineWidth = 1.3; hex(g, 5.5); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 1.8, 0, TAU); g.fill() },
  bolt1(g) { g.fillStyle = C.mint; g.strokeStyle = '#C8FFEE'; g.lineWidth = 1.4; hex(g, 7); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill() },
  bolt2(g) { g.fillStyle = C.yellow; g.strokeStyle = '#FFF3C9'; g.lineWidth = 1.6; hex(g, 9); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 2.8, 0, TAU); g.fill() },
  heart(g) {
    g.fillStyle = C.mint; rr(g, -7, -9, 14, 19, 3); g.fill(); g.stroke(); g.fillStyle = C.ink; g.fillRect(-3, -12.5, 6, 3.5)
    g.fillStyle = C.paper; g.fillRect(-1.5, -4.5, 3, 10); g.fillRect(-5, -1, 10, 3)
  },
  magnet(g) {
    g.lineWidth = 9; g.strokeStyle = C.ink; g.beginPath(); g.arc(0, -1, 7, Math.PI, 0); g.moveTo(-7, -1); g.lineTo(-7, 8); g.moveTo(7, -1); g.lineTo(7, 8); g.stroke()
    g.lineWidth = 5.5; g.strokeStyle = C.pink; g.lineCap = 'butt'; g.beginPath(); g.arc(0, -1, 7, Math.PI, 0); g.moveTo(-7, -1); g.lineTo(-7, 4); g.moveTo(7, -1); g.lineTo(7, 4); g.stroke()
    g.strokeStyle = C.paper; g.beginPath(); g.moveTo(-7, 4); g.lineTo(-7, 8); g.moveTo(7, 4); g.lineTo(7, 8); g.stroke()
  },
  bomb(g) {
    g.fillStyle = C.ink; g.strokeStyle = C.orange; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 2, 8.5, 0, TAU); g.fill(); g.stroke()
    g.beginPath(); g.moveTo(3, -6); g.quadraticCurveTo(6, -12, 10, -10); g.stroke()
    g.fillStyle = C.yellow; g.beginPath(); g.arc(10.5, -10.5, 2.8, 0, TAU); g.fill()
    g.fillStyle = C.paper; g.beginPath(); g.arc(-3, -1, 2, 0, TAU); g.fill()
  },
  scrap(g) { g.fillStyle = C.orange; cog(g, 8, 6, 0.74); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill() },
  crate(g) {
    g.fillStyle = 'rgba(8,5,14,.38)'; g.beginPath(); g.ellipse(0, 13, 15, 4, 0, 0, TAU); g.fill()
    g.fillStyle = C.yellow; rr(g, -14, -11, 28, 23, 4); g.fill(); g.stroke()
    g.fillStyle = C.orange; g.fillRect(-14, -3, 28, 6); g.strokeRect(-14, -3, 28, 6)
    g.fillStyle = C.paper; rr(g, -4, -5, 8, 10, 2); g.fill(); g.stroke()
  },
  cog(g) { g.fillStyle = C.yellow; cog(g, 16, 8, 0.74); g.fill(); g.stroke(); g.fillStyle = C.plum; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.stroke() },
  wrench(g) {
    g.fillStyle = C.orange
    g.beginPath(); g.moveTo(-3, -4); g.lineTo(-3, 15); g.arc(0, 15, 3, Math.PI, 0, true); g.lineTo(3, -4)
    g.arc(0, -9, 7.5, 1.1, -1.05, false); g.lineTo(2.6, -9); g.lineTo(-2.6, -9); g.arc(0, -9, 7.5, Math.PI + 1.05, Math.PI - 1.1, false); g.closePath(); g.fill(); g.stroke()
  },
  mine(g) {
    g.fillStyle = 'rgba(8,5,14,.38)'; g.beginPath(); g.ellipse(0, 6, 11, 4, 0, 0, TAU); g.fill()
    g.fillStyle = C.pink; cog(g, 10, 8, 0.8); g.fill(); g.stroke(); g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill()
  },
  glow(g) { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 60); gr.addColorStop(0, 'rgba(255,170,80,.34)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(-60, -60, 120, 120) },
}
const SPRITE_HALF = { bolt0: 8, bolt1: 9, bolt2: 11, heart: 15, magnet: 14, bomb: 15, scrap: 11, crate: 19, cog: 19, wrench: 19, mine: 13, glow: 60 }

export function makeRenderer(canvas) {
  const g = canvas.getContext('2d')
  let W = 1, H = 1, dpr = 1, scale = 1, px = 1, zoom = 1
  let sprites = new Map(), floorTile = null
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const view = { w: 1100, h: 620 }

  function makeCanvas(half, draw) {
    const c = document.createElement('canvas'), size = Math.ceil(half * 2 * px)
    c.width = size; c.height = size
    const cg = c.getContext('2d')
    cg.setTransform(px, 0, 0, px, size / 2, size / 2)
    cg.strokeStyle = C.ink; cg.lineWidth = 1.8; cg.lineJoin = 'round'; cg.lineCap = 'round'
    draw(cg)
    return { c, half }
  }
  function whiten(sp) {
    const c = document.createElement('canvas'); c.width = sp.c.width; c.height = sp.c.height
    const cg = c.getContext('2d'); cg.drawImage(sp.c, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(255,255,255,.72)'; cg.fillRect(0, 0, c.width, c.height)
    return { c, half: sp.half }
  }
  function sprite(key) {
    let sp = sprites.get(key)
    if (!sp) { sp = makeCanvas(SPRITE_HALF[key], PICKUP_DRAW[key]); sprites.set(key, sp) }
    return sp
  }
  function enemySprite(e, flash) {
    const key = e.def.look + (e.elite ? 'E' : '') + (e.type === 'mini' ? 'm' : '') + (flash ? 'F' : '')
    let sp = sprites.get(key)
    if (!sp) {
      if (flash) sp = whiten(enemySprite(e, false))
      else sp = makeCanvas(e.r * 1.75 + 3, (cg) => drawMatcher(cg, e.r, e.def.look, e.elite))
      sprites.set(key, sp)
    }
    return sp
  }
  function buildFloor() {
    const T = 256, c = document.createElement('canvas'); c.width = c.height = Math.round(T * px)
    const k = c.width / T
    const f = c.getContext('2d'); f.scale(k, k)
    f.fillStyle = FLOOR; f.fillRect(0, 0, T, T)
    f.strokeStyle = FLOOR_LINE; f.lineWidth = 2
    f.beginPath(); for (const v of [0, 128, 256]) { f.moveTo(v, 0); f.lineTo(v, T); f.moveTo(0, v); f.lineTo(T, v) } f.stroke()
    f.fillStyle = FLOOR_DOT
    for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128], [256, 0], [0, 256], [256, 256], [128, 256], [256, 128]]) { f.beginPath(); f.arc(x, y, 4, 0, TAU); f.fill() }
    f.strokeStyle = FLOOR_DOT; f.lineWidth = 2.5; f.lineCap = 'round'
    f.beginPath()
    f.moveTo(58, 64); f.lineTo(70, 64); f.moveTo(64, 58); f.lineTo(64, 70) // plus
    f.moveTo(180, 186); f.lineTo(196, 202) // scratch
    f.moveTo(40, 196); f.lineTo(52, 190); f.moveTo(46, 204); f.lineTo(58, 198) // two ticks
    f.stroke()
    f.beginPath(); f.arc(196, 60, 7, 0, TAU); f.stroke() // a lone ring: the odd tile out
    floorTile = c
  }

  function resize() {
    const fit = fitCanvas(canvas)
    W = fit.w; H = fit.h; dpr = fit.dpr
    // Same world scale whatever the shape: the shorter side always shows a sensible slice of the vale.
    scale = W >= H ? H / 620 : W / 500
    scale = Math.max(0.45, scale) * zoom
    view.w = W / scale; view.h = H / scale
    const npx = Math.round(scale * dpr * 20) / 20
    if (npx !== px || !floorTile) { px = npx; sprites = new Map(); buildFloor() }
    return view
  }

  function stamp(sp, x, y, sx = 1, sy = 1) { g.drawImage(sp.c, x - sp.half * sx, y - sp.half * sy, sp.half * 2 * sx, sp.half * 2 * sy) }
  function stampRot(sp, x, y, rot, k = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(sp.c, -sp.half * k, -sp.half * k, sp.half * 2 * k, sp.half * 2 * k); g.restore() }

  function drawFloor(cx, cy) {
    const T = 256, x0 = Math.floor((cx - view.w / 2) / T) * T, y0 = Math.floor((cy - view.h / 2) / T) * T
    for (let y = y0; y < cy + view.h / 2; y += T) for (let x = x0; x < cx + view.w / 2; x += T) g.drawImage(floorTile, x, y, T + 0.5, T + 0.5)
  }

  function drawOdd(p, bodyColor, time, alpha = 1) {
    const r = 15
    const bob = p.moving ? Math.sin(p.walk) * 1.6 : Math.sin(time * 3) * 0.7
    stamp(sprite('glow'), p.x, p.y)
    g.save(); g.translate(p.x, p.y)
    g.globalAlpha = alpha
    g.fillStyle = 'rgba(8,5,14,.4)'; g.beginPath(); g.ellipse(0, r * 0.98, r * 0.95, r * 0.28, 0, 0, TAU); g.fill()
    g.fillStyle = C.ink
    const st = p.moving ? Math.sin(p.walk) * 2.5 : 0
    rr(g, -r * 0.74, r * 0.58 + st, r * 0.52, r * 0.46, 2); g.fill(); rr(g, r * 0.22, r * 0.58 - st, r * 0.52, r * 0.46, 2); g.fill()
    g.rotate(-0.07 + Math.max(-0.12, Math.min(0.12, p.vx * 0.0008)))
    g.translate(0, bob)
    g.strokeStyle = C.ink; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'
    const sway = Math.max(-4, Math.min(4, -p.vx * 0.02))
    g.beginPath(); g.moveTo(5, -r); g.quadraticCurveTo(6, -r - 8, 7 + sway, -r - 11); g.stroke()
    g.fillStyle = C.orange; g.beginPath(); g.arc(7 + sway, -r - 12, 3.6, 0, TAU); g.fill(); g.stroke()
    g.fillStyle = bodyColor; rr(g, -r, -r, r * 2, r * 1.85, r * 0.45); g.fill(); g.stroke()
    drawOddFace(g, 0, -1.5, r * 1.5, { look: p.lookX * 0.8, lookY: p.lookY * 0.8, blink: time % 4.3 < 0.13 })
    g.restore()
  }

  function drawEnemies(s, cx, cy, time) {
    const hw = view.w / 2 + 70, hh = view.h / 2 + 70, list = s.enemies
    // telegraphs first, under the bodies
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      if (e.state !== 1 || (e.def.ai !== 'charge' && e.def.ai !== 'boss')) continue
      if (Math.abs(e.x - cx) > hw + 200 || Math.abs(e.y - cy) > hh + 200) continue
      const len = e.def.dashSpeed * (e.boss ? 0.62 : e.def.dash) + e.r
      g.save(); g.translate(e.x, e.y); g.rotate(Math.atan2(e.dy, e.dx))
      g.fillStyle = 'rgba(255,91,46,.22)'; g.fillRect(0, -e.r, len, e.r * 2)
      g.strokeStyle = C.orange; g.lineWidth = 2; g.setLineDash([8, 7]); g.strokeRect(0, -e.r, len, e.r * 2); g.setLineDash([])
      g.restore()
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      if (e.x - cx > hw || cx - e.x > hw || e.y - cy > hh || cy - e.y > hh) continue
      const sp = enemySprite(e, e.flash > 0)
      const wob = Math.sin(time * 9 + e.phase) * 0.045
      let sx = 1 - wob, sy = 1 + wob, ox = 0
      if (e.state === 1 || e.state === 3) { ox = Math.sin(time * 60) * 1.5; sy *= 0.94; sx *= 1.05 } // winding up: shiver and crouch
      const pop = e.born > 0 && s.t - e.born < 0.18 ? 0.6 + (s.t - e.born) / 0.18 * 0.4 : 1
      stamp(sp, e.x + ox, e.y, sx * pop, sy * pop)
      if (e.state === 1 || e.state === 3) {
        g.fillStyle = C.orange; g.strokeStyle = C.ink; g.lineWidth = 3
        g.font = `800 ${Math.max(16, e.r * 0.9)}px ${FONT.display}`; g.textAlign = 'center'
        g.strokeText('!', e.x, e.y - e.r * 1.5); g.fillText('!', e.x, e.y - e.r * 1.5)
      }
      if (e.elite && e.hp < e.maxHp) {
        const w = e.r * 2
        g.fillStyle = C.ink; g.fillRect(e.x - w / 2 - 1.5, e.y + e.r + 7.5, w + 3, 7)
        g.fillStyle = C.yellow; g.fillRect(e.x - w / 2, e.y + e.r + 9, w * Math.max(0, e.hp / e.maxHp), 4)
      }
    }
  }

  function drawPickups(s, cx, cy, time) {
    const hw = view.w / 2 + 30, hh = view.h / 2 + 30, list = s.pickups
    for (let i = 0; i < list.length; i++) {
      const o = list[i]
      if (o.x - cx > hw || cx - o.x > hw || o.y - cy > hh || cy - o.y > hh) continue
      if (o.kind === 'bolt') stamp(sprite(o.value < 3 ? 'bolt0' : o.value < 12 ? 'bolt1' : 'bolt2'), o.x, o.y)
      else {
        const bob = Math.sin(time * 4 + o.phase) * 2.5
        if (o.kind !== 'scrap') { g.strokeStyle = 'rgba(251,246,236,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(o.x, o.y, 20 + Math.sin(time * 4 + o.phase) * 2, 0, TAU); g.stroke() }
        stamp(sprite(o.kind), o.x, o.y + bob)
      }
    }
  }

  function drawGround(s, time) {
    for (let i = 0; i < s.pools.length; i++) {
      const o = s.pools[i], k = Math.min(1, o.life / 0.4, (o.max - o.life) / 0.25)
      const r = o.r * (0.5 + 0.5 * k)
      g.fillStyle = 'rgba(96,58,170,.5)'; g.strokeStyle = '#B48CFF'; g.lineWidth = 2.5
      g.beginPath()
      for (let j = 0; j <= 14; j++) { const a = (j / 14) * TAU, rad = r * (0.9 + 0.1 * Math.sin(a * 3 + o.seed + time * 1.5)); g.lineTo(o.x + Math.cos(a) * rad, o.y + Math.sin(a) * rad * 0.82) }
      g.closePath(); g.fill(); g.stroke()
      g.strokeStyle = 'rgba(255,143,199,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(o.x - r * 0.25, o.y - r * 0.2, r * 0.32, 3.4, 4.6); g.stroke()
    }
    for (let i = 0; i < s.hazards.length; i++) {
      const h = s.hazards[i], k = Math.min(1, h.t / h.delay)
      g.fillStyle = 'rgba(255,91,46,.16)'; g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill()
      g.fillStyle = 'rgba(255,91,46,.42)'; g.beginPath(); g.arc(h.x, h.y, h.r * k, 0, TAU); g.fill()
      g.strokeStyle = C.orange; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -time * 30
      g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.stroke(); g.setLineDash([])
    }
    const mine = sprite('mine')
    for (let i = 0; i < s.mines.length; i++) {
      const m = s.mines[i], pop = Math.min(1, m.age / 0.15)
      stamp(mine, m.x, m.y, pop, pop)
      if (m.age > m.arm && Math.sin(time * 10 + i) > 0) { g.fillStyle = C.yellow; g.beginPath(); g.arc(m.x, m.y, 2.4, 0, TAU); g.fill() }
    }
  }

  function drawWeapons(s, time, under) {
    const p = s.player
    for (let i = 0; i < s.weapons.length; i++) {
      const w = s.weapons[i], def = WEAPONS[w.id], L = def.levels[w.lvl - 1]
      if (def.kind === 'orbit' && !under) {
        const n = orbitCount(s, L), R = orbitRadius(s, L), k = (L.size * s.stats.area) / 16, sp = sprite('cog')
        for (let j = 0; j < n; j++) { const a = w.ang + (j / n) * TAU; stampRot(sp, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, -w.ang * 2.5, k) }
      } else if (def.kind === 'beam' && under && w.active > 0) {
        const len = L.len * s.stats.area, wd = L.width * s.stats.area, beams = 1 + s.stats.amount
        const ex = p.x - 4, ey = p.y - 5
        g.lineCap = 'round'
        for (let b = 0; b < beams; b++) {
          const a = w.ang + (b / beams) * TAU, x2 = p.x + Math.cos(a) * len, y2 = p.y + Math.sin(a) * len
          const fl = 1 + Math.sin(time * 50) * 0.12
          g.strokeStyle = C.ink; g.lineWidth = wd * fl + 5; g.beginPath(); g.moveTo(ex, ey); g.lineTo(x2, y2); g.stroke()
          g.strokeStyle = C.orange; g.lineWidth = wd * fl; g.beginPath(); g.moveTo(ex, ey); g.lineTo(x2, y2); g.stroke()
          g.strokeStyle = C.yellow; g.lineWidth = wd * 0.38; g.beginPath(); g.moveTo(ex, ey); g.lineTo(x2, y2); g.stroke()
        }
      }
    }
  }

  function drawShots(s) {
    const wr = sprite('wrench')
    g.strokeStyle = C.ink; g.lineWidth = 2; g.lineJoin = 'round'
    for (let i = 0; i < s.shots.length; i++) {
      const o = s.shots[i]
      if (o.kind === 1) stampRot(wr, o.x, o.y, o.rot, o.r / 15)
      else {
        const c = Math.cos(o.rot), sn = Math.sin(o.rot), l = o.r * 2.2, wdt = o.r * 0.9
        g.fillStyle = C.yellow
        g.beginPath(); g.moveTo(o.x + c * l, o.y + sn * l); g.lineTo(o.x - sn * wdt, o.y + c * wdt); g.lineTo(o.x - c * l * 1.3, o.y - sn * l * 1.3); g.lineTo(o.x + sn * wdt, o.y - c * wdt); g.closePath()
        g.fill(); g.stroke()
      }
    }
    // enemy shots: one pink batch with an ink edge, then paper cores
    if (s.eshots.length) {
      g.fillStyle = C.pink; g.lineWidth = 2.5
      g.beginPath(); for (let i = 0; i < s.eshots.length; i++) { const o = s.eshots[i]; g.moveTo(o.x + o.r, o.y); g.arc(o.x, o.y, o.r, 0, TAU) }
      g.fill(); g.stroke()
      g.fillStyle = C.paper
      g.beginPath(); for (let i = 0; i < s.eshots.length; i++) { const o = s.eshots[i]; g.moveTo(o.x + o.r * 0.4, o.y); g.arc(o.x, o.y, o.r * 0.4, 0, TAU) }
      g.fill()
    }
    g.lineCap = 'round'
    for (let i = 0; i < s.zaps.length; i++) {
      const z = s.zaps[i], k = z.life / z.max
      const dx = z.x2 - z.x1, dy = z.y2 - z.y1, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d
      const segs = Math.max(2, Math.min(6, Math.round(d / 28)))
      g.beginPath(); g.moveTo(z.x1, z.y1)
      for (let j = 1; j < segs; j++) { const t = j / segs, off = Math.sin(z.seed + j * 12.9898) * 9; g.lineTo(z.x1 + dx * t + nx * off, z.y1 + dy * t + ny * off) }
      g.lineTo(z.x2, z.y2)
      g.strokeStyle = C.blue; g.lineWidth = 7 * k + 1; g.stroke()
      g.strokeStyle = C.paper; g.lineWidth = 2.5 * k + 0.5; g.stroke()
    }
  }

  function drawFx(s, showNumbers) {
    for (let i = 0; i < s.rings.length; i++) {
      const r = s.rings[i], k = 1 - r.life / r.max, e = 1 - (1 - k) * (1 - k)
      const rad = r.r0 + (r.r1 - r.r0) * e
      if (r.fill) { g.globalAlpha = r.fill * (1 - k); g.fillStyle = r.color; g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.fill(); g.globalAlpha = 1 }
      g.strokeStyle = r.color; g.lineWidth = Math.max(0.5, r.width * (1 - k)); g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.stroke()
    }
    for (let i = 0; i < s.parts.length; i++) {
      const p = s.parts[i], sz = p.size * Math.min(1, (p.life / p.max) * 1.6)
      g.fillStyle = p.color
      if (p.kind === 1) { const c = Math.cos(p.rot) * sz, sn = Math.sin(p.rot) * sz; g.beginPath(); g.moveTo(p.x + c, p.y + sn); g.lineTo(p.x - sn, p.y + c); g.lineTo(p.x - c, p.y - sn); g.lineTo(p.x + sn, p.y - c); g.fill() }
      else { g.beginPath(); g.arc(p.x, p.y, sz, 0, TAU); g.fill() }
    }
    if (showNumbers && s.texts.length) {
      g.textAlign = 'center'; g.lineJoin = 'round'; g.strokeStyle = C.ink
      let font = ''
      for (let i = 0; i < s.texts.length; i++) {
        const t = s.texts[i], f = t.big ? 17 : t.value >= 40 ? 14 : 11.5
        const want = `500 ${f}px ${FONT.mono}`
        if (want !== font) { g.font = want; font = want }
        const k = t.life / t.max, y = t.y - (1 - k) * 4
        g.globalAlpha = Math.min(1, k * 2.5)
        const txt = String(Math.max(1, Math.round(t.value)))
        g.lineWidth = 3; g.strokeText(txt, t.x, y)
        g.fillStyle = t.big ? t.color : t.value >= 40 ? C.yellow : C.paper; g.fillText(txt, t.x, y)
      }
      g.globalAlpha = 1
    }
  }

  function arrow(tx, ty, cx, cy, color) {
    // screen-edge pointer to something off screen (world coords in, screen coords drawn)
    const dx = (tx - cx) * scale, dy = (ty - cy) * scale
    const hw = W / 2 - 26, hh = H / 2 - 26
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) return
    const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6))
    const x = W / 2 + dx * k, y = H / 2 + dy * k, a = Math.atan2(dy, dx)
    g.save(); g.translate(x, y); g.rotate(a)
    g.fillStyle = color; g.strokeStyle = C.ink; g.lineWidth = 2.5; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(12, 0); g.lineTo(-8, -10); g.lineTo(-3, 0); g.lineTo(-8, 10); g.closePath(); g.fill(); g.stroke()
    g.restore()
  }

  /** Draw a frame of the run. opts: { time, numbers, shake, stick: { on, x, y, dx, dy } } */
  function draw(s, opts) {
    const time = opts.time, p = s.player
    let cx = p.x, cy = p.y
    let shx = 0, shy = 0
    if (s.shake > 0 && opts.shake && !reduced) { const a = time * 97; shx = Math.sin(a) * s.shake * 0.5; shy = Math.cos(a * 1.3) * s.shake * 0.5 }
    const k = scale * dpr
    g.setTransform(k, 0, 0, k, Math.round((W / 2 + shx) * dpr - cx * k), Math.round((H / 2 + shy) * dpr - cy * k))
    g.imageSmoothingEnabled = true
    drawFloor(cx, cy)
    drawGround(s, time)
    drawPickups(s, cx, cy, time)
    drawEnemies(s, cx, cy, time)
    drawWeapons(s, time, true)
    if (s.mode !== 'dead') {
      const blinkOut = p.iframe > 0 && Math.sin(time * 40) > 0.2
      drawOdd(p, getCharacter(s.char).body, time, blinkOut ? 0.45 : 1)
      if (p.hurt > 0) { g.strokeStyle = C.orange; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, 22 + (0.3 - p.hurt) * 60, 0, TAU); g.stroke() }
    }
    drawWeapons(s, time, false)
    drawShots(s)
    drawFx(s, opts.numbers)

    // screen space
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (s.boss) arrow(s.boss.x, s.boss.y, cx, cy, C.orange)
    for (let i = 0; i < s.pickups.length; i++) { const o = s.pickups[i]; if (o.kind === 'crate') arrow(o.x, o.y, cx, cy, C.yellow) }
    if (s.flash > 0 && !reduced) { g.fillStyle = `rgba(251,246,236,${Math.min(0.6, s.flash * 1.6)})`; g.fillRect(0, 0, W, H) }
    const st = opts.stick
    if (st && st.on) {
      g.strokeStyle = 'rgba(251,246,236,.3)'; g.lineWidth = 3; g.beginPath(); g.arc(st.x, st.y, st.max, 0, TAU); g.stroke()
      g.fillStyle = 'rgba(251,246,236,.32)'; g.beginPath(); g.arc(st.x + st.dx, st.y + st.dy, 20, 0, TAU); g.fill()
    }
  }

  // Title screen backdrop: rows and rows of identical Matchers, and one robot who isn't.
  const fake = { x: 0, y: 0, vx: 0, vy: 0, moving: false, walk: 0, lookX: 0.5, lookY: 0.4 }
  function drawTitle(time, charId) {
    const k = scale * dpr
    const cx = Math.sin(time * 0.15) * 30, cy = Math.cos(time * 0.11) * 14 + view.h * (W < H ? 0.07 : 0.03)
    g.setTransform(k, 0, 0, k, Math.round(W / 2 * dpr - cx * k), Math.round(H / 2 * dpr - cy * k))
    drawFloor(cx, cy)
    const e = { def: ENEMIES.walker, r: 13, elite: false, type: 'walker' }
    const sp = enemySprite(e, false), gap = 44
    const nx = Math.ceil(view.w / 2 / gap) + 2, ny = Math.ceil(view.h / 2 / gap) + 2
    for (let j = -ny; j <= ny; j++) {
      for (let i = -nx; i <= nx; i++) {
        const x = i * gap, y = j * gap
        const d = Math.hypot(x, y * 1.15)
        if (d < 96) continue
        const wob = Math.sin(time * 2.2 + d * 0.02) * 0.03
        stamp(sp, x, y, 1 - wob, 1 + wob)
      }
    }
    fake.lookX = Math.sin(time * 0.7) * 0.8; fake.lookY = Math.cos(time * 0.9) * 0.6
    g.save(); g.translate(0, 0); g.scale(1.7, 1.7); drawOdd(fake, getCharacter(charId).body, time); g.restore()
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** A small canvas with the icon for a weapon / passive / filler id, for DOM menus and the HUD. */
  function iconCanvas(id, size = 40) {
    const c = document.createElement('canvas'), d = Math.min(window.devicePixelRatio || 1, 2)
    c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + 'px'; c.className = 'icon'
    const cg = c.getContext('2d'); cg.scale(d, d)
    drawIcon(cg, id, size)
    return c
  }

  return { resize, draw, drawTitle, iconCanvas, view, get scale() { return scale }, /** debug: camera zoom */ setZoom(k) { zoom = k; return resize() } }
}
