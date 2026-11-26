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
- `kit/talk.js` (hub copy, do not edit): `main.js` calls `tellUs` once for the `#tell-us` card under the stage (anonymous thumbs and one-tap notes; hidden when the API is unreachable). No daily, so no `dailyTalk`.
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

## Balance notes (v1.1.0)

v1.1.0 rebalanced weapons and Lucky Nut, made bosses size you up, and reshaped endless mode. Measured before and after on the same seeds (`1000 + i * 7`, the seeds `tools/balance.mjs` uses), 12 minute cap. Novice: 96 runs; good bots: 96 runs each. `node tools/balance.mjs 24 12` prints the same kind of numbers for 24 runs (a 24-run sample swings a lot: the good bot's median moved between 10:08 and 12:00 across samples).

| Bot | Median survival (before → after) | Beat the Template | Template fight, wins only: median (range) | Fight length incl. unfinished, p25 / median / p75 |
| --- | --- | --- | --- | --- |
| novice, no workshop | 2:53 → 2:50 (p25 2:08 → 1:54, p75 4:01 → 3:54) | 0 → 0 of 96 | n/a | n/a |
| good, no workshop | 10:42 → 10:08 | 20 → 20 of 96 (reached it: 59 → 50) | 64 s (47-103) → 72 s (29-115) | 66 / 132 / 224 s → 70 / 101 / 167 s |
| good, full workshop | 12:00 (cap) → 12:00 | 56 → 72 of 96 | 61 s (29-120) → 72 s (32-117) | 51 / 107 / 183 s → 58 / 85 / 122 s |

"Fight length incl. unfinished" is the kill time for wins, and the Template's HP divided by the damage per second it was taking for runs that died or hit the cap. The p75/p25 spread went from 3.4-3.6 to 2.1-2.4.

Weapon share of its run's damage when held (good bot, no workshop / full workshop), before → after. An even share with 4 weapons would be 25%:

| Weapon | Before | After |
| --- | --- | --- |
| Hot Oil | 43% / 40% | 33% / 28% |
| Bolt Mines | 42% / 43% | 30% / 29% |
| Spark (always held) | 25% / 30% | 25% / 29% |
| Odd Eye Beam | 26% / 26% | 24% / 25% |
| Chain Lightning | 23% / 25% | 23% / 27% |
| Wrench-a-rang | 19% / 13% | 23% / 17% |
| Magnet Pulse | 12% / 13% | 20% / 20% |
| Orbit Gears | 8% / 6% | 20% / 19% |

Pick rates (share of runs holding each weapon) did not change in any meaningful way (gears 40-44%, mines 40-44%, oil 40-55%): the good bot rates every weapon card the same, so pick rate is set by the offer weights, not by weapon strength.

Lucky Nut: forcing a part whenever offered (good bot, no workshop, 48 runs, before) gave Lucky Nut 8:09 median survival (others 7:31 to 11:09) and the lowest damage per second at 9-10 minutes of any part. It now does `LUCK` in `data/weapons.js`: drops x1.4 per level (was x1.25), 0.02% per level chance per ordinary Matcher of a crate, 18% per level chance of a 4th card (was 12%). Springy Treads (7:31) and Dented Armour (7:43) were as weak in that test and were not changed. The good bot itself almost never picks Lucky Nut (its weight in `bot.js` is the lowest), so normal bot runs barely see it.

How bosses size you up (`POWER` in `data/timeline.js`, `sizeUp` in `director.js`): the director keeps a 30 s running average of your damage per second (`s.dealt`). The Template arrives with HP x (dps / 12000), clamped to 0.7-1.3. Once it is hurt or within 320 units, it watches the damage it takes for 20 s, then rescales its HP once (by 0.5-1.25, keeping the bar's fraction) aiming at a 65 s fight, and the total is kept within 0.4-1.6 x 15,000. Its pattern cooldown is multiplied by HPmul^-0.3 (0.85-1.15). Why a calibration window: crowd damage per second only loosely predicts damage on the boss (correlation 0.35-0.65, depending on the weapon mix), level even less (0.1-0.5), and damage to elites no better. What decides boss damage is mostly the weapon mix (Bolt Mines builds hit the Template about twice as hard as Gears/Pulse builds, because the bot runs from bosses and short-range weapons can't reach) and how the fight goes, which only the fight itself shows.

Endless (`ENDLESS`, `ENDLESS_WAVES` in `data/timeline.js`, `runEndless` in `director.js`): themed spawn mixes take turns every 45 s with a banner, elite packs every 40 s (2 growing to 6), an old boss every 120 s with 12,000 base HP x (1 + 0.35 per reprise so far), sized up like the Template. Spawn rate in endless now grows 1/420 per second (was 1/240). Before, the third reprise was a 108,000 HP Template. Full-workshop good bot with a 22 minute cap: beat the Template 45 → 48 of 48; died in endless 19 → 30 of 48, at 18-602 s (median 278 s) after the win before and 94-548 s (median 385 s) after. More runs end in endless now, but later and spread out, rather than at a wall of numbers. Endless has had no human play.

- Targets: a new player lasts 2 to 4 minutes; a decent build feels strong by minute 6 (about level 20 to 24); the last two minutes have 300 to 500 Matchers alive. Typical level at 10:00 is 38 to 45, which is close to a full build (4 weapons x 5 levels + 5 parts).
- The bots are not people. The good bot dodges better than a human and runs from bosses (so it often fails to finish the Template in time); the novice bot picks cards at random. Use them to compare before/after, not as truth.
- Knobs, in order of usefulness: `hpScale` (how tanky the crowd is over time), phase `rate` (how many), enemy `speed` (how hard it is to kite; walkers are 43% of Odd's speed, runners 74%), `xpNeed` (levelling pace).
- In a dense crowd, area weapons (mines, oil, gears, pulse) out-damage single-target ones several times over; Spark and Chain make up for it with range. Bolt Mines was the strongest weapon in v1.0.0 because the crowd (and bosses) walk over them; Hot Oil was just as strong. Both were cut in v1.1.0 and are still the top two by a few points. Melee weapons (gears, pulse) look strong in `tools/dps.mjs` (Odd stands in the crowd) but weak in bot runs (the bot keeps its distance): judge weapons by damage share in `tools/balance.mjs`, not by the bench alone.
- The novice bot's survival is set mostly by weapon levels 1 and 2 (it averages about weapon level 2 when it dies). A first pass that buffed gears, pulse and wrench at levels 1-2 pushed the novice median from 2:53 to 3:23, so those buffs only start at level 3.
- Scrap: time/6 + pickups + elites + bosses (+40 for a win), times the Nose for Scrap bonus. A 3 minute run pays about 40 to 60 (novice bot average: 56 a run), a win 400 to 700. The whole workshop costs about 5,700, loadouts 380.
- Player hits: 0.5 s of invulnerability after any hit, so damage per second is capped by the hardest hitter, not the crowd size. Contact damage is what kills new players; shots and slams are what kill good ones.

## Known weak spots

- Not yet played by a human hand at full speed during development (the test browser was throttled); feel was tuned from bot runs, timing maths and screenshots. Real play-testing feedback is the most valuable input for the next update.
- No music, only effects.
- The Template fight still varies (bots: about 30 to 120 s) because the good bot runs from bosses and short-range builds barely reach it; sizing narrowed the spread but cannot fix that. A player could in theory run away for the 20 s sizing window to get a smaller Template (it is clamped, so the gain is limited).
- Hot Oil and Bolt Mines still lead damage share (28-33% when held); Wrench-a-rang is the weakest with a full workshop (17%). Springy Treads and Dented Armour test as weak as Lucky Nut did.
- Endless mode's new waves, packs and reprises are tuned from bot runs only.
- Full screen on phones in landscape is cramped (overlays scroll).

## Phones and full screen (1.3.0)

- The kit's `wireChrome` gives full screen everywhere (native, or the iPhone "focus" fallback; both add `.stage.is-full`). In full screen `game.css` insets `.ui` by the safe areas like the kit insets the canvas, moves the kit's exit button down beside the pause button (top: 22px) and shifts `.hud-row` left 68px. Overlays get 70px top padding (portrait) or 60px side padding (short stage) so nothing sits under the exit button.
- `main.js` pauses the run when full screen ends (`oddvale:fullscreen` with `on: false`), deferred one tick so Esc in focus mode doesn't pause and then un-pause.
- Touch targets: 44px on `(pointer: coarse)` for pause, loadout chips, toggles and buttons. "Give up" needs two taps. Level-up cards still ignore clicks for 280 ms after opening (`settled()` in `ui.js`).
- `audio.js` fires a kit `haptic()` with a few sounds (`HAPTIC` table). `input.js` treats `lostpointercapture` like `pointerup`.
- `game.css` sizes the injected "Play full screen" button's icon (kit workaround: the kit's `.stage-cta svg` has no size yet).

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
