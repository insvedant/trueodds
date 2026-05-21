'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth, api } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle, useTheme } from '@/lib/theme'

const NAV = [
  { href: '/dashboard',              label: 'Home',    icon: '🏠', desc: 'Overview & stats' },
  { href: '/dashboard/arbitrage',    label: 'Arbs',    icon: '⚡', desc: 'Guaranteed profit' },
  { href: '/dashboard/positive-ev',  label: '+EV',     icon: '📈', desc: 'Beat the books long-term' },
  { href: '/dashboard/tracker',      label: 'Tracker', icon: '📋', desc: 'P&L, ROI, win rate' },
  { href: '/dashboard/odds',         label: 'Odds',    icon: '📊', desc: 'Live odds comparison' },
  { href: '/dashboard/calculators',  label: 'Calc',    icon: '🧮', desc: 'Arb, EV, Kelly' },
  { href: '/dashboard/insights',     label: 'ML',      icon: '🧠', desc: 'ML predictions' },
  { href: '/dashboard/alerts',       label: 'Alerts',  icon: '🔔', desc: 'Notifications', badge: true },
]

const PLAN_COLOR: Record<string, string> = { gold: '#f0a500', platinum: '#8957e5', free: 'var(--dim)' }
const PLAN_BG:    Record<string, string> = { gold: 'rgba(240,165,0,0.1)', platinum: 'rgba(137,87,229,0.1)', free: 'rgba(107,114,128,0.1)' }

function NavTooltip({ label, desc, visible }: { label: string; desc: string; visible: boolean }) {
  return (
    <div style={{ position:'absolute', left:'100%', top:'50%', transform:`translateY(-50%) translateX(${visible?'8px':'0px'})`, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRadius:10, padding:'8px 14px', whiteSpace:'nowrap', zIndex:300, pointerEvents:'none', opacity:visible?1:0, transition:'opacity 0.18s, transform 0.18s', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{label}</div>
      <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>{desc}</div>
      <div style={{ position:'absolute', left:-5, top:'50%', transform:'translateY(-50%)', width:8, height:8, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRight:'none', borderTop:'none', rotate:'45deg' }} />
    </div>
  )
}

function NavItem({ item, active, collapsed, unread }: { item: typeof NAV[0]; active: boolean; collapsed: boolean; unread: number }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link href={item.href} style={{ display:'flex', alignItems:'center', gap:collapsed?0:10, padding:collapsed?'11px 0':'9px 12px', justifyContent:collapsed?'center':'flex-start', borderRadius:10, marginBottom:3, textDecoration:'none', background:active?'linear-gradient(135deg,rgba(0,200,83,0.14),rgba(0,200,83,0.06))':hovered?'var(--hover-bg)':'transparent', color:active?'#00C853':hovered?'var(--text)':'var(--dim)', fontWeight:active?700:400, fontSize:13, transition:'all 0.18s', position:'relative', borderLeft:active?'2px solid #00C853':'2px solid transparent' }}>
        <span style={{ fontSize:18, flexShrink:0, lineHeight:1, transform:hovered&&!active?'scale(1.15)':'scale(1)', transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', display:'inline-block' }}>{item.icon}</span>
        <span style={{ overflow:'hidden', whiteSpace:'nowrap', maxWidth:collapsed?0:120, opacity:collapsed?0:1, transition:'max-width 0.25s, opacity 0.2s' }}>{item.label}</span>
        {item.badge && unread > 0 && (
          <span style={{ position:collapsed?'absolute':'relative', top:collapsed?4:undefined, right:collapsed?4:undefined, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:900, borderRadius:20, padding:'1px 5px', marginLeft:collapsed?0:'auto', flexShrink:0, lineHeight:1.4, animation:'badgePulse 2s ease-in-out infinite' }}>{unread}</span>
        )}
        {active && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:5, height:5, background:'#00C853', borderRadius:'50%', opacity:collapsed?0:1, boxShadow:'0 0 6px rgba(0,200,83,0.6)' }} />}
      </Link>
      {collapsed && <NavTooltip label={item.label} desc={item.desc} visible={hovered} />}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { theme, toggle }         = useTheme()
  const router    = useRouter()
  const pathname  = usePathname()
  const [collapsed, setCollapsed]       = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading])

  // Fetch real unread alert count from API
  useEffect(() => {
    if (!user) return
    api.get('/alerts?limit=1')
      .then(res => setUnreadAlerts(res.data.unread || 0))
      .catch(() => setUnreadAlerts(0))
  }, [user, pathname])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  if (loading || !user) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid rgba(0,200,83,0.2)', borderTopColor:'#00C853', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 14px' }} />
        <div style={{ color:'var(--dim)', fontSize:13 }}>Loading TrueOdds...</div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )

  const planColor = PLAN_COLOR[user.plan] || 'var(--dim)'
  const sw = collapsed ? 62 : 200

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <style>{`
        @keyframes spin       { to { transform:rotate(360deg) } }
        @keyframes badgePulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 4px rgba(239,68,68,0)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .sidebar-inner { transition: width 0.25s ease; }
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar-inner" style={{ width:sw, background:'var(--bg)', borderRight:'1px solid var(--hover-bg)', display:'flex', flexDirection:'column', flexShrink:0, position:'relative', zIndex:50, overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ height:58, display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:collapsed?'0 12px':'0 14px', borderBottom:'1px solid var(--hover-bg)', flexShrink:0 }}>
          {!collapsed && <Link href="/" style={{ fontWeight:900, fontSize:17, color:'var(--text)', textDecoration:'none', whiteSpace:'nowrap', letterSpacing:'-0.4px' }}>True<span style={{ color:'var(--green)' }}>Odds</span></Link>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background:'var(--hover-bg)', border:'1px solid var(--hover-bg2)', color:'var(--dim)', cursor:'pointer', fontSize:14, padding:'5px 7px', borderRadius:7, flexShrink:0, transition:'all 0.18s', lineHeight:1 }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--hover-bg2)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background='var(--hover-bg)'; e.currentTarget.style.color='var(--dim)' }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto', overflowX:'visible' }}>
          {NAV.map(item => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
            return <NavItem key={item.href} item={item} active={active} collapsed={collapsed} unread={item.badge ? unreadAlerts : 0} />
          })}
          <div style={{ height:1, background:'var(--hover-bg)', margin:'10px 6px' }} />
          {user.role === 'admin' && (
            <NavItem item={{ href:'/admin', label:'Admin', icon:'🛡', desc:'Platform management', badge:false }} active={pathname.startsWith('/admin')} collapsed={collapsed} unread={0} />
          )}
        </nav>

        {/* Theme toggle */}
        <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:collapsed?'center':'flex-start' }}>
          {collapsed ? (
            <button onClick={toggle} title="Toggle theme" style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:4 }}>{theme==='dark'?'🌙':'☀️'}</button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
              <span style={{ fontSize:12, color:'var(--muted)', fontWeight:500 }}>{theme==='dark'?'Dark mode':'Light mode'}</span>
              <ThemeToggle size="sm" />
            </div>
          )}
        </div>

        {/* User section */}
        <div style={{ borderTop:'1px solid var(--hover-bg)', padding:'10px 10px', flexShrink:0, position:'relative' }} ref={userMenuRef}>
          {!collapsed ? (
            <>
              <div onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:10, cursor:'pointer', transition:'background 0.15s', background:userMenuOpen?'var(--hover-bg2)':'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background=userMenuOpen?'var(--hover-bg2)':'transparent')}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:PLAN_BG[user.plan], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:planColor, flexShrink:0, border:`1px solid ${planColor}33` }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize:10, color:planColor, fontWeight:700, textTransform:'uppercase' as const }}>{user.plan}</div>
                </div>
                <span style={{ fontSize:10, color:'var(--dim)', transition:'transform 0.2s', transform:userMenuOpen?'rotate(180deg)':'rotate(0deg)', display:'inline-block' }}>▾</span>
              </div>

              {userMenuOpen && (
                <div style={{ position:'absolute', bottom:'100%', left:8, right:8, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRadius:12, padding:6, boxShadow:'0 -16px 40px rgba(0,0,0,0.4)', animation:'slideDown 0.2s ease' }}>
                  {user.plan !== 'platinum' && (
                    <Link href="/pricing" onClick={() => setUserMenuOpen(false)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, textDecoration:'none', background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.15)', marginBottom:6 }}>
                      <span style={{ fontSize:14 }}>⬆️</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>Upgrade Plan</div>
                        <div style={{ fontSize:10, color:'var(--dim)' }}>Unlock all features</div>
                      </div>
                    </Link>
                  )}
                  {[{ label:'← Back to Site', href:'/', icon:'🌐' }, ...(user.role==='admin'?[{ label:'Admin Panel', href:'/admin', icon:'🛡' }]:[])].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, textDecoration:'none', color:'var(--muted)', fontSize:13, transition:'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background='var(--hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <span>{item.icon}</span>{item.label}
                    </Link>
                  ))}
                  <div style={{ height:1, background:'var(--hover-bg2)', margin:'4px 0' }} />
                  <button onClick={() => { setUserMenuOpen(false); logout() }} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'none', border:'none', color:'#ef4444', fontSize:13, cursor:'pointer', fontFamily:'inherit', width:'100%', transition:'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background='rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <span>⏻</span> Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:PLAN_BG[user.plan], display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:planColor, border:`1px solid ${planColor}33` }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <button onClick={logout} style={{ background:'none', border:'none', color:'var(--faint)', cursor:'pointer', fontSize:16, padding:4, transition:'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color='var(--faint)')}
                title="Log out">⏻</button>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex:1, overflow:'auto', height:'100vh', background:'var(--bg)' }}>
        {children}
      </main>
    </div>
  )
}
