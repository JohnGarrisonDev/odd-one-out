// Player input: keyboard (WASD / arrows) and a floating virtual stick (drag anywhere on the canvas, touch or mouse).
// Exposes one movement vector; main.js copies it into the simulation.

const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] }

export function makeInput(canvas) {
  const down = new Set()
  const stick = { on: false, id: -1, x: 0, y: 0, dx: 0, dy: 0, max: 52 }
  const vec = { x: 0, y: 0 }
  const api = { vec, stick, active: false, update, reset }

  function reset() { down.clear(); stick.on = false; stick.id = -1; stick.dx = stick.dy = 0; vec.x = vec.y = 0 }

  window.addEventListener('keydown', (e) => {
    if (!api.active || e.ctrlKey || e.metaKey || e.altKey) return
    if (KEYS[e.code]) { down.add(e.code); e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => { down.delete(e.code) })
  window.addEventListener('blur', reset)

  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  canvas.addEventListener('pointerdown', (e) => {
    if (!api.active || stick.on || (e.pointerType === 'mouse' && e.button !== 0)) return
    const [x, y] = local(e)
    stick.on = true; stick.id = e.pointerId; stick.x = x; stick.y = y; stick.dx = stick.dy = 0
    try { canvas.setPointerCapture(e.pointerId) } catch { /* fine without capture */ }
    e.preventDefault()
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!stick.on || e.pointerId !== stick.id) return
    const [x, y] = local(e)
    let dx = x - stick.x, dy = y - stick.y
    const d = Math.hypot(dx, dy)
    if (d > stick.max) {
      // the stick's base trails the finger, so a long drag never leaves you stretching for the edge
      stick.x += (dx / d) * (d - stick.max); stick.y += (dy / d) * (d - stick.max)
      dx = (dx / d) * stick.max; dy = (dy / d) * stick.max
    }
    stick.dx = dx; stick.dy = dy
  })
  const end = (e) => { if (e.pointerId === stick.id) { stick.on = false; stick.id = -1; stick.dx = stick.dy = 0 } }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('lostpointercapture', end) // the browser took the gesture: let go of the stick
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  function update() {
    let x = 0, y = 0
    for (const code of down) { x += KEYS[code][0]; y += KEYS[code][1] }
    if (x || y) { const m = Math.hypot(x, y); vec.x = x / m; vec.y = y / m; return vec }
    if (stick.on) {
      const d = Math.hypot(stick.dx, stick.dy), dead = 7
      if (d > dead) { const k = Math.min(1, (d - dead) / (stick.max * 0.55)) / d; vec.x = stick.dx * k; vec.y = stick.dy * k; return vec }
    }
    vec.x = vec.y = 0
    return vec
  }
  return api
}
