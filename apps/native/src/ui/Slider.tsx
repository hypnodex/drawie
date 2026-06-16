import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

/**
 * Continuous slider. The THUMB + fill track the finger on the UI thread (a Reanimated shared value),
 * so dragging is glassy-smooth regardless of how heavy the React re-render is. The data (onChange) is
 * committed on a ~30 fps throttle during the drag + once on release, so a drag doesn't re-render the
 * whole editor (every Skia layer) on every frame — that churn was the lag.
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
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const thumb = useSharedValue(frac)
  const wSv = useSharedValue(1)
  const dragging = useSharedValue(false)
  const lastCommit = useRef(0)

  // Sync the thumb to an EXTERNAL value change (tool switch etc.) — but never while dragging.
  useEffect(() => { if (!dragging.value) thumb.value = frac }, [frac, dragging, thumb])

  const commit = (f: number, throttle: boolean) => {
    const now = Date.now()
    if (throttle && now - lastCommit.current < 33) return
    lastCommit.current = now
    const snapped = Math.round((min + f * (max - min)) / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }

  const pan = useRef(
    Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => { 'worklet'; dragging.value = true; const f = Math.max(0, Math.min(1, e.x / wSv.value)); thumb.value = f; runOnJS(commit)(f, true) })
      .onUpdate((e) => { 'worklet'; const f = Math.max(0, Math.min(1, e.x / wSv.value)); thumb.value = f; runOnJS(commit)(f, true) })
      .onEnd((e) => { 'worklet'; const f = Math.max(0, Math.min(1, e.x / wSv.value)); thumb.value = f; runOnJS(commit)(f, false) })
      .onFinalize(() => { 'worklet'; dragging.value = false }),
  ).current

  const fillStyle = useAnimatedStyle(() => ({ width: `${thumb.value * 100}%` }))
  const thumbStyle = useAnimatedStyle(() => ({ left: `${thumb.value * 100}%` }))

  return (
    <View className="flex-row items-center gap-2.5 py-1">
      <Text className="w-[52px] text-xs font-semibold text-muted-foreground">{label}</Text>
      <GestureDetector gesture={pan}>
        <View className="h-7 flex-1 justify-center" onLayout={(e) => { wSv.value = e.nativeEvent.layout.width }}>
          <View className="absolute inset-x-0 h-1 rounded-full bg-muted-foreground/20" />
          <Animated.View className="absolute h-1 rounded-full bg-primary" style={fillStyle} />
          <Animated.View className="absolute -ml-2.5 h-5 w-5 rounded-full border-2 border-primary bg-card shadow" style={thumbStyle} />
        </View>
      </GestureDetector>
      <Text className={cn('w-[42px] text-right text-xs text-foreground')} style={{ fontVariant: ['tabular-nums'] }}>
        {format ? format(value) : String(Math.round(value))}
      </Text>
    </View>
  )
}
