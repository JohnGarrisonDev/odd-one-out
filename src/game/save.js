// Save data shape, defaults, migration and the between-runs rules (buying, records, achievements). No DOM, no storage:
// main.js hands the plain object to kit's makeStore.
import { WORKSHOP, CHARACTERS, ACHIEVEMENTS } from './data/meta.js'
import { WEAPONS } from './data/weapons.js'

export const SAVE_VERSION = 1

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    scrap: 0,
    best: { time: 0, kills: 0, level: 1 },
    totals: { runs: 0, kills: 0, wins: 0, time: 0, scrap: 0 },
    workshop: {},
    chars: ['odd'],
    char: 'odd',
    achievements: {},
    settings: { damageNumbers: true, shake: true, music: true },
  }
}

const num = (v, d = 0, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : d)
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

/** Turn anything (old versions, junk, null) into a valid save object. Never throws. */
export function normalizeSave(raw) {
  const d = defaultSave()
  const r = obj(raw)
  d.scrap = Math.floor(num(r.scrap))
  const best = obj(r.best)
  d.best = { time: num(best.time), kills: Math.floor(num(best.kills)), level: Math.floor(num(best.level, 1, 1)) }
  const tot = obj(r.totals)
  for (const k in d.totals) d.totals[k] = num(tot[k])
  const ws = obj(r.workshop)
  for (const u of WORKSHOP) { const l = Math.floor(num(ws[u.id])); if (l > 0) d.workshop[u.id] = Math.min(l, u.costs.length) }
  const ach = obj(r.achievements)
  for (const a of ACHIEVEMENTS) if (ach[a.id]) d.achievements[a.id] = true
  const owned = Array.isArray(r.chars) ? r.chars : []
  for (const c of CHARACTERS) if (c.id !== 'odd' && (owned.includes(c.id) || (c.needs && d.achievements[c.needs]))) d.chars.push(c.id)
  d.char = d.chars.includes(r.char) ? r.char : 'odd'
  const st = obj(r.settings)
  d.settings.damageNumbers = st.damageNumbers !== false
  d.settings.shake = st.shake !== false
  d.settings.music = st.music !== false // added in 1.4.0: older saves get music on
  return d
}

export function workshopCost(save, id) {
  const u = WORKSHOP.find((x) => x.id === id); if (!u) return null
  const lvl = save.workshop[id] | 0
  return lvl >= u.costs.length ? null : u.costs[lvl]
}
/** Buy one workshop level. Returns true if it went through. */
export function buyWorkshop(save, id) {
  const cost = workshopCost(save, id)
  if (cost == null || save.scrap < cost) return false
  save.scrap -= cost; save.workshop[id] = (save.workshop[id] | 0) + 1
  return true
}
export function buyCharacter(save, id) {
  const c = CHARACTERS.find((x) => x.id === id)
  if (!c || save.chars.includes(id) || c.cost == null || save.scrap < c.cost) return false
  save.scrap -= c.cost; save.chars.push(id); save.char = id
  return true
}
/** Weapon ids that may be offered this run (some need an achievement first). */
export function unlockedWeapons(save) {
  return Object.keys(WEAPONS).filter((id) => !WEAPONS[id].needs || save.achievements[WEAPONS[id].needs])
}

/** Fold a finished run (summarize() from sim.js) into the save. Returns what changed, for the summary screen. */
export function applyRun(save, run) {
  const out = { scrap: run.scrap, records: [], achievements: [] }
  save.scrap += run.scrap
  save.totals.runs += 1; save.totals.kills += run.kills; save.totals.time += run.time; save.totals.scrap += run.scrap
  if (run.won) save.totals.wins += 1
  if (run.time > save.best.time) { save.best.time = run.time; out.records.push('time') }
  if (run.kills > save.best.kills) { save.best.kills = run.kills; out.records.push('kills') }
  if (run.level > save.best.level) { save.best.level = run.level; out.records.push('level') }
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements[a.id] && a.test(run, save)) { save.achievements[a.id] = true; out.achievements.push(a) }
  }
  for (const c of CHARACTERS) if (c.needs && save.achievements[c.needs] && !save.chars.includes(c.id)) save.chars.push(c.id)
  return out
}
