// The wave director's script. Pure data plus two tiny curve functions.
// PHASES: what trickles in from the screen edges. Each phase runs until `until` (seconds), spawning `rate` enemies per
//   second (lerped from rate[0] to rate[1] across the phase), never more than `cap` alive, picked by weight from `mix`.
// EVENTS: one-off or repeating set pieces (rings, lines, elites, bosses).

export const RUN_LENGTH = 600 // seconds; the big boss arrives here

export const PHASES = [
  { until: 40, rate: [1.2, 2.1], cap: 50, mix: { walker: 1 }, elite: ['walker'] },
  { until: 90, rate: [2.1, 3.4], cap: 80, mix: { walker: 5, runner: 2 }, elite: ['walker'] },
  { until: 150, rate: [3.4, 4.7], cap: 110, mix: { walker: 5, runner: 2, splitter: 1 }, elite: ['walker', 'splitter'] },
  { until: 200, rate: [4.7, 6], cap: 140, mix: { walker: 5, runner: 3, splitter: 1, shooter: 1 }, elite: ['splitter', 'shooter'] },
  { until: 240, rate: [4.2, 5.7], cap: 150, mix: { walker: 5, runner: 3, shooter: 1 }, elite: ['walker'] }, // Foreman fight: a breather
  { until: 300, rate: [6, 7.8], cap: 190, mix: { walker: 5, runner: 3, tank: 0.6, splitter: 1, shooter: 1, charger: 0.8 }, elite: ['tank', 'charger'] },
  { until: 400, rate: [7.8, 10.4], cap: 240, mix: { walker: 5, runner: 3, tank: 1, splitter: 1.5, shooter: 1.2, charger: 1.2 }, elite: ['tank', 'charger', 'shooter'] },
  { until: 440, rate: [9, 11], cap: 270, mix: { walker: 5, runner: 4, splitter: 1, charger: 1 }, elite: ['splitter'] }, // Auditor fight
  { until: 520, rate: [12, 16], cap: 340, mix: { walker: 5, runner: 4, tank: 1.4, splitter: 2, shooter: 1.5, charger: 1.5 }, elite: ['tank', 'charger'] },
  { until: 600, rate: [16, 22], cap: 400, mix: { walker: 5, runner: 4, tank: 1.8, splitter: 2, shooter: 1.6, charger: 2 }, elite: ['tank', 'charger', 'splitter'] },
  // Endless mode keeps using the last phase, with rate and cap pushed up by endlessScale().
  { until: Infinity, rate: [18, 18], cap: 400, mix: { walker: 5, runner: 4, tank: 2, splitter: 2, shooter: 1.6, charger: 2 }, elite: ['tank', 'charger', 'splitter'] },
]

// kind: 'elite' (one elite from the phase's list), 'ring' (swarm ring closing on the player), 'line' (a wall of swarm
// sweeping across), 'boss'. `every` repeats the event; `until` stops the repeats.
export const EVENTS = [
  { at: 55, every: 50, kind: 'elite' },
  { at: 70, every: 85, kind: 'ring', n: 14, grow: 2.2 },
  { at: 110, every: 75, kind: 'line', n: 9, grow: 1.6 },
  { at: 200, kind: 'boss', type: 'foreman' },
  { at: 400, kind: 'boss', type: 'auditor' },
  { at: 600, kind: 'boss', type: 'template', final: true },
]

// Bosses size you up (The Template, and the bosses that come back in endless mode).
// 1. On arrival its HP is multiplied by (dps / ref) ^ exp, kept within [start[0], start[1]], where dps is the director's
//    running average of your damage per second over about `tau` seconds.
// 2. Once the fight is on (it has been hurt, or is within `near` of you) it watches how fast you hurt it for `window`
//    seconds, then rescales its HP once (by a factor within `adjust`) so the whole fight should last about `fight` seconds.
// Its total HP multiplier always stays within [min, max]. A tougher boss also attacks a little more often:
// patternCd times multiplier ^ -pressure, kept within cdRange.
export const POWER = { tau: 30, ref: 12000, exp: 1, start: [0.7, 1.3], near: 320, window: 20, fight: 65, adjust: [0.5, 1.25], min: 0.4, max: 1.6, pressure: 0.3, cdRange: [0.85, 1.15] }

// Endless mode: after the Template falls, the run changes shape instead of only getting bigger.
// - Every `waveEvery` seconds a new themed wave takes over the spawn mix (cycling through ENDLESS_WAVES), with a banner.
// - Every `packEvery` seconds a pack of elites arrives (more each time, up to `packMax`), drawn from the wave's types.
// - Every `bossEvery` seconds an old boss comes back (ENDLESS_BOSSES in turn), sized up to your build like the Template,
//   from a base of `bossHp` whichever boss it is, plus `bossGrow` more HP for each reprise so far.
export const ENDLESS = { waveEvery: 45, packEvery: 40, packMin: 2, packMax: 6, bossEvery: 120, bossHp: 12000, bossGrow: 0.35 }
export const ENDLESS_WAVES = [
  { name: 'Rush hour', mix: { runner: 6, walker: 3, mini: 2 }, elite: ['runner', 'walker'] },
  { name: 'Ram raid', mix: { charger: 4, walker: 4, runner: 2 }, elite: ['charger'] },
  { name: 'Stamp duty', mix: { shooter: 3, walker: 5, tank: 1 }, elite: ['shooter', 'tank'] },
  { name: 'Bulk order', mix: { tank: 3, splitter: 3, walker: 3 }, elite: ['tank', 'splitter'] },
  { name: 'Everything at once', mix: { walker: 5, runner: 4, tank: 2, splitter: 2, shooter: 1.6, charger: 2 }, elite: ['tank', 'charger', 'splitter'] },
]
export const ENDLESS_BOSSES = ['foreman', 'auditor', 'template']

const mins = (t) => t / 60
/** Enemy HP multiplier at time t (seconds). */
export function hpScale(t) { const m = mins(t); return 1 + 0.42 * m + 0.1 * m * m + 0.016 * m * m * m + (m > 10 ? (m - 10) * 0.9 : 0) }
/** Enemy contact / shot damage multiplier at time t. */
export function dmgScale(t) { return 1 + 0.07 * mins(t) }
/** Enemy move speed multiplier at time t. */
export function speedScale(t) { return 1 + Math.min(0.3, 0.02 * mins(t)) }
/** Spawn rate multiplier in endless mode. */
export function endlessScale(t) { return t <= RUN_LENGTH ? 1 : 1 + (t - RUN_LENGTH) / 420 }

/** XP needed to go from `level` to `level + 1`. */
export function xpNeed(level) { const l = level - 1; return Math.floor(5 + 6 * l + 0.4 * l * l) }
