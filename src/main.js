// Odd One Out: entry point. Owns the frame loop and glues the pieces together:
//   game/sim.js (rules, no DOM)  ->  render.js (canvas)  +  ui.js (DOM menus and HUD)  +  audio.js  +  input.js
import { makeStore, wireChrome } from '../kit/kit.js'
import { tellUs } from '../kit/talk.js'
import { createRun, step, chooseOffer, rerollOffers, closeCrate, keepGoing, summarize, debug as simDebug } from './game/sim.js'
import { normalizeSave, defaultSave, applyRun, buyWorkshop, buyCharacter, unlockedWeapons } from './game/save.js'
import { applyOffer } from './game/upgrades.js'
import { makeRenderer } from './render.js'
import { makeInput } from './input.js'
import { makeUI } from './ui.js'
import { play, playEvents } from './audio.js'

const stage = document.getElementById('stage')
const canvas = document.getElementById('game')
wireChrome({ stage })
tellUs(document.getElementById('tell-us'), { game: 'odd-one-out', issueUrl: 'https://github.com/JohnGarrisonDev/odd-one-out/issues/new?template=feedback.yml' })

// ---- save data (one JSON blob in localStorage, see game/save.js for the shape)
const store = makeStore('odd-one-out', {})
let save = normalizeSave(store.data)
const persist = () => { for (const k of Object.keys(store.data)) delete store.data[k]; store.set(save) }
persist()

const renderer = makeRenderer(canvas)
const input = makeInput(canvas)
let run = null // the current run state, or null on the menus
let paused = false, banked = false, overShown = false
let speed = 1, bot = null // debug only

const ui = makeUI(stage, renderer, {
  play: () => { play('ui'); startRun() },
  workshop: () => { play('ui'); endToMenu(); ui.showWorkshop(save) },
  records: () => { play('ui'); ui.showRecords(save) },
  title: () => { play('ui'); endToMenu(); ui.showTitle(save) },
  pickChar: (id, inShop) => { if (!save.chars.includes(id)) return; save.char = id; persist(); play('ui'); inShop ? ui.showWorkshop(save, true) : ui.showTitle(save) },
  buy: (id) => { if (buyWorkshop(save, id)) { persist(); play('buy') } else play('nope'); ui.showWorkshop(save, true) },
  buyChar: (id) => { if (buyCharacter(save, id)) { persist(); play('buy') } else play('nope'); ui.showWorkshop(save, true) },
  choose: (i) => { if (run && chooseOffer(run, i)) { play('ui'); afterModal() } },
  reroll: () => { if (run && rerollOffers(run)) { play('ui'); ui.showLevelUp(run) } },
  closeCrate: () => { if (run && closeCrate(run)) afterModal() },
  pause: () => setPaused(true),
  resume: () => setPaused(false),
  giveUp: () => { if (run) { paused = false; finishRun() } },
  keepGoing: () => { if (run && keepGoing(run)) { ui.show(null); input.active = true } },
  endRun: () => finishRun(),
  setting: (key, value) => { save.settings[key] = value; persist() },
  resetSave: () => { save = defaultSave(); persist(); ui.showTitle(save) },
})

function resize() {
  const v = renderer.resize()
  if (run) { run.view.w = v.w; run.view.h = v.h }
}
new ResizeObserver(resize).observe(stage)
resize()

function startRun() {
  const v = renderer.view
  run = createRun({ seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, char: save.char, workshop: { ...save.workshop }, allowedWeapons: unlockedWeapons(save), view: { w: v.w, h: v.h } })
  paused = false; banked = false; overShown = false
  input.reset(); input.active = true
  ui.show(null); ui.showHud(true)
}
function endToMenu() { run = null; paused = false; input.active = false; input.reset(); ui.showHud(false) }

/** After a level-up or crate closes: the sim may have queued another one straight away. */
function afterModal() {
  if (run.mode === 'levelup') ui.showLevelUp(run)
  else if (run.mode === 'crate') ui.showCrate(run)
  else { ui.show(null); input.reset(); input.active = true }
}
function setPaused(v) {
  if (!run || run.mode !== 'play' || paused === v) return
  paused = v
  input.reset(); input.active = !v
  if (v) ui.showPause(run, save); else ui.show(null)
  play('ui')
}
/** Bank the run into the save file and show the summary. Safe to call twice. */
function finishRun() {
  if (!run || banked) return
  banked = true
  const sum = summarize(run)
  const result = applyRun(save, sum)
  persist()
  input.active = false; input.reset()
  ui.showHud(false)
  ui.showOver(sum, result, save)
  overShown = true
}

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && run && run.mode === 'play' && !banked) { setPaused(!paused); e.preventDefault() }
})
// Rule 7: never let anyone die in a background tab.
document.addEventListener('visibilitychange', () => { if (document.hidden && run && run.mode === 'play' && !paused) setPaused(true) })

let lastT = performance.now(), clock = 0
function frame(now) {
  requestAnimationFrame(frame)
  let dt = (now - lastT) / 1000
  lastT = now
  if (dt > 0.1) dt = 0.1 // tab was away, or a long hitch: don't fast-forward
  clock += dt
  if (run) {
    if (!paused) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 30))) * speed
      const sdt = speed > 1 ? 1 / 60 : dt / steps
      for (let i = 0; i < steps; i++) {
        if (bot) bot(run)
        else { const v = input.update(); run.input.x = v.x; run.input.y = v.y }
        const before = run.mode
        step(run, sdt)
        if (run.mode !== before) {
          if (run.mode === 'levelup') { input.active = false; input.reset(); if (!bot) ui.showLevelUp(run) }
          else if (run.mode === 'crate') { input.active = false; input.reset(); if (!bot) ui.showCrate(run) }
          else if (run.mode === 'won') { input.active = false; input.reset(); ui.showHud(true); ui.showWin(run, summarize(run)) }
          if (run.mode !== 'play' && run.mode !== 'dead') break
        }
      }
      playEvents(run.events)
      if (run.mode === 'dead' && run.deadT > 1.1 && !overShown) finishRun()
    }
    renderer.draw(run, { time: clock, numbers: save.settings.damageNumbers, shake: save.settings.shake, stick: input.stick })
    if (!banked) ui.updateHud(run)
  } else {
    renderer.drawTitle(clock, save.char)
  }
}

ui.showTitle(save)
requestAnimationFrame(frame)

// ---- debug hook: only with ?debug in the URL. Lets tests and AIs drive the game from the console.
if (new URLSearchParams(location.search).has('debug')) {
  import('./game/bot.js').then(({ makeBot }) => {
    window.__game = {
      get run() { return run }, get save() { return save }, ui, renderer, input, sim: simDebug,
      start: startRun,
      /** Let a bot play: 'good', 'novice', or null for manual control. */
      auto(skill) { bot = skill ? makeBot(skill, Date.now() & 0xffff) : null; if (!bot && run && run.mode === 'play') input.active = true },
      /** Fast-forward: run `seconds` of simulation right now (bot or current input), without waiting for frames. */
      tick(seconds) { for (let i = 0; i < seconds * 60 && run; i++) { if (bot) bot(run); step(run, 1 / 60); run.events.length = 0 } return run && { t: run.t, mode: run.mode, level: run.level, enemies: run.enemies.length, hp: run.player.hp } },
      /** Run the simulation n times faster. */
      speed(n) { speed = Math.max(1, n | 0) },
      give(type, id) { return run && applyOffer(run, { type, id }) },
      scrap(n) { save.scrap += n; persist() },
      finish: finishRun,
    }
  })
}
