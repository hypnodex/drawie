import { useState } from 'react'
import { View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { joinPrivateCanvas, type Canvas, type Tile } from '@drawie/data'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ScreenHeader } from '../components/ui/screen-header'

/** Pull the opaque token out of a full guest link (…/join/<token> or …?token=<token>) or a raw code. */
export function extractToken(s: string): string {
  const t = s.trim()
  return t.match(/[?&]token=([^&#]+)/)?.[1] ?? t.match(/\/join\/([^?#/]+)/)?.[1] ?? t
}

/**
 * Join a private canvas from an invite — paste the guest link or code. join_private_canvas resolves
 * the token, assigns an artboard, and returns {canvas, tile}; we drop straight into the editor to draw
 * it. (Deep links — drawie://join?token=… — are handled in App.tsx; this is the manual path.)
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
 */
export function JoinScreen({ onBack, onJoined }: { onBack: () => void; onJoined: (canvas: Canvas, tile: Tile) => void }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async () => {
    const token = extractToken(input)
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const { canvas, tile } = await joinPrivateCanvas(token)
      onJoined(canvas, tile)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('INVALID_TOKEN') ? 'That invite link or code is invalid.' : msg)
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-background">
      <ScreenHeader title="Join private" onBack={onBack} backLabel="Canvases" />

      <View className="mt-5 w-full max-w-[520px] gap-3.5 self-center p-5">
        <Text className="text-center text-sm leading-5 text-muted-foreground">
          Paste the invite link or code someone shared with you.
        </Text>
        <Input
          value={input}
          onChangeText={setInput}
          onSubmitEditing={join}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Invite link or code"
        />
        {!!error && <Text className="text-center text-sm text-destructive">{error}</Text>}
        <Button onPress={join} disabled={!input.trim() || busy}>
          {busy ? <ActivityIndicator color="white" /> : <Text>Join & draw</Text>}
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}
