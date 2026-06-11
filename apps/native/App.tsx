import './src/supabase' // initialises the Supabase client — must run before anything uses it
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@drawie/data'
import { EditorScreen } from './src/EditorScreen'
import { LoginScreen } from './src/auth/LoginScreen'

/**
 * Phase 5 native entry. Auth-gates the editor: undefined session = loading, null = show login,
 * a session = the editor. The product shell (discovery/canvas/tile picking, save/submit) is
 * built out on top of this in later increments.
 */
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="auto" />
      {session === undefined ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : session ? (
        <EditorScreen />
      ) : (
        <LoginScreen />
      )}
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
