import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSave, normalizeSave, buyWorkshop, buyCharacter, workshopCost, applyRun, unlockedWeapons } from '../src/game/save.js'
import { WORKSHOP } from '../src/game/data/meta.js'
import { computeStats, BASE_STATS } from '../src/game/stats.js'

const run = (over = {}) => ({ time: 100, kills: 50, level: 5, won: false, endless: false, char: 'odd', scrap: 20, bosses: {}, weapons: [{ id: 'spark', lvl: 2, dmg: 10 }], passives: [], ...over })

test('junk save data becomes a valid save', () => {
  for (const junk of [undefined, null, 'x', 42, [], { scrap: 'lots' }, { scrap: -5, best: null, workshop: { hull: 99, nope: 3 }, chars: 'odd', char: 'ghost', settings: 7, totals: { runs: NaN } }]) {
    const s = normalizeSave(junk)
    assert.equal(typeof s.scrap, 'number'); assert.ok(s.scrap >= 0)
    assert.deepEqual(s.chars, ['odd']); assert.equal(s.char, 'odd')
    assert.equal(s.settings.damageNumbers, true); assert.equal(s.settings.shake, true)
    assert.ok(Number.isFinite(s.totals.runs))
    assert.ok((s.workshop.hull || 0) <= 5); assert.equal(s.workshop.nope, undefined)
  }
})

test('a real save survives a round trip through JSON', () => {
  const s = defaultSave()
  s.scrap = 500; buyWorkshop(s, 'hull'); buyCharacter(s, 'fixer'); s.settings.shake = false
  applyRun(s, run({ time: 301, bosses: { foreman: true } }))
  const back = normalizeSave(JSON.parse(JSON.stringify(s)))
  assert.deepEqual(back, s)
})

test('workshop: costs rise, purchases need scrap, levels cap', () => {
  const s = defaultSave()
  assert.equal(buyWorkshop(s, 'hull'), false, 'no scrap, no sale')
  s.scrap = 100000
  for (const u of WORKSHOP) {
    for (let i = 1; i < u.costs.length; i++) assert.ok(u.costs[i] > u.costs[i - 1], `${u.id} costs rise`)
    for (let i = 0; i < u.costs.length; i++) assert.equal(buyWorkshop(s, u.id), true)
    assert.equal(workshopCost(s, u.id), null); assert.equal(buyWorkshop(s, u.id), false, 'maxed')
  }
  const stats = computeStats('odd', s.workshop, [])
  assert.ok(stats.maxHp > BASE_STATS.maxHp && stats.speed > BASE_STATS.speed && stats.damage > 1 && stats.cooldown < 1)
  assert.equal(stats.rerolls, 3); assert.equal(stats.revives, 1)
})

test('loadouts: buying, and unlocking by achievement', () => {
  const s = defaultSave()
  s.scrap = 130
  assert.equal(buyCharacter(s, 'fixer'), true); assert.equal(s.scrap, 10); assert.equal(s.char, 'fixer')
  assert.equal(buyCharacter(s, 'fixer'), false, 'already owned')
  assert.equal(buyCharacter(s, 'magno'), false, 'not for sale')
  applyRun(s, run({ won: true, time: 640, bosses: { foreman: true, auditor: true, template: true } }))
  assert.ok(s.chars.includes('magno'), 'winning unlocks Magno Odd')
  assert.equal(s.totals.wins, 1)
})

test('runs update records, totals and achievements once', () => {
  const s = defaultSave()
  assert.ok(!unlockedWeapons(s).includes('oil') && !unlockedWeapons(s).includes('beam'))
  const a = applyRun(s, run({ time: 320, kills: 1200, level: 31, bosses: { foreman: true } }))
  assert.deepEqual(a.records.sort(), ['kills', 'level', 'time'])
  assert.deepEqual(a.achievements.map((x) => x.id).sort(), ['five', 'foreman', 'k1000', 'lvl30', 'minute'])
  assert.ok(unlockedWeapons(s).includes('oil') && unlockedWeapons(s).includes('beam'))
  assert.equal(s.scrap, 20)
  const b = applyRun(s, run({ time: 30, kills: 3, level: 2 }))
  assert.deepEqual(b.records, []); assert.deepEqual(b.achievements, [])
  assert.equal(s.totals.runs, 2); assert.equal(s.best.time, 320)
})

test('1.4.0 music setting: on by default, kept when off, and a 1.3.0 save without it gets music on', () => {
  assert.equal(defaultSave().settings.music, true)
  const old = { v: 1, scrap: 42, settings: { damageNumbers: false, shake: true } } // a 1.3.0 blob
  const s = normalizeSave(old)
  assert.deepEqual(s.settings, { damageNumbers: false, shake: true, music: true }); assert.equal(s.scrap, 42)
  s.settings.music = false
  assert.equal(normalizeSave(JSON.parse(JSON.stringify(s))).settings.music, false)
})
