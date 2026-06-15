import './global.css' // NativeWind v4: imports the Tailwind CSS so metro processes it
import { registerRootComponent } from 'expo'

// NativeWind v4 compat spike. Hardcoded ON for this spike branch so it renders
// deterministically, and App is lazily require()'d so its Supabase-init side-effect
// never runs in spike mode. Flip to false to run the real app from this branch.
const SPIKE = true

if (SPIKE) {
  registerRootComponent(require('./src/spike/NativeWindSpike').NativeWindSpike)
} else {
  registerRootComponent(require('./App').default)
}
