import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Pressable, TextInput, Keyboard } from 'react-native'
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { Text } from '../components/ui/text'
import { EyedropperIcon } from '../components/icons'
import { tokenColors } from '../theme/tokenColors'

/**
 * Full color picker (the image the user sent): a saturation/value square, a rainbow hue strip, the
 * current swatch + eyedropper, and R/G/B inputs. Gradients are drawn with Skia (already in the build —
 * no expo-linear-gradient dependency). Drag the square (S=x, V=y) and the strip (hue=x).
 */
export function SvColorPicker({
  color, onChange, onEyedrop,
}: {
  color: string
  onChange: (hex: string) => void
  onEyedrop?: () => void
}) {
  const { h, s, v } = hexToHsv(color)
  const { r, g, b } = hexToRgb(color)
  const hueHex = hsvToHex(h, 1, 1)

  // Dims are STATE so the Skia <Canvas> actually renders once measured; mirrored to refs for the
  // gesture worklets (which must read the latest size without re-subscribing).
  const [svDims, setSvDims] = useState({ w: 0, h: 0 })
  const [hueW, setHueW] = useState(0)
  // Live values for the gesture worklets (avoid stale closures / re-created gestures mid-drag).
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const hueRef = useRef(h); hueRef.current = h
  const currentS = useRef(s); currentS.current = s
  const currentV = useRef(v); currentV.current = v

  // UI-thread thumb positions (fractions) + dims as shared values, so dragging is smooth no matter how
  // heavy the React re-render is — exactly like the Slider.
  const svFx = useSharedValue(s)        // saturation 0..1 (x)
  const svFy = useSharedValue(1 - v)    // value 0..1 from the top (y)
  const hueF = useSharedValue(h / 360)
  const svW = useSharedValue(1), svH = useSharedValue(1), hueWsv = useSharedValue(1)
  const dragging = useSharedValue(false)
  useEffect(() => {
    if (!dragging.value) { svFx.value = s; svFy.value = 1 - v; hueF.value = h / 360 }
  }, [s, v, h, dragging, svFx, svFy, hueF])

  // Blur any focused R/G/B field the instant a Pencil drag starts on the square/strip. While a TextInput
  // holds focus, iPadOS Scribble hijacks the Apple Pencil (gray handwriting ink over the UI), so dropping
  // focus on drag-start lets the Pencil pick a colour instead of triggering handwriting.
  const dismissKb = useCallback(() => Keyboard.dismiss(), [])

  // Throttle the data commit to ~30 fps so a drag doesn't re-render the editor every frame.
  const lastCommit = useRef(0)
  const applySv = useCallback((fx: number, fy: number, throttle: boolean) => {
    const now = Date.now()
    if (throttle && now - lastCommit.current < 33) return
    lastCommit.current = now
    onChangeRef.current(hsvToHex(hueRef.current, fx, 1 - fy))
  }, [])
  const applyHue = useCallback((f: number, throttle: boolean) => {
    const now = Date.now()
    if (throttle && now - lastCommit.current < 33) return
    lastCommit.current = now
    onChangeRef.current(hsvToHex(f * 360, currentS.current || 1, currentV.current || 1))
  }, [])

  const svPan = useRef(
    Gesture.Pan().minDistance(0)
      .onBegin((e) => { 'worklet'; dragging.value = true; runOnJS(dismissKb)(); const fx = Math.max(0, Math.min(1, e.x / svW.value)), fy = Math.max(0, Math.min(1, e.y / svH.value)); svFx.value = fx; svFy.value = fy; runOnJS(applySv)(fx, fy, true) })
      .onUpdate((e) => { 'worklet'; const fx = Math.max(0, Math.min(1, e.x / svW.value)), fy = Math.max(0, Math.min(1, e.y / svH.value)); svFx.value = fx; svFy.value = fy; runOnJS(applySv)(fx, fy, true) })
      .onEnd((e) => { 'worklet'; const fx = Math.max(0, Math.min(1, e.x / svW.value)), fy = Math.max(0, Math.min(1, e.y / svH.value)); svFx.value = fx; svFy.value = fy; runOnJS(applySv)(fx, fy, false) })
      .onFinalize(() => { 'worklet'; dragging.value = false }),
  ).current
  const huePan = useRef(
    Gesture.Pan().minDistance(0)
      .onBegin((e) => { 'worklet'; dragging.value = true; runOnJS(dismissKb)(); const f = Math.max(0, Math.min(1, e.x / hueWsv.value)); hueF.value = f; runOnJS(applyHue)(f, true) })
      .onUpdate((e) => { 'worklet'; const f = Math.max(0, Math.min(1, e.x / hueWsv.value)); hueF.value = f; runOnJS(applyHue)(f, true) })
      .onEnd((e) => { 'worklet'; const f = Math.max(0, Math.min(1, e.x / hueWsv.value)); hueF.value = f; runOnJS(applyHue)(f, false) })
      .onFinalize(() => { 'worklet'; dragging.value = false }),
  ).current

  const svThumbStyle = useAnimatedStyle(() => ({ left: `${svFx.value * 100}%`, top: `${svFy.value * 100}%` }))
  const hueThumbStyle = useAnimatedStyle(() => ({ left: `${hueF.value * 100}%` }))

  const setChannel = (key: 'r' | 'g' | 'b', text: string) => {
    const n = clamp(parseInt(text.replace(/[^0-9]/g, '') || '0', 10), 0, 255)
    const next = { r, g, b, [key]: n }
    onChange(rgbToHex(next.r, next.g, next.b))
  }

  return (
    <View className="gap-2">
      <GestureDetector gesture={svPan}>
        <View className="h-40 w-full overflow-hidden rounded-lg bg-black" onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setSvDims({ w: width, h: height }); svW.value = width; svH.value = height }}>
          {svDims.w > 0 && (
            <Canvas style={{ width: svDims.w, height: svDims.h }}>
              <Rect x={0} y={0} width={svDims.w} height={svDims.h}>
                <LinearGradient start={vec(0, 0)} end={vec(svDims.w, 0)} colors={['#ffffff', hueHex]} />
              </Rect>
              <Rect x={0} y={0} width={svDims.w} height={svDims.h}>
                <LinearGradient start={vec(0, 0)} end={vec(0, svDims.h)} colors={['rgba(0,0,0,0)', '#000000']} />
              </Rect>
            </Canvas>
          )}
          <Animated.View pointerEvents="none" className="absolute h-4 w-4 rounded-full border-2 border-white shadow" style={[{ marginLeft: -8, marginTop: -8, backgroundColor: color }, svThumbStyle]} />
        </View>
      </GestureDetector>

      <View className="flex-row items-center gap-2.5">
        {onEyedrop && (
          <Pressable onPress={onEyedrop} className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <EyedropperIcon size={17} color={tokenColors.foreground} />
          </Pressable>
        )}
        <View className="h-9 w-9 rounded-full border border-black/10" style={{ backgroundColor: color }} />
        <GestureDetector gesture={huePan}>
          <View className="h-5 flex-1 justify-center overflow-hidden rounded-full" onLayout={(e) => { const w = e.nativeEvent.layout.width; setHueW(w); hueWsv.value = w }}>
            {hueW > 0 && (
              <Canvas style={{ width: hueW, height: 20 }}>
                <Rect x={0} y={0} width={hueW} height={20}>
                  <LinearGradient start={vec(0, 0)} end={vec(hueW, 0)} colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']} />
                </Rect>
              </Canvas>
            )}
            <Animated.View pointerEvents="none" className="absolute h-5 w-5 rounded-full border-2 border-white shadow" style={[{ marginLeft: -10, backgroundColor: hueHex }, hueThumbStyle]} />
          </View>
        </GestureDetector>
      </View>

      <View className="flex-row gap-2">
        {(['r', 'g', 'b'] as const).map((k, i) => (
          <View key={k} className="flex-1 items-center gap-0.5">
            <TextInput
              value={String([r, g, b][i])}
              onChangeText={(t) => setChannel(k, t)}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
              className="w-full rounded-lg border border-border bg-card py-1.5 text-center text-[15px] text-foreground"
            />
            <Text className="text-[10px] font-bold text-muted-foreground">{k.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { r: 124, g: 140, b: 255 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
function rgbToHex(r: number, g: number, b: number) {
  const h = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToHex(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}
