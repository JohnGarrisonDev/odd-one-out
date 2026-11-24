// Small shared helpers for the simulation. No DOM.

/** Seeded random numbers (mulberry32), same algorithm as kit.js (which can't be imported in node: it touches window). */
export function makeRng(seed) {
  let a = seed >>> 0
  const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  rng.range = (lo, hi) => lo + rng() * (hi - lo)
  rng.int = (n) => Math.floor(rng() * n)
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)]
  return rng
}

/** Uniform grid for fast "who is near here" queries. Centred on a moving origin; rebuilt every step. No allocation in use. */
export function makeGrid(cell = 64, size = 64) {
  const buckets = new Array(size * size)
  for (let i = 0; i < buckets.length; i++) buckets[i] = []
  const used = []
  const g = {
    cell, size, buckets, ox: 0, oy: 0, maxR: 0, out: [], n: 0,
    clear(cx, cy) {
      for (let i = 0; i < used.length; i++) buckets[used[i]].length = 0
      used.length = 0
      g.ox = Math.floor(cx / cell) - (size >> 1); g.oy = Math.floor(cy / cell) - (size >> 1); g.maxR = 0
    },
    insert(e) {
      let cx = Math.floor(e.x / cell) - g.ox, cy = Math.floor(e.y / cell) - g.oy
      if (cx < 0) cx = 0; else if (cx >= size) cx = size - 1
      if (cy < 0) cy = 0; else if (cy >= size) cy = size - 1
      const b = buckets[cx + cy * size]
      if (b.length === 0) used.push(cx + cy * size)
      b.push(e)
      if (e.r > g.maxR) g.maxR = e.r
    },
    /** Fill g.out with live enemies whose body overlaps the circle (x, y, rad). Returns the count. */
    query(x, y, rad) {
      const out = g.out; let n = 0
      const reach = rad + g.maxR
      let x0 = Math.floor((x - reach) / cell) - g.ox, x1 = Math.floor((x + reach) / cell) - g.ox
      let y0 = Math.floor((y - reach) / cell) - g.oy, y1 = Math.floor((y + reach) / cell) - g.oy
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= size) x1 = size - 1; if (y1 >= size) y1 = size - 1
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const b = buckets[cx + cy * size]
          for (let i = 0; i < b.length; i++) {
            const e = b[i]
            if (e.dead) continue
            const dx = e.x - x, dy = e.y - y, rr = rad + e.r
            if (dx * dx + dy * dy <= rr * rr) out[n++] = e
          }
        }
      }
      g.n = n
      return n
    },
  }
  return g
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const TAU = Math.PI * 2
