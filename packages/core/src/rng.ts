// Seeded pseudo-random number generator — the single source of determinism for
// the drawing engine across web + native. Threading this through every stochastic
// site (pencil, spray, bristles, textures) means identical (input + seed) produces
// identical marks on every platform, which is what makes tool output consistent.
//
// `mulberry32` is the same generator already used by mockTiles.ts; centralised here
// so the engine and the mock-art renderer share one implementation.

/** A deterministic random source: returns successive values in [0, 1). */
export type Rng = () => number

/** Mulberry32 — fast, well-distributed 32-bit seeded PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash an arbitrary string to a 32-bit seed (e.g. to derive a stable texture seed). */
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
