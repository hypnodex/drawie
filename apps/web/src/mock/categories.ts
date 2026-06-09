export const CATEGORIES = [
  'Landscape',
  'Portrait',
  'Abstract',
  'Character',
  'Surreal',
  'Sci-Fi',
  'Botanical',
  'Architecture',
  'Animal',
  'Mythical',
] as const

export type Category = typeof CATEGORIES[number]
