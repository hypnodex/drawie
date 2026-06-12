// Realtime neighbor-tile live drawing — cross-platform transport + dev simulator. Pure data: no DOM,
// no RN, no React; imports only the supabase client + @drawie/core. The renderer (web Canvas.tsx /
// native EditorScreen) registers handlers on the receiver and replays strokes through the engine.
export * from './types'
export * from './broadcaster'
export * from './receiver'
export * from './strokeGen'
export * from './simulateNeighbors'
