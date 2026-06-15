import { useState } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

/**
 * Minimal continuous slider built on gesture-handler (no native-module dep). Tapping or
 * dragging anywhere on the track sets the value by x-position. Used for brush size/opacity
 * in the editor. Phase 3 (native shadcn): StyleSheet → NativeWind over the tokens (gesture logic
 * + dynamic fill/thumb positions unchanged).
 */
export function Slider({
  label, value, min, max, step = 1, onChange, format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const [w, setW] = useState(1)
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const setFromX = (px: number) => {
    const f = Math.max(0, Math.min(1, px / w))
    const raw = min + f * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(setFromX)(e.x))
    .onUpdate((e) => runOnJS(setFromX)(e.x))

  return (
    <View className="flex-row items-center gap-2.5 py-1">
      <Text className="w-[52px] text-xs font-semibold text-muted-foreground">{label}</Text>
      <GestureDetector gesture={pan}>
        <View className="h-7 flex-1 justify-center" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <View className="absolute inset-x-0 h-1 rounded-full bg-border" />
          <View className="absolute h-1 rounded-full bg-primary" style={{ width: `${frac * 100}%` }} />
          <View className="absolute -ml-2.5 h-5 w-5 rounded-full border-2 border-primary bg-card shadow" style={{ left: `${frac * 100}%` }} />
        </View>
      </GestureDetector>
      <Text className={cn('w-[42px] text-right text-xs text-foreground')} style={{ fontVariant: ['tabular-nums'] }}>
        {format ? format(value) : String(Math.round(value))}
      </Text>
    </View>
  )
}
