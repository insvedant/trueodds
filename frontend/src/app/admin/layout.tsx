'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle, useTheme } from '@/lib/theme'

const NAV = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/revenue', label: 'Revenue', icon: '💰' },
  { href: '/admin/bets', label: 'All Bets', icon: '🎯' },
  { href: '/admin/blog', label: 'Blog', icon: '✍️' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login')
      else if (user.role !== 'admin') router.push('/dashboard')
    }
  }, [user, loading])

  if (loading || !user || user.role !== 'admin') {
    return <div style={{ minHeight: '100vh', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading admin panel...</div>
  }

  const sw = collapsed ? 60 : 200

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg2)' }}>
      <aside style={{ width: sw, background: 'var(--bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? 0 : '0 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && <div style={{ fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap' }}>True<span style={{ color: 'var(--green)' }}>Odds</span> <span style={{ fontSize: 10, color: 'var(--red)', background: 'rgba(248,81,73,0.1)', padding: '2px 6px', borderRadius: 4 }}>ADMIN</span></div>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>{collapsed ? '→' : '←'}</button>
        </div>

        <nav style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px' : '9px 12px', justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 7, marginBottom: 2, textDecoration: 'none',
                background: active ? 'rgba(0,200,83,0.1)' : 'transparent',
                color: active ? '#00C853' : 'var(--muted)',
                fontWeight: active ? 700 : 400, fontSize: 13, whiteSpace: 'nowrap',
              }} title={collapsed ? item.label : undefined}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
          <div style={{ height: 1, background: 'var(--border2)', margin: '8px 6px' }} />
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 7, textDecoration: 'none', color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }} title={collapsed ? 'User View' : undefined}>
            <span style={{ fontSize: 17 }}>👤</span>
            {!collapsed && <span>User View</span>}
          </Link>
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
          {!collapsed ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                <span style={{ fontSize:11,color:'var(--muted)' }}>{theme==='dark'?'Dark':'Light'} mode</span>
                <ThemeToggle size="sm" />
              </div>
              <button onClick={logout} style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', padding: '4px 10px', width: '100%', marginTop: 6 }}>Logout</button>
            </div>
          ) : (
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, width: '100%' }}>⏻</button>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {children}
      </main>
    </div>
  )
}
