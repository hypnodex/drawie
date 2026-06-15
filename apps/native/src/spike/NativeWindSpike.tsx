import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

/**
 * NativeWind v4 STABLE compat spike — Expo SDK 56 / RN 0.85.3 / React 19.2.
 *
 * Rendered ONLY when the entry gate (index.ts) selects it, so the real app is untouched.
 * This is the gating check for Phase 3 (native bespoke RN → React Native Reusables, which
 * targets NativeWind v4). It exercises:
 *   - plain Tailwind utilities (layout, color, radius, shadow, type) — `bg-emerald-500` etc.
 *   - the shadcn HSL TOKEN bridge — `bg-primary` / `text-foreground` resolve from the
 *     :root HSL vars in global.css via tailwind.config (the web↔native token convention)
 *   - a reactive conditional className (tap to toggle)
 * If this renders STYLED on the iPad, v4 stable works on this stack and Phase 3 is unblocked.
 */
export function NativeWindSpike() {
  const [on, setOn] = useState(false)
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background p-8">
      <Text className="text-2xl font-bold text-foreground">NativeWind v4 stable spike ✦</Text>

      {/* Token-driven card: bg-card / text-foreground come from :root HSL vars */}
      <View className="w-full max-w-sm gap-4 rounded-2xl bg-card p-6 shadow-lg">
        <Text className="text-base leading-6 text-muted-foreground">
          White card = `bg-card`, this text = `text-muted-foreground` — both from the shadcn
          :root HSL tokens. If they render correctly, the web↔native token bridge works.
        </Text>

        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 rounded-full bg-primary" />
          <Text className="font-mono text-sm text-primary">bg-primary (token)</Text>
          <View className="h-10 w-10 rounded-full bg-emerald-500" />
          <Text className="font-mono text-sm text-emerald-700">bg-emerald-500 (plain)</Text>
        </View>

        <Pressable
          onPress={() => setOn((v) => !v)}
          className={`mt-2 items-center rounded-xl px-4 py-3 ${on ? 'bg-primary' : 'bg-foreground'}`}
        >
          <Text className="font-bold text-white">
            {on ? 'Reactive className: ON ✓ (tap)' : 'Tap to toggle reactive className'}
          </Text>
        </Pressable>
      </View>

      <Text className="font-mono text-xs text-muted-foreground">NativeWind v4 · Tailwind v3 · Expo SDK 56</Text>
    </View>
  )
}
