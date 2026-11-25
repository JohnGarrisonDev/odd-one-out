// Shared building blocks of the simulation: spawning things, hurting things, pickups and cosmetic effects.
// Everything takes the run state `s` first. No DOM. Objects are recycled through s.free.* to avoid garbage.
import { ENEMIES, ELITE } from './data/enemies.js'
import { LUCK } from './data/weapons.js'
import { hpScale, dmgScale, speedScale, xpNeed } from './data/timeline.js'
import { TAU } from './util.js'

export const CAPS = { parts: 260, texts: 48, bolts: 320, rings: 40, zaps: 40, eshots: 260 }

const take = (free) => (free.length ? free.pop() : {})
export function emit(s, name) { if (s.events.length < 48) s.events.push(name) }
export function shake(s, amt) { if (amt > s.shake) s.shake = amt }

// ---------------------------------------------------------------- effects (cosmetic only)
export function particle(s, x, y, vx, vy, life, size, color, kind = 0) {
  if (s.parts.length >= CAPS.parts) return
  const p = take(s.free.parts)
  p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color; p.kind = kind; p.dead = false
  p.rot = s.fxRng() * TAU; p.spin = (s.fxRng() - 0.5) * 12
  s.parts.push(p)
}
export function burst(s, x, y, n, color, speed = 140, size = 4, kind = 0) {
  for (let i = 0; i < n; i++) {
    const a = s.fxRng() * TAU, v = speed * (0.4 + s.fxRng() * 0.8)
    particle(s, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.25 + s.fxRng() * 0.3, size * (0.6 + s.fxRng() * 0.7), color, kind)
  }
}
/** An expanding ring (explosions, pulses, pops). fill: 0..1 alpha of a filled disc under the ring. */
export function ring(s, x, y, r0, r1, life, color, fill = 0, width = 4) {
  if (s.rings.length >= CAPS.rings) return
  const r = take(s.free.rings)
  r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.life = life; r.max = life; r.color = color; r.fill = fill; r.width = width; r.dead = false
  s.rings.push(r)
}
export function zap(s, x1, y1, x2, y2, color = '#9aa0ff') {
  if (s.zaps.length >= CAPS.zaps) return
  const z = take(s.free.zaps)
  z.x1 = x1; z.y1 = y1; z.x2 = x2; z.y2 = y2; z.life = 0.16; z.max = 0.16; z.color = color; z.seed = s.fxRng() * 1000; z.dead = false
  s.zaps.push(z)
}
export function floatText(s, x, y, value, color = '#FBF6EC', big = false) {
  if (s.texts.length >= CAPS.texts) return
  const t = take(s.free.texts)
  t.x = x + (s.fxRng() - 0.5) * 10; t.y = y; t.value = value; t.life = 0.6; t.max = 0.6; t.color = color; t.big = big; t.dead = false
  s.texts.push(t)
}

// ---------------------------------------------------------------- enemies
let uid = 1
/** Spawn an enemy of `type` at x, y. opts: { elite, hpMul }. Returns the enemy. */
export function spawnEnemy(s, type, x, y, opts) {
  const def = ENEMIES[type]
  const e = take(s.free.enemies)
  const elite = !!(opts && opts.elite) && !def.boss
  const st = Math.min(s.t, s.scaleCap)
  let hp = def.hp * (def.boss ? 1 : hpScale(st)) * ((opts && opts.hpMul) || 1)
  if (elite) hp *= ELITE.hp
  e.uid = uid++; e.type = type; e.def = def; e.x = x; e.y = y
  e.r = def.r * (elite ? ELITE.size : 1)
  e.hp = hp; e.maxHp = hp
  e.speed = def.speed * speedScale(st) * (elite ? ELITE.speed : 1) * (0.92 + s.rng() * 0.16)
  e.dmg = def.dmg * dmgScale(st) * (elite ? ELITE.dmg : 1)
  e.xp = elite ? def.xp + ELITE.xp : def.xp
  e.elite = elite; e.boss = !!def.boss; e.kbResist = elite ? Math.max(0.6, def.kbResist || 0) : def.kbResist || 0
  e.kx = 0; e.ky = 0; e.flash = 0; e.dead = false; e.silent = false
  e.state = 0; e.t1 = def.boss ? 2.2 : (def.shotCd || def.dashCd || 0) * (0.4 + s.rng() * 0.6); e.t2 = 0
  e.dx = 0; e.dy = 0; e.vx = 0; e.vy = 0; e.dieAt = Infinity
  e.cdA = 0; e.cdB = 0; e.cdW = 0; e.cdP = 0; e.slowUntil = 0; e.slowMul = 1; e.tok = 0
  e.pat = ''; e.mx = 0; e.my = 0; e.dmgMul = 1; e.cdMul = 1
  e.phase = s.rng() * TAU; e.pi = 0; e.cnt = 0; e.ang = 0; e.born = s.t
  s.enemies.push(e)
  if (def.boss) { s.boss = e; emit(s, 'boss'); s.banner = def.name; s.bannerT = 3.2; shake(s, 8) }
  return e
}

/** Deal `dmg` (before the player's damage bonus) to an enemy, with a knockback impulse. `wid` credits a weapon. */
export function hurtEnemy(s, e, dmg, kx, ky, wid) {
  if (e.dead) return
  dmg *= s.stats.damage
  e.hp -= dmg; e.flash = 0.1
  const k = 1 - e.kbResist
  e.kx += kx * k; e.ky += ky * k
  s.dealt += dmg
  if (wid) s.dmgBy[wid] = (s.dmgBy[wid] || 0) + dmg
  floatText(s, e.x, e.y - e.r, dmg)
  if (e.hp <= 0) killEnemy(s, e)
  else emit(s, 'hit')
}

export function killEnemy(s, e) {
  if (e.dead) return
  e.dead = true
  const def = e.def, rng = s.rng
  s.kills++
  burst(s, e.x, e.y, e.boss ? 40 : e.elite ? 12 : 5, e.boss || e.elite ? '#FFC93C' : '#8FA0C9', e.boss ? 320 : 150, e.r * 0.34, 1)
  ring(s, e.x, e.y, e.r * 0.6, e.r * (e.boss ? 4 : 1.7), e.boss ? 0.6 : 0.22, '#FBF6EC', 0, e.boss ? 8 : 3)
  emit(s, e.boss ? 'bossdie' : 'kill')
  if (e.boss) {
    s.boss = null; s.bossKills[e.type] = true
    shake(s, 16)
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; spawnPickup(s, 'bolt', e.x + Math.cos(a) * 46, e.y + Math.sin(a) * 46, Math.ceil(e.xp / 14)) }
    for (let i = 0; i < 5; i++) spawnPickup(s, 'scrap', e.x + (rng() - 0.5) * 80, e.y + (rng() - 0.5) * 80, Math.ceil((def.scrap || 10) / 5))
    spawnPickup(s, 'crate', e.x, e.y, 1)
    spawnPickup(s, 'heart', e.x + 30, e.y + 20, 1)
    for (const o of s.eshots) o.dead = true
    for (const h of s.hazards) h.dead = true
    for (const o of s.enemies) if (!o.dead && !o.boss && o.def.ai === 'drift') { o.dead = true; burst(s, o.x, o.y, 3, '#8FA0C9', 90, 3, 1) }
    if (s.finalBoss === e) { s.finalBoss = null; if (!s.won) { s.won = true; s.winT = 1.6 } }
    return
  }
  spawnPickup(s, 'bolt', e.x, e.y, e.xp)
  const luck = 1 + s.stats.luck * LUCK.drops
  const roll = rng()
  if (e.elite) {
    spawnPickup(s, 'crate', e.x, e.y, 1)
    spawnPickup(s, 'scrap', e.x + 14, e.y - 8, ELITE.scrap)
  } else if (roll < 0.006 * luck) spawnPickup(s, 'heart', e.x, e.y, 1)
  else if (roll < 0.006 * luck + LUCK.crate * s.stats.luck) spawnPickup(s, 'crate', e.x, e.y, 1) // Lucky Nut only
  else if (roll < 0.0085 * luck + LUCK.crate * s.stats.luck) spawnPickup(s, 'magnet', e.x, e.y, 1)
  else if (roll < 0.0105 * luck + LUCK.crate * s.stats.luck) spawnPickup(s, 'bomb', e.x, e.y, 1)
  else if (roll < 0.026 * luck + LUCK.crate * s.stats.luck) spawnPickup(s, 'scrap', e.x + 8, e.y, 1)
  if (def.split) {
    for (let i = 0; i < def.split.n; i++) {
      const a = rng() * TAU
      const k = spawnEnemy(s, def.split.type, e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10)
      k.kx = Math.cos(a) * 220; k.ky = Math.sin(a) * 220
    }
  }
}

// ---------------------------------------------------------------- player
/** Enemy contact, shot or hazard hits the player. */
export function hitPlayer(s, dmg) {
  const p = s.player
  if (p.iframe > 0 || s.mode !== 'play') return false
  dmg = Math.max(1, Math.round(dmg - s.stats.armour))
  p.hp -= dmg; p.iframe = 0.5; p.hurt = 0.3
  s.dmgTaken += dmg
  shake(s, 7); emit(s, 'hurt')
  floatText(s, p.x, p.y - 22, dmg, '#FF8FC7', true)
  burst(s, p.x, p.y, 6, '#FF5B2E', 160, 4)
  if (p.hp <= 0) {
    if (s.revives > 0) {
      s.revives--; p.hp = Math.round(s.stats.maxHp * 0.5); p.iframe = 2.2
      blast(s, p.x, p.y, 260, 40, 700, null)
      ring(s, p.x, p.y, 20, 260, 0.5, '#2FD6A3', 0.25, 8)
      emit(s, 'revive'); s.banner = 'Second wind!'; s.bannerT = 2
    } else {
      p.hp = 0; s.mode = 'dead'; s.deadT = 0
      burst(s, p.x, p.y, 30, '#FF5B2E', 260, 6); burst(s, p.x, p.y, 16, '#FBF6EC', 200, 5, 1)
      ring(s, p.x, p.y, 10, 120, 0.5, '#FF5B2E', 0, 6)
      shake(s, 18); emit(s, 'die')
    }
  }
  return true
}

export function gainXp(s, v) {
  s.xp += v * s.stats.xp
  while (s.xp >= s.xpNeed) { s.xp -= s.xpNeed; s.level++; s.pendingLevels++; s.xpNeed = xpNeed(s.level) }
}

// ---------------------------------------------------------------- pickups
export function spawnPickup(s, kind, x, y, value) {
  if (kind === 'bolt' && s.boltCount >= CAPS.bolts) {
    // Too many bolts on the floor: fold this one's XP into an existing bolt instead (round robin).
    const list = s.pickups
    for (let n = 0; n < list.length; n++) {
      s.mergeIdx = (s.mergeIdx + 1) % list.length
      const o = list[s.mergeIdx]
      if (o.kind === 'bolt' && !o.dead) { o.value += value; return o }
    }
  }
  const p = take(s.free.pickups)
  const a = s.rng() * TAU, v = kind === 'bolt' ? 40 + s.rng() * 50 : 30
  p.kind = kind; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.value = value
  p.vac = false; p.speed = 0; p.age = 0; p.dead = false; p.phase = s.rng() * TAU
  if (kind === 'bolt') s.boltCount++
  s.pickups.push(p)
  return p
}

// ---------------------------------------------------------------- area damage
/** Hurt every enemy within R of x, y, pushing them outwards. */
export function blast(s, x, y, R, dmg, kb, wid) {
  const g = s.grid, n = g.query(x, y, R), out = g.out
  // Copy the hits first: hurtEnemy can kill, and kills can spawn (splitters), but nothing here re-queries the grid.
  for (let i = 0; i < n; i++) {
    const e = out[i]
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1
    hurtEnemy(s, e, dmg, (dx / d) * kb, (dy / d) * kb, wid)
  }
  return n
}

/** Enemy projectile (slow, dodgeable). */
export function enemyShot(s, x, y, ang, speed, dmg, r = 7) {
  if (s.eshots.length >= CAPS.eshots) return
  const o = take(s.free.eshots)
  o.x = x; o.y = y; o.vx = Math.cos(ang) * speed; o.vy = Math.sin(ang) * speed; o.r = r; o.dmg = dmg; o.life = 7; o.dead = false
  s.eshots.push(o)
}
/** A telegraphed danger circle that goes off after `delay` seconds. */
export function hazard(s, x, y, r, delay, dmg) {
  const h = take(s.free.hazards)
  h.x = x; h.y = y; h.r = r; h.t = 0; h.delay = delay; h.dmg = dmg; h.dead = false
  s.hazards.push(h)
}
