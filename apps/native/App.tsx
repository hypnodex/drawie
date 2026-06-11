import './src/supabase' // initialises the Supabase client — must run before anything uses it
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator, Linking } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase, joinPrivateCanvas, type Tile, type Canvas } from '@drawie/data'
import { EditorScreen } from './src/EditorScreen'
import { LoginScreen } from './src/auth/LoginScreen'
import { DiscoveryScreen } from './src/screens/DiscoveryScreen'
import { CanvasScreen } from './src/screens/CanvasScreen'
import { CreateCanvasScreen } from './src/screens/CreateCanvasScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { ShareScreen } from './src/screens/ShareScreen'
import { JoinScreen } from './src/screens/JoinScreen'
import { GoldenScreen } from './src/golden/GoldenScreen'

/**
 * Phase 5 native entry. Auth-gates the product, then a minimal state-based router for the
 * mosaic loop: discovery → canvas (tile grid) → editor (draw a claimed tile). expo-router
 * can replace this once the screen set grows.
 */
type Route =
  | { name: 'discovery' }
  | { name: 'create' }
  | { name: 'profile' }
  | { name: 'share'; canvas: Canvas }
  | { name: 'join' }
  | { name: 'golden' }
  | { name: 'canvas'; canvasId: string }
  | { name: 'editor'; canvasId: string; tile: Tile; canvas: Canvas }

// Deep-link single-use guards — the redirect can arrive via BOTH getInitialURL (cold) and the 'url'
// event. Module-level so they survive effect re-runs.
const handledOAuthCodes = new Set<string>()
const handledJoinTokens = new Set<string>()

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [route, setRoute] = useState<Route>({ name: 'discovery' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[auth] state:', event, s ? `(session ${s.user.email ?? s.user.id})` : '(no session)')
      setSession(s)
      if (!s) setRoute({ name: 'discovery' }) // reset nav on sign-out
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // OAuth deep-link: Google sign-in opens a browser that redirects to drawie://auth-callback?code=…
  // (PKCE). Exchange that code for a session here; onAuthStateChange above then swaps to the product.
  // Built-in Linking (no expo-web-browser) so it works on the current dev build without a native rebuild.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return
      const err = url.match(/[?&]error[^=]*=([^&]+)/)?.[1]
      if (err) { console.warn('[auth] OAuth redirect error:', decodeURIComponent(err)); return }
      // Private-canvas invite: drawie://join?token=… or …/join/<token> → join + drop into the editor.
      if (/[?&]token=|\/join\//.test(url)) {
        const token = url.match(/[?&]token=([^&#]+)/)?.[1] ?? url.match(/\/join\/([^?#/]+)/)?.[1]
        if (token && !handledJoinTokens.has(token)) {
          handledJoinTokens.add(token)
          try {
            const { canvas, tile } = await joinPrivateCanvas(decodeURIComponent(token))
            setRoute({ name: 'editor', canvasId: canvas.id, tile, canvas })
          } catch (e) { console.warn('[join] failed:', e instanceof Error ? e.message : String(e)) }
        }
        return
      }
      const code = url.match(/[?&]code=([^&]+)/)?.[1]
      // Dedupe: the redirect can arrive via BOTH getInitialURL (cold) and the 'url' event, but the
      // PKCE code is single-use — exchanging twice yields a benign "invalid flow state". Skip repeats.
      if (!code || handledOAuthCodes.has(code)) return
      handledOAuthCodes.add(code)
      const { error } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code))
      if (error) console.warn('[auth] code exchange failed:', error.message)
    }
    void Linking.getInitialURL().then(handleUrl) // cold start via the deep link
    const sub = Linking.addEventListener('url', ({ url }) => void handleUrl(url)) // warm
    return () => sub.remove()
  }, [])

  let content
  if (session === undefined) {
    content = <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
  } else if (!session) {
    content = <LoginScreen />
  } else if (route.name === 'discovery') {
    content = (
      <DiscoveryScreen
        onOpen={(canvasId) => setRoute({ name: 'canvas', canvasId })}
        onCreate={() => setRoute({ name: 'create' })}
        onJoin={() => setRoute({ name: 'join' })}
        onProfile={() => setRoute({ name: 'profile' })}
        onDevTools={() => setRoute({ name: 'golden' })}
      />
    )
  } else if (route.name === 'create') {
    content = (
      <CreateCanvasScreen
        onBack={() => setRoute({ name: 'discovery' })}
        onCreated={(canvas) =>
          setRoute(canvas.visibility === 'private-link' ? { name: 'share', canvas } : { name: 'canvas', canvasId: canvas.id })}
      />
    )
  } else if (route.name === 'share') {
    content = (
      <ShareScreen
        canvas={route.canvas}
        onOpen={(id) => setRoute({ name: 'canvas', canvasId: id })}
        onBack={() => setRoute({ name: 'discovery' })}
      />
    )
  } else if (route.name === 'join') {
    content = (
      <JoinScreen
        onBack={() => setRoute({ name: 'discovery' })}
        onJoined={(canvas, tile) => setRoute({ name: 'editor', canvasId: canvas.id, tile, canvas })}
      />
    )
  } else if (route.name === 'profile') {
    content = (
      <ProfileScreen
        onBack={() => setRoute({ name: 'discovery' })}
        onOpen={(canvasId) => setRoute({ name: 'canvas', canvasId })}
      />
    )
  } else if (route.name === 'golden') {
    content = <GoldenScreen onBack={() => setRoute({ name: 'discovery' })} />
  } else if (route.name === 'canvas') {
    content = (
      <CanvasScreen
        canvasId={route.canvasId}
        onBack={() => setRoute({ name: 'discovery' })}
        onDraw={(tile, canvas) => setRoute({ name: 'editor', canvasId: route.canvasId, tile, canvas })}
      />
    )
  } else {
    content = (
      <EditorScreen
        canvasId={route.canvasId}
        tile={route.tile}
        canvas={route.canvas}
        onExit={() => setRoute({ name: 'canvas', canvasId: route.canvasId })}
      />
    )
  }

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="auto" />
      {content}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
