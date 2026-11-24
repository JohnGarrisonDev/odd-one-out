// Headless balance check: plays many runs with the bots and prints how they went. Not a test (run by hand):
//   node tools/balance.mjs [runs=12] [minutes=12]
import { createRun, step, STEP, summarize } from '../src/game/sim.js'
import { makeBot } from '../src/game/bot.js'
import { WORKSHOP } from '../src/game/data/meta.js'

const RUNS = Number(process.argv[2] || 12), MINUTES = Number(process.argv[3] || 12)
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const maxed = Object.fromEntries(WORKSHOP.map((u) => [u.id, u.costs.length]))

export function playRun(skill, seed, workshop = {}, minutes = MINUTES, char = 'odd') {
  const s = createRun({ seed, workshop, char })
  const bot = makeBot(skill, seed + 99)
  const marks = {}
  let peak = 0, worst = 0
  while (s.mode !== 'dead' && s.t < minutes * 60) {
    bot(s)
    const t0 = performance.now()
    step(s, STEP)
    worst = Math.max(worst, performance.now() - t0)
    peak = Math.max(peak, s.enemies.length)
    const m = Math.floor(s.t / 60)
    if (!marks[m]) marks[m] = { lvl: s.level, n: s.enemies.length, kills: s.kills, hp: Math.round(s.player.hp) }
  }
  return { s, sum: summarize(s), marks, peak, worst }
}

if (process.argv[1] && process.argv[1].endsWith('balance.mjs')) {
  for (const [label, skill, ws] of [['novice, no workshop', 'novice', {}], ['good, no workshop', 'good', {}], ['good, full workshop', 'good', maxed]]) {
    const times = [], lines = []
    let wins = 0, scrap = 0
    for (let i = 0; i < RUNS; i++) {
      const r = playRun(skill, 1000 + i * 7, ws)
      times.push(r.sum.time); if (r.sum.won) wins++; scrap += r.sum.scrap
      lines.push(`  ${fmt(r.sum.time)} lv${r.sum.level} kills ${r.sum.kills} peak ${r.peak} scrap ${r.sum.scrap} step<=${r.worst.toFixed(1)}ms ${r.sum.won ? 'WON' : ''} | ` +
        r.sum.weapons.map((w) => `${w.id}${w.lvl}:${Math.round(w.dmg / 1000)}k`).join(' ') + ' | lvl@min ' + Object.values(r.marks).map((m) => m.lvl).join(','))
    }
    times.sort((a, b) => a - b)
    console.log(`${label}: median ${fmt(times[times.length >> 1])}, min ${fmt(times[0])}, max ${fmt(times[times.length - 1])}, wins ${wins}/${RUNS}, avg scrap ${Math.round(scrap / RUNS)}`)
    console.log(lines.join('\n'))
  }
}
