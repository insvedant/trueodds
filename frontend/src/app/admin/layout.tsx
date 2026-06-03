'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle, useTheme } from '@/lib/theme'

const NAV = [
  { href: '/admin',             label: 'Overview',  icon: '📊' },
  { href: '/admin/users',       label: 'Users',     icon: '👥' },
  { href: '/admin/revenue',     label: 'Revenue',   icon: '💰' },
  { href: '/admin/bets',        label: 'All Bets',  icon: '🎯' },
  { href: '/admin/referrals',   label: 'Referrals', icon: '🎁' },
  { href: '/admin/chat',        label: 'Chat',      icon: '💬' },
  { href: '/admin/blog',        label: 'Blog',      icon: '✍️' },
  { href: '/admin/affiliates',  label: 'Affiliates',icon: '🔗' },
  { href: '/admin/newsletter',  label: 'Newsletter', icon: '📧' },
  { href: '/admin/settings',    label: 'Settings',  icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login')
      else if (user.role !== 'admin') router.push('/dashboard')
    }
  }, [user, loading])

  
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  if (loading || !user || user.role !== 'admin') {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', gap:12 }}>
        <span style={{ width:18, height:18, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
        Loading admin panel...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const sw = collapsed ? 60 : 200

  return (
    <div className="admin-wrapper" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg2)' }}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        .admin-nav-link { transition: background 0.15s, color 0.15s; }
        .admin-nav-link:hover { background: var(--hover-bg) !important; color: var(--text) !important; }

        .avatar-btn { transition: transform 0.2s, box-shadow 0.2s; }
        .avatar-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }

        /* Mobile bottom nav */
        @media (max-width: 768px) {
          .admin-wrapper { flex-direction: column !important; }
          .admin-sidebar {
            width: 100% !important;
            height: 62px !important;
            border-right: none !important;
            border-top: 1px solid var(--border) !important;
            position: fixed !important;
            bottom: 0 !important; left: 0 !important; right: 0 !important;
            z-index: 100 !important;
            overflow: visible !important;
            flex-direction: row !important;
          }
          .admin-logo { display: none !important; }
          .admin-nav {
            display: flex !important;
            flex-direction: row !important;
            padding: 0 !important;
            overflow-x: auto !important;
            overflow-y: visible !important;
            height: 62px !important;
            align-items: stretch !important;
            gap: 0 !important;
            flex: 1 !important;
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          .admin-nav::-webkit-scrollbar { display: none !important; }
          .admin-nav a {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 6px 10px !important;
            min-width: 52px !important;
            border-radius: 0 !important;
            margin-bottom: 0 !important;
            gap: 2px !important;
            font-size: 9px !important;
          }
          .admin-nav a span:first-child { font-size: 18px !important; }
          .admin-nav-divider { display: none !important; }
          .admin-user-section { display: none !important; }
          .admin-main { padding-bottom: 70px !important; height: calc(100vh - 62px) !important; overflow: auto !important; }

          /* Avatar popup menu — shown above bottom nav */
          .admin-avatar-wrap { display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 8px !important; border-left: 1px solid var(--border) !important; flex-shrink: 0 !important; position: relative !important; }
          .admin-avatar-menu {
            position: absolute !important;
            bottom: 70px !important;
            right: 4px !important;
            background: var(--bg2) !important;
            border: 1px solid var(--border) !important;
            borderRadius: 14px !important;
            padding: 8px !important;
            boxShadow: 0 -12px 40px rgba(0,0,0,0.4) !important;
            minWidth: 200px !important;
            zIndex: 200 !important;
            animation: slideUp 0.25s ease !important;
          }
        }
        @media (min-width: 769px) {
          .admin-avatar-wrap { display: none !important; }
        }
      `}</style>

      {}
      <aside className="admin-sidebar" style={{ width:sw, background:'var(--bg)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 0.2s', overflow:'hidden' }}>

        {}
        <div className="admin-logo" style={{ height:56, display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:collapsed?0:'0 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {!collapsed && (
            <div style={{ fontWeight:900, fontSize:15, whiteSpace:'nowrap' as const }}>
              True<span style={{ color:'var(--green)' }}>Odds</span>{' '}
              <span style={{ fontSize:10, color:'var(--red)', background:'rgba(248,81,73,0.1)', padding:'2px 6px', borderRadius:4 }}>ADMIN</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:16, padding:4, transition:'color 0.15s' }}
            onMouseEnter={e=>(e.currentTarget.style.color='var(--text)')}
            onMouseLeave={e=>(e.currentTarget.style.color='var(--muted)')}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {}
        <nav className="admin-nav" style={{ flex:1, padding:'8px 6px', overflowY:'auto' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="admin-nav-link"
                style={{ display:'flex', alignItems:'center', gap:10, padding:collapsed?'10px':'9px 12px', justifyContent:collapsed?'center':'flex-start', borderRadius:7, marginBottom:2, textDecoration:'none', background:active?'rgba(0,200,83,0.1)':'transparent', color:active?'#00C853':'var(--muted)', fontWeight:active?700:400, fontSize:13, whiteSpace:'nowrap' as const, borderLeft:active?'2px solid #00C853':'2px solid transparent' }}
                title={collapsed ? item.label : undefined}>
                <span style={{ fontSize:17, flexShrink:0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
          <div className="admin-nav-divider" style={{ height:1, background:'var(--border)', margin:'8px 6px' }} />
          <Link href="/dashboard" className="admin-nav-link"
            style={{ display:'flex', alignItems:'center', gap:10, padding:collapsed?'10px':'9px 12px', justifyContent:collapsed?'center':'flex-start', borderRadius:7, textDecoration:'none', color:'var(--muted)', fontSize:13, whiteSpace:'nowrap' as const }}
            title={collapsed ? 'Back to Site' : undefined}>
            <span style={{ fontSize:17 }}>🌐</span>
            {!collapsed && <span>Back to Site</span>}
          </Link>
        </nav>

        {}
        <div className="admin-user-section" style={{ padding:'10px 8px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          {!collapsed ? (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, background:'var(--bg3)', marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,200,83,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:13, flexShrink:0 }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{user.name}</div>
                  <div style={{ fontSize:10, color:'var(--green)', fontWeight:700 }}>ADMIN</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, padding:'0 2px' }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>{theme==='dark'?'Dark':'Light'} mode</span>
                <ThemeToggle size="sm" />
              </div>
              <Link href="/dashboard" style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:7, textDecoration:'none', color:'var(--muted)', fontSize:12, marginBottom:4, transition:'background 0.15s' }}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--hover-bg)')}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                <span>🌐</span> Back to Site
              </Link>
              <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', transition:'background 0.15s' }}
                onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,0.12)')}
                onMouseLeave={e=>(e.currentTarget.style.background='rgba(239,68,68,0.06)')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log out
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(0,200,83,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:13 }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <button onClick={logout} title="Log out" style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4, transition:'color 0.15s', display:'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          )}
        </div>

        {}
        <div className="admin-avatar-wrap" ref={menuRef}>
          <button className="avatar-btn" onClick={() => setMenuOpen(!menuOpen)}
            style={{ width:36, height:36, borderRadius:'50%', background:menuOpen?'rgba(0,200,83,0.2)':'rgba(0,200,83,0.12)', border:`2px solid ${menuOpen?'var(--green)':'rgba(0,200,83,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:15, cursor:'pointer', flexShrink:0 }}>
            {user.name?.charAt(0).toUpperCase()}
          </button>

          {menuOpen && (
            <div className="admin-avatar-menu" style={{ position:'absolute', bottom:70, right:4, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:8, boxShadow:'0 -12px 40px rgba(0,0,0,0.5)', minWidth:200, zIndex:200, animation:'slideUp 0.25s ease' }}>
              {}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, background:'var(--bg3)', marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,200,83,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:14, flexShrink:0 }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{user.name}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--green)', textTransform:'uppercase' as const }}>Admin</div>
                </div>
              </div>

              {}
              <button onPointerDown={() => toggle()}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'9px 12px', borderRadius:9, background:'var(--bg3)', border:'none', cursor:'pointer', fontFamily:'inherit', marginBottom:8, WebkitTapHighlightColor:'transparent' as any }}>
                <span style={{ fontSize:13, color:'var(--muted)' }}>{theme==='dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
                <span style={{ fontSize:12, color:'var(--green)', fontWeight:700 }}>Toggle</span>
              </button>

              {}
              <button onPointerDown={() => { setMenuOpen(false); logout() }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', WebkitTapHighlightColor:'transparent' as any }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="admin-main" style={{ flex:1, overflow:'auto', padding:'clamp(16px,3vw,24px)' }}>
        {children}
      </main>
    </div>
  )
}
