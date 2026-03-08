import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../api/users'

const STORAGE_KEY = 'volt_user'

interface AuthContextValue {
  user: User | null
  authChecked: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data && typeof data.id === 'number' && typeof data.email === 'string') {
      return data as User
    }
  } catch {
    // ignore
  }
  return null
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const setUser = useCallback((u: User) => {
    setUserState(u)
    saveUser(u)
  }, [])

  const logout = useCallback(() => {
    setUserState(null)
    saveUser(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { loginUser } = await import('../api/users')
    const { user: u } = await loginUser({ email: email.trim(), password })
    setUserState(u)
    saveUser(u)
  }, [])

  // No confiar en localStorage: validar SIEMPRE con el servidor antes de considerar logueado
  useEffect(() => {
    const stored = getStoredUser()
    if (!stored?.id) {
      setAuthChecked(true)
      return
    }
    let cancelled = false
    import('../api/users')
      .then(({ getUserById }) => getUserById(stored.id))
      .then(({ user: u }) => {
        if (!cancelled) {
          setUserState(u)
          saveUser(u)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserState(null)
          saveUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AuthContext.Provider value={{ user, authChecked, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
