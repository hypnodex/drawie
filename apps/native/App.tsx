import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet } from 'react-native'
import { EditorScreen } from './src/EditorScreen'

/**
 * Phase 5 native entry. The product shell is being rebuilt in RN (STEP 4) on top of the
 * shared @drawie/core engine; right now that's the editor screen. Auth + discovery + the
 * other screens (and expo-router navigation) follow in later increments.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="auto" />
      <EditorScreen />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
