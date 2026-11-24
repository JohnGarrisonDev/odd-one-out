// Weapon comparison bench (run by hand: node tools/dps.mjs). An unkillable Odd holding one weapon stands in the crowd
// from minute `START` for 60 seconds, either standing still or walking in a circle. Prints damage per second.
import { createRun, step, STEP } from '../src/game/sim.js'
import { WEAPONS } from '../src/game/data/weapons.js'

const START = Number(process.argv[2] || 240)
function bench(id, lvl, move) {
  const s = createRun({ seed: 7 })
  s.weapons = [{ id, lvl, cd: 0.3, ang: 0, active: 0, dir: 1 }]
  s.t = START; s.dir.next = s.dir.next.map(() => Infinity)
  let kills0 = 0
  for (let i = 0; i < 70 * 60; i++) {
    s.player.hp = 1e9; s.pendingLevels = 0; s.crates = 0
    const a = i / 60 * 0.8
    s.input.x = move ? Math.cos(a) : 0; s.input.y = move ? Math.sin(a) : 0
    if (i === 600) { s.dmgBy = {}; kills0 = s.kills }
    step(s, STEP)
    if (s.mode !== 'play') { s.mode = 'play'; s.pendingLevels = 0; s.crates = 0; s.offers = null }
  }
  return { dps: Math.round((s.dmgBy[id] || 0) / 60), kps: ((s.kills - kills0) / 60).toFixed(1) }
}
console.log(`From ${START}s. dps (kills/s): still | circling`)
for (const id in WEAPONS) {
  const row = [1, 3, 5].map((l) => { const a = bench(id, l, false), b = bench(id, l, true); return `L${l} ${a.dps} (${a.kps}) | ${b.dps} (${b.kps})` })
  console.log(id.padEnd(8), row.join('   '))
}
