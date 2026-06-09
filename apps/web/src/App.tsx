import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/ui/AppShell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { RequireAuth } from './components/ui/RequireAuth'
import { AuthProvider } from './state/AuthContext'
import DiscoveryScreen from './screens/DiscoveryScreen'
import CanvasDetailScreen from './screens/CanvasDetailScreen'
import LoginScreen from './screens/LoginScreen'
import DashboardScreen from './screens/DashboardScreen'
import MyCanvasesScreen from './screens/MyCanvasesScreen'
import PremiumScreen from './screens/PremiumScreen'
import NotFoundScreen from './screens/NotFoundScreen'
import CreateCanvasWizard from './screens/CreateCanvasWizard'
import DrawingScreen from './screens/DrawingScreen'
import CanvasDrawScreen from './screens/CanvasDrawScreen'
import UserProfileScreen from './screens/UserProfileScreen'
import DesignSystemScreen from './screens/DesignSystemScreen'
import PrivateJoinScreen from './screens/PrivateJoinScreen'
import PrivateHostScreen from './screens/PrivateHostScreen'

/**
 * Drawie2 routes. Drawing artboard (/draw and /canvas/:id/draw/:tileId) still
 * use ComingSoon stubs; everything else is live.
 */
export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/draw" element={<DrawingScreen onLeave={() => window.history.back()} />} />

          {/* Private canvas — link-only, guest entry (no account) + host console */}
          <Route path="/join/:guestToken" element={<PrivateJoinScreen />} />
          <Route path="/host/:hostToken" element={<PrivateHostScreen />} />
          <Route
            path="/canvas/:id/draw/:tileId"
            element={<RequireAuth><CanvasDrawScreen /></RequireAuth>}
          />

          <Route element={<AppShell />}>
            <Route path="/" element={<DiscoveryScreen />} />
            <Route path="/canvas/:id" element={<CanvasDetailScreen />} />
            <Route path="/dashboard" element={<RequireAuth><DashboardScreen /></RequireAuth>} />
            <Route path="/dashboard/canvases" element={<RequireAuth><MyCanvasesScreen /></RequireAuth>} />
            <Route path="/create-canvas" element={<RequireAuth><CreateCanvasWizard /></RequireAuth>} />
            <Route path="/premium" element={<PremiumScreen />} />
            <Route path="/profile/:userId" element={<UserProfileScreen />} />
            <Route path="/design-system" element={<DesignSystemScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}
