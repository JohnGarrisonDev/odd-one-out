// A simple autoplayer, used by the headless balance sim (tests/balance.mjs), the smoke test and the ?debug hook.
// It is not part of the game. skill: 'novice' (slow reactions, short sight, random picks) or 'good'.
import { chooseOffer, closeCrate, keepGoing } from './sim.js'
import { makeRng } from './util.js'

const PREFS = { weapon: 3, cell: 2.4, clock: 2.4, spares: 2.6, lens: 1.6, plating: 1.5, armour: 1.6, solder: 1.3, springs: 1.4, magnet: 1.2, luck: 0.8 }

export function makeBot(skill = 'good', seed = 1) {
  const rng = makeRng(seed)
  const good = skill === 'good'
  const sight = good ? 150 : 110, react = good ? 0.05 : 0.3
  let think = 0, wx = 1, wy = 0, wanderT = 0
  return function bot(s) {
    if (s.mode === 'levelup') {
      let pick = 0
      if (good) {
        let best = -1
        s.offers.forEach((o, i) => { const v = (o.type === 'weapon' ? PREFS.weapon : PREFS[o.id] || 1) + rng() * 0.5; if (v > best) { best = v; pick = i } })
      } else pick = Math.floor(rng() * s.offers.length)
      chooseOffer(s, pick); return
    }
    if (s.mode === 'crate') { closeCrate(s); return }
    if (s.mode === 'won') { keepGoing(s); return }
    if (s.mode !== 'play') return
    think -= 1 / 60
    if (think > 0) return
    think = react
    const p = s.player
    let fx = 0, fy = 0, threat = 0
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i]
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) - e.r
      const reach = e.boss ? sight * 1.6 : sight
      if (d > reach) continue
      const w = (e.boss ? 6 : 1) * (e.r / 13) / Math.max(8, d) ** 2
      fx += (dx / (d + e.r)) * w; fy += (dy / (d + e.r)) * w; threat += w
    }
    for (let i = 0; i < s.eshots.length; i++) {
      const o = s.eshots[i], dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy)
      if (d > sight * 0.7) continue
      // step sideways out of the shot's path
      const side = dx * o.vy - dy * o.vx > 0 ? 1 : -1, sp = Math.hypot(o.vx, o.vy) || 1
      const w = (good ? 3 : 1) / Math.max(10, d) ** 2
      fx += (o.vy / sp) * side * w + (dx / d) * w * 0.4; fy += (-o.vx / sp) * side * w + (dy / d) * w * 0.4; threat += w
    }
    for (let i = 0; i < s.hazards.length; i++) {
      const h = s.hazards[i], dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1
      if (d > h.r + 30) continue
      const w = (good ? 8 : 2) / 400
      fx += (dx / d) * w; fy += (dy / d) * w; threat += w
    }
    // Drift towards loot when it is fairly safe.
    let lx = 0, ly = 0, bd = good ? 420 : 260, found = false
    for (let i = 0; i < s.pickups.length; i++) {
      const o = s.pickups[i]; if (o.vac) continue
      const d = Math.hypot(o.x - p.x, o.y - p.y) / (o.kind === 'bolt' ? 1 : 3)
      if (d < bd) { bd = d; lx = o.x - p.x; ly = o.y - p.y; found = true }
    }
    wanderT -= react
    if (wanderT <= 0) { wanderT = 1 + rng() * 2; const a = rng() * 6.283; wx = Math.cos(a); wy = Math.sin(a) }
    const fm = Math.hypot(fx, fy)
    let mx = 0, my = 0
    if (fm > 0) { mx = fx / fm - (fy / fm) * 0.8; my = fy / fm + (fx / fm) * 0.8 } // flee, curving round the crowd
    const calm = Math.max(0, 1 - threat * (good ? 2500 : 1200))
    if (found) { const lm = Math.hypot(lx, ly) || 1; mx += (lx / lm) * (0.35 + calm * 1.5); my += (ly / lm) * (0.35 + calm * 1.5) }
    else { mx += wx * calm * 0.6; my += wy * calm * 0.6 }
    if (!good) { mx += (rng() - 0.5) * 0.5; my += (rng() - 0.5) * 0.5 }
    const m = Math.hypot(mx, my)
    s.input.x = m > 0.05 ? mx / m : 0; s.input.y = m > 0.05 ? my / m : 0
  }
}
