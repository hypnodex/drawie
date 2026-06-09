import type { User, UserId } from '@drawie/data'

/**
 * Demo personas. We intentionally MIX portrait-avatars and initials-avatars
 * across the persona set so:
 *
 *   1. The persona picker in Login + Profile menu shows visual variety.
 *   2. The ContributorAvatars stacks on the catalog cards (which cycle through
 *      MOCK_USERS) get a realistic mix of faces and colored initial chips,
 *      mirroring how real apps look when not every user has uploaded a photo.
 *
 * Portrait URLs use https://i.pravatar.cc/300?img=N — public curated set, no
 * auth, stable per id. The hex `avatar` field on every user is the initials
 * background; it shows briefly while the photo loads, and permanently for
 * users who don't have a `photoUrl`.
 */
export const MOCK_USERS: User[] = [
  {
    id: 'maya',
    name: 'Maya',
    avatar: '#f472b6',              // pink
    photoUrl: 'https://i.pravatar.cc/300?img=47',
    isPremium: false,
    completedTilesCount: 0,
    savedCanvasIds: [],
    draftTileIds: [],
    contributedCanvasIds: [],
  },
  {
    id: 'alex',
    name: 'Alex',
    avatar: '#7c8cff',              // accent indigo
    photoUrl: 'https://i.pravatar.cc/300?img=12',
    isPremium: false,
    completedTilesCount: 4,
    savedCanvasIds: ['canvas-world-mosaic', 'canvas-cosmic-bloom'],
    draftTileIds: [],
    contributedCanvasIds: [
      'canvas-city-jungle',
      'canvas-ocean-bloom',
      'canvas-watercolor-garden',
      'canvas-bloom-creature',
    ],
  },
  {
    id: 'river',
    name: 'River',
    avatar: '#10b981',              // emerald — initials only
    isPremium: true,
    completedTilesCount: 8,
    savedCanvasIds: ['canvas-cosmic-bloom'],
    draftTileIds: [],
    contributedCanvasIds: ['canvas-city-jungle', 'canvas-wildflower-grid', 'canvas-jellyfish-bloom'],
  },
  {
    id: 'nico',
    name: 'Nico',
    avatar: '#fb923c',              // orange
    photoUrl: 'https://i.pravatar.cc/300?img=22',
    isPremium: false,
    completedTilesCount: 2,
    savedCanvasIds: [],
    draftTileIds: [],
    contributedCanvasIds: ['canvas-ocean-bloom'],
  },
  {
    id: 'soren',
    name: 'Soren',
    avatar: '#a78bfa',              // violet — initials only
    isPremium: true,
    completedTilesCount: 11,
    savedCanvasIds: ['canvas-watercolor-garden'],
    draftTileIds: [],
    contributedCanvasIds: ['canvas-wildflower-grid', 'canvas-bloom-creature'],
  },
  {
    id: 'wren',
    name: 'Wren',
    avatar: '#22d3ee',              // cyan — initials only
    isPremium: false,
    completedTilesCount: 6,
    savedCanvasIds: [],
    draftTileIds: [],
    contributedCanvasIds: ['canvas-jellyfish-bloom', 'canvas-cosmic-bloom'],
  },
]

/** The user we auto-log in as on first load. */
export const DEFAULT_USER_ID: UserId = 'alex'

export function findUser(id: UserId): User | null {
  return MOCK_USERS.find((u) => u.id === id) ?? null
}
