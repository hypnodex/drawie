import './src/supabase' // initialises the Supabase client — must run before anything uses it
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Tile } from '@drawie/data'
import { EditorScreen } from './src/EditorScreen'
import { LoginScreen } from './src/auth/LoginScreen'
import { DiscoveryScreen } from './src/screens/DiscoveryScreen'
import { CanvasScreen } from './src/screens/CanvasScreen'
import { CreateCanvasScreen } from './src/screens/CreateCanvasScreen'

/**
 * Phase 5 native entry. Auth-gates the product, then a minimal state-based router for the
 * mosaic loop: discovery → canvas (tile grid) → editor (draw a claimed tile). expo-router
 * can replace this once the screen set grows.
 */
type Route =
  | { name: 'discovery' }
  | { name: 'create' }
  | { name: 'canvas'; canvasId: string }
  | { name: 'editor'; canvasId: string; tile: Tile }

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [route, setRoute] = useState<Route>({ name: 'discovery' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) setRoute({ name: 'discovery' }) // reset nav on sign-out
    })
    return () => sub.subscription.unsubscribe()
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
      />
    )
  } else if (route.name === 'create') {
    content = (
      <CreateCanvasScreen
        onBack={() => setRoute({ name: 'discovery' })}
        onCreated={(canvasId) => setRoute({ name: 'canvas', canvasId })}
      />
    )
  } else if (route.name === 'canvas') {
    content = (
      <CanvasScreen
        canvasId={route.canvasId}
        onBack={() => setRoute({ name: 'discovery' })}
        onDraw={(tile) => setRoute({ name: 'editor', canvasId: route.canvasId, tile })}
      />
    )
  } else {
    content = (
      <EditorScreen
        canvasId={route.canvasId}
        tile={route.tile}
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
