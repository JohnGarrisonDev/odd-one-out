// Enemy behaviour: movement AIs, boss attack patterns, crowd separation, contact damage. No DOM.
// To add a behaviour: add a case to the `switch (def.ai)` below and use it from an entry in data/enemies.js.
import { spawnEnemy, hitPlayer, enemyShot, hazard, emit, ring, shake, burst } from './combat.js'
import { dmgScale } from './data/timeline.js'
import { TAU } from './util.js'

const LEASH = 1500 // enemies further than this from the player are moved back to the edge of the screen

/** A point just outside the visible area, on a random side. Writes to s.tmp. */
export function edgePoint(s, margin = 50) {
  const p = s.player, hw = s.view.w / 2 + margin, hh = s.view.h / 2 + margin, r = s.rng
  const side = r() * (hw + hh) * 2
  let x, y
  if (side < hw * 2) { x = -hw + side; y = r() < 0.5 ? -hh : hh }
  else { y = -hh + (side - hw * 2); x = r() < 0.5 ? -hw : hw }
  s.tmp.x = p.x + x; s.tmp.y = p.y + y
  return s.tmp
}

/** A ring of drifting swarm enemies that closes on where the player is now. */
export function spawnRing(s, n, type = 'swarm') {
  const p = s.player, R = Math.hypot(s.view.w, s.view.h) / 2 + 40
  const a0 = s.rng() * TAU, gap = Math.floor(s.rng() * n) // leave a gap to escape through
  for (let i = 0; i < n; i++) {
    if (i === gap || i === (gap + 1) % n) continue
    const a = a0 + (i / n) * TAU
    const e = spawnEnemy(s, type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R)
    const sp = e.speed * 0.55
    e.vx = -Math.cos(a) * sp; e.vy = -Math.sin(a) * sp
    e.dieAt = s.t + (R * 2 + 200) / sp
  }
}
/** A wall of drifting swarm enemies sweeping across the screen. */
export function spawnLine(s, n, type = 'swarm') {
  const p = s.player, horiz = s.rng() < 0.5, dir = s.rng() < 0.5 ? -1 : 1
  const span = (horiz ? s.view.h : s.view.w) * 0.9, dist = (horiz ? s.view.w : s.view.h) / 2 + 60
  const gap = 1 + Math.floor(s.rng() * (n - 2))
  for (let i = 0; i < n; i++) {
    if (i === gap) continue
    const off = (i / (n - 1) - 0.5) * span
    const x = horiz ? p.x - dir * dist : p.x + off, y = horiz ? p.y + off : p.y - dir * dist
    const e = spawnEnemy(s, type, x, y)
    e.vx = horiz ? dir * e.def.speed : 0; e.vy = horiz ? 0 : dir * e.def.speed
    e.dieAt = s.t + (dist * 2 + 300) / e.def.speed
  }
}

function startPattern(s, e) {
  const def = e.def
  const pat = def.patterns[e.pi % def.patterns.length]; e.pi++
  e.pat = pat; e.t2 = 0; e.cnt = 0
  e.state = pat === 'charge' ? 1 : 3 // 1 = aim then dash; 3 = wind-up for everything else
  if (pat === 'spiral') e.ang = s.rng() * TAU
  emit(s, 'warn')
}

// Boss: walk at the player; every patternCd seconds run the next attack pattern. All patterns have a wind-up (e.state 1 or 3)
// that render.js shows as a flashing "!" and, for charges, an aim line.
function bossAI(s, e, dt, nx, ny, dist) {
  const def = e.def, p = s.player, dm = dmgScale(Math.min(s.t, s.scaleCap)) * (e.dmgMul || 1)
  const enraged = e.hp < e.maxHp * 0.4
  if (e.state === 0) {
    e.t1 -= dt * (enraged ? 1.4 : 1)
    if (e.t1 <= 0) startPattern(s, e)
    const sp = dist > e.r ? e.speed : 0
    e.mx = nx * sp; e.my = ny * sp
    return
  }
  e.t2 += dt; e.mx = 0; e.my = 0
  if (e.state === 1) { // aim: track the player until the last 0.3s, so a late sidestep works
    if (e.t2 < 0.65) { e.dx = nx; e.dy = ny }
    if (e.t2 >= 0.95) { e.state = 2; e.t2 = 0; emit(s, 'dash') }
  } else if (e.state === 2) { // dash
    e.mx = e.dx * def.dashSpeed; e.my = e.dy * def.dashSpeed
    if (e.t2 >= 0.62) { e.state = 0; e.t1 = def.patternCd * e.cdMul }
  } else if (e.state === 3) { // wind-up
    if (e.t2 >= 0.7) { e.state = 4; e.t2 = 0 }
  } else if (e.state === 4) {
    const pat = e.pat
    let done = true
    if (pat === 'ring') {
      const n = def.ringN, a0 = s.rng() * TAU
      for (let i = 0; i < n; i++) enemyShot(s, e.x, e.y, a0 + (i / n) * TAU, def.shotSpeed, def.shotDmg * dm, 8)
      emit(s, 'eshot')
    } else if (pat === 'spread') { // three aimed fans
      if (e.t2 >= e.cnt * 0.42) {
        const a = Math.atan2(p.y - e.y, p.x - e.x)
        for (let i = -2; i <= 2; i++) enemyShot(s, e.x, e.y, a + i * 0.2, def.shotSpeed * 1.15, def.shotDmg * dm, 8)
        e.cnt++; emit(s, 'eshot')
      }
      done = e.cnt >= 3
    } else if (pat === 'spiral') {
      e.ang += 2.1 * dt
      if (e.t2 >= e.cnt * 0.14) {
        enemyShot(s, e.x, e.y, e.ang, def.shotSpeed, def.shotDmg * dm, 8)
        enemyShot(s, e.x, e.y, e.ang + Math.PI, def.shotSpeed, def.shotDmg * dm, 8)
        e.cnt++; if (e.cnt % 3 === 0) emit(s, 'eshot')
      }
      done = e.t2 >= 2.6
    } else if (pat === 'slam') { // danger circles: one on the player, the rest scattered around them
      const n = enraged ? 6 : 4
      hazard(s, p.x, p.y, 78, 1.0, e.dmg * 1.1)
      for (let i = 0; i < n; i++) {
        const a = s.rng() * TAU, d = 90 + s.rng() * 190
        hazard(s, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 62, 1.15 + i * 0.12, e.dmg * 1.1)
      }
    } else if (pat === 'summon') {
      spawnRing(s, enraged ? 20 : 16)
    }
    if (done) { e.state = 0; e.t1 = def.patternCd * e.cdMul }
  }
}

export function updateEnemies(s, dt) {
  const p = s.player, list = s.enemies, grid = s.grid, t = s.t
  const cell = grid.cell, size = grid.size, buckets = grid.buckets
  const kdamp = Math.max(0, 1 - 7 * dt)
  const touchR = p.r - 3
  for (let i = 0, len = list.length; i < len; i++) {
    const e = list[i]
    if (e.dead) continue
    const def = e.def
    if (e.flash > 0) e.flash -= dt
    let dx = p.x - e.x, dy = p.y - e.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
    const nx = dx / dist, ny = dy / dist
    const sp = t < e.slowUntil ? e.speed * e.slowMul : e.speed
    let mx = 0, my = 0
    switch (def.ai) {
      case 'chase': {
        mx = nx * sp; my = ny * sp
        if (def.weave) { const w = Math.sin(t * 5 + e.phase) * def.weave * sp; mx += -ny * w; my += nx * w }
        break
      }
      case 'drift': {
        mx = e.vx; my = e.vy
        if (t > e.dieAt) { e.dead = true; e.silent = true; continue }
        break
      }
      case 'shoot': {
        if (e.state === 1) { // wind-up, standing still
          e.t2 -= dt
          if (e.t2 <= 0) {
            enemyShot(s, e.x, e.y, Math.atan2(dy, dx), def.shotSpeed, def.shotDmg * dmgScale(Math.min(t, s.scaleCap)) * (e.elite ? 1.3 : 1), def.shotR * (e.elite ? 1.3 : 1))
            emit(s, 'eshot'); e.state = 0; e.t1 = def.shotCd
          }
        } else {
          e.t1 -= dt
          const want = def.range
          if (dist > want + 30) { mx = nx * sp; my = ny * sp }
          else if (dist < want - 50) { mx = -nx * sp * 0.6; my = -ny * sp * 0.6 }
          else { const d = e.uid & 1 ? 1 : -1; mx = -ny * sp * 0.5 * d; my = nx * sp * 0.5 * d }
          if (e.t1 <= 0 && dist < want + 140) { e.state = 1; e.t2 = 0.5 }
        }
        break
      }
      case 'charge': {
        if (e.state === 0) {
          e.t1 -= dt; mx = nx * sp; my = ny * sp
          if (e.t1 <= 0 && dist < def.dashRange) { e.state = 1; e.t2 = 0; e.dx = nx; e.dy = ny }
        } else if (e.state === 1) {
          e.t2 += dt
          if (e.t2 < def.tele * 0.5) { e.dx = nx; e.dy = ny } // aim locks half way through, so a late sidestep works
          if (e.t2 >= def.tele) { e.state = 2; e.t2 = 0 }
        } else if (e.state === 2) {
          e.t2 += dt; mx = e.dx * def.dashSpeed; my = e.dy * def.dashSpeed
          if (e.t2 >= def.dash) { e.state = 3; e.t2 = 0 }
        } else {
          e.t2 += dt
          if (e.t2 >= def.rest) { e.state = 0; e.t1 = def.dashCd }
        }
        break
      }
      case 'boss': {
        bossAI(s, e, dt, nx, ny, dist)
        mx = e.mx; my = e.my
        break
      }
    }
    e.x += (mx + e.kx) * dt; e.y += (my + e.ky) * dt
    e.kx *= kdamp; e.ky *= kdamp

    // Keep the crowd from stacking into one robot: push out of neighbours (same and adjacent grid cells).
    if (def.ai !== 'drift' && !e.boss) {
      const cx = Math.floor(e.x / cell) - grid.ox, cy = Math.floor(e.y / cell) - grid.oy
      if (cx > 0 && cy > 0 && cx < size - 1 && cy < size - 1) {
        let px = 0, py = 0
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            const b = buckets[gx + gy * size]
            for (let j = 0; j < b.length; j++) {
              const o = b[j]
              if (o === e || o.dead) continue
              const ox = e.x - o.x, oy = e.y - o.y, rr = e.r + o.r
              const d2 = ox * ox + oy * oy
              if (d2 < rr * rr && d2 > 0.0001) {
                const d = Math.sqrt(d2), push = (rr - d) / d * (o.boss ? 0.9 : o.r / rr * 0.6)
                px += ox * push; py += oy * push
              }
            }
          }
        }
        e.x += px; e.y += py
      }
    }

    // Touching the player hurts (the player's short invulnerability after a hit is handled in hitPlayer).
    dx = p.x - e.x; dy = p.y - e.y
    const reach = e.r + touchR
    if (dx * dx + dy * dy < reach * reach) {
      if (hitPlayer(s, e.dmg) && s.mode !== 'play') return
    } else if (def.ai !== 'drift' && !e.boss && dx * dx + dy * dy > LEASH * LEASH) {
      const q = edgePoint(s, 80); e.x = q.x; e.y = q.y; e.kx = 0; e.ky = 0
    }
  }
}

export function updateEnemyShots(s, dt) {
  const p = s.player
  for (let i = 0; i < s.eshots.length; i++) {
    const o = s.eshots[i]
    if (o.dead) continue
    o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt
    const dx = o.x - p.x, dy = o.y - p.y, rr = o.r + p.r - 4
    if (o.life <= 0) o.dead = true
    else if (dx * dx + dy * dy < rr * rr && p.iframe <= 0) { o.dead = true; hitPlayer(s, o.dmg); if (s.mode !== 'play') return }
  }
  for (let i = 0; i < s.hazards.length; i++) {
    const h = s.hazards[i]
    if (h.dead) continue
    h.t += dt
    if (h.t >= h.delay) {
      h.dead = true
      ring(s, h.x, h.y, h.r * 0.5, h.r * 1.15, 0.3, '#FF5B2E', 0.5, 6)
      burst(s, h.x, h.y, 8, '#FF5B2E', 200, 5)
      shake(s, 5); emit(s, 'boom')
      const dx = h.x - p.x, dy = h.y - p.y
      if (dx * dx + dy * dy < (h.r + p.r * 0.5) ** 2) { hitPlayer(s, h.dmg); if (s.mode !== 'play') return }
    }
  }
}
