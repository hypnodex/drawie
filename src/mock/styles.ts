export const STYLES = [
  'Watercolor',
  'Pixel art',
  'Line art',
  'Geometric',
  'Pastel',
  'Sketch',
  'Painterly',
  'Abstract',
  'Minimalist',
  'Cinematic',
] as const

export type Style = typeof STYLES[number]
