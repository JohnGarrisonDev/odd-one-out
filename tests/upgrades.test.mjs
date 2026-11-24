import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun } from '../src/game/sim.js'
import { buildPool, rollOffers, applyOffer, describeOffer } from '../src/game/upgrades.js'
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES } from '../src/game/data/weapons.js'

function assertValid(s, o) {
  if (o.type === 'weapon') {
    const def = WEAPONS[o.id], held = s.weapons.find((w) => w.id === o.id)
    assert.ok(def, `weapon ${o.id} exists`)
    assert.ok(s.allowedWeapons.includes(o.id), `${o.id} is unlocked`)
    if (held) { assert.ok(held.lvl < def.levels.length, `${o.id} not maxed`); assert.equal(o.lvl, held.lvl + 1); assert.equal(o.isNew, false) }
    else { assert.ok(s.weapons.length < MAX_WEAPONS, 'free weapon slot'); assert.equal(o.lvl, 1); assert.equal(o.isNew, true) }
  } else if (o.type === 'passive') {
    const def = PASSIVES[o.id], held = s.passives.find((p) => p.id === o.id)
    assert.ok(def, `passive ${o.id} exists`)
    if (held) assert.ok(held.lvl < def.max, `${o.id} not maxed`)
    else assert.ok(s.passives.length < MAX_PASSIVES, 'free passive slot')
  } else assert.ok(o.type === 'heal' || o.type === 'scrap')
}

test('offers are always valid, unique, and the build can be completed', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = createRun({ seed })
    let fillersSeen = false
    for (let i = 0; i < 120; i++) {
      for (const o of buildPool(s)) assertValid(s, o)
      const offers = rollOffers(s)
      assert.ok(offers.length >= 2 && offers.length <= 4, 'between 2 and 4 cards')
      assert.equal(new Set(offers.map((o) => o.type + o.id)).size, offers.length, 'no duplicate cards')
      for (const o of offers) { assertValid(s, o); const d = describeOffer(o); assert.ok(d.name && d.text && d.tag) }
      if (offers.some((o) => o.type === 'heal')) fillersSeen = true
      assert.equal(applyOffer(s, offers[Math.floor(s.rng() * offers.length)]), true)
      assert.ok(s.weapons.length <= MAX_WEAPONS && s.passives.length <= MAX_PASSIVES)
      assert.ok(s.player.hp <= s.stats.maxHp)
    }
    assert.equal(buildPool(s).length, 0, 'build is complete after enough level-ups')
    assert.ok(fillersSeen, 'fillers appear once the build is complete')
    for (const w of s.weapons) assert.equal(w.lvl, WEAPONS[w.id].levels.length)
  }
})

test('invalid picks are refused', () => {
  const s = createRun({ seed: 3 })
  s.weapons[0].lvl = WEAPONS.spark.levels.length
  assert.equal(applyOffer(s, { type: 'weapon', id: 'spark' }), false)
  assert.equal(applyOffer(s, { type: 'weapon', id: 'nope' }), false)
  for (const id of ['gears', 'wrench', 'chain']) assert.equal(applyOffer(s, { type: 'weapon', id }), true)
  assert.equal(applyOffer(s, { type: 'weapon', id: 'mines' }), false, 'no fifth weapon')
  assert.equal(s.weapons.length, MAX_WEAPONS)
})

test('locked weapons are never offered, but a loadout always keeps its own weapon', () => {
  const s = createRun({ seed: 5, allowedWeapons: ['spark', 'gears'], char: 'wire' })
  assert.equal(s.weapons[0].id, 'chain')
  for (let i = 0; i < 300; i++) for (const o of rollOffers(s)) if (o.type === 'weapon') assert.ok(['spark', 'gears', 'chain'].includes(o.id))
})

test('passives change stats', () => {
  const s = createRun({ seed: 9 })
  const hp = s.stats.maxHp, speed = s.stats.speed
  applyOffer(s, { type: 'passive', id: 'plating' }); applyOffer(s, { type: 'passive', id: 'springs' }); applyOffer(s, { type: 'passive', id: 'clock' })
  assert.ok(s.stats.maxHp > hp && s.stats.speed > speed && s.stats.cooldown < 1)
})

test('every weapon level has card text and sane numbers', () => {
  for (const id in WEAPONS) {
    const def = WEAPONS[id]
    assert.equal(def.id, id); assert.ok(def.levels.length >= 5, `${id} has 5 levels`)
    for (const L of def.levels) { assert.ok(L.text.length > 5); assert.ok(L.dmg > 0) }
  }
  for (const id in PASSIVES) { assert.equal(PASSIVES[id].id, id); assert.ok(PASSIVES[id].max >= 1 && PASSIVES[id].text) }
})
