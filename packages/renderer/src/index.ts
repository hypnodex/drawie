// @drawie/renderer — concrete RendererBackend implementations + the procedural
// grain textures they paint. The abstract RendererBackend contract lives in
// @drawie/core (so the engine can depend on it without a cycle); this package
// provides the platform backends: Canvas2DBackend today, SkiaBackend in Phase 4.
export * from './canvas2d'
export * from './skia'
export * from './textures'
