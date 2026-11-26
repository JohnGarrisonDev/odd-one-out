// A small synth music loop built from the kit's sfx.tone / sfx.noise (no audio files). It follows the run:
//   bass line always; off-beat hats once the crowd passes 60 Matchers; a quiet arpeggio past 200 or when the
//   Template arrives; a darker progression while any boss is on the field.
// Notes are scheduled a little ahead (the kit's tone takes a delay), so frame hitches do not smear the beat.
// It stays silent when the shared Oddvale mute is on (sfx does that), when the player turns Music off, and whenever
// the run is paused, between runs or on a modal screen (main.js calls update() only while the run is playing).
import { sfx } from '../kit/kit.js'

const BPM = 112, EIGHTH = 60 / BPM / 2, LOOK = 0.18
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12) // MIDI note -> Hz
// chord roots (MIDI) and qualities, two bars each, eight eighths per bar
const CALM = [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']] // A minor, F, C, G
const BOSS = [[45, 'm'], [46, 'M'], [45, 'm'], [40, 'M']] // A minor, B flat, A minor, E
const TRIAD = { m: [0, 3, 7, 12], M: [0, 4, 7, 12] }
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]
const BASS = [0, -1, 12, -1, 0, 0, 7, -1] // -1 = rest (semitones above the root otherwise)

let next = 0, beat = 0, on = true

/** Is the loop allowed to play at all (player setting)? */
export function setMusic(v) { on = !!v; if (!on) next = 0 }

/** Restart the loop on the next update (new run, unpause): it comes back in on a downbeat. */
export function resetMusic() { next = 0; beat = 0 }

/** intensity: { crowd: number of Matchers alive, boss: any boss alive, final: the Template is up } */
export function updateMusic(intensity) {
  if (!on || sfx.muted) { next = 0; return }
  const now = performance.now() / 1000
  if (next === 0 || next < now - 0.5) { next = now + 0.05; beat = 0 } // (re)start; after a long gap don't play catch-up
  while (next < now + LOOK) {
    playEighth(beat, next - now, intensity)
    beat = (beat + 1) % 64 // 4 chords x 2 bars x 8 eighths
    next += EIGHTH
  }
}

function playEighth(b, delay, { crowd = 0, boss = false, final = false }) {
  const prog = boss ? BOSS : CALM, [root, q] = prog[b >> 4], k = b & 7
  const bn = BASS[k]
  if (bn >= 0) sfx.tone({ freq: hz(root + bn), dur: EIGHTH * 0.9, type: boss ? 'sawtooth' : 'triangle', vol: boss ? 0.035 : 0.06, delay })
  if (crowd >= 60 && (k & 1)) sfx.noise({ dur: 0.035, vol: 0.022, freq: 7000, delay })
  if (crowd >= 140 && k === 4) sfx.noise({ dur: 0.09, vol: 0.04, freq: 1500, slide: 300, delay }) // a soft snare on beat 3
  if (crowd >= 200 || final) sfx.tone({ freq: hz(root + 24 + TRIAD[q][ARP[k]]), dur: EIGHTH * 0.7, type: 'square', vol: 0.014, delay })
}
