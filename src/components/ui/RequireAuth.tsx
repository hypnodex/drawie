import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Spinner } from '@heroui/react'
import { useAuth } from '../../state/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, isLoading } = useAuth()
  const loc = useLocation()
  // Wait for the initial session to resolve so a refresh on a protected route
  // doesn't bounce an already-signed-in user to /login.
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!isAuthed) return <Navigate to="/login" state={{ from: loc }} replace />
  return <>{children}</>
}
