// Headless simulation tests: the whole game runs in node with a bot at the controls.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRun, step, STEP, summarize, chooseOffer, keepGoing, scrapEarned } from '../src/game/sim.js'
import { makeBot } from '../src/game/bot.js'
import { WEAPONS } from '../src/game/data/weapons.js'
import { ENEMIES } from '../src/game/data/enemies.js'
import { spawnEnemy, killEnemy, hitPlayer, spawnPickup } from '../src/game/combat.js'
import { hpScale } from '../src/game/data/timeline.js'

function assertFinite(s) {
  const p = s.player
  for (const v of [p.x, p.y, p.hp, p.vx, p.vy, s.xp, s.t, s.shake]) assert.ok(Number.isFinite(v), 'player / run numbers are finite')
  for (const list of [s.enemies, s.shots, s.eshots, s.pickups, s.parts, s.mines, s.pools, s.hazards]) {
    for (const o of list) assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y), 'entity position is finite')
  }
  for (const e of s.enemies) assert.ok(Number.isFinite(e.hp) && Number.isFinite(e.kx), 'enemy numbers are finite')
}
function play(s, bot, seconds, each) {
  const end = s.t + seconds
  let guard = seconds * 60 * 4
  while (s.t < end && s.mode !== 'dead' && guard-- > 0) { bot(s); step(s, STEP); if (each) each(s) }
}

test('smoke: bots play full-length runs without errors or NaN, and difficulty ramps', () => {
  for (const [skill, seed] of [['novice', 11], ['good', 12], ['good', 13]]) {
    const s = createRun({ seed })
    const bot = makeBot(skill, seed)
    const samples = []
    let frames = 0, peak = 0
    play(s, bot, 660, () => {
      if (++frames % 600 === 0) assertFinite(s)
      peak = Math.max(peak, s.enemies.length)
      const m = Math.floor(s.t / 60)
      if (!samples[m]) samples[m] = { n: s.enemies.length, kills: s.kills }
    })
    assertFinite(s)
    const sum = summarize(s)
    assert.ok(sum.time > 20, `${skill} lasts more than 20s (got ${sum.time.toFixed(0)}s)`)
    assert.ok(sum.kills > 10 && sum.level > 1)
    assert.ok(peak < 900, 'enemy count stays bounded')
    assert.ok(s.parts.length <= 260 && s.texts.length <= 48, 'effects stay capped')
    if (samples.length > 4) {
      const killsPerMin = samples.map((x, i) => (i ? x.kills - samples[i - 1].kills : x.kills))
      assert.ok(killsPerMin[4] > killsPerMin[1], 'more Matchers arrive later than early')
    }
  }
})

test('same seed, same inputs, same run', () => {
  const a = createRun({ seed: 77 }), b = createRun({ seed: 77 })
  play(a, makeBot('good', 5), 90); play(b, makeBot('good', 5), 90)
  assert.equal(a.kills, b.kills); assert.equal(a.player.x, b.player.x); assert.equal(a.level, b.level)
})

test('enemies get tougher over time', () => {
  const s = createRun({ seed: 1 })
  const early = spawnEnemy(s, 'walker', 500, 0)
  s.t = 480
  const late = spawnEnemy(s, 'walker', 500, 0)
  assert.ok(late.maxHp > early.maxHp * 5 && late.dmg > early.dmg && late.speed > early.speed * 0.95)
  assert.ok(hpScale(600) > 10)
})

test('levelling up pauses the run until a card is picked', () => {
  const s = createRun({ seed: 2 })
  spawnPickup(s, 'bolt', 0, 0, 500).age = 1
  for (let i = 0; i < 30 && s.mode === 'play'; i++) step(s, STEP)
  assert.equal(s.mode, 'levelup'); assert.ok(s.offers.length >= 2)
  const t = s.t
  step(s, STEP); assert.equal(s.t, t, 'time stands still on the level-up screen')
  let picks = 0
  while (s.mode === 'levelup') { assert.equal(chooseOffer(s, 0), true); picks++ }
  assert.ok(picks >= 5, 'a big XP gain queues several level-ups')
  assert.equal(s.mode, 'play'); assert.equal(s.pendingLevels, 0)
  assert.equal(chooseOffer(s, 0), false, 'cannot pick outside the level-up screen')
})

test('every weapon works alone and deals damage', () => {
  for (const id in WEAPONS) {
    for (const lvl of [1, WEAPONS[id].levels.length]) {
      const s = createRun({ seed: 4 })
      s.weapons = [{ id, lvl, cd: 0.1, ang: 0, active: 0, dir: 1 }]
      s.t = 120
      for (let i = 0; i < 60 * 25; i++) {
        s.player.hp = 1e6; s.input.x = Math.cos(i / 40); s.input.y = Math.sin(i / 40)
        step(s, STEP)
        if (s.mode !== 'play') { s.mode = 'play'; s.pendingLevels = 0; s.crates = 0 }
      }
      assertFinite(s)
      assert.ok((s.dmgBy[id] || 0) > 0, `${id} level ${lvl} dealt damage`)
    }
  }
})

test('every enemy type can be spawned, hurt the player and be broken', () => {
  for (const type in ENEMIES) {
    const s = createRun({ seed: 6 })
    s.dir.next = s.dir.next.map(() => Infinity)
    const e = spawnEnemy(s, type, 60, 0, { elite: type === 'tank' })
    for (let i = 0; i < 60 * 12 && s.mode !== 'dead'; i++) { s.player.hp = Math.max(s.player.hp, 50); s.weapons[0].cd = 99; step(s, STEP); if (s.mode !== 'play') { s.mode = 'play'; s.pendingLevels = 0; s.crates = 0 } }
    assertFinite(s)
    if (type !== 'swarm') assert.ok(s.dmgTaken > 0, `${type} hurt the player`)
    const kills = s.kills
    if (!e.dead) killEnemy(s, e)
    assert.ok(s.kills > kills || e.silent)
  }
})

test('death ends the run; a second wind saves you once', () => {
  const s = createRun({ seed: 8, workshop: { wind: 1 } })
  assert.equal(s.revives, 1)
  hitPlayer(s, 9999)
  assert.equal(s.mode, 'play'); assert.ok(s.player.hp > 0); assert.equal(s.revives, 0)
  s.player.iframe = 0
  hitPlayer(s, 9999)
  assert.equal(s.mode, 'dead'); assert.equal(s.player.hp, 0)
  const t = s.t
  step(s, STEP); assert.equal(s.t, t)
  assert.equal(summarize(s).won, false)
})

test('beating the Template wins; keep going switches to endless', () => {
  const s = createRun({ seed: 10 })
  s.t = 599.9; s.player.hp = 1e9
  for (let i = 0; i < 30 && !s.finalBoss; i++) step(s, STEP)
  assert.ok(s.finalBoss && s.boss === s.finalBoss, 'the Template arrives at 10:00')
  const scrapBefore = scrapEarned(s)
  killEnemy(s, s.finalBoss)
  for (let i = 0; i < 600 && s.mode !== 'won'; i++) { s.player.hp = 1e9; step(s, STEP); if (s.mode === 'levelup') while (s.mode === 'levelup') chooseOffer(s, 0); if (s.mode === 'crate') { s.mode = 'play'; s.crates = 0 } }
  assert.equal(s.mode, 'won'); assert.equal(summarize(s).won, true); assert.ok(summarize(s).bosses.template)
  assert.ok(scrapEarned(s) > scrapBefore, 'winning pays')
  assert.equal(keepGoing(s), true)
  assert.equal(s.mode, 'play'); assert.equal(s.endless, true)
  const bot = makeBot('good', 3)
  play(s, bot, 200, (r) => { r.player.hp = 1e9 })
  assertFinite(s)
  assert.ok(s.boss || s.bossKills.foreman, 'endless mode sends bosses back')
})
