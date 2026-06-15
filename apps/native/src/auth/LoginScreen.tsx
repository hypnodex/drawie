import { useState } from 'react'
import { View, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native'
import { supabase } from '@drawie/data'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

/** drawie:// deep link the OAuth provider redirects back to; App.tsx exchanges the ?code for a session. */
const OAUTH_REDIRECT = 'drawie://auth-callback'

/**
 * Email/password + Google OAuth + guest sign-in for the native app. Google uses the PKCE deep-link
 * flow: signInWithOAuth(skipBrowserRedirect) → open the provider URL in the system browser → it
 * redirects to OAUTH_REDIRECT, which App.tsx catches and exchanges for a session.
 *
 * Phase 3 (native shadcn): bespoke StyleSheet → NativeWind className + RN-Reusables primitives
 * (Text/Button/Input) over the shadcn HSL tokens, matching the web LoginScreen's visual language,
 * adapted to the tablet. Auth LOGIC is unchanged.
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

  const signInGoogle = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (data?.url) await Linking.openURL(data.url) // browser → redirect → App.tsx exchanges the code
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false) // the user is in the browser now; the screen stays until the session lands
    }
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-md gap-3 rounded-2xl bg-secondary p-8">
          {/* brand */}
          <View className="mb-2 flex-row items-center justify-center gap-2">
            <View className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-foreground" />
              <View className="h-2 w-2 rounded-full bg-foreground" />
              <View className="h-2 w-2 rounded-full bg-foreground" />
            </View>
            <Text className="text-base font-extrabold tracking-tight text-foreground">Drawie</Text>
          </View>

          <Text className="text-center text-2xl font-extrabold text-foreground">Sign in to Drawie</Text>
          <Text className="mb-2 text-center text-sm text-muted-foreground">
            Join a canvas, save your work, and collaborate in real time.
          </Text>

          <Input
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={signIn}
            returnKeyType="go"
          />

          {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

          <Button onPress={signIn} disabled={busy} className="mt-1">
            {busy ? <ActivityIndicator color="white" /> : <Text>Sign in</Text>}
          </Button>

          {/* divider */}
          <View className="my-1 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs uppercase tracking-wider text-muted-foreground">or</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Button variant="outline" onPress={signInGoogle} disabled={busy}>
            <Text className="text-base font-extrabold text-[#4285F4]">G</Text>
            <Text>Continue with Google</Text>
          </Button>
          <Button variant="ghost" onPress={continueAsGuest} disabled={busy}>
            <Text>Continue as guest</Text>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
