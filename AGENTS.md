# Notes for the next AI

Read the hub's `GAME_GUIDE.md` first: it is the contract (no build step, no dependencies, relative URLs, localStorage only, strict CSP, phone + desktop). This file is about this game.

## What the game is

Top-down arena survival auto-shooter. Odd (the player) only moves. Weapons fire on their own. Matchers drop bolts (XP); a level-up pauses the run and offers 3 cards. Bosses at 3:20 and 6:40, The Template at 10:00; beating it wins and offers endless mode. Runs pay scrap, spent in the workshop on permanent upgrades and loadouts.

Fiction rule that the art depends on: **every Matcher is the same grey-blue box with two identical square eyes.** Types differ only by size, a colour accent and a silhouette detail. Odd is the only thing with mismatched eyes (`drawOddFace` from the kit). Keep it that way.

## Architecture

```
main.js  --owns-->  run state (plain object from game/sim.js createRun)
   |  each frame:  input -> run.input,  step(run, dt),  play run.events,  render,  update HUD
   |-- render.js   reads the state, draws the canvas. Never changes state.
   |-- ui.js       DOM overlays + HUD. Calls back into main.js (the `on` object), which calls sim functions.
   |-- audio.js    sim pushes event names into run.events; audio maps them to kit sfx with a rate limit.
   '-- input.js    keyboard + floating stick -> one vector.
```

- **The simulation (`src/game/`) has no DOM access** and runs in node. Keep it that way: tests and balance tools depend on it. `kit/kit.js` touches `window` on import, so nothing under `src/game/` may import it (that is why `util.js` has its own copy of the RNG).
- `step(run, dt)` only advances in mode `'play'`. Modes: `play`, `levelup`, `crate`, `won`, `dead`. The UI resolves the modal modes by calling `chooseOffer`, `closeCrate`, `keepGoing`. "Paused" is not a sim mode: main.js just stops calling `step`.
- dt is variable (main.js splits long frames into steps of at most 1/30 s; tests use 1/60). All sim code multiplies by dt.
- Randomness: `run.rng` for gameplay, `run.fxRng` for cosmetics. Same seed + same inputs = same run (there is a test).
- **Performance rules in the hot path** (everything called from `step`): no closures, no array/object creation, no `for...of` over big lists. Dead objects are swept once per step and recycled through `run.free.*`. Enemy lookups go through `run.grid` (`util.js`), rebuilt every step. `grid.query()` fills the shared `grid.out` array, so never nest two queries (finish reading one before starting the next). Caps live in `CAPS` in `combat.js`.
- Renderer: unchanging sprites are drawn once to off-screen canvases (`makeCanvas`, keyed in `sprites`) and stamped. The cache is rebuilt when the stage size changes. Hit flash uses a whitened copy of the sprite.
- World scale: the shorter side of the stage shows 620 world units (landscape) or 500 wide (portrait). `run.view` holds the visible size in world units; the director spawns just outside it.
- Save: one blob, `oddvale:odd-one-out`. Shape and migration in `game/save.js` (`normalizeSave` accepts anything). **Never break old saves**: add fields with defaults in `defaultSave` + `normalizeSave`, bump `SAVE_VERSION` only if you must transform old data, and add a test.

## Debug hook

Open `/?debug`. Then in the console:

```js
__game.start()             // start a run
__game.auto('good')        // bot plays ('novice' | 'good' | null)
__game.tick(120)           // run 120 s of simulation right now
__game.speed(8)            // 8x speed in real time
__game.give('weapon', 'beam'); __game.give('passive', 'luck')
__game.sim.spawnEnemy(__game.run, 'template', 100, 0)
__game.scrap(500)          // free scrap
__game.renderer.setZoom(2) // camera zoom, for looking at art
__game.run                 // the live state
```

## How to add things

**A weapon.** Add an entry to `WEAPONS` in `data/weapons.js` (5 levels, each with full stats and a `text` line for the card). If an existing `kind` fits (bolt, orbit, boomerang, chain, beam, mine, nova, pool), you are done apart from an icon: add a glyph to `GLYPHS` in `icons.js`. A new `kind` needs a function in `KINDS` in `game/weapons.js` and, if it draws something new, a few lines in `render.js` (`drawWeapons` / `drawShots` / `drawGround`). Apply `s.stats.cooldown`, `.area`, `.amount` in the kind; `.damage` is applied inside `hurtEnemy`. Optional `needs: '<achievement id>'` locks it. Then run `node tools/dps.mjs` and compare with the others.

**A part (passive).** One line in `PASSIVES` (`stat`, `per`, `max`) and a glyph. If it is a new stat, add it to `BASE_STATS` (and `MUL` if it is a multiplier) in `stats.js` and read it where it matters.

**An enemy.** Add to `ENEMIES` in `data/enemies.js`, pick an existing `ai` (`chase`, `shoot`, `charge`, `drift`) or add a case in `updateEnemies` in `game/enemies.js`. Give it a `look` and draw its accent in `drawMatcher` in `render.js` (same body, same eyes!). Put it in a phase `mix` in `data/timeline.js` to make it appear.

**A boss.** Same table, `boss: true`, `ai: 'boss'`, and a `patterns` list from: `charge`, `ring`, `spread`, `spiral`, `slam`, `summon`. New patterns go in `bossAI`. Every pattern must have a wind-up the player can read. Add it to `EVENTS` (or `ENDLESS_BOSSES`).

**A wave or set piece.** `PHASES` and `EVENTS` in `data/timeline.js`. Event kinds: `elite`, `ring`, `line`, `boss`; new kinds go in `runDirector`.

**A workshop upgrade, loadout or achievement.** `data/meta.js`. Workshop entries work like passives. Achievements get the run summary from `summarize()`.

**A sound.** `SOUNDS` in `audio.js`, then `emit(s, 'name')` in the sim.

After any change: `node --test tests/`, then play it (desktop and phone width, console open).

## Balance notes (v1.0.0)

Measured with `node tools/balance.mjs 24 12` (bots, 12 minute cap):

| Bot | Median survival | Range | Beat the Template |
| --- | --- | --- | --- |
| novice, no workshop | 2:53 | 1:27 to 6:58 | 0 of 24 |
| good, no workshop | 11:36 | 6:00 to 12:00+ | 8 of 24 |
| good, full workshop | 12:00+ (cap) | all reached the Template | 17 of 24 |

- Targets: a new player lasts 2 to 4 minutes; a decent build feels strong by minute 6 (about level 20 to 24); the last two minutes have 300 to 500 Matchers alive. Typical level at 10:00 is 38 to 45, which is close to a full build (4 weapons x 5 levels + 5 parts).
- The bots are not people. The good bot dodges better than a human and runs from bosses (so it often fails to finish the Template in time); the novice bot picks cards at random. Use them to compare before/after, not as truth.
- Knobs, in order of usefulness: `hpScale` (how tanky the crowd is over time), phase `rate` (how many), enemy `speed` (how hard it is to kite; walkers are 43% of Odd's speed, runners 74%), `xpNeed` (levelling pace).
- In a dense crowd, area weapons (mines, oil, gears, pulse) out-damage single-target ones several times over; Spark and Chain make up for it with range and boss damage. Bolt Mines is the strongest weapon in bot runs because the crowd walks over them. Watch it.
- Scrap: time/6 + pickups + elites + bosses (+40 for a win), times the Nose for Scrap bonus. A 3 minute run pays about 40 to 60 (novice bot average: 56 a run), a win 400 to 700. The whole workshop costs about 5,700, loadouts 380.
- Player hits: 0.5 s of invulnerability after any hit, so damage per second is capped by the hardest hitter, not the crowd size. Contact damage is what kills new players; shots and slams are what kill good ones.

## Known weak spots

- Not yet played by a human hand at full speed during development (the test browser was throttled); feel was tuned from bot runs, timing maths and screenshots. Real play-testing feedback is the most valuable input for the next update.
- No music, only effects.
- Endless mode scales by simple multipliers and gets unfair rather than interesting after a few minutes.
- The Template fight is short for strong builds and long for weak ones (its HP does not scale with your damage).
- Luck is a weak pick; Bolt Mines is a strong one.
- Full screen on phones in landscape is cramped (overlays scroll).

## Backlog (ideas for future updates)

- Weapon evolutions: a maxed weapon + a specific maxed part becomes a new weapon (data: `evolvesWith`, `evolvesTo`).
- A daily run: fixed seed from the date (`hashString` + `makeRng` in the kit), fixed loadout, its own best time.
- More bosses with new patterns (rotating laser walls, a boss that copies your weapons: very on theme).
- Floor variety: zones with different floor patterns, a few solid obstacles, breakable crates lying around.
- A music loop built from `sfx.tune`, with layers that come in as the crowd grows.
- An "Oddities" codex page: every Matcher type and weapon you have met.
- More loadouts with real twists (one that cannot stop moving, one whose weapons aim where it walks).
- Curses: optional run modifiers that pay more scrap.
- Banish / skip buttons on the level-up screen as workshop upgrades.
- Controller support.
