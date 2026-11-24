// DOM user interface inside the stage: HUD, title, level-up, crate, pause, game over, workshop, records.
// It only reads game state and calls the callbacks main.js gives it (`on.*`). Styles live in game.css.
import { WEAPONS, PASSIVES } from './game/data/weapons.js'
import { WORKSHOP, CHARACTERS, ACHIEVEMENTS } from './game/data/meta.js'
import { describeOffer } from './game/upgrades.js'
import { workshopCost } from './game/save.js'
import { RUN_LENGTH } from './game/data/timeline.js'

export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const fmtNum = (n) => Math.round(n).toLocaleString('en-US')
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild }
const pips = (lvl, max) => `<span class="pips" aria-label="level ${lvl} of ${max}">${'<i class="on"></i>'.repeat(lvl)}${'<i></i>'.repeat(Math.max(0, max - lvl))}</span>`
const SCRAP = '<span class="scrap-ico" aria-hidden="true"></span>'

export function makeUI(stage, renderer, on) {
  const root = el('<div class="ui"></div>')
  stage.appendChild(root)

  // ------------------------------------------------------------------ HUD
  const hud = el(`<div class="hud" hidden>
    <div class="xp" role="progressbar" aria-label="Experience"><i></i><span class="lv">LV 1</span></div>
    <div class="hud-row">
      <div class="hp" role="progressbar" aria-label="Health"><i></i><span></span></div>
      <div class="timer" aria-label="Time survived">0:00</div>
      <div class="hud-right"><span class="kills" title="Matchers broken"><b></b><em>0</em></span><button class="pause-btn" type="button" aria-label="Pause"><i></i><i></i></button></div>
    </div>
    <div class="bossbar" hidden><span></span><div><i></i></div></div>
    <div class="banner" hidden></div>
    <div class="build" aria-label="Your build"></div>
  </div>`)
  const lowhp = el('<div class="lowhp"></div>')
  root.append(lowhp, hud)
  const h = {
    xp: hud.querySelector('.xp i'), lv: hud.querySelector('.lv'), hp: hud.querySelector('.hp i'), hpText: hud.querySelector('.hp span'),
    timer: hud.querySelector('.timer'), kills: hud.querySelector('.kills em'), boss: hud.querySelector('.bossbar'), bossName: hud.querySelector('.bossbar span'),
    bossFill: hud.querySelector('.bossbar i'), banner: hud.querySelector('.banner'), build: hud.querySelector('.build'),
  }
  hud.querySelector('.pause-btn').addEventListener('click', () => on.pause())
  const last = {}
  const set = (key, value, fn) => { if (last[key] !== value) { last[key] = value; fn(value) } }

  function updateHud(s) {
    set('xp', Math.round((s.xp / s.xpNeed) * 200), (v) => { h.xp.style.width = v / 2 + '%' })
    set('lv', s.level, (v) => { h.lv.textContent = 'LV ' + v })
    const hp = Math.max(0, Math.ceil(s.player.hp)), max = s.stats.maxHp
    set('hp', hp + '/' + max, () => { h.hp.style.width = Math.min(100, (hp / max) * 100) + '%'; h.hpText.textContent = hp })
    set('low', hp > 0 && hp / max < 0.3, (v) => lowhp.classList.toggle('on', v))
    set('time', Math.floor(s.t), (v) => { h.timer.textContent = fmtTime(v); h.timer.classList.toggle('late', v >= RUN_LENGTH) })
    set('kills', s.kills, (v) => { h.kills.textContent = fmtNum(v) })
    const b = s.boss
    set('boss', b ? b.def.name : '', (v) => { h.boss.hidden = !v; h.bossName.textContent = v })
    if (b) set('bossHp', Math.round((b.hp / b.maxHp) * 200), (v) => { h.bossFill.style.width = Math.max(0, v / 2) + '%' })
    set('banner', s.bannerT > 0 ? s.banner : '', (v) => { h.banner.hidden = !v; h.banner.textContent = v })
    let sig = ''
    for (const w of s.weapons) sig += w.id + w.lvl
    for (const p of s.passives) sig += p.id + p.lvl
    set('build', sig, () => {
      h.build.textContent = ''
      const row = (items, defs, cls) => {
        const r = el(`<div class="build-row ${cls}"></div>`)
        for (const it of items) { const c = el(`<span class="slot" title="${defs[it.id].name} level ${it.lvl}"><b>${it.lvl}</b></span>`); c.prepend(renderer.iconCanvas(it.id, 26)); r.append(c) }
        h.build.append(r)
      }
      row(s.weapons, WEAPONS, 'w'); if (s.passives.length) row(s.passives, PASSIVES, 'p')
    })
  }
  function showHud(v) { hud.hidden = !v; if (!v) { lowhp.classList.remove('on'); for (const k in last) delete last[k] } }

  // ------------------------------------------------------------------ overlays
  const overlays = {}
  let current = null, shownAt = 0
  function overlay(name, cls = '') {
    const o = el(`<div class="ov ov-${name} ${cls}" hidden><div class="panel"></div></div>`)
    root.append(o); overlays[name] = o
    return o.firstElementChild
  }
  function show(name) {
    for (const k in overlays) overlays[k].hidden = k !== name
    current = name; shownAt = performance.now()
    if (name) {
      const o = overlays[name]; o.scrollTop = 0
      const first = o.querySelector('[data-focus]') || o.querySelector('button:not([disabled])')
      if (first) first.focus({ preventScroll: true })
    } else if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur()
  }
  // A just-opened overlay ignores clicks for a moment, so a stray tap in the heat of things can't pick a card.
  const settled = () => performance.now() - shownAt > 280
  const act = (fn) => (e) => { if (!settled()) return; fn(e) }
  const btn = (label, cls, fn, attrs = '') => { const b = el(`<button type="button" class="btn ${cls}" ${attrs}>${label}</button>`); b.addEventListener('click', act(fn)); return b }

  function buildList(s, withDamage) {
    const box = el('<div class="buildlist"></div>')
    const total = s.weapons.reduce((a, w) => a + (s.dmgBy?.[w.id] || w.dmg || 0), 0) || 1
    for (const w of s.weapons) {
      const def = WEAPONS[w.id], dmg = s.dmgBy ? s.dmgBy[w.id] || 0 : w.dmg || 0
      const r = el(`<div class="bl-row"><div class="bl-main"><b>${def.name}</b>${pips(w.lvl, def.levels.length)}</div>${withDamage ? `<div class="bl-dmg"><i style="width:${Math.round((dmg / total) * 100)}%"></i><span>${fmtNum(dmg)} dmg</span></div>` : ''}</div>`)
      r.prepend(renderer.iconCanvas(w.id, 30)); box.append(r)
    }
    if (s.passives.length) {
      const parts = el('<div class="bl-parts"></div>')
      for (const p of s.passives) { const c = el(`<span class="slot" title="${PASSIVES[p.id].name}"><b>${p.lvl}</b></span>`); c.prepend(renderer.iconCanvas(p.id, 26)); parts.append(c) }
      box.append(parts)
    }
    return box
  }

  // ---- title
  const title = overlay('title')
  function showTitle(save) {
    title.textContent = ''
    const top = el(`<div class="title-top"><h2 class="logo-big">Odd <em>One</em> Out</h2><p class="sub">Everything in the vale has to match. You don't. Stay odd for 10 minutes.</p></div>`)
    const bottom = el('<div class="title-bottom"></div>')
    const chars = el('<div class="chars" role="group" aria-label="Starting loadout"></div>')
    for (const c of CHARACTERS) {
      const owned = save.chars.includes(c.id)
      const b = el(`<button type="button" class="char ${save.char === c.id ? 'sel' : ''} ${owned ? '' : 'locked'}" aria-pressed="${save.char === c.id}" title="${c.name}${owned ? '' : ' (locked)'}"><i style="background:${c.body}"></i><span>${owned ? c.name : 'Locked'}</span></button>`)
      b.addEventListener('click', act(() => (owned ? on.pickChar(c.id) : on.workshop())))
      chars.append(b)
    }
    const cur = CHARACTERS.find((c) => c.id === save.char) || CHARACTERS[0]
    const row = el('<div class="row"></div>')
    row.append(btn('Play', 'primary big', () => on.play(), 'data-focus'), btn(`Workshop <span class="scrap">${SCRAP}${fmtNum(save.scrap)}</span>`, '', () => on.workshop()), btn('Records', '', () => on.records()))
    bottom.append(chars, el(`<p class="blurb">${cur.blurb}</p>`), row, el('<p class="howto">Drag anywhere to move<span class="kb">, or use <kbd>WASD</kbd> or the arrow keys</span>. Your weapons fire on their own.</p>'))
    if (save.best.time > 0) top.append(el(`<p class="best">Best ${fmtTime(save.best.time)} · ${fmtNum(save.totals.wins)} win${save.totals.wins === 1 ? '' : 's'}</p>`))
    title.append(top, bottom)
    show('title')
  }

  // ---- level up + crate
  const level = overlay('level', 'dim')
  function offerCard(o, i, onPick) {
    const d = describeOffer(o)
    const b = el(`<button type="button" class="pick ${o.isNew ? 'new' : ''}"><span class="pick-text"><span class="tag">${d.tag}</span><b>${d.name}</b><span class="txt">${d.text}</span></span>${i != null ? `<kbd>${i + 1}</kbd>` : ''}</button>`)
    b.prepend(renderer.iconCanvas(o.id, 44))
    if (onPick) b.addEventListener('click', act(() => onPick(i)))
    return b
  }
  function showLevelUp(s) {
    level.textContent = ''
    level.append(el(`<h2>Level ${s.level - s.pendingLevels + 1}!</h2>`), el('<p class="hint">Pick an upgrade</p>'))
    const cards = el('<div class="picks"></div>')
    s.offers.forEach((o, i) => cards.append(offerCard(o, i, on.choose)))
    level.append(cards)
    if (s.rerolls > 0) level.append(btn(`Reroll (${s.rerolls} left) <kbd>R</kbd>`, 'small', () => on.reroll()))
    show('level')
  }
  const crate = overlay('crate', 'dim')
  function showCrate(s) {
    crate.textContent = ''
    const r = s.crateReward
    crate.append(el('<h2>Crate!</h2>'), el('<p class="hint">Somebody packed this very neatly. It\'s yours now.</p>'))
    const cards = el('<div class="picks one"></div>')
    if (r.amount) { const c = el(`<div class="pick"><span class="pick-text"><span class="tag">SCRAP</span><b>${r.amount} scrap</b><span class="txt">Spend it in the workshop.</span></span></div>`); c.prepend(renderer.iconCanvas('scrap', 44)); cards.append(c) }
    else { const c = offerCard(r, null, null); c.disabled = true; cards.append(c) }
    crate.append(cards, btn('Lovely', 'primary', () => on.closeCrate(), 'data-focus'))
    show('crate')
  }

  // ---- pause
  const pause = overlay('pause', 'dim')
  function showPause(s, save) {
    pause.textContent = ''
    pause.append(el('<h2>Paused</h2>'), el(`<p class="hint">${fmtTime(s.t)} · level ${s.level} · ${fmtNum(s.kills)} broken</p>`), buildList(s, true))
    const toggles = el('<div class="toggles"></div>')
    for (const [key, label] of [['damageNumbers', 'Damage numbers'], ['shake', 'Screen shake']]) {
      const t = el(`<button type="button" class="toggle" role="switch" aria-checked="${save.settings[key]}"><i></i>${label}</button>`)
      t.addEventListener('click', () => { on.setting(key, !save.settings[key]); t.setAttribute('aria-checked', String(save.settings[key])) })
      toggles.append(t)
    }
    const row = el('<div class="row"></div>')
    row.append(btn('Resume', 'primary', () => on.resume(), 'data-focus'), btn('Give up', '', () => on.giveUp()))
    pause.append(toggles, row)
    show('pause')
  }

  // ---- win + game over
  const over = overlay('over', 'dim')
  function statGrid(run, result) {
    const rec = (k) => (result && result.records.includes(k) ? '<em class="rec">New best</em>' : '')
    return el(`<div class="stats">
      <div><span>Time</span><b>${fmtTime(run.time)}</b>${rec('time')}</div>
      <div><span>Broken</span><b>${fmtNum(run.kills)}</b>${rec('kills')}</div>
      <div><span>Level</span><b>${run.level}</b>${rec('level')}</div>
      <div class="scrap-stat"><span>Scrap</span><b>+${fmtNum(run.scrap)}</b></div>
    </div>`)
  }
  function showWin(s, run) {
    over.textContent = ''
    over.append(el('<h2>Still <em>odd!</em></h2>'), el('<p class="hint">The Template is in pieces, and not one of them matches. You can bank this run, or stay out and see how long you last.</p>'), statGrid(run, null))
    const row = el('<div class="row"></div>')
    row.append(btn('Keep going', 'primary', () => on.keepGoing(), 'data-focus'), btn('Bank it', '', () => on.endRun()))
    over.append(row)
    show('over')
  }
  function showOver(run, result, save) {
    over.textContent = ''
    const head = run.won ? (run.endless ? 'Odd to the <em>end</em>' : 'Still <em>odd!</em>') : 'You got <em>matched</em>'
    const line = run.won ? `You beat The Template${run.endless ? ' and kept going' : ''}. Nothing about that was standard.`
      : run.time < 60 ? 'They got you early. Keep moving, and grab the bolts they drop.'
        : run.time < RUN_LENGTH ? `You stayed odd for ${fmtTime(run.time)}. ${fmtTime(RUN_LENGTH - run.time)} short of the Template.` : 'So close. The Template was right there.'
    over.append(el(`<h2>${head}</h2>`), el(`<p class="hint">${line}</p>`), statGrid(run, result))
    const row = el('<div class="row"></div>')
    row.append(btn('Play again', 'primary big', () => on.play(), 'data-focus'), btn(`Workshop <span class="scrap">${SCRAP}${fmtNum(save.scrap)}</span>`, '', () => on.workshop()), btn('Title', '', () => on.title()))
    over.append(row)
    for (const a of result.achievements) over.append(el(`<p class="ach-new"><b>Achievement: ${a.name}</b> ${a.text}${a.unlocks ? ' <em>' + a.unlocks + '</em>' : ''}</p>`))
    over.append(buildList(run, true))
    show('over')
  }

  // ---- workshop
  const shop = overlay('shop', 'solid')
  function showWorkshop(save, keepScroll) {
    const sc = keepScroll ? overlays.shop.scrollTop : 0
    const focusId = keepScroll && document.activeElement ? document.activeElement.dataset.id : null
    shop.textContent = ''
    shop.append(el(`<div class="shop-head"><h2>Workshop</h2><span class="wallet">${SCRAP}<b>${fmtNum(save.scrap)}</b> scrap</span></div>`), el('<p class="hint">Permanent tweaks, paid for in scrap. Every run earns some.</p>'))
    const list = el('<div class="shop-list"></div>')
    for (const u of WORKSHOP) {
      const lvl = save.workshop[u.id] | 0, cost = workshopCost(save, u.id)
      const row = el(`<div class="shop-row ${cost == null ? 'max' : ''}"><div class="shop-info"><b>${u.name}</b><span>${u.text}</span>${pips(lvl, u.costs.length)}</div></div>`)
      const b = el(cost == null ? '<button type="button" class="btn small" disabled>Maxed</button>' : `<button type="button" class="btn small ${save.scrap >= cost ? 'primary' : 'poor'}" data-id="${u.id}" aria-label="Buy ${u.name} for ${cost} scrap">${SCRAP}${cost}</button>`)
      if (cost != null) b.addEventListener('click', () => on.buy(u.id))
      row.append(b); list.append(row)
    }
    shop.append(list, el('<h3>Loadouts</h3>'))
    const chars = el('<div class="shop-list"></div>')
    for (const c of CHARACTERS) {
      const owned = save.chars.includes(c.id), sel = save.char === c.id
      const row = el(`<div class="shop-row"><i class="swatch" style="background:${c.body}"></i><div class="shop-info"><b>${c.name}</b><span>${c.blurb}</span></div></div>`)
      let b
      if (owned) { b = el(`<button type="button" class="btn small" data-id="c-${c.id}" ${sel ? 'disabled' : ''}>${sel ? 'In use' : 'Use'}</button>`); b.addEventListener('click', () => on.pickChar(c.id, true)) }
      else if (c.cost != null) { b = el(`<button type="button" class="btn small ${save.scrap >= c.cost ? 'primary' : 'poor'}" data-id="c-${c.id}" aria-label="Buy ${c.name} for ${c.cost} scrap">${SCRAP}${c.cost}</button>`); b.addEventListener('click', () => on.buyChar(c.id)) }
      else { const a = ACHIEVEMENTS.find((x) => x.id === c.needs); b = el(`<span class="lock-note">${a ? a.text : 'Locked'}</span>`) }
      row.append(b); chars.append(row)
    }
    const row = el('<div class="row"></div>')
    row.append(btn('Play', 'primary', () => on.play()), btn('Back', '', () => on.title(), keepScroll ? '' : 'data-focus'))
    shop.append(chars, row)
    show('shop')
    if (keepScroll) { overlays.shop.scrollTop = sc; const f = focusId && shop.querySelector(`[data-id="${focusId}"]:not([disabled])`); if (f) f.focus({ preventScroll: true }) }
  }

  // ---- records
  const records = overlay('records', 'solid')
  function showRecords(save) {
    records.textContent = ''
    const t = save.totals
    records.append(el('<h2>Records</h2>'), el(`<div class="stats">
      <div><span>Best time</span><b>${fmtTime(save.best.time)}</b></div><div><span>Most broken</span><b>${fmtNum(save.best.kills)}</b></div>
      <div><span>Top level</span><b>${save.best.level}</b></div><div><span>Wins</span><b>${fmtNum(t.wins)}</b></div>
      <div><span>Runs</span><b>${fmtNum(t.runs)}</b></div><div><span>All broken</span><b>${fmtNum(t.kills)}</b></div>
    </div>`), el('<h3>Achievements</h3>'))
    const list = el('<div class="ach-list"></div>')
    for (const a of ACHIEVEMENTS) list.append(el(`<div class="ach ${save.achievements[a.id] ? 'got' : ''}"><i aria-hidden="true"></i><div><b>${a.name}</b><span>${a.text}${a.unlocks ? ' ' + a.unlocks : ''}</span></div><em>${save.achievements[a.id] ? 'Done' : 'To do'}</em></div>`))
    const row = el('<div class="row"></div>')
    const reset = el('<button type="button" class="btn small">Erase save</button>')
    let armed = false
    reset.addEventListener('click', () => { if (armed) on.resetSave(); else { armed = true; reset.textContent = 'Really erase everything?'; reset.classList.add('danger') } })
    row.append(btn('Back', 'primary', () => on.title(), 'data-focus'), reset)
    records.append(list, row)
    show('records')
  }

  // ------------------------------------------------------------------ keyboard on menus
  window.addEventListener('keydown', (e) => {
    if (!current || e.ctrlKey || e.metaKey || e.altKey) return
    const o = overlays[current]
    if (current === 'level' && settled()) {
      const n = Number(e.key)
      if (n >= 1 && n <= 4) { const cards = o.querySelectorAll('.pick'); if (cards[n - 1]) { on.choose(n - 1); e.preventDefault(); return } }
      if (e.code === 'KeyR') { on.reroll(); return }
    }
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    if (dir) {
      const items = [...o.querySelectorAll('button:not([disabled])')]
      if (!items.length) return
      const i = items.indexOf(document.activeElement)
      items[(i + dir + items.length) % items.length].focus()
      e.preventDefault()
    }
  })

  return { updateHud, showHud, show, showTitle, showLevelUp, showCrate, showPause, showWin, showOver, showWorkshop, showRecords, get current() { return current } }
}
