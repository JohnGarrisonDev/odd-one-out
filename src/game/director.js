// The wave director: reads data/timeline.js and decides what spawns when. No DOM.
import { PHASES, EVENTS, RUN_LENGTH, ENDLESS, ENDLESS_WAVES, ENDLESS_BOSSES, POWER, endlessScale } from './data/timeline.js'
import { spawnEnemy, emit } from './combat.js'
import { ENEMIES } from './data/enemies.js'
import { edgePoint, spawnRing, spawnLine } from './enemies.js'

export function makeDirector() {
  return { acc: 5, // a small welcoming party straight away
     next: EVENTS.map((e) => e.at), endlessBossAt: 0, endlessBossN: 0, phase: 0,
    dps: 0, dealt: 0, // running average of the player's damage per second (see POWER), and s.dealt at the last step
    sizing: null, // a boss that is still sizing you up (see sizeUp)
    endlessAt: 0, wave: -1, packAt: 0, packN: 0 }
}

/** The phase active at time t, plus the spawn rate right now. */
export function phaseAt(t) {
  let i = 0
  while (i < PHASES.length - 1 && t >= PHASES[i].until) i++
  const ph = PHASES[i], from = i ? PHASES[i - 1].until : 0
  const k = Number.isFinite(ph.until) ? (t - from) / (ph.until - from) : 0
  return { index: i, phase: ph, rate: ph.rate[0] + (ph.rate[1] - ph.rate[0]) * Math.min(1, Math.max(0, k)) }
}

function pickType(s, mix) {
  let total = 0
  for (const k in mix) total += mix[k]
  let r = s.rng() * total
  for (const k in mix) { r -= mix[k]; if (r <= 0) return k }
  return 'walker'
}

/** How much tougher a boss that sizes you up should be, from your recent damage per second (POWER in timeline.js). */
export function powerMul(dps) {
  const k = Math.pow(Math.max(0, dps) / POWER.ref, POWER.exp)
  return Math.min(POWER.start[1], Math.max(POWER.start[0], k))
}

function spawnBoss(s, type, final, hpMul, sized) {
  const q = edgePoint(s, 70)
  const m = sized ? powerMul(s.dir.dps) : 1
  const b = spawnEnemy(s, type, q.x, q.y, { hpMul: hpMul * m })
  b.dmgMul = 1
  if (sized) { b.cdMul = cdMulFor(m); b.sizeMul = m; b.calT = -1; b.calHp = 0; s.dir.sizing = b }
  if (final) s.finalBoss = b
  return b
}
const cdMulFor = (m) => Math.min(POWER.cdRange[1], Math.max(POWER.cdRange[0], Math.pow(m, -POWER.pressure)))

// A sized boss watches how fast you hurt it for POWER.window seconds once the fight is on (it has taken damage or is
// close), then sets its HP once so the rest of the fight should last about POWER.fight - POWER.window seconds.
// The HP bar keeps its fraction, and the total stays within [POWER.min, POWER.max] of the boss's base HP.
function sizeUp(s, b, t) {
  if (b.dead || !b.boss) { s.dir.sizing = null; return }
  if (b.calT < 0) {
    const dx = b.x - s.player.x, dy = b.y - s.player.y
    if (b.hp < b.maxHp || dx * dx + dy * dy < POWER.near * POWER.near) { b.calT = t; b.calHp = b.hp }
    return
  }
  if (t - b.calT < POWER.window) return
  s.dir.sizing = null
  const dps = (b.calHp - b.hp) / POWER.window
  const want = Math.max(0, dps) * (POWER.fight - POWER.window)
  let f = want / Math.max(1, b.hp)
  f = Math.min(POWER.adjust[1], Math.max(POWER.adjust[0], f))
  const m = Math.min(POWER.max, Math.max(POWER.min, b.sizeMul * f))
  f = m / b.sizeMul
  b.hp *= f; b.maxHp *= f; b.sizeMul = m; b.cdMul = cdMulFor(m)
  s.banner = b.def.name + ' has your measure'; s.bannerT = 2
}

export function runDirector(s, dt) {
  const d = s.dir, t = s.t
  // Running average of the player's damage per second (bosses use it to size you up).
  if (dt > 0) { d.dps += ((s.dealt - d.dealt) / dt - d.dps) * Math.min(1, dt / POWER.tau); d.dealt = s.dealt }
  if (d.sizing) sizeUp(s, d.sizing, t) // before anything spawns, so a recycled boss object is never mistaken for it
  if (s.endless && d.wave < 0) startEndless(s, t)
  const wave = s.endless ? ENDLESS_WAVES[d.wave % ENDLESS_WAVES.length] : null
  // While the final boss is up (and the run isn't endless yet) the timeline holds at the 10 minute mark.
  const tt = Math.min(t, s.scaleCap)
  const info = phaseAt(tt), ph = info.phase
  d.phase = info.index
  const es = endlessScale(tt)
  let rate = info.rate * es, cap = Math.min(520, ph.cap * (1 + (es - 1) * 0.5))
  if (s.finalBoss) rate *= 0.55
  d.acc += rate * dt
  let alive = s.enemies.length
  while (d.acc >= 1) {
    d.acc -= 1
    if (alive >= cap) { d.acc = Math.min(d.acc, 2); break }
    const q = edgePoint(s)
    spawnEnemy(s, pickType(s, wave ? wave.mix : ph.mix), q.x, q.y)
    alive++
  }

  for (let i = 0; i < EVENTS.length; i++) {
    if (t < d.next[i]) continue
    const ev = EVENTS[i]
    d.next[i] = ev.every && (ev.until == null || t + ev.every <= ev.until) ? d.next[i] + ev.every : Infinity
    if (s.finalBoss && ev.kind !== 'boss') continue
    const grow = 1 + (ev.grow ? (tt / RUN_LENGTH) * (ev.grow - 1) : 0)
    if (ev.kind === 'elite') {
      const q = edgePoint(s)
      spawnEnemy(s, s.rng.pick((wave || ph).elite || ['walker']), q.x, q.y, { elite: true })
      emit(s, 'elite')
    } else if (ev.kind === 'ring') { spawnRing(s, Math.round(ev.n * grow)); emit(s, 'warn'); s.banner = 'Closing ring!'; s.bannerT = 1.8 }
    else if (ev.kind === 'line') { spawnLine(s, Math.round(ev.n * grow)); emit(s, 'warn') }
    else if (ev.kind === 'boss') spawnBoss(s, ev.type, !!ev.final, 1, !!ev.final)
  }

  if (s.endless) runEndless(s, t, wave)
}

function startEndless(s, t) {
  const d = s.dir
  d.endlessAt = t; d.wave = 0; d.packAt = t + ENDLESS.packEvery; d.packN = 0; d.endlessBossAt = t + ENDLESS.bossEvery
  s.banner = ENDLESS_WAVES[0].name; s.bannerT = 2.4; emit(s, 'warn')
}

// Endless mode: themed waves take turns, elite packs grow, old bosses come back sized up to the build.
function runEndless(s, t, wave) {
  const d = s.dir
  const w = Math.floor((t - d.endlessAt) / ENDLESS.waveEvery)
  if (w !== d.wave) { d.wave = w; s.banner = ENDLESS_WAVES[w % ENDLESS_WAVES.length].name; s.bannerT = 2.4; emit(s, 'warn') }
  if (t >= d.packAt) {
    d.packAt = t + ENDLESS.packEvery
    const n = Math.min(ENDLESS.packMax, ENDLESS.packMin + Math.floor(d.packN++ / 2))
    const types = wave.elite || ['walker']
    for (let i = 0; i < n; i++) { const q = edgePoint(s); spawnEnemy(s, s.rng.pick(types), q.x, q.y, { elite: true }) }
    emit(s, 'elite')
  }
  if (t >= d.endlessBossAt && !s.boss) {
    const n = d.endlessBossN++
    const type = ENDLESS_BOSSES[n % ENDLESS_BOSSES.length]
    spawnBoss(s, type, false, (ENDLESS.bossHp / ENEMIES[type].hp) * (1 + ENDLESS.bossGrow * n), true)
    d.endlessBossAt = t + ENDLESS.bossEvery
  }
}
