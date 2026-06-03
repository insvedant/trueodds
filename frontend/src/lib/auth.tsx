'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const api = axios.create({ baseURL: `${API}/api` })

api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('to_token')
    if (t) cfg.headers.Authorization = `Bearer ${t}`
  }
  return cfg
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('to_token')
    localStorage.removeItem('to_user')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

export type User = {
  id: string; name: string; email: string
  role: 'user' | 'admin'; plan: 'free' | 'basic' | 'gold' | 'platinum'
  subscriptionStatus: string; subscriptionExpiry?: string
  totalPaid?: number
}

type AuthCtx = {
  user: User | null; token: string | null; loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, phone?: string, referralCode?: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('to_token')
    const u = localStorage.getItem('to_user')
    if (t && u) {
      setToken(t)
      setUser(JSON.parse(u))
      
      api.get('/auth/me').then(res => {
        setUser(res.data.user)
        localStorage.setItem('to_user', JSON.stringify(res.data.user))
      }).catch(() => {
        
        localStorage.removeItem('to_token')
        localStorage.removeItem('to_user')
        setToken(null)
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: tk, user: u } = res.data
    localStorage.setItem('to_token', tk)
    localStorage.setItem('to_user', JSON.stringify(u))
    setToken(tk); setUser(u)
  }

  const register = async (name: string, email: string, password: string, phone?: string, referralCode?: string) => {
    const res = await api.post('/auth/register', { name, email, password, phone, referralCode })
    const { token: tk, user: u } = res.data
    localStorage.setItem('to_token', tk)
    localStorage.setItem('to_user', JSON.stringify(u))
    setToken(tk); setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('to_token'); localStorage.removeItem('to_user')
    setToken(null); setUser(null)
    window.location.href = '/login'
  }

  const refresh = async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
      localStorage.setItem('to_user', JSON.stringify(res.data.user))
    } catch {}
  }

  return <Ctx.Provider value={{ user, token, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
