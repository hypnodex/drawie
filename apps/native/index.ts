import 'expo-dev-client' // dev launcher: lets you repoint the Metro URL on-device (no rebuild when the LAN IP changes)
import './global.css' // NativeWind v4: imports the Tailwind CSS so metro processes it
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
