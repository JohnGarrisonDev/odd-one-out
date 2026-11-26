// Sound: maps simulation event names to little synth sounds from the kit, with a minimum gap per sound so a big
// fight stays pleasant instead of turning into a buzz. To add a sound: add an entry to SOUNDS = [minGapSeconds, fn].
import { sfx, haptic } from '../kit/kit.js'

let combo = 0, comboT = 0
const SOUNDS = {
  shot: [0.09, () => sfx.tone({ freq: 880, slide: 620, dur: 0.06, type: 'triangle', vol: 0.05 })],
  hit: [0.07, () => sfx.noise({ dur: 0.03, vol: 0.035, freq: 2400 })],
  grind: [0.1, () => sfx.tone({ freq: 310, slide: 240, dur: 0.035, type: 'square', vol: 0.02 })],
  kill: [0.06, () => sfx.tone({ freq: 240, slide: 120, dur: 0.08, type: 'square', vol: 0.045 })],
  bolt: [0.04, () => {
    const now = performance.now()
    combo = now - comboT < 400 ? Math.min(combo + 1, 14) : 0; comboT = now
    sfx.tone({ freq: 620 * Math.pow(1.0595, combo), dur: 0.07, type: 'sine', vol: 0.07 })
  }],
  scrap: [0.05, () => sfx.tune([[1175, 0.05], [1568, 0.08]], { type: 'triangle', vol: 0.09 })],
  heal: [0.2, () => sfx.tune([[523, 0.08], [784, 0.14]], { type: 'sine', vol: 0.14 })],
  magnet: [0.3, () => sfx.tone({ freq: 260, slide: 1040, dur: 0.35, type: 'sine', vol: 0.12 })],
  bomb: [0.3, () => { sfx.noise({ dur: 0.6, vol: 0.3, freq: 900, slide: 80 }); sfx.tone({ freq: 110, slide: 40, dur: 0.5, type: 'sine', vol: 0.25 }) }],
  boom: [0.1, () => sfx.noise({ dur: 0.18, vol: 0.11, freq: 700, slide: 120 })],
  zap: [0.12, () => sfx.tone({ freq: 1400, slide: 320, dur: 0.09, type: 'square', vol: 0.03 })],
  pulse: [0.2, () => sfx.tone({ freq: 190, slide: 60, dur: 0.24, type: 'sine', vol: 0.14 })],
  throw: [0.15, () => sfx.noise({ dur: 0.14, vol: 0.05, freq: 600, slide: 2600 })],
  beam: [0.3, () => sfx.tone({ freq: 520, slide: 780, dur: 0.5, type: 'sawtooth', vol: 0.03 })],
  drop: [0.2, () => sfx.tone({ freq: 200, slide: 150, dur: 0.05, type: 'triangle', vol: 0.05 })],
  splat: [0.2, () => sfx.noise({ dur: 0.16, vol: 0.06, freq: 500, slide: 150 })],
  eshot: [0.15, () => sfx.tone({ freq: 330, slide: 220, dur: 0.1, type: 'square', vol: 0.04 })],
  warn: [0.4, () => sfx.tune([[740, 0.08], [0, 0.04], [740, 0.08]], { type: 'square', vol: 0.06 })],
  dash: [0.15, () => sfx.noise({ dur: 0.22, vol: 0.08, freq: 400, slide: 1800 })],
  elite: [0.5, () => sfx.tune([[392, 0.09], [330, 0.14]], { type: 'square', vol: 0.06 })],
  hurt: [0.12, () => { sfx.tone({ freq: 170, slide: 70, dur: 0.2, type: 'sawtooth', vol: 0.16 }); sfx.noise({ dur: 0.1, vol: 0.1, freq: 900 }) }],
  level: [0.2, () => sfx.tune([[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.16]], { type: 'triangle', vol: 0.16 })],
  crate: [0.2, () => sfx.tune([[784, 0.06], [988, 0.06], [1175, 0.06], [1568, 0.2]], { type: 'triangle', vol: 0.15 })],
  boss: [1, () => sfx.tune([[147, 0.22], [139, 0.22], [131, 0.22], [98, 0.5]], { type: 'sawtooth', vol: 0.13 })],
  bossdie: [0.5, () => { sfx.noise({ dur: 0.7, vol: 0.28, freq: 1200, slide: 90 }); sfx.tune([[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.3]], { type: 'triangle', vol: 0.16 }) }],
  revive: [0.5, () => sfx.tune([[330, 0.08], [440, 0.08], [660, 0.2]], { type: 'triangle', vol: 0.16 })],
  die: [0.5, () => { sfx.tune([[392, 0.14], [330, 0.14], [262, 0.14], [196, 0.4]], { type: 'triangle', vol: 0.18 }); sfx.noise({ dur: 0.4, vol: 0.18, freq: 700, slide: 100 }) }],
  win: [0.5, () => sfx.tune([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [784, 0.1], [1047, 0.35]], { type: 'triangle', vol: 0.18 })],
  ui: [0.03, () => sfx.tone({ freq: 660, dur: 0.04, type: 'triangle', vol: 0.07 })],
  buy: [0.05, () => sfx.tune([[660, 0.05], [880, 0.05], [1320, 0.12]], { type: 'triangle', vol: 0.12 })],
  nope: [0.1, () => sfx.tone({ freq: 160, dur: 0.1, type: 'square', vol: 0.06 })],
}
// A short buzz on phones for the moments that matter (kit haptic: Android only, silent when muted or reduced motion).
const HAPTIC = { hurt: 28, level: [12, 40, 12], crate: 15, bossdie: [30, 50, 30], revive: 30, die: [40, 60, 90], win: [20, 50, 20, 50, 60] }
const last = {}

export function play(name) {
  const s = SOUNDS[name]
  if (!s || sfx.muted) return
  const now = performance.now() / 1000
  if (now - (last[name] || 0) < s[0]) return
  last[name] = now
  s[1]()
  if (HAPTIC[name]) haptic(HAPTIC[name])
}
/** Play (and empty) the simulation's event list for this frame. */
export function playEvents(events) {
  for (let i = 0; i < events.length; i++) play(events[i])
  events.length = 0
}
