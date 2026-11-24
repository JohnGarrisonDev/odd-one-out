// Player stats: base values, then character mods + workshop levels + passives layered on top. No DOM.
import { PASSIVES } from './data/weapons.js'
import { WORKSHOP, CHARACTERS } from './data/meta.js'

export const BASE_STATS = { maxHp: 100, speed: 152, pickup: 72, regen: 0, damage: 1, cooldown: 1, area: 1, amount: 0, armour: 0, luck: 0, xp: 1, scrap: 1, rerolls: 0, revives: 0 }
// These stats are multipliers: bonuses add up, then multiply the base (two +10% make +20%). The rest are flat adds.
const MUL = { maxHp: 1, speed: 1, pickup: 1, damage: 1, cooldown: 1, area: 1, xp: 1, scrap: 1 }

export function getCharacter(id) { return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0] }

/** Work out the player's stats. passives: [{ id, lvl }]. workshop: { id: level }. Returns a fresh object. */
export function computeStats(charId, workshop = {}, passives = [], out = {}) {
  const bonus = {}
  const add = (stat, v) => { bonus[stat] = (bonus[stat] || 0) + v }
  const ch = getCharacter(charId)
  for (const k in ch.mods) add(k, ch.mods[k])
  for (const u of WORKSHOP) { const lvl = Math.min(workshop[u.id] | 0, u.costs.length); if (lvl > 0) add(u.stat, u.per * lvl) }
  for (const p of passives) { const def = PASSIVES[p.id]; if (def) add(def.stat, def.per * p.lvl) }
  for (const k in BASE_STATS) out[k] = MUL[k] ? BASE_STATS[k] * (1 + (bonus[k] || 0)) : BASE_STATS[k] + (bonus[k] || 0)
  out.cooldown = Math.max(0.4, out.cooldown)
  out.maxHp = Math.max(20, Math.round(out.maxHp))
  out.speed = Math.max(60, out.speed)
  return out
}
