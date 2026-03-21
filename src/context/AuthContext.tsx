import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../api/users'
import { isSupabaseBackend } from '../lib/backendMode'
import { loadUserFromSupabaseSession } from '../api/supabaseProfileLoader'

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
    if (isSupabaseBackend()) {
      void import('../lib/supabaseClient').then(({ getSupabase }) => {
        void getSupabase().auth.signOut()
      })
    }
    setUserState(null)
    saveUser(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { loginUser } = await import('../api/users')
    const { user: u } = await loginUser({ email: email.trim(), password })
    setUserState(u)
    saveUser(u)
  }, [])

  useEffect(() => {
    if (isSupabaseBackend()) {
      let cancelled = false
      const subHolder: { current?: { unsubscribe: () => void } } = {}
      void import('../lib/supabaseClient').then(({ getSupabase }) => {
        if (cancelled) return
        const sb = getSupabase()
        const applySession = async (session: { user: { id: string } } | null) => {
          if (cancelled) return
          if (!session?.user) {
            setUserState(null)
            saveUser(null)
            setAuthChecked(true)
            return
          }
          try {
            const u = await loadUserFromSupabaseSession(sb, session.user.id)
            if (cancelled) return
            setUserState(u)
            saveUser(u)
          } catch {
            if (cancelled) return
            setUserState(null)
            saveUser(null)
          }
          setAuthChecked(true)
        }

        void sb.auth.getSession().then(({ data: { session } }) => {
          void applySession(session)
        })

        const {
          data: { subscription },
        } = sb.auth.onAuthStateChange((_event, session) => {
          void applySession(session)
        })
        subHolder.current = subscription
      })
      return () => {
        cancelled = true
        subHolder.current?.unsubscribe()
      }
    }

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
    return () => {
      cancelled = true
    }
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
