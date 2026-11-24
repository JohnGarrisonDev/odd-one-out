// The run simulation: state, the step function, player, pickups, level-ups. No DOM: runs in node for tests and bots.
// main.js owns the loop and calls step(); render.js only reads the state; ui.js calls chooseOffer / closeCrate / keepGoing.
import { makeRng, makeGrid } from './util.js'
import { computeStats, getCharacter } from './stats.js'
import { WEAPONS } from './data/weapons.js'
import { xpNeed, RUN_LENGTH } from './data/timeline.js'
import { makeDirector, runDirector } from './director.js'
import { updateEnemies, updateEnemyShots } from './enemies.js'
import { updateWeapons, updateShots, nearest } from './weapons.js'
import { rollOffers, applyOffer, buildPool } from './upgrades.js'
import { gainXp, emit, ring, shake, hurtEnemy, killEnemy, spawnEnemy, spawnPickup, hitPlayer, hazard, enemyShot } from './combat.js'

export const STEP = 1 / 60

/** Start a run. opts: { seed, char, workshop, allowedWeapons, view: { w, h } }. */
export function createRun(opts = {}) {
  const char = getCharacter(opts.char)
  const seed = (opts.seed ?? 12345) >>> 0
  const stats = computeStats(char.id, opts.workshop || {}, [])
  const allowed = (opts.allowedWeapons || Object.keys(WEAPONS)).slice()
  if (!allowed.includes(char.weapon)) allowed.push(char.weapon)
  const s = {
    seed, t: 0, mode: 'play', // 'play' | 'levelup' | 'crate' | 'dead' | 'won'
    rng: makeRng(seed), fxRng: makeRng(seed ^ 0x9e3779b9),
    view: { w: opts.view?.w || 1100, h: opts.view?.h || 620 },
    char: char.id, workshop: opts.workshop || {}, allowedWeapons: allowed, stats,
    player: { x: 0, y: 0, r: 13, hp: stats.maxHp, vx: 0, vy: 0, faceX: 1, faceY: 0, lookX: 0.5, lookY: 0.3, iframe: 0, hurt: 0, walk: 0, moving: false },
    input: { x: 0, y: 0 },
    weapons: [{ id: char.weapon, lvl: 1, cd: 0.6, ang: 0, active: 0, dir: 1 }], passives: [],
    level: 1, xp: 0, xpNeed: xpNeed(1), pendingLevels: 0, offers: null, rerolls: stats.rerolls, revives: stats.revives,
    crates: 0, crateReward: null,
    enemies: [], shots: [], eshots: [], pickups: [], hazards: [], mines: [], pools: [], parts: [], texts: [], rings: [], zaps: [],
    free: { enemies: [], shots: [], eshots: [], pickups: [], hazards: [], mines: [], pools: [], parts: [], texts: [], rings: [], zaps: [] },
    grid: makeGrid(64, 64), tmp: { x: 0, y: 0 }, tok: 0, boltCount: 0, mergeIdx: 0,
    dir: makeDirector(), boss: null, finalBoss: null, bossKills: {}, scaleCap: RUN_LENGTH,
    kills: 0, scrapFound: 0, dmgBy: {}, dmgTaken: 0, events: [], shake: 0, flash: 0, banner: '', bannerT: 0,
    won: false, endless: false, winT: 0, deadT: 0, lookT: 0,
  }
  return s
}

function updatePlayer(s, dt) {
  const p = s.player, inp = s.input
  let ix = inp.x, iy = inp.y
  const m = Math.hypot(ix, iy)
  if (m > 1) { ix /= m; iy /= m }
  const k = Math.min(1, 20 * dt)
  p.vx += (ix * s.stats.speed - p.vx) * k; p.vy += (iy * s.stats.speed - p.vy) * k
  p.x += p.vx * dt; p.y += p.vy * dt
  p.moving = m > 0.1
  if (p.moving) { p.faceX = ix / (m > 1 ? 1 : m || 1); p.faceY = iy / (m > 1 ? 1 : m || 1); p.walk += dt * 11 }
  if (p.iframe > 0) p.iframe -= dt
  if (p.hurt > 0) p.hurt -= dt
  if (s.stats.regen > 0 && p.hp < s.stats.maxHp) p.hp = Math.min(s.stats.maxHp, p.hp + s.stats.regen * dt)
  // The big eye watches the nearest Matcher (checked a few times a second).
  s.lookT -= dt
  if (s.lookT <= 0) {
    s.lookT = 0.15
    const e = nearest(s, p.x, p.y, 420)
    if (e) { const d = Math.hypot(e.x - p.x, e.y - p.y) || 1; p.tx = (e.x - p.x) / d; p.ty = (e.y - p.y) / d }
    else { p.tx = p.faceX; p.ty = p.faceY }
  }
  p.lookX += ((p.tx || 0) - p.lookX) * Math.min(1, 10 * dt); p.lookY += ((p.ty || 0) - p.lookY) * Math.min(1, 10 * dt)
}

function collect(s, o) {
  const p = s.player
  o.dead = true
  switch (o.kind) {
    case 'bolt': s.boltCount--; gainXp(s, o.value); emit(s, 'bolt'); break
    case 'heart': p.hp = Math.min(s.stats.maxHp, p.hp + Math.max(25, s.stats.maxHp * 0.3)); emit(s, 'heal'); ring(s, p.x, p.y, 10, 50, 0.35, '#2FD6A3', 0.2, 4); break
    case 'magnet': for (const q of s.pickups) if (q.kind === 'bolt' || q.kind === 'scrap') q.vac = true; emit(s, 'magnet'); ring(s, p.x, p.y, 20, 420, 0.5, '#5B5BFF', 0, 5); break
    case 'bomb': bomb(s); break
    case 'scrap': s.scrapFound += o.value; emit(s, 'scrap'); break
    case 'crate': s.crates++; break
  }
}

/** Screen-clearing bomb: breaks every ordinary Matcher in view, dents elites and bosses. */
function bomb(s) {
  const p = s.player, hw = s.view.w / 2 + 60, hh = s.view.h / 2 + 60
  const n = s.enemies.length
  for (let i = 0; i < n; i++) {
    const e = s.enemies[i]
    if (e.dead || Math.abs(e.x - p.x) > hw || Math.abs(e.y - p.y) > hh) continue
    if (e.boss || e.elite) { e.hp -= e.maxHp * (e.boss ? 0.08 : 0.5); e.flash = 0.2; if (e.hp <= 0) killEnemy(s, e) }
    else killEnemy(s, e)
  }
  for (const o of s.eshots) o.dead = true
  s.flash = 0.35; shake(s, 14); emit(s, 'bomb')
  ring(s, p.x, p.y, 30, Math.max(hw, hh), 0.5, '#FFC93C', 0.2, 10)
}

function updatePickups(s, dt) {
  const p = s.player, range = s.stats.pickup, list = s.pickups
  const damp = Math.max(0, 1 - 6 * dt)
  for (let i = 0; i < list.length; i++) {
    const o = list[i]
    if (o.dead) continue
    o.age += dt
    const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy
    if (o.vac) {
      const d = Math.sqrt(d2) || 1
      o.speed = Math.min(900, o.speed + 1500 * dt)
      const mv = (o.speed + s.stats.speed * 0.5) * dt
      if (d <= mv + p.r) { collect(s, o); continue }
      o.x += (dx / d) * mv; o.y += (dy / d) * mv
    } else {
      o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= damp; o.vy *= damp
      const r = o.kind === 'crate' ? 26 : range
      if (d2 < r * r && o.age > 0.25) { o.vac = true; o.speed = o.kind === 'crate' ? 200 : -180 } // a little hop back first
    }
  }
}

function updateFx(s, dt) {
  for (let i = 0; i < s.parts.length; i++) {
    const p = s.parts[i]
    p.life -= dt
    if (p.life <= 0) { p.dead = true; continue }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; p.rot += p.spin * dt
  }
  for (let i = 0; i < s.texts.length; i++) { const t = s.texts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) t.dead = true }
  for (let i = 0; i < s.rings.length; i++) { const r = s.rings[i]; r.life -= dt; if (r.life <= 0) r.dead = true }
  for (let i = 0; i < s.zaps.length; i++) { const z = s.zaps[i]; z.life -= dt; if (z.life <= 0) z.dead = true }
  if (s.shake > 0) s.shake = Math.max(0, s.shake - 40 * dt)
  if (s.flash > 0) s.flash -= dt
  if (s.bannerT > 0) s.bannerT -= dt
}

// Remove dead things, keeping order (so overlapping sprites don't flicker) and recycling the objects.
function sweep(list, free) {
  let w = 0
  for (let i = 0; i < list.length; i++) { const o = list[i]; if (o.dead) free.push(o); else list[w++] = o }
  list.length = w
}
function sweepAll(s) {
  const f = s.free
  sweep(s.enemies, f.enemies); sweep(s.shots, f.shots); sweep(s.eshots, f.eshots); sweep(s.pickups, f.pickups)
  sweep(s.hazards, f.hazards); sweep(s.mines, f.mines); sweep(s.pools, f.pools)
  sweep(s.parts, f.parts); sweep(s.texts, f.texts); sweep(s.rings, f.rings); sweep(s.zaps, f.zaps)
}

function rebuildGrid(s) {
  const g = s.grid, list = s.enemies
  g.clear(s.player.x, s.player.y)
  for (let i = 0; i < list.length; i++) if (!list[i].dead) g.insert(list[i])
}

/** Advance the run by dt seconds (keep dt at or under 1/30). Does nothing unless s.mode is 'play' (or winding down). */
export function step(s, dt) {
  if (s.mode === 'dead') { s.deadT += dt; updateFx(s, dt); sweepAll(s); return }
  if (s.mode !== 'play') return
  s.t += dt
  updatePlayer(s, dt)
  runDirector(s, dt)
  rebuildGrid(s)
  updateWeapons(s, dt)
  updateShots(s, dt)
  updateEnemies(s, dt)
  if (s.mode === 'play') updateEnemyShots(s, dt)
  updatePickups(s, dt)
  updateFx(s, dt)
  sweepAll(s)
  if (s.mode !== 'play') return
  if (s.winT > 0) { s.winT -= dt; if (s.winT <= 0) { s.mode = 'won'; emit(s, 'win'); return } }
  if (s.crates > 0) openCrate(s)
  else if (s.pendingLevels > 0) beginLevelUp(s)
}

function beginLevelUp(s) {
  s.offers = rollOffers(s)
  s.mode = 'levelup'
  emit(s, 'level')
  ring(s, s.player.x, s.player.y, 16, 150, 0.5, '#FFC93C', 0.12, 6)
}
/** Pick offer i on the level-up screen. */
export function chooseOffer(s, i) {
  if (s.mode !== 'levelup' || !s.offers || !s.offers[i]) return false
  applyOffer(s, s.offers[i])
  s.pendingLevels--; s.offers = null; s.mode = 'play'
  s.player.iframe = Math.max(s.player.iframe, 0.6)
  if (s.pendingLevels > 0) beginLevelUp(s)
  return true
}
/** Spend a reroll (bought in the workshop) for new cards. */
export function rerollOffers(s) {
  if (s.mode !== 'levelup' || s.rerolls <= 0) return false
  s.rerolls--; s.offers = rollOffers(s)
  return true
}

function openCrate(s) {
  s.crates--
  // A crate is a free upgrade: usually a level for something you hold, else scrap.
  const pool = buildPool(s)
  const owned = pool.filter((o) => !o.isNew)
  const pick = owned.length ? s.rng.pick(owned) : pool.length ? s.rng.pick(pool) : null
  if (pick) { applyOffer(s, pick); s.crateReward = pick }
  else { const n = 12 + Math.floor(s.rng() * 8); s.scrapFound += n; s.crateReward = { type: 'scrap', id: 'scrap', lvl: 0, amount: n } }
  s.mode = 'crate'
  emit(s, 'crate')
}
export function closeCrate(s) {
  if (s.mode !== 'crate') return false
  s.crateReward = null; s.mode = 'play'
  s.player.iframe = Math.max(s.player.iframe, 0.6)
  if (s.crates > 0) openCrate(s)
  else if (s.pendingLevels > 0) beginLevelUp(s)
  return true
}
/** After beating the Template: carry on in endless mode. */
export function keepGoing(s) {
  if (s.mode !== 'won') return false
  s.endless = true; s.scaleCap = Infinity; s.mode = 'play'
  s.player.iframe = 1.5
  return true
}

/** Scrap this run is worth so far. */
export function scrapEarned(s) {
  const base = Math.floor(s.t / 6) + s.scrapFound + (s.won ? 40 : 0)
  return Math.floor(base * s.stats.scrap)
}
/** Plain summary of a run, for the save file and the game-over screen. */
export function summarize(s) {
  return {
    time: s.t, kills: s.kills, level: s.level, won: s.won, endless: s.endless, char: s.char, scrap: scrapEarned(s),
    bosses: { ...s.bossKills }, weapons: s.weapons.map((w) => ({ id: w.id, lvl: w.lvl, dmg: Math.round(s.dmgBy[w.id] || 0) })),
    passives: s.passives.map((p) => ({ id: p.id, lvl: p.lvl })),
  }
}

// Debug helpers (used by tests and the ?debug hook).
export const debug = { hurtEnemy, killEnemy, gainXp, spawnEnemy, spawnPickup, hitPlayer, hazard, enemyShot }
