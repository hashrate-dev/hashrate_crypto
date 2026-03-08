import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, authChecked } = useAuth()
  const location = useLocation()

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <span className="w-8 h-8 border-2 border-exodus/30 border-t-exodus rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
