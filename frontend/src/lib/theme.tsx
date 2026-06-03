'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light'

type ThemeCtxType = {
  theme: Theme
  toggle: () => void
  
  forceDark: () => void
  
  restoreTheme: () => void
}

const ThemeCtx = createContext<ThemeCtxType>({
  theme: 'dark', toggle: () => {}, forceDark: () => {}, restoreTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [saved, setSaved] = useState<Theme>('dark')

  
  useEffect(() => {
    const s = (localStorage.getItem('to_theme') as Theme) || 'dark'
    setTheme(s); setSaved(s)
  }, [])

  
  const applyTheme = (t: Theme) => {
    const root = document.documentElement
    if (t === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); setSaved(next)
    localStorage.setItem('to_theme', next)
  }

  
  const forceDark = () => {
    document.documentElement.removeAttribute('data-theme')
  }

  
  const restoreTheme = () => {
    const s = (localStorage.getItem('to_theme') as Theme) || 'dark'
    setSaved(s); setTheme(s); applyTheme(s)
  }

  return (
    <ThemeCtx.Provider value={{ theme: saved, toggle, forceDark, restoreTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() { return useContext(ThemeCtx) }

export function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const w = size === 'sm' ? 40 : 48
  const h = size === 'sm' ? 22 : 26
  const k = size === 'sm' ? 16 : 20
  const top = 3

  return (
    <button onClick={toggle} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{ display:'inline-flex',alignItems:'center',gap:7,background:'transparent',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit' }}>
      <span style={{ fontSize: size === 'sm' ? 13 : 15 }}>{isDark ? '🌙' : '☀️'}</span>
      <div style={{ width:w,height:h,borderRadius:h,background:isDark?'#1e293b':'#e2e8f0',border:`1px solid ${isDark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.12)'}`,position:'relative',transition:'background 0.3s,border-color 0.3s',flexShrink:0 }}>
        <div style={{ position:'absolute',top,left:isDark?w-k-top-1:top,width:k,height:k,borderRadius:'50%',background:isDark?'#00C853':'#f59e0b',transition:'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',boxShadow:isDark?'0 0 8px rgba(0,200,83,0.5)':'0 0 8px rgba(245,158,11,0.5)' }} />
      </div>
    </button>
  )
}
