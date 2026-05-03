/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setToken } from '../api/client'
import type { UserMe } from '../api/types'

interface AuthState {
  user: UserMe | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken = typeof window !== 'undefined' ? localStorage.getItem('discify_web_token') : null
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(Boolean(initialToken))

  useEffect(() => {
    if (!initialToken) {
      return
    }

    setToken(initialToken)
    api
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('discify_web_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [initialToken])

  async function login(email: string, password: string) {
    const { access_token } = await api.login(email, password)
    localStorage.setItem('discify_web_token', access_token)
    setToken(access_token)
    const me = await api.me()
    setUser(me)
  }

  async function register(email: string, password: string) {
    const { access_token } = await api.register(email, password)
    localStorage.setItem('discify_web_token', access_token)
    setToken(access_token)
    const me = await api.me()
    setUser(me)
  }

  function logout() {
    localStorage.removeItem('discify_web_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
