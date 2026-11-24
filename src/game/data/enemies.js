// Enemy table. Pure data. `ai` picks the behaviour in ../enemies.js; `look` picks the accent drawn in ../../render.js.
// Every Matcher shares the same body and the same two square eyes: types differ by size, accent and silhouette only.
// hp and dmg are base values; the director scales them over time (see timeline.js hpScale / dmgScale).

export const ENEMIES = {
  walker: { id: 'walker', name: 'Matcher', ai: 'chase', look: 'plain', hp: 10, speed: 66, r: 13, dmg: 10, xp: 1 },
  runner: { id: 'runner', name: 'Hurrier', ai: 'chase', look: 'runner', hp: 7, speed: 112, r: 10, dmg: 6, xp: 1, weave: 0.5 },
  tank: { id: 'tank', name: 'Big Box', ai: 'chase', look: 'tank', hp: 85, speed: 40, r: 22, dmg: 16, xp: 8, kbResist: 0.7 },
  splitter: { id: 'splitter', name: 'Multipack', ai: 'chase', look: 'splitter', hp: 30, speed: 56, r: 17, dmg: 10, xp: 3, split: { type: 'mini', n: 3 } },
  mini: { id: 'mini', name: 'Single', ai: 'chase', look: 'plain', hp: 5, speed: 96, r: 8, dmg: 5, xp: 1 },
  shooter: { id: 'shooter', name: 'Stamper', ai: 'shoot', look: 'shooter', hp: 20, speed: 56, r: 13, dmg: 8, xp: 3, range: 250, shotCd: 3.4, shotSpeed: 108, shotDmg: 10, shotR: 8 },
  charger: { id: 'charger', name: 'Rammer', ai: 'charge', look: 'charger', hp: 34, speed: 60, r: 15, dmg: 14, xp: 4, kbResist: 0.3, dashSpeed: 420, dashRange: 230, tele: 0.75, dash: 0.55, rest: 1.0, dashCd: 2.4 },
  swarm: { id: 'swarm', name: 'Copy', ai: 'drift', look: 'swarm', hp: 6, speed: 135, r: 9, dmg: 6, xp: 1 },

  // Bosses. `patterns` is the attack cycle; each pattern is telegraphed (see bossAI in ../enemies.js).
  foreman: {
    id: 'foreman', name: 'The Foreman', boss: true, ai: 'boss', look: 'foreman', hp: 1400, speed: 46, r: 38, dmg: 18, xp: 60, kbResist: 0.95,
    patterns: ['charge', 'ring', 'charge', 'summon'], patternCd: 2.6, dashSpeed: 470, shotSpeed: 120, shotDmg: 12, ringN: 14, scrap: 15,
  },
  auditor: {
    id: 'auditor', name: 'The Auditor', boss: true, ai: 'boss', look: 'auditor', hp: 5200, speed: 52, r: 42, dmg: 22, xp: 150, kbResist: 0.95,
    patterns: ['spread', 'slam', 'ring', 'summon', 'charge'], patternCd: 2.2, dashSpeed: 500, shotSpeed: 135, shotDmg: 14, ringN: 18, scrap: 25,
  },
  template: {
    id: 'template', name: 'The Template', boss: true, ai: 'boss', look: 'template', hp: 15000, speed: 50, r: 54, dmg: 28, xp: 300, kbResist: 1,
    patterns: ['slam', 'spiral', 'charge', 'summon', 'ring', 'spread'], patternCd: 1.8, dashSpeed: 520, shotSpeed: 140, shotDmg: 16, ringN: 22, scrap: 60,
  },
}

// Elite variants: any non-boss type, scaled up. They drop a treasure crate.
export const ELITE = { hp: 9, size: 1.4, dmg: 1.4, speed: 1.08, xp: 12, scrap: 3 }
