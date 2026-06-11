import { useState } from 'react'
import { StyleSheet, View, Text, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { joinPrivateCanvas, type Canvas, type Tile } from '@drawie/data'

/** Pull the opaque token out of a full guest link (…/join/<token> or …?token=<token>) or a raw code. */
export function extractToken(s: string): string {
  const t = s.trim()
  return t.match(/[?&]token=([^&#]+)/)?.[1] ?? t.match(/\/join\/([^?#/]+)/)?.[1] ?? t
}

/**
 * Join a private canvas from an invite — paste the guest link or code. join_private_canvas resolves
 * the token, assigns an artboard, and returns {canvas, tile}; we drop straight into the editor to draw
 * it. (Deep links — drawie://join?token=… — are handled in App.tsx; this is the manual path.)
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.title}>Join private</Text>
        <View style={{ width: 90 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sub}>Paste the invite link or code someone shared with you.</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={join}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Invite link or code"
          placeholderTextColor="#bbb"
          style={styles.input}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.btn, (!input.trim() || busy) && styles.btnOff]} onPress={join} disabled={!input.trim() || busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Join & draw</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 90 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  body: { padding: 20, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center', marginTop: 20 },
  sub: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#e3e3e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafc' },
  error: { color: '#ef476f', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: '#7c8cff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
