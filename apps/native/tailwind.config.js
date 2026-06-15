/** @type {import('tailwindcss').Config} */
// NativeWind v4 STABLE (Tailwind v3). The Tailwind CLI (driven by withNativeWind's
// `input` in metro.config.js) scans `content` for class names and generates utilities.
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // shadcn-style HSL token bridge — SAME convention the web shadcn app uses, so one
      // token source (Style Dictionary) can emit the web CSS vars AND these native :root
      // HSL vars, and `bg-primary` / `text-foreground` mean the same thing on both platforms.
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
