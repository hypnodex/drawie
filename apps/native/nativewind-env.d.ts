/// <reference types="nativewind/types" />

// Declare the CSS module so the side-effect `import './global.css'` in index.ts typechecks
// (metro/NativeWind process it; TS just needs the module to exist).
declare module '*.css' {}
