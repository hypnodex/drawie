import { useState } from 'react'
import { StyleSheet, View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '@drawie/data'

/**
 * Minimal email/password sign-in for the native app (STEP 5). OAuth (Google) via the drawie://
 * deep link + dev personas come later; this is enough to authenticate against the shared backend.
 */
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message)
    setBusy(false)
    // success → App's onAuthStateChange swaps to the editor.
  }

  // Anonymous session (enabled on the project) — quick end-to-end auth test, no account needed.
  const continueAsGuest = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInAnonymously()
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={styles.center}>
        <Text style={styles.title}>Drawie</Text>
        <Text style={styles.subtitle}>Sign in to draw on shared canvases</Text>

        <TextInput
          style={styles.input} placeholder="Email" placeholderTextColor="#999"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email"
          value={email} onChangeText={setEmail}
        />
        <TextInput
          style={styles.input} placeholder="Password" placeholderTextColor="#999"
          secureTextEntry value={password} onChangeText={setPassword}
          onSubmitEditing={signIn} returnKeyType="go"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={signIn} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} /><Text style={styles.dividerText}>or</Text><View style={styles.divider} />
        </View>
        <Pressable style={styles.guestButton} onPress={continueAsGuest} disabled={busy}>
          <Text style={styles.guestText}>Continue as guest</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%' },
  title: { fontSize: 34, fontWeight: '800', color: '#1a1a2e', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 16 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e6', paddingHorizontal: 14,
    fontSize: 16, color: '#1a1a2e', backgroundColor: '#fafafc',
  },
  error: { color: '#ef476f', fontSize: 13, textAlign: 'center' },
  button: { height: 48, borderRadius: 12, backgroundColor: '#7c8cff', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#ddd' },
  dividerText: { color: '#aaa', fontSize: 12 },
  guestButton: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e6', alignItems: 'center', justifyContent: 'center' },
  guestText: { color: '#555', fontSize: 15, fontWeight: '600' },
})

