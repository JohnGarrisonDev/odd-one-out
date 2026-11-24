// Weapon and passive tables. Pure data: add an entry here and it shows up in level-up offers.
// A weapon's `kind` picks its behaviour in ../weapons.js (bolt, orbit, boomerang, chain, beam, mine, nova, pool).
// Every level lists the full stats for that level plus `text`, the line shown on the upgrade card.
// `needs` (optional) is an achievement id that must be earned before the weapon is offered.

export const MAX_WEAPONS = 4
export const MAX_PASSIVES = 5

export const WEAPONS = {
  spark: {
    id: 'spark', name: 'Spark', kind: 'bolt', color: '#FFC93C',
    levels: [
      { dmg: 10, cd: 0.8, count: 1, pierce: 0, speed: 560, text: 'Zaps the nearest Matcher.' },
      { dmg: 12, cd: 0.75, count: 2, pierce: 0, speed: 560, text: 'Fires 2 sparks. A bit more damage.' },
      { dmg: 16, cd: 0.65, count: 2, pierce: 1, speed: 600, text: 'Faster, and sparks pierce 1 Matcher.' },
      { dmg: 21, cd: 0.6, count: 3, pierce: 1, speed: 600, text: 'Fires 3 sparks. More damage.' },
      { dmg: 28, cd: 0.48, count: 4, pierce: 2, speed: 640, text: 'Fires 4 sparks, faster, piercing 2.' },
    ],
  },
  gears: {
    id: 'gears', name: 'Orbit Gears', kind: 'orbit', color: '#FFC93C',
    levels: [
      { dmg: 9, count: 2, radius: 62, size: 14, rot: 2.9, tick: 0.5, kb: 110, text: 'Two cogs circle you and grind what they touch.' },
      { dmg: 11, count: 3, radius: 66, size: 14, rot: 3.0, tick: 0.5, kb: 110, text: 'A third cog.' },
      { dmg: 15, count: 3, radius: 76, size: 16, rot: 3.3, tick: 0.45, kb: 130, text: 'Bigger, faster, wider orbit.' },
      { dmg: 20, count: 4, radius: 84, size: 17, rot: 3.5, tick: 0.45, kb: 130, text: 'A fourth cog. More damage.' },
      { dmg: 28, count: 5, radius: 96, size: 19, rot: 3.9, tick: 0.4, kb: 150, text: 'Five big cogs. A proper grinder.' },
    ],
  },
  wrench: {
    id: 'wrench', name: 'Wrench-a-rang', kind: 'boomerang', color: '#FF5B2E',
    levels: [
      { dmg: 16, cd: 1.7, count: 1, speed: 460, out: 0.5, size: 16, text: 'Thrown, comes back, hits everything both ways.' },
      { dmg: 22, cd: 1.6, count: 1, speed: 480, out: 0.55, size: 17, text: 'More damage, flies further.' },
      { dmg: 27, cd: 1.6, count: 2, speed: 480, out: 0.55, size: 17, text: 'Throws 2 wrenches.' },
      { dmg: 36, cd: 1.4, count: 2, speed: 510, out: 0.6, size: 20, text: 'Bigger wrenches, thrown more often.' },
      { dmg: 48, cd: 1.2, count: 3, speed: 540, out: 0.62, size: 23, text: 'Throws 3 huge wrenches.' },
    ],
  },
  chain: {
    id: 'chain', name: 'Chain Lightning', kind: 'chain', color: '#5B5BFF',
    levels: [
      { dmg: 14, cd: 1.3, jumps: 4, range: 250, jump: 130, text: 'A bolt that jumps between 4 Matchers.' },
      { dmg: 17, cd: 1.25, jumps: 5, range: 260, jump: 135, text: 'Jumps 5 times. More damage.' },
      { dmg: 21, cd: 1.1, jumps: 6, range: 270, jump: 145, text: 'Jumps 6 times, strikes more often.' },
      { dmg: 27, cd: 1.0, jumps: 8, range: 280, jump: 155, text: 'Jumps 8 times. More damage.' },
      { dmg: 36, cd: 0.8, jumps: 12, range: 300, jump: 170, text: 'Jumps 12 times. The whole crowd lights up.' },
    ],
  },
  beam: {
    id: 'beam', name: 'Odd Eye Beam', kind: 'beam', color: '#FF5B2E', needs: 'foreman',
    levels: [
      { dmg: 7, cd: 3.6, dur: 1.1, sweep: 1.9, len: 240, width: 16, tick: 0.14, text: 'Your big eye sweeps a laser across the crowd.' },
      { dmg: 9, cd: 3.4, dur: 1.2, sweep: 2.3, len: 260, width: 17, tick: 0.14, text: 'Longer beam, wider sweep.' },
      { dmg: 11, cd: 3.1, dur: 1.3, sweep: 2.9, len: 280, width: 19, tick: 0.13, text: 'More damage, wider sweep.' },
      { dmg: 14, cd: 2.8, dur: 1.5, sweep: 4.0, len: 300, width: 21, tick: 0.12, text: 'Sweeps most of the way round.' },
      { dmg: 18, cd: 2.4, dur: 1.7, sweep: 6.28, len: 330, width: 24, tick: 0.11, text: 'A full turn of pure stare.' },
    ],
  },
  mines: {
    id: 'mines', name: 'Bolt Mines', kind: 'mine', color: '#FF8FC7',
    levels: [
      { dmg: 20, cd: 1.7, count: 1, blast: 62, life: 14, text: 'Drops mines behind you. Matchers do not look down.' },
      { dmg: 26, cd: 1.6, count: 1, blast: 70, life: 14, text: 'Bigger blast, more damage.' },
      { dmg: 32, cd: 1.5, count: 2, blast: 74, life: 14, text: 'Drops 2 mines at a time.' },
      { dmg: 38, cd: 1.3, count: 2, blast: 86, life: 14, text: 'Bigger blast, dropped more often.' },
      { dmg: 46, cd: 1.1, count: 3, blast: 96, life: 14, text: 'Drops 3 huge mines.' },
    ],
  },
  pulse: {
    id: 'pulse', name: 'Magnet Pulse', kind: 'nova', color: '#2FD6A3',
    levels: [
      { dmg: 9, cd: 3.0, radius: 110, kb: 330, text: 'A shove in every direction. Buys you room.' },
      { dmg: 13, cd: 2.8, radius: 125, kb: 360, text: 'Wider, harder shove.' },
      { dmg: 17, cd: 2.5, radius: 140, kb: 390, text: 'Pulses more often.' },
      { dmg: 23, cd: 2.2, radius: 160, kb: 420, text: 'Wider. More damage.' },
      { dmg: 32, cd: 1.8, radius: 185, kb: 460, text: 'A huge pulse, nearly twice as often as at first.' },
    ],
  },
  oil: {
    id: 'oil', name: 'Hot Oil', kind: 'pool', color: '#B48CFF', needs: 'five',
    levels: [
      { dmg: 5, cd: 3.4, count: 1, radius: 58, life: 3.5, tick: 0.35, slow: 0.5, text: 'Lobs a puddle that slows and burns.' },
      { dmg: 7, cd: 3.2, count: 1, radius: 66, life: 4.0, tick: 0.35, slow: 0.5, text: 'Bigger puddle that lasts longer.' },
      { dmg: 8, cd: 3.0, count: 2, radius: 68, life: 4.0, tick: 0.32, slow: 0.45, text: 'Lobs 2 puddles.' },
      { dmg: 11, cd: 2.7, count: 2, radius: 78, life: 4.5, tick: 0.3, slow: 0.4, text: 'Bigger, hotter, stickier.' },
      { dmg: 14, cd: 2.3, count: 3, radius: 88, life: 5.0, tick: 0.28, slow: 0.35, text: 'Lobs 3 big puddles.' },
    ],
  },
}

// Passives add `per` to a stat for every level. Stats are listed in ../stats.js (BASE_STATS).
// mode 'add' adds, mode 'mul' adds to a multiplier (so 0.1 = +10%).
export const PASSIVES = {
  springs: { id: 'springs', name: 'Springy Treads', stat: 'speed', per: 0.08, max: 5, color: '#2FD6A3', text: '+8% move speed.' },
  plating: { id: 'plating', name: 'Spare Plating', stat: 'maxHp', per: 0.18, max: 5, color: '#FF8FC7', text: '+18% max HP, and patches you up a little.' },
  solder: { id: 'solder', name: 'Self-Solder', stat: 'regen', per: 0.45, max: 5, color: '#FF8FC7', text: 'Repair +0.45 HP every second.' },
  magnet: { id: 'magnet', name: 'Fridge Magnet', stat: 'pickup', per: 0.3, max: 5, color: '#5B5BFF', text: '+30% pickup range.' },
  clock: { id: 'clock', name: 'Overclock', stat: 'cooldown', per: -0.07, max: 5, color: '#FFC93C', text: 'Weapons fire 7% more often.' },
  cell: { id: 'cell', name: 'Power Cell', stat: 'damage', per: 0.1, max: 5, color: '#FF5B2E', text: '+10% damage.' },
  spares: { id: 'spares', name: 'Spare Parts', stat: 'amount', per: 1, max: 2, color: '#FFC93C', text: '+1 projectile for every weapon.' },
  lens: { id: 'lens', name: 'Wide Lens', stat: 'area', per: 0.1, max: 5, color: '#2FD6A3', text: '+10% area and size for every weapon.' },
  armour: { id: 'armour', name: 'Dented Armour', stat: 'armour', per: 1, max: 5, color: '#A79DB5', text: 'Every hit hurts 1 less.' },
  luck: { id: 'luck', name: 'Lucky Nut', stat: 'luck', per: 1, max: 5, color: '#FFC93C', text: 'More drops, and sometimes a 4th upgrade card.' },
}
