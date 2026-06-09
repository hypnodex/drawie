import type { Canvas, CanvasStatus } from '@drawie/data'
import { PALETTES } from './palettes'

/**
 * Hand-crafted mock canvas catalog. Statuses cover the full spectrum so
 * Discovery / Detail / Dashboard each have something interesting to render.
 */

interface Spec {
  id: string
  title: string
  description: string
  founderId: string
  founderName: string
  category: string
  topic: string
  style: string
  gridRows: number
  gridCols: number
  completedTiles: number
  activeContributors: number
  isTrending?: boolean
  createdAtDaysAgo: number
  completedAtDaysAgo?: number
  paletteId?: string                  // restrict drawing to this palette
  allowedToolIds?: string[]           // restrict tools
  previewGradient: string
  finalGradient?: string
  /** Final finished artwork — served from /public. When set on a completed
   *  canvas, MosaicPreview renders this image instead of procedural artwork. */
  artworkUrl?: string
  styleGuidance: string
  discussionCount?: number
}

function isoDaysAgo(days: number): string {
  const t = Date.parse('2026-06-01T00:00:00.000Z') - days * 86400000
  return new Date(t).toISOString()
}

function statusFor(s: Spec): CanvasStatus {
  const total = s.gridRows * s.gridCols
  if (s.completedTiles >= total) return 'completed'
  if (s.completedTiles / total > 0.85) return 'almost-complete'
  return 'open'
}

const SPECS: Spec[] = [
  // ── Completed ────────────────────────────────────────────────────────
  {
    id: 'canvas-world-mosaic',
    title: 'World Mosaic',
    description: 'A wall of small worlds — surreal cats, ghosts, flowers, and faces, each tile a vignette.',
    founderId: 'river', founderName: 'River',
    category: 'Surreal', topic: 'A collage of imagined worlds', style: 'Mixed media',
    gridRows: 9, gridCols: 9, completedTiles: 81, activeContributors: 64,
    createdAtDaysAgo: 110, completedAtDaysAgo: 2,
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #2f5742 40%, #d6ee5a 75%, #f3f7ec 100%)',
    artworkUrl: '/completed/1.png',
    styleGuidance: 'No theme limits. Each tile is its own scene; soft edges may bleed into neighbors.',
    discussionCount: 312,
  },
  {
    id: 'canvas-glyph-garden',
    title: 'Glyph Garden',
    description: 'Aztec-pattern blooms and a wandering creature carry a sprout across a cosmic dust storm.',
    founderId: 'river', founderName: 'River',
    category: 'Surreal', topic: 'A cosmic creature gardener', style: 'Pattern / Ink',
    gridRows: 10, gridCols: 10, completedTiles: 100, activeContributors: 41,
    createdAtDaysAgo: 75, completedAtDaysAgo: 8,
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #5c8a6c 35%, #d6ee5a 70%, #dfeacf 100%)',
    artworkUrl: '/completed/2.png',
    styleGuidance: 'Fill tiles with pattern. Ink linework over washes; a single creature crosses the canvas.',
    discussionCount: 188,
  },
  {
    id: 'canvas-watercolor-garden',
    title: 'Watercolor Garden',
    description: 'A loose botanical wash — peony bloom and storm clouds drift across the canvas.',
    founderId: 'river', founderName: 'River',
    category: 'Botanical', topic: 'Flowers blooming in soft weather', style: 'Watercolor',
    gridRows: 6, gridCols: 6, completedTiles: 36, activeContributors: 24,
    createdAtDaysAgo: 48, completedAtDaysAgo: 10,
    paletteId: 'pastel',
    previewGradient: 'linear-gradient(135deg, #f3f7ec 0%, #c4dab8 30%, #5c8a6c 60%, #dfeacf 100%)',
    artworkUrl: '/completed/3.png',
    styleGuidance: 'Soft watercolor washes, generous whitespace, no hard outlines.',
    discussionCount: 86,
  },
  {
    id: 'canvas-pixel-meadow',
    title: 'Pixel Meadow',
    description: 'Watercolor flora arranged on a chunky grid — small tiles, lots of breathing room.',
    founderId: 'river', founderName: 'River',
    category: 'Botanical', topic: 'Quiet wildflower meadow', style: 'Watercolor / Pixel',
    gridRows: 16, gridCols: 16, completedTiles: 256, activeContributors: 64,
    createdAtDaysAgo: 70, completedAtDaysAgo: 18,
    previewGradient: 'linear-gradient(135deg, #f3f7ec 0%, #dfeacf 40%, #c4dab8 70%, #ffffff 100%)',
    artworkUrl: '/completed/4.png',
    styleGuidance: 'Loose washes, occasional sharp blossom. Empty cells are part of the composition.',
    discussionCount: 142,
  },
  {
    id: 'canvas-jellyfish-bloom',
    title: 'Jellyfish Bloom',
    description: 'Translucent creatures drifting through colored clouds.',
    founderId: 'river', founderName: 'River',
    category: 'Botanical', topic: 'Jellyfish among watercolor blooms', style: 'Watercolor',
    gridRows: 5, gridCols: 5, completedTiles: 25, activeContributors: 16,
    createdAtDaysAgo: 36, completedAtDaysAgo: 6,
    paletteId: 'pastel',
    previewGradient: 'linear-gradient(135deg, #dfeacf 0%, #c4dab8 40%, #f3f7ec 75%, #ffffff 100%)',
    artworkUrl: '/completed/5.png',
    styleGuidance: 'Sparse composition, water-on-water bleeds, translucent overlapping forms.',
    discussionCount: 58,
  },
  {
    id: 'canvas-wildflower-grid',
    title: 'Wildflower Grid',
    description: '169 separate watercolor wildflowers — a single calm field tiled across the canvas.',
    founderId: 'river', founderName: 'River',
    category: 'Botanical', topic: 'A field of wildflowers — one per tile', style: 'Watercolor',
    gridRows: 13, gridCols: 13, completedTiles: 169, activeContributors: 76,
    createdAtDaysAgo: 95, completedAtDaysAgo: 22,
    previewGradient: 'linear-gradient(135deg, #ffffff 0%, #dfeacf 35%, #c4dab8 65%, #e6f593 100%)',
    artworkUrl: '/completed/6.png',
    styleGuidance: 'One flower per tile. Stems may extend into adjacent tiles by mutual consent.',
    discussionCount: 217,
  },
  {
    id: 'canvas-cosmic-splash',
    title: 'Cosmic Splash',
    description: 'A weightless watercolor explosion — nebula, bloom, and a few quiet creatures.',
    founderId: 'river', founderName: 'River',
    category: 'Abstract', topic: 'Cosmic watercolor energy', style: 'Watercolor',
    gridRows: 7, gridCols: 7, completedTiles: 49, activeContributors: 31,
    createdAtDaysAgo: 55, completedAtDaysAgo: 12,
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #2f5742 25%, #5c8a6c 50%, #d6ee5a 75%, #f3f7ec 100%)',
    artworkUrl: '/completed/7.png',
    styleGuidance: 'Energetic, splashy, no negative space rules. Let edges drift across seams.',
    discussionCount: 124,
  },
  {
    id: 'canvas-bloom-creature',
    title: 'Bloom Creature',
    description: 'A surreal portrait of a flower that became someone — sea-anemone hair and a serene face.',
    founderId: 'river', founderName: 'River',
    category: 'Character', topic: 'A blooming creature with a serene face', style: 'Mixed media',
    gridRows: 6, gridCols: 6, completedTiles: 36, activeContributors: 22,
    createdAtDaysAgo: 28, completedAtDaysAgo: 3,
    previewGradient: 'linear-gradient(135deg, #264363 0%, #5c8a6c 35%, #c4dab8 65%, #f3f7ec 100%)',
    artworkUrl: '/completed/8.png',
    styleGuidance: 'Ink lines + watercolor washes. Build a single creature across all tiles.',
    discussionCount: 191,
  },
  {
    id: 'canvas-bloom-spirits',
    title: 'Bloom Spirits',
    description: 'A drifting spirit-creature wreathed in watercolor swirls and a single carried flower.',
    founderId: 'river', founderName: 'River',
    category: 'Surreal', topic: 'A traveling watercolor spirit', style: 'Watercolor',
    gridRows: 5, gridCols: 5, completedTiles: 25, activeContributors: 18,
    createdAtDaysAgo: 40, completedAtDaysAgo: 5,
    previewGradient: 'linear-gradient(135deg, #dfeacf 0%, #c4dab8 30%, #5c8a6c 65%, #2f5742 100%)',
    artworkUrl: '/completed/9.png',
    styleGuidance: 'Loose color spirits, soft edges, a small bloom as the anchor.',
    discussionCount: 73,
  },

  // ── Almost complete ─────────────────────────────────────────────────
  {
    id: 'canvas-cosmic-bloom',
    title: 'Cosmic Bloom',
    description: 'Galactic flowers spreading across the void — 41 of 49 tiles done.',
    founderId: 'river', founderName: 'River',
    category: 'Botanical', topic: 'Flowers blooming in space', style: 'Painterly',
    gridRows: 7, gridCols: 7, completedTiles: 41, activeContributors: 22,
    isTrending: true,
    createdAtDaysAgo: 14,
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #2f5742 40%, #5c8a6c 70%, #d6ee5a 100%)',
    styleGuidance: 'Lean into the contrast — deep voids next to high-chroma blooms.',
    discussionCount: 78,
  },
  {
    id: 'canvas-ocean-bloom',
    title: 'Reef Bloom',
    description: 'Coral reef in full color — only a few tiles left.',
    founderId: 'maya', founderName: 'Maya',
    category: 'Animal', topic: 'Coral reef ecosystem', style: 'Watercolor',
    gridRows: 5, gridCols: 5, completedTiles: 22, activeContributors: 15,
    isTrending: true,
    createdAtDaysAgo: 9,
    paletteId: 'ocean',
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #264363 35%, #5c8a6c 70%, #c4dab8 100%)',
    styleGuidance: 'Watercolor brushes encouraged. Leave white space — let the paper breathe.',
    discussionCount: 33,
  },

  // ── Open / in progress ───────────────────────────────────────────────
  {
    id: 'canvas-city-jungle',
    title: 'City Jungle',
    description: 'Modern skyline overgrown by jungle. Maximalist + chaotic.',
    founderId: 'river', founderName: 'River',
    category: 'Architecture', topic: 'Reclaimed-by-nature cityscape', style: 'Cinematic',
    gridRows: 6, gridCols: 6, completedTiles: 11, activeContributors: 8,
    isTrending: true,
    createdAtDaysAgo: 4,
    previewGradient: 'linear-gradient(135deg, #2f5742 0%, #5c8a6c 50%, #d6ee5a 100%)',
    styleGuidance: 'Where steel meets vines — let the architecture lose to the green.',
    discussionCount: 17,
  },
  {
    id: 'canvas-festival-night',
    title: 'Festival Night',
    description: 'Late-night crowd at a music festival; warm lights, neon stage.',
    founderId: 'river', founderName: 'River',
    category: 'Character', topic: 'Festival crowd and stage', style: 'Cinematic',
    gridRows: 6, gridCols: 6, completedTiles: 6, activeContributors: 5,
    createdAtDaysAgo: 2,
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #264363 35%, #d6ee5a 75%, #e6f593 100%)',
    styleGuidance: 'Strong directional lighting. Faces in silhouette are fine.',
    discussionCount: 4,
  },
  {
    id: 'canvas-myth-river',
    title: 'River of Myth',
    description: 'Legendary creatures bathing in a slow-moving river.',
    founderId: 'maya', founderName: 'Maya',
    category: 'Mythical', topic: 'Mythical creatures by a river', style: 'Painterly',
    gridRows: 5, gridCols: 5, completedTiles: 7, activeContributors: 6,
    createdAtDaysAgo: 5,
    paletteId: 'botanical',
    previewGradient: 'linear-gradient(135deg, #2f5742 0%, #5c8a6c 50%, #c4dab8 80%, #f3f7ec 100%)',
    styleGuidance: 'Calm, deliberate strokes. No bright neon.',
    discussionCount: 9,
  },
  {
    id: 'canvas-portrait-tile',
    title: 'Fragments',
    description: 'Single portrait shattered into 16 tile fragments.',
    founderId: 'river', founderName: 'River',
    category: 'Portrait', topic: 'Abstract human portrait', style: 'Abstract',
    gridRows: 4, gridCols: 4, completedTiles: 5, activeContributors: 4,
    createdAtDaysAgo: 7,
    previewGradient: 'linear-gradient(135deg, #264363 0%, #5c8a6c 50%, #f3f7ec 100%)',
    styleGuidance: 'Lean into the fragmentation — don\'t try to make tile edges match.',
    discussionCount: 12,
  },
  {
    id: 'canvas-neon-tokyo',
    title: 'Neon Tokyo',
    description: 'Rain-slick Tokyo street, every sign in neon.',
    founderId: 'river', founderName: 'River',
    category: 'Architecture', topic: 'Neon Tokyo street', style: 'Cinematic',
    gridRows: 6, gridCols: 6, completedTiles: 20, activeContributors: 11,
    isTrending: true,
    createdAtDaysAgo: 11,
    paletteId: 'neon',
    previewGradient: 'linear-gradient(135deg, #0d1a2d 0%, #2f5742 35%, #d6ee5a 75%, #ffffff 100%)',
    styleGuidance: 'Neon palette only. Wet streets, reflective surfaces.',
    discussionCount: 28,
  },
  {
    id: 'canvas-cardboard-robot',
    title: 'Cardboard Robot',
    description: 'A giant friendly robot built from cardboard scraps.',
    founderId: 'maya', founderName: 'Maya',
    category: 'Character', topic: 'Cardboard robot in a meadow', style: 'Sketch',
    gridRows: 5, gridCols: 5, completedTiles: 4, activeContributors: 3,
    createdAtDaysAgo: 1,
    paletteId: 'earth',
    previewGradient: 'linear-gradient(135deg, #f3f7ec 0%, #c4dab8 50%, #5c8a6c 100%)',
    styleGuidance: 'Pencil-driven, gentle linework. Imperfect = correct.',
    discussionCount: 2,
  },
  {
    id: 'canvas-deep-time',
    title: 'Deep Time',
    description: 'Geological layers, fossils, and root systems. Earth as cross-section.',
    founderId: 'river', founderName: 'River',
    category: 'Abstract', topic: 'Earth cross-section through time', style: 'Geometric',
    gridRows: 5, gridCols: 5, completedTiles: 3, activeContributors: 2,
    createdAtDaysAgo: 3,
    paletteId: 'earth',
    previewGradient: 'linear-gradient(180deg, #0d1a2d 0%, #264363 30%, #5c8a6c 60%, #c4dab8 85%, #f3f7ec 100%)',
    styleGuidance: 'Cross-section logic — horizontal banding rewards composition.',
    discussionCount: 6,
  },
  {
    id: 'canvas-quiet-sea',
    title: 'Quiet Sea',
    description: 'Slow ocean at dusk. Almost no human marks.',
    founderId: 'river', founderName: 'River',
    category: 'Landscape', topic: 'Calm ocean horizon', style: 'Minimalist',
    gridRows: 4, gridCols: 6, completedTiles: 9, activeContributors: 7,
    createdAtDaysAgo: 6,
    paletteId: 'ocean',
    previewGradient: 'linear-gradient(180deg, #dfeacf 0%, #5c8a6c 60%, #2f5742 100%)',
    styleGuidance: 'Minimal, near-monochrome. Horizon line is sacred.',
    discussionCount: 11,
  },
]

export const MOCK_CANVASES: Canvas[] = SPECS.map((s) => {
  const palette = s.paletteId ? PALETTES.find((p) => p.id === s.paletteId) : null
  const total = s.gridRows * s.gridCols
  const status = statusFor(s)
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    founderId: s.founderId,
    founderName: s.founderName,
    category: s.category,
    topic: s.topic,
    style: s.style,

    gridRows: s.gridRows,
    gridCols: s.gridCols,
    allowedTools: (s.allowedToolIds as any) ?? [],   // empty = all allowed
    colorPalette: palette ? palette.colors : null,
    background: '#ffffff',
    styleGuidance: s.styleGuidance,
    participationMode: 'free-pick',
    visibility: 'public',
    neighborPreviewSize: 'small',

    totalTiles: total,
    completedTiles: s.completedTiles,
    activeContributors: s.activeContributors,
    status,
    isTrending: s.isTrending ?? false,
    createdAt: isoDaysAgo(s.createdAtDaysAgo),
    completedAt: s.completedAtDaysAgo !== undefined ? isoDaysAgo(s.completedAtDaysAgo) : undefined,
    previewGradient: s.previewGradient,
    finalGradient: s.finalGradient,
    artworkUrl: s.artworkUrl,
    discussionCount: s.discussionCount ?? 0,
  }
})

export function findCanvas(id: string): Canvas | null {
  return MOCK_CANVASES.find((c) => c.id === id) ?? null
}
