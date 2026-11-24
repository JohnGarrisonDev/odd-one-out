# Odd One Out

An arcade survival game for [Oddvale Games](https://games.oddvale.com/odd-one-out/). You are Odd, the one mismatched robot in the vale. The Matchers, an endless crowd of identical grey-blue box robots, want everything to match, starting with you. You only steer; your gadgets fire on their own. Stay odd for 10 minutes, break The Template, and spend the scrap you earn on permanent upgrades.

Designed, built and updated by AI models. No build step, no dependencies, no network requests.

## Play it locally

Any static file server works. From the Oddvale hub repo:

```
node scripts/serve.mjs ../odd-one-out 4301
```

then open http://127.0.0.1:4301/ (opening `index.html` straight from disk will not work: ES modules need a server).

Add `?debug` to the URL for a console hook, `window.__game` (start a run, let a bot play, fast-forward, spawn things). See `AGENTS.md`.

## Controls

- Move: `WASD` or arrow keys, or drag anywhere on the game (touch or mouse) for a floating stick.
- Upgrades: `1` `2` `3` (`4` when a lucky fourth card shows up), click, or tap. `R` rerolls if you bought rerolls.
- Pause: `Esc` or `P`, or the button in the corner. The game also pauses when the tab is hidden.

## Tests

```
node --test tests/
```

22 tests: upgrade offers, save data, the wave timeline, and headless full-length runs played by bots (no NaN, no exceptions, difficulty ramps, win and endless flows).

Two hand tools for balance work:

```
node tools/balance.mjs [runs] [minutes]   # bots play many runs; prints survival times, levels, damage per weapon
node tools/dps.mjs [startSecond]          # each weapon alone against the crowd at a given minute
```

## Layout

```
index.html            the page (from the hub's kit/template.html)
game.json             metadata the hub reads
cover.webp            cover art
kit/                  copy of the hub kit (do not edit; re-copy from the hub to update)
src/main.js           entry: frame loop, glue, save, debug hook
src/render.js         canvas renderer (all art is drawn in code)
src/icons.js          weapon / part icons
src/ui.js             DOM menus and HUD inside the stage
src/game.css          styles for the HUD and menus
src/input.js          keyboard + floating stick
src/audio.js          event name -> synth sound, rate limited
src/game/             the simulation. No DOM, runs in node.
  sim.js              run state, step(), player, pickups, level-ups, summary
  combat.js           spawn / hurt / kill, pickups, effects, enemy shots
  enemies.js          enemy AIs, boss patterns, crowd separation
  weapons.js          weapon behaviours (one function per kind)
  director.js         spawns from the timeline
  upgrades.js         level-up offers
  stats.js            player stats from loadout + workshop + parts
  save.js             save shape, migration, buying, records, achievements
  bot.js              autoplayer for tests and balance runs
  util.js             seeded RNG, spatial grid
  data/weapons.js     weapon + part tables
  data/enemies.js     enemy + boss tables
  data/timeline.js    wave phases, events, difficulty curves, XP curve
  data/meta.js        workshop, loadouts, achievements
tests/                node --test
tools/                balance scripts (run by hand)
```

`package.json` exists only to mark the files as ES modules for node (tests and tools). The game itself needs nothing installed.

## License
Code is MIT licensed, see [LICENSE](LICENSE). The fonts in `kit/fonts/` (Fraunces, Figtree, DM Mono) are under the SIL Open Font License 1.1. The Oddvale name and mark are not covered by the MIT license.
