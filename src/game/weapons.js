// Weapon behaviours. Each `kind` is a function (s, w, L, dt) run every step for a held weapon:
//   s = run state, w = the held weapon { id, lvl, cd, ... scratch fields }, L = its current level's stats (data/weapons.js).
// To add a new kind: write the function, add it to KINDS, and (if it draws something new) teach render.js about it.
// Player bonuses: s.stats.damage is applied inside hurtEnemy; cooldown / area / amount are applied here.
import { WEAPONS } from './data/weapons.js'
import { hurtEnemy, blast, ring, zap, emit, burst, shake } from './combat.js'
import { TAU } from './util.js'

const take = (free) => (free.length ? free.pop() : {})
const near = [] // scratch: the K nearest enemies
const nearD = []

/** Find up to k nearest live enemies within maxDist of (x, y). Fills `near`, returns how many. */
export function nearestK(s, x, y, k, maxDist) {
  let n = 0
  const list = s.enemies, max2 = maxDist * maxDist
  for (let i = 0; i < list.length; i++) {
    const e = list[i]
    if (e.dead) continue
    const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy
    if (d2 > max2) continue
    if (n < k || d2 < nearD[n - 1]) {
      let j = n < k ? n++ : n - 1
      while (j > 0 && nearD[j - 1] > d2) { near[j] = near[j - 1]; nearD[j] = nearD[j - 1]; j-- }
      near[j] = e; nearD[j] = d2
    }
  }
  return n
}
export function nearest(s, x, y, maxDist) { return nearestK(s, x, y, 1, maxDist) ? near[0] : null }

function shot(s, kind, wid, x, y, vx, vy, r, dmg, life) {
  const o = take(s.free.shots)
  o.kind = kind; o.wid = wid; o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.r = r; o.dmg = dmg; o.life = life; o.age = 0
  o.pierce = 0; o.h1 = 0; o.h2 = 0; o.h3 = 0; o.back = false; o.out = 0; o.rot = 0; o.dead = false
  s.shots.push(o)
  return o
}
const seeRange = (s) => Math.max(s.view.w, s.view.h) * 0.5 + 30

const KINDS = {
  // Auto-aimed projectiles at the nearest enemies.
  bolt(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, count = L.count + s.stats.amount
    const n = nearestK(s, p.x, p.y, count, seeRange(s))
    if (!n) { w.cd = 0.12; return }
    for (let i = 0; i < count; i++) {
      const e = near[i % n], extra = Math.floor(i / n)
      const a = Math.atan2(e.y - p.y, e.x - p.x) + (extra ? (extra % 2 ? 1 : -1) * 0.14 * Math.ceil(extra / 2) : 0)
      const o = shot(s, 0, w.id, p.x, p.y, Math.cos(a) * L.speed, Math.sin(a) * L.speed, 6 * s.stats.area, L.dmg, 1.1)
      o.pierce = L.pierce; o.rot = a
    }
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'shot')
  },

  // Things circling the player. Render reads w.ang and the same count / radius maths (orbitCount, orbitRadius).
  orbit(s, w, L, dt) {
    const p = s.player, g = s.grid
    w.ang = (w.ang + L.rot * dt) % TAU
    const n = L.count + s.stats.amount, R = L.radius * s.stats.area, size = L.size * s.stats.area
    for (let k = 0; k < n; k++) {
      const a = w.ang + (k / n) * TAU, x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R
      const m = g.query(x, y, size)
      for (let i = 0; i < m; i++) {
        const e = g.out[i]
        if (s.t < e.cdA) continue
        e.cdA = s.t + L.tick
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1
        hurtEnemy(s, e, L.dmg, (dx / d) * L.kb, (dy / d) * L.kb, w.id)
        emit(s, 'grind')
      }
    }
  },

  // Thrown out, slows, flies home. Hits everything on the way, both ways.
  boomerang(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, count = L.count + s.stats.amount
    const n = nearestK(s, p.x, p.y, count, seeRange(s) * 0.8)
    if (!n) { w.cd = 0.15; return }
    for (let i = 0; i < count; i++) {
      const e = near[i % n], extra = Math.floor(i / n)
      const a = Math.atan2(e.y - p.y, e.x - p.x) + extra * 0.5 * (i % 2 ? 1 : -1)
      const o = shot(s, 1, w.id, p.x, p.y, Math.cos(a) * L.speed, Math.sin(a) * L.speed, L.size * s.stats.area, L.dmg, 4)
      o.out = L.out; o.speed = L.speed
    }
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'throw')
  },

  // Instant bolt that hops from enemy to enemy.
  chain(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, g = s.grid
    let e = nearest(s, p.x, p.y, L.range * s.stats.area)
    if (!e) { w.cd = 0.15; return }
    const tok = ++s.tok, jumpR = L.jump * s.stats.area
    let fx = p.x, fy = p.y, jumps = L.jumps + s.stats.amount * 2
    while (e && jumps-- > 0) {
      e.tok = tok
      const ex = e.x, ey = e.y
      zap(s, fx, fy, ex, ey)
      hurtEnemy(s, e, L.dmg, 0, 0, w.id)
      fx = ex; fy = ey
      const m = g.query(ex, ey, jumpR)
      let best = null, bd = Infinity
      for (let i = 0; i < m; i++) {
        const o = g.out[i]
        if (o.tok === tok || o.dead) continue
        const d = (o.x - ex) ** 2 + (o.y - ey) ** 2
        if (d < bd) { bd = d; best = o }
      }
      e = best
    }
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'zap')
  },

  // A sweeping laser from Odd's big eye. w.active > 0 while firing; w.ang is the beam direction.
  beam(s, w, L, dt) {
    const p = s.player
    if (!(w.active > 0)) {
      w.cd -= dt
      if (w.cd > 0) return
      const e = nearest(s, p.x, p.y, L.len * s.stats.area * 1.2)
      if (!e) { w.cd = 0.2; return }
      w.dir = w.dir === 1 ? -1 : 1
      w.ang = Math.atan2(e.y - p.y, e.x - p.x) - (Math.min(L.sweep, 1.6) / 2) * w.dir
      w.active = L.dur
      emit(s, 'beam')
      return
    }
    w.active -= dt
    w.ang += (L.sweep / L.dur) * w.dir * dt
    const len = L.len * s.stats.area, half = L.width * s.stats.area * 0.5, beams = 1 + s.stats.amount
    const g = s.grid, m = g.query(p.x, p.y, len)
    for (let b = 0; b < beams; b++) {
      const a = w.ang + (b / beams) * TAU, ca = Math.cos(a), sa = Math.sin(a)
      for (let i = 0; i < m; i++) {
        const e = g.out[i]
        if (e.dead || s.t < e.cdB) continue
        const dx = e.x - p.x, dy = e.y - p.y
        const along = dx * ca + dy * sa
        if (along < -e.r || along > len + e.r) continue
        if (Math.abs(dy * ca - dx * sa) > half + e.r) continue
        e.cdB = s.t + L.tick
        hurtEnemy(s, e, L.dmg, ca * 40, sa * 40, w.id)
      }
    }
    if (w.active <= 0) w.cd = L.cd * s.stats.cooldown
  },

  // Mines dropped at your feet; they go off when a Matcher walks over them (or when they get old).
  mine(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, count = L.count + s.stats.amount
    if (s.enemies.length === 0) { w.cd = 0.3; return }
    for (let i = 0; i < count; i++) {
      const m = take(s.free.mines)
      const a = s.rng() * TAU, d = i === 0 ? 0 : 30 + s.rng() * 40
      m.x = p.x + Math.cos(a) * d; m.y = p.y + Math.sin(a) * d
      m.arm = 0.35; m.life = L.life; m.blast = L.blast * s.stats.area; m.dmg = L.dmg; m.wid = w.id; m.dead = false; m.age = 0
      s.mines.push(m)
    }
    if (s.mines.length > 16) s.mines[0].life = 0
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'drop')
  },

  // A shove in all directions.
  nova(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, R = L.radius * s.stats.area
    if (!nearest(s, p.x, p.y, R * 1.25)) { w.cd = 0.15; return }
    blast(s, p.x, p.y, R, L.dmg, L.kb, w.id)
    ring(s, p.x, p.y, 14, R, 0.32, '#2FD6A3', 0.16, 6)
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'pulse')
  },

  // Puddles thrown onto the crowd: slow and burn whatever stands in them.
  pool(s, w, L, dt) {
    w.cd -= dt
    if (w.cd > 0) return
    const p = s.player, count = L.count + s.stats.amount
    const n = nearestK(s, p.x, p.y, 8, 320)
    if (!n) { w.cd = 0.2; return }
    for (let i = 0; i < count; i++) {
      const e = near[Math.floor(s.rng() * n)]
      const o = take(s.free.pools)
      o.x = e.x + (s.rng() - 0.5) * 30; o.y = e.y + (s.rng() - 0.5) * 30
      o.r = L.radius * s.stats.area; o.life = L.life; o.max = L.life; o.dmg = L.dmg; o.tick = L.tick; o.next = 0.15; o.slow = L.slow; o.wid = w.id
      o.seed = s.rng() * 100; o.dead = false
      s.pools.push(o)
    }
    if (s.pools.length > 9) s.pools[0].life = Math.min(s.pools[0].life, 0.3)
    w.cd = L.cd * s.stats.cooldown
    emit(s, 'splat')
  },
}

export function orbitCount(s, L) { return L.count + s.stats.amount }
export function orbitRadius(s, L) { return L.radius * s.stats.area }

export function updateWeapons(s, dt) {
  for (let i = 0; i < s.weapons.length; i++) {
    const w = s.weapons[i], def = WEAPONS[w.id]
    KINDS[def.kind](s, w, def.levels[w.lvl - 1], dt)
  }
}

/** Player projectiles, mines and pools. */
export function updateShots(s, dt) {
  const p = s.player, g = s.grid
  for (let i = 0; i < s.shots.length; i++) {
    const o = s.shots[i]
    if (o.dead) continue
    o.age += dt; o.life -= dt
    if (o.kind === 1) { // boomerang
      o.rot += 16 * dt
      if (!o.back) {
        const k = Math.max(0.05, 1 - o.age / o.out)
        o.x += o.vx * k * dt; o.y += o.vy * k * dt
        if (o.age >= o.out) o.back = true
      } else {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1
        const sp = Math.min(o.speed * 1.5, 120 + (o.age - o.out) * 900)
        o.x += (dx / d) * sp * dt; o.y += (dy / d) * sp * dt
        if (d < 18) o.dead = true
      }
      const m = g.query(o.x, o.y, o.r)
      for (let j = 0; j < m; j++) {
        const e = g.out[j]
        if (s.t < e.cdW) continue
        e.cdW = s.t + 0.32
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 1
        hurtEnemy(s, e, o.dmg, (dx / d) * 90, (dy / d) * 90, o.wid)
      }
    } else { // straight bolt
      o.x += o.vx * dt; o.y += o.vy * dt
      const m = g.query(o.x, o.y, o.r)
      for (let j = 0; j < m; j++) {
        const e = g.out[j], id = e.uid
        if (id === o.h1 || id === o.h2 || id === o.h3) continue
        hurtEnemy(s, e, o.dmg, o.vx * 0.22, o.vy * 0.22, o.wid)
        burst(s, o.x, o.y, 2, '#FFC93C', 90, 3)
        if (o.pierce-- <= 0) { o.dead = true; break }
        o.h3 = o.h2; o.h2 = o.h1; o.h1 = id
      }
    }
    if (o.life <= 0) o.dead = true
  }

  for (let i = 0; i < s.mines.length; i++) {
    const m = s.mines[i]
    if (m.dead) continue
    m.age += dt; m.life -= dt
    let go = m.life <= 0
    if (!go && m.age > m.arm) go = g.query(m.x, m.y, 10) > 0
    if (go) {
      m.dead = true
      blast(s, m.x, m.y, m.blast, m.dmg, 260, m.wid)
      ring(s, m.x, m.y, m.blast * 0.3, m.blast, 0.28, '#FF8FC7', 0.3, 5)
      burst(s, m.x, m.y, 7, '#FFC93C', 220, 4)
      shake(s, 3); emit(s, 'boom')
    }
  }

  for (let i = 0; i < s.pools.length; i++) {
    const o = s.pools[i]
    if (o.dead) continue
    o.life -= dt; o.next -= dt
    if (o.life <= 0) { o.dead = true; continue }
    if (o.next <= 0) {
      o.next = o.tick
      const m = g.query(o.x, o.y, o.r * 0.92)
      for (let j = 0; j < m; j++) {
        const e = g.out[j]
        if (!e.boss) { e.slowUntil = s.t + 0.5; e.slowMul = o.slow }
        if (s.t >= e.cdP) { e.cdP = s.t + o.tick * 0.9; hurtEnemy(s, e, o.dmg, 0, 0, o.wid) }
      }
    }
  }
}
