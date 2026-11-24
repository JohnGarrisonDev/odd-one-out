// Level-up offers: what may be offered, rolling cards, applying a pick. No DOM.
import { WEAPONS, PASSIVES, MAX_WEAPONS, MAX_PASSIVES } from './data/weapons.js'
import { computeStats } from './stats.js'

/** Every valid upgrade right now: [{ type: 'weapon' | 'passive', id, lvl (level after picking), isNew, weight }]. */
export function buildPool(s) {
  const pool = []
  const held = new Map(s.weapons.map((w) => [w.id, w]))
  for (const id of s.allowedWeapons) {
    const def = WEAPONS[id]; if (!def) continue
    const w = held.get(id)
    if (w) { if (w.lvl < def.levels.length) pool.push({ type: 'weapon', id, lvl: w.lvl + 1, isNew: false, weight: 1.25 }) }
    else if (s.weapons.length < MAX_WEAPONS) pool.push({ type: 'weapon', id, lvl: 1, isNew: true, weight: s.weapons.length < 2 ? 2.2 : 1 })
  }
  const heldP = new Map(s.passives.map((p) => [p.id, p]))
  for (const id in PASSIVES) {
    const def = PASSIVES[id], p = heldP.get(id)
    if (p) { if (p.lvl < def.max) pool.push({ type: 'passive', id, lvl: p.lvl + 1, isNew: false, weight: 1 }) }
    else if (s.passives.length < MAX_PASSIVES) pool.push({ type: 'passive', id, lvl: 1, isNew: true, weight: 0.8 })
  }
  return pool
}

const FILLERS = [{ type: 'heal', id: 'heal', lvl: 0, isNew: false }, { type: 'scrap', id: 'scrap', lvl: 0, isNew: false }]

/** Pick n different offers (weighted). When the build is complete, offers a repair or a handful of scrap instead. */
export function rollOffers(s, n) {
  if (n == null) n = 3 + (s.rng() < s.stats.luck * 0.12 ? 1 : 0)
  const pool = buildPool(s), out = []
  while (out.length < n && pool.length) {
    let total = 0
    for (const o of pool) total += o.weight
    let r = s.rng() * total, i = 0
    for (; i < pool.length - 1; i++) { r -= pool[i].weight; if (r <= 0) break }
    out.push(pool.splice(i, 1)[0])
  }
  for (const f of FILLERS) if (out.length < Math.min(n, 2)) out.push({ ...f })
  return out
}

/** Apply an offer to the run. Returns false if it is not valid (already maxed, no free slot). */
export function applyOffer(s, o) {
  if (o.type === 'heal') { s.player.hp = Math.min(s.stats.maxHp, s.player.hp + 30); return true }
  if (o.type === 'scrap') { s.scrapFound += 5; return true }
  if (o.type === 'weapon') {
    const def = WEAPONS[o.id]; if (!def) return false
    const w = s.weapons.find((x) => x.id === o.id)
    if (w) { if (w.lvl >= def.levels.length) return false; w.lvl++ }
    else { if (s.weapons.length >= MAX_WEAPONS) return false; s.weapons.push({ id: o.id, lvl: 1, cd: 0.3, ang: 0, active: 0, dir: 1 }) }
    return true
  }
  if (o.type === 'passive') {
    const def = PASSIVES[o.id]; if (!def) return false
    const p = s.passives.find((x) => x.id === o.id)
    if (p) { if (p.lvl >= def.max) return false; p.lvl++ }
    else { if (s.passives.length >= MAX_PASSIVES) return false; s.passives.push({ id: o.id, lvl: 1 }) }
    const before = s.stats.maxHp
    computeStats(s.char, s.workshop, s.passives, s.stats)
    if (s.stats.maxHp > before) s.player.hp += s.stats.maxHp - before + (def.stat === 'maxHp' ? 8 : 0)
    s.player.hp = Math.min(s.player.hp, s.stats.maxHp)
    return true
  }
  return false
}

/** Card text for an offer: { name, tag, text, color }. */
export function describeOffer(o) {
  if (o.type === 'heal') return { name: 'Quick Repair', tag: 'FIX', text: 'Patch up 30 HP.', color: '#FF8FC7' }
  if (o.type === 'scrap') return { name: 'Pocket Scrap', tag: 'SCRAP', text: '+5 scrap for the workshop.', color: '#FF5B2E' }
  if (o.type === 'weapon') {
    const def = WEAPONS[o.id]
    return { name: def.name, tag: o.isNew ? 'NEW WEAPON' : `WEAPON LV ${o.lvl}`, text: def.levels[o.lvl - 1].text, color: def.color }
  }
  const def = PASSIVES[o.id]
  return { name: def.name, tag: o.isNew ? 'NEW PART' : `PART LV ${o.lvl}`, text: def.text, color: def.color }
}
