import test from 'node:test'
import assert from 'node:assert/strict'
import { PHASES, EVENTS, RUN_LENGTH, ENDLESS, ENDLESS_WAVES, ENDLESS_BOSSES, POWER, hpScale, dmgScale, speedScale, endlessScale, xpNeed } from '../src/game/data/timeline.js'
import { ENEMIES } from '../src/game/data/enemies.js'
import { phaseAt, powerMul } from '../src/game/director.js'

test('timeline phases are in order and only name real, non-boss enemies', () => {
  let prev = 0
  for (const ph of PHASES) {
    assert.ok(ph.until > prev, 'phases ascend'); prev = ph.until
    assert.ok(ph.rate[0] > 0 && ph.rate[1] >= ph.rate[0] * 0.5 && ph.cap > 0)
    for (const type of [...Object.keys(ph.mix), ...(ph.elite || [])]) { assert.ok(ENEMIES[type], `${type} exists`); assert.ok(!ENEMIES[type].boss) }
    assert.ok(Object.values(ph.mix).every((w) => w > 0))
  }
  assert.equal(PHASES[PHASES.length - 1].until, Infinity, 'last phase never ends (endless mode)')
})

test('events: bosses exist, the final boss lands at the end of the run', () => {
  const bosses = EVENTS.filter((e) => e.kind === 'boss')
  assert.ok(bosses.length >= 3)
  for (const b of bosses) { assert.ok(ENEMIES[b.type].boss); assert.ok(ENEMIES[b.type].patterns.length >= 2, 'bosses have a couple of patterns') }
  const final = bosses.filter((b) => b.final)
  assert.equal(final.length, 1); assert.equal(final[0].at, RUN_LENGTH)
  for (const e of EVENTS) assert.ok(['elite', 'ring', 'line', 'boss'].includes(e.kind))
})

test('difficulty ramps smoothly', () => {
  for (let t = 0; t < 900; t += 10) {
    assert.ok(hpScale(t + 10) > hpScale(t)); assert.ok(dmgScale(t + 10) > dmgScale(t)); assert.ok(speedScale(t + 10) >= speedScale(t))
    assert.ok(hpScale(t + 10) / hpScale(t) < 1.35, 'no sudden wall')
  }
  assert.ok(phaseAt(590).rate > phaseAt(300).rate && phaseAt(300).rate > phaseAt(60).rate && phaseAt(60).rate > phaseAt(1).rate)
  // spawn rate never jumps by more than about half from one second to the next
  for (let t = 1; t < RUN_LENGTH; t++) assert.ok(phaseAt(t).rate / phaseAt(t - 1).rate < 1.5, `rate jump at ${t}s`)
  for (let l = 1; l < 80; l++) assert.ok(xpNeed(l + 1) > xpNeed(l))
})

test('enemy table is sane', () => {
  const ais = new Set(['chase', 'drift', 'shoot', 'charge', 'boss'])
  for (const id in ENEMIES) {
    const e = ENEMIES[id]
    assert.equal(e.id, id); assert.ok(ais.has(e.ai), `${id} ai`); assert.ok(e.hp > 0 && e.r > 0 && e.dmg > 0 && e.speed > 0 && e.xp > 0)
    if (e.split) assert.ok(ENEMIES[e.split.type] && !ENEMIES[e.split.type].split, 'splitters split into things that do not split')
  }
  assert.ok(Object.values(ENEMIES).filter((e) => !e.boss).length >= 6)
})

test('endless mode data: waves name real enemies, packs and bosses are bounded', () => {
  assert.ok(ENDLESS_WAVES.length >= 3)
  for (const w of ENDLESS_WAVES) {
    assert.ok(w.name && Object.keys(w.mix).length >= 2, 'a wave is a named mix')
    for (const type of [...Object.keys(w.mix), ...w.elite]) { assert.ok(ENEMIES[type], `${type} exists`); assert.ok(!ENEMIES[type].boss && ENEMIES[type].ai !== 'drift', `${type} can walk in from the edge`) }
  }
  assert.ok(ENDLESS.packMin >= 1 && ENDLESS.packMax >= ENDLESS.packMin && ENDLESS.packMax <= 8)
  for (const b of ENDLESS_BOSSES) assert.ok(ENEMIES[b].boss)
  assert.ok(endlessScale(RUN_LENGTH + 600) < 3, 'endless leans on variety, not only on bigger numbers')
})

test('bosses that size you up stay within bounds', () => {
  assert.ok(POWER.min > 0 && POWER.min < 1 && POWER.max > 1 && POWER.max <= 2)
  assert.ok(POWER.start[0] >= POWER.min && POWER.start[1] <= POWER.max)
  assert.equal(powerMul(0), POWER.start[0]); assert.equal(powerMul(1e9), POWER.start[1])
  assert.ok(powerMul(POWER.ref) > 0.99 && powerMul(POWER.ref) < 1.01, 'a typical build gets the base HP')
  for (let d = 0; d < 30000; d += 500) assert.ok(powerMul(d + 500) >= powerMul(d), 'more damage never means an easier boss')
})
