// The wave director: reads data/timeline.js and decides what spawns when. No DOM.
import { PHASES, EVENTS, RUN_LENGTH, ENDLESS_BOSS_EVERY, ENDLESS_BOSSES, endlessScale } from './data/timeline.js'
import { spawnEnemy, emit } from './combat.js'
import { edgePoint, spawnRing, spawnLine } from './enemies.js'

export function makeDirector() {
  return { acc: 5, // a small welcoming party straight away
     next: EVENTS.map((e) => e.at), endlessBossAt: 0, endlessBossN: 0, phase: 0 }
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

function spawnBoss(s, type, final, hpMul) {
  const q = edgePoint(s, 70)
  const b = spawnEnemy(s, type, q.x, q.y, { hpMul })
  b.dmgMul = 1
  if (final) s.finalBoss = b
  return b
}

export function runDirector(s, dt) {
  const d = s.dir, t = s.t
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
    spawnEnemy(s, pickType(s, ph.mix), q.x, q.y)
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
      spawnEnemy(s, s.rng.pick(ph.elite || ['walker']), q.x, q.y, { elite: true })
      emit(s, 'elite')
    } else if (ev.kind === 'ring') { spawnRing(s, Math.round(ev.n * grow)); emit(s, 'warn'); s.banner = 'Closing ring!'; s.bannerT = 1.8 }
    else if (ev.kind === 'line') { spawnLine(s, Math.round(ev.n * grow)); emit(s, 'warn') }
    else if (ev.kind === 'boss') {
      spawnBoss(s, ev.type, !!ev.final, 1)
      if (ev.final) d.endlessBossAt = Infinity
    }
  }

  // Endless mode: bosses keep coming back, tougher each time.
  if (s.endless) {
    if (d.endlessBossAt === Infinity) d.endlessBossAt = t + ENDLESS_BOSS_EVERY
    if (t >= d.endlessBossAt && !s.boss) {
      const n = d.endlessBossN++
      spawnBoss(s, ENDLESS_BOSSES[n % ENDLESS_BOSSES.length], false, 2.5 * Math.pow(1.7, n))
      d.endlessBossAt = t + ENDLESS_BOSS_EVERY
    }
  }
}
