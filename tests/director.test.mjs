import test from 'node:test'
import assert from 'node:assert/strict'
import { PHASES, EVENTS, RUN_LENGTH, hpScale, dmgScale, speedScale, xpNeed } from '../src/game/data/timeline.js'
import { ENEMIES } from '../src/game/data/enemies.js'
import { phaseAt } from '../src/game/director.js'

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
