/**
 * Predefined color palettes for the canvas creation wizard and for restricting
 * the drawing color picker on canvases with palette rules.
 */

export interface Palette {
  id: string
  name: string
  colors: string[]
}

export const PALETTES: Palette[] = [
  {
    id: 'pastel',
    name: 'Pastel',
    colors: ['#ffd6e0', '#ffe9b0', '#caffd6', '#bfe6ff', '#d6c5ff', '#fff4d6'],
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: ['#0a0b0e', '#262c37', '#4a525f', '#a3a9b3', '#cfd2d8', '#ffffff'],
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: ['#ff00aa', '#00f0ff', '#a3ff00', '#ff8800', '#5b00ff', '#fff200'],
  },
  {
    id: 'earth',
    name: 'Earth',
    colors: ['#3e2723', '#6d4c41', '#8d6e63', '#a1887f', '#bcaaa4', '#efebe9'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0a4d68', '#088395', '#05bfdb', '#00ffca', '#cfffe5', '#ffffff'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#ff6a3d', '#ff9a3c', '#ffd23f', '#ee4266', '#540d6e', '#3bceac'],
  },
  {
    id: 'botanical',
    name: 'Botanical',
    colors: ['#1b4332', '#2d6a4f', '#52b788', '#95d5b2', '#d8f3dc', '#fefae0'],
  },
]

export function findPalette(id: string): Palette | null {
  return PALETTES.find((p) => p.id === id) ?? null
}
