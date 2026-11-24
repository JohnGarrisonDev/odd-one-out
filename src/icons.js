// Little icons for weapons, parts and other cards: a coloured tile with an ink glyph. Drawn in code.
// To add one: add a function to GLYPHS keyed by the weapon / passive id. Glyphs draw in a -10..10 box, ink stroke set.
import { C } from '../kit/kit.js'
import { WEAPONS, PASSIVES } from './game/data/weapons.js'

const TAU = Math.PI * 2
const line = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]) }
function cog(g, r, teeth, inner) {
  g.beginPath()
  for (let i = 0; i < teeth * 2; i++) { const a0 = (i / (teeth * 2)) * TAU, a1 = ((i + 1) / (teeth * 2)) * TAU, rad = i % 2 ? r : r * inner; g.lineTo(Math.cos(a0) * rad, Math.sin(a0) * rad); g.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad) }
  g.closePath()
}

const GLYPHS = {
  spark(g) { line(g, [2, -10, -6, 1, -1, 1, -3, 10, 6, -2, 1, -2]); g.closePath(); g.fill() },
  gears(g) { cog(g, 9, 7, 0.7); g.fill(); g.fillStyle = C.yellow; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill() },
  wrench(g) { g.lineWidth = 4.5; line(g, [-7, 8, 2, -1]); g.stroke(); g.lineWidth = 3.5; g.beginPath(); g.arc(4.5, -4.5, 5, 0.2, 4.3); g.stroke() },
  chain(g) { g.lineWidth = 3; line(g, [-9, -6, -3, -1, -6, 3, 1, 4, -1, 8]); g.stroke(); line(g, [1, -9, 6, -4, 3, -1, 9, 3]); g.stroke() },
  beam(g) { g.beginPath(); g.arc(-4, 2, 6, 0, TAU); g.fill(); g.fillStyle = C.paper; g.beginPath(); g.arc(-3, 1.5, 2.4, 0, TAU); g.fill(); g.lineWidth = 3.5; line(g, [1, -3, 10, -10]); g.stroke() },
  mines(g) { cog(g, 9, 8, 0.78); g.fill(); g.fillStyle = C.yellow; g.beginPath(); g.arc(0, 0, 3.2, 0, TAU); g.fill() },
  pulse(g) { g.lineWidth = 2.8; for (const r of [3, 6.5, 10]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke() } },
  oil(g) { g.beginPath(); g.moveTo(0, -10); g.bezierCurveTo(8, 0, 8, 9, 0, 9); g.bezierCurveTo(-8, 9, -8, 0, 0, -10); g.fill(); g.strokeStyle = C.paper; g.lineWidth = 2; g.beginPath(); g.arc(0, 2, 4, 1.6, 2.9); g.stroke() },

  springs(g) { g.lineWidth = 3; line(g, [-7, 9, 7, 5, -7, 1, 7, -3, -7, -7, 7, -10]); g.stroke() },
  plating(g) { g.beginPath(); g.moveTo(0, -10); g.lineTo(9, -6); g.lineTo(8, 3); g.lineTo(0, 10); g.lineTo(-8, 3); g.lineTo(-9, -6); g.closePath(); g.fill() },
  solder(g) { g.fillRect(-3, -9, 6, 18); g.fillRect(-9, -3, 18, 6) },
  magnet(g) { g.lineWidth = 6; g.lineCap = 'butt'; g.beginPath(); g.arc(0, -1, 6, Math.PI, 0); g.moveTo(-6, -1); g.lineTo(-6, 9); g.moveTo(6, -1); g.lineTo(6, 9); g.stroke(); g.strokeStyle = C.paper; line(g, [-6, 5, -6, 9]); g.stroke(); line(g, [6, 5, 6, 9]); g.stroke() },
  clock(g) { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke(); line(g, [0, -5, 0, 0, 4, 3]); g.stroke() },
  cell(g) { g.fillRect(-6, -7, 12, 16); g.fillRect(-2.5, -10, 5, 3); g.fillStyle = C.yellow; line(g, [1, -5, -3, 1, 0, 1, -1, 7, 3, 0, 0, 0]); g.closePath(); g.fill() },
  spares(g) { g.fillRect(-9, -9, 8, 8); g.fillRect(1, -9, 8, 8); g.fillRect(-9, 1, 8, 8); g.lineWidth = 2.5; line(g, [5, 2, 5, 9]); g.stroke(); line(g, [1.5, 5.5, 8.5, 5.5]); g.stroke() },
  lens(g) { g.lineWidth = 3; g.beginPath(); g.arc(-2, -2, 7, 0, TAU); g.stroke(); g.lineWidth = 4; line(g, [3.5, 3.5, 9, 9]); g.stroke() },
  armour(g) { g.lineWidth = 3; g.beginPath(); g.moveTo(0, -10); g.lineTo(9, -6); g.lineTo(8, 3); g.lineTo(0, 10); g.lineTo(-8, 3); g.lineTo(-9, -6); g.closePath(); g.stroke(); line(g, [-3, -2, 0, 2, 3, -3]); g.stroke() },
  luck(g) { g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i / 6 * TAU) * 10, Math.sin(i / 6 * TAU) * 10); g.closePath(); g.fill(); g.fillStyle = C.yellow; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill() },

  heal(g) { g.fillRect(-3, -9, 6, 18); g.fillRect(-9, -3, 18, 6) },
  scrap(g) { cog(g, 9, 6, 0.72); g.fill(); g.fillStyle = C.orange; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill() },
  crate(g) { g.fillRect(-9, -7, 18, 15); g.fillStyle = C.yellow; g.fillRect(-9, -2, 18, 4) },
}
const TILE = { heal: C.pink, scrap: C.orange, crate: C.yellow }

/** Draw icon `id` in a size x size box whose top-left is at 0,0. */
export function drawIcon(g, id, size) {
  const def = WEAPONS[id] || PASSIVES[id]
  const color = def ? def.color : TILE[id] || C.paper
  const round = !!PASSIVES[id]
  g.save()
  g.lineJoin = 'round'; g.lineCap = 'round'
  g.fillStyle = color; g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, size * 0.06)
  const m = g.lineWidth / 2 + 0.5
  g.beginPath()
  if (round) g.arc(size / 2, size / 2, size / 2 - m, 0, TAU) // parts are round, weapons are square: shape, not just colour
  else if (g.roundRect) g.roundRect(m, m, size - m * 2, size - m * 2, size * 0.24)
  else g.rect(m, m, size - m * 2, size - m * 2)
  g.fill(); g.stroke()
  g.translate(size / 2, size / 2); g.scale(size / 32, size / 32)
  g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 2.5
  const fn = GLYPHS[id]
  if (fn) fn(g)
  g.restore()
}
