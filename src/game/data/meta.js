// Between-runs content: workshop upgrades, starting loadouts and achievements. Pure data.

// Workshop upgrades are permanent. `stat`/`per` work like passives (see ../stats.js). `costs` is one price per level.
export const WORKSHOP = [
  { id: 'hull', name: 'Thicker Hull', stat: 'maxHp', per: 0.08, costs: [20, 50, 90, 150, 230], text: '+8% max HP' },
  { id: 'treads', name: 'Oiled Treads', stat: 'speed', per: 0.03, costs: [20, 50, 90, 150, 230], text: '+3% move speed' },
  { id: 'sparks', name: 'Hotter Sparks', stat: 'damage', per: 0.05, costs: [30, 60, 110, 180, 270], text: '+5% damage' },
  { id: 'timer', name: 'Quicker Timer', stat: 'cooldown', per: -0.03, costs: [30, 60, 110, 180, 270], text: 'Weapons fire 3% more often' },
  { id: 'reach', name: 'Longer Reach', stat: 'pickup', per: 0.12, costs: [15, 35, 65, 105, 160], text: '+12% pickup range' },
  { id: 'patch', name: 'Patch Kit', stat: 'regen', per: 0.15, costs: [30, 60, 110, 180, 270], text: 'Repair +0.15 HP a second' },
  { id: 'study', name: 'Night School', stat: 'xp', per: 0.04, costs: [35, 70, 120, 190, 280], text: '+4% XP from bolts' },
  { id: 'nose', name: 'Nose for Scrap', stat: 'scrap', per: 0.1, costs: [40, 80, 140, 220, 320], text: '+10% scrap from every run' },
  { id: 'reroll', name: 'Second Opinion', stat: 'rerolls', per: 1, costs: [60, 140, 260], text: '+1 reroll of upgrade cards each run' },
  { id: 'wind', name: 'Second Wind', stat: 'revives', per: 1, costs: [300], text: 'Once a run, get back up at half HP' },
]

// Starting loadouts. `mods` are added to the base stats (see ../stats.js). `cost` in scrap, or `needs` an achievement.
export const CHARACTERS = [
  { id: 'odd', name: 'Odd', weapon: 'spark', mods: {}, body: '#FBF6EC', blurb: 'The original. Starts with Spark.' },
  { id: 'fixer', name: 'Fixer Odd', weapon: 'wrench', mods: { maxHp: 0.25, speed: -0.06 }, cost: 120, body: '#FFC93C', blurb: 'Starts with Wrench-a-rang. +25% HP, a little slower.' },
  { id: 'wire', name: 'Live Wire Odd', weapon: 'chain', mods: { speed: 0.1, maxHp: -0.2, cooldown: -0.05 }, cost: 260, body: '#2FD6A3', blurb: 'Starts with Chain Lightning. Faster all round, 20% less HP.' },
  { id: 'magno', name: 'Magno Odd', weapon: 'pulse', mods: { pickup: 0.6, area: 0.1 }, needs: 'win', body: '#FF8FC7', blurb: 'Starts with Magnet Pulse. Huge pickup range, bigger areas.' },
]

// Achievements. `test(run, save)` gets the finished run summary (see summarize() in ../sim.js) and the save data.
export const ACHIEVEMENTS = [
  { id: 'minute', name: 'Still Here', text: 'Stay odd for 1 minute.', test: (r) => r.time >= 60 },
  { id: 'five', name: 'Halfway Odd', text: 'Stay odd for 5 minutes.', unlocks: 'Unlocks the Hot Oil weapon.', test: (r) => r.time >= 300 },
  { id: 'foreman', name: 'Clocked Off', text: 'Beat The Foreman.', unlocks: 'Unlocks the Odd Eye Beam weapon.', test: (r) => !!r.bosses.foreman },
  { id: 'auditor', name: 'Audit Failed', text: 'Beat The Auditor.', test: (r) => !!r.bosses.auditor },
  { id: 'win', name: 'Odd One Out', text: 'Beat The Template at 10 minutes.', unlocks: 'Unlocks Magno Odd.', test: (r) => !!r.bosses.template },
  { id: 'k1000', name: 'Mismatch Maker', text: 'Break 1,000 Matchers in one run.', test: (r) => r.kills >= 1000 },
  { id: 'lvl30', name: 'Overbuilt', text: 'Reach level 30.', test: (r) => r.level >= 30 },
  { id: 'maxed', name: 'Finished Article', text: 'Get a weapon to level 5.', test: (r) => r.weapons.some((w) => w.lvl >= 5) },
  { id: 'endless', name: 'Overtime', text: 'Stay odd for 15 minutes.', test: (r) => r.time >= 900 },
]
