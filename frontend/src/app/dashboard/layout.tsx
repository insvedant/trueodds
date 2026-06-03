'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth, api } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle, useTheme } from '@/lib/theme'
import LiveChat from '@/components/LiveChat'
import Logo from '@/components/Logo'
import StateSelector from '@/components/StateSelector'
import { getMarketFromStorage } from '@/lib/geo'
import { GeoProvider } from '@/lib/geoContext'

const NAV = [
  { href: '/dashboard',             label: 'Home',    icon: '🏠', desc: 'Overview & stats' },
  { href: '/dashboard/arbitrage',   label: 'Arbs',    icon: '⚡', desc: 'Guaranteed profit' },
  { href: '/dashboard/positive-ev', label: '+EV',     icon: '📈', desc: 'Beat the books' },
  { href: '/dashboard/odds',        label: 'Odds',    icon: '📊', desc: 'Live odds' },
  { href: '/dashboard/tracker',     label: 'Tracker', icon: '📋', desc: 'P&L, ROI, win rate' },
  { href: '/dashboard/calculators', label: 'Calc',    icon: '🧮', desc: 'Arb, EV, Kelly' },
  { href: '/dashboard/hedge',       label: 'Hedge',   icon: '🚨', desc: 'Emergency hedge' },
  { href: '/dashboard/insights',    label: 'Edges',   icon: '🧠', desc: 'Sharp edge predictions' },
  { href: '/dashboard/alerts',      label: 'Alerts',  icon: '🔔', desc: 'Notifications', badge: true },
  { href: '/dashboard/referral',    label: 'Refer',     icon: '🎁', desc: 'Earn free months' },
  { href: '/dashboard/regulatory',  label: 'Regs',      icon: '📋', desc: 'Regulatory updates' },
  { href: '/dashboard/settings',    label: 'Settings',  icon: '⚙️', desc: 'Account & password' },
  { href: '/dashboard/api-access',  label: 'API',       icon: '🔌', desc: 'API access — coming soon' },
]

const PLAN_COLOR: Record<string,string> = { free:'var(--dim)', basic:'#00C853', gold:'#f0a500', platinum:'#8957e5' }
const PLAN_BG:    Record<string,string> = { free:'rgba(107,114,128,0.1)', basic:'rgba(0,200,83,0.1)', gold:'rgba(240,165,0,0.1)', platinum:'rgba(137,87,229,0.1)' }

function NavTooltip({ label, desc, visible }: { label:string; desc:string; visible:boolean }) {
  return (
    <div style={{ position:'absolute', left:'100%', top:'50%', transform:`translateY(-50%) translateX(${visible?'8px':'0px'})`, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRadius:10, padding:'8px 14px', whiteSpace:'nowrap', zIndex:300, pointerEvents:'none', opacity:visible?1:0, transition:'opacity 0.18s, transform 0.18s', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{label}</div>
      <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>{desc}</div>
      <div style={{ position:'absolute', left:-5, top:'50%', transform:'translateY(-50%)', width:8, height:8, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRight:'none', borderTop:'none', rotate:'45deg' }} />
    </div>
  )
}

function NavItem({ item, active, collapsed, unread }: { item:typeof NAV[0]; active:boolean; collapsed:boolean; unread:number }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link href={item.href} style={{ display:'flex', alignItems:'center', gap:collapsed?0:10, padding:collapsed?'11px 0':'9px 12px', justifyContent:collapsed?'center':'flex-start', borderRadius:10, marginBottom:3, textDecoration:'none', background:active?'linear-gradient(135deg,rgba(0,200,83,0.14),rgba(0,200,83,0.06))':hovered?'var(--hover-bg)':'transparent', color:active?'#00C853':hovered?'var(--text)':'var(--dim)', fontWeight:active?700:400, fontSize:13, transition:'all 0.18s', position:'relative', borderLeft:active?'2px solid #00C853':'2px solid transparent' }}>
        <span style={{ fontSize:18, flexShrink:0, lineHeight:1, transform:hovered&&!active?'scale(1.15)':'scale(1)', transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', display:'inline-block' }}>{item.icon}</span>
        <span style={{ overflow:'hidden', whiteSpace:'nowrap', maxWidth:collapsed?0:120, opacity:collapsed?0:1, transition:'max-width 0.25s, opacity 0.2s' }}>{item.label}</span>
        {item.badge && unread > 0 && <span style={{ position:collapsed?'absolute':'relative', top:collapsed?4:undefined, right:collapsed?4:undefined, background:'#ef4444', color:'#fff', fontSize:9, fontWeight:900, borderRadius:20, padding:'1px 5px', marginLeft:collapsed?0:'auto', flexShrink:0, lineHeight:1.4, animation:'badgePulse 2s ease-in-out infinite' }}>{unread}</span>}
        {active && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:5, height:5, background:'#00C853', borderRadius:'50%', opacity:collapsed?0:1, boxShadow:'0 0 6px rgba(0,200,83,0.6)' }} />}
      </Link>
      {collapsed && <NavTooltip label={item.label} desc={item.desc} visible={hovered} />}
    </div>
  )
}

function MobileUserMenu({ user, theme, toggle, onClose, onLogout }: {
  user: any; theme: string; toggle: () => void; onClose: () => void; onLogout: () => void
}) {
  const planColor = PLAN_COLOR[user.plan] || 'var(--dim)'

  return (
    <>
      {}
      <div
        onPointerDown={onClose}
        style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.45)' }}
      />
      {}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{ position:'fixed', bottom:72, right:10, zIndex:9999, background:'#161b22', border:'1px solid rgba(255,255,255,0.08)', borderRadius:18, padding:10, boxShadow:'0 -20px 60px rgba(0,0,0,0.7)', minWidth:220, maxWidth:280, animation:'menuSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background:'var(--bg3)', marginBottom:8 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:PLAN_BG[user.plan]||'rgba(107,114,128,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:planColor, flexShrink:0, border:`2px solid ${planColor}44` }}>
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{user.name}</div>
            <div style={{ fontSize:11, fontWeight:700, color:planColor, textTransform:'uppercase' as const, letterSpacing:0.5 }}>{user.plan} plan</div>
          </div>
        </div>

        {}
        <button
          onPointerDown={e => { e.stopPropagation(); toggle() }}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'10px 14px', borderRadius:12, background:'var(--bg3)', border:'none', cursor:'pointer', fontFamily:'inherit', marginBottom:8, WebkitTapHighlightColor:'transparent' }}>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{theme==='dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
          <span style={{ fontSize:12, color:'var(--green)', fontWeight:700 }}>Toggle</span>
        </button>

        {}
        <button
          onPointerDown={e => { e.stopPropagation(); onClose(); onLogout() }}
          style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', WebkitTapHighlightColor:'transparent' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Log out
        </button>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { theme, toggle }         = useTheme()
  const router   = useRouter()
  const pathname = usePathname()
  const [showStateSelector, setShowStateSelector] = useState(false)
  const [collapsed, setCollapsed]       = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading])

  useEffect(() => {
    if (!loading && user && !getMarketFromStorage()) {
      setTimeout(() => setShowStateSelector(true), 1500)
    }
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    api.get('/alerts?limit=1').then(r => setUnreadAlerts(r.data.unread || 0)).catch(() => {})
  }, [user, pathname])

  
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  
  useEffect(() => { setUserMenuOpen(false) }, [pathname])

  if (loading || !user) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid rgba(0,200,83,0.2)', borderTopColor:'#00C853', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 14px' }} />
        <div style={{ color:'var(--dim)', fontSize:13 }}>Loading TrueOdds...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const planColor = PLAN_COLOR[user.plan] || 'var(--dim)'
  const sw = collapsed ? 62 : 200

  return (
    <GeoProvider>
    <div className="dashboard-wrapper" style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <style>{`
        @keyframes spin          { to{transform:rotate(360deg)} }
        @keyframes badgePulse    { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 4px rgba(239,68,68,0)} }
        @keyframes slideDown     { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes menuPop       { from{opacity:0;transform:scale(0.94) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes menuSlideUp   { from{opacity:0;transform:translateY(16px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        .sidebar-inner           { transition: width 0.25s ease; }

        /* ── Mobile bottom nav ── */
        @media (max-width: 768px) {
          .dashboard-wrapper { flex-direction: column !important; }
          .sidebar-inner {
            width: 100% !important; height: 62px !important;
            border-right: none !important; border-top: 1px solid var(--border) !important;
            position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
            z-index: 100 !important;
            overflow: visible !important;
            flex-direction: row !important;
          }
          .sidebar-logo    { display: none !important; }
          .sidebar-nav {
            display: flex !important; flex-direction: row !important;
            padding: 0 !important; overflow-x: auto !important; overflow-y: visible !important;
            height: 62px !important; align-items: stretch !important;
            gap: 0 !important; flex: 1 !important;
            -ms-overflow-style: none !important; scrollbar-width: none !important;
          }
          .sidebar-nav::-webkit-scrollbar { display: none !important; }
          .sidebar-nav > div { position: static !important; flex-shrink: 0 !important; }
          .sidebar-nav a {
            flex-direction: column !important; align-items: center !important;
            justify-content: center !important; padding: 6px 10px !important;
            min-width: 52px !important; border-left: none !important;
            border-bottom: 2px solid transparent !important;
            margin-bottom: 0 !important; gap: 2px !important; border-radius: 0 !important;
          }
          .sidebar-nav a > span:nth-child(2) {
            font-size: 9px !important; max-width: unset !important;
            opacity: 1 !important; overflow: visible !important; white-space: nowrap !important;
          }
          .sidebar-support  { display: none !important; }
          .sidebar-theme    { display: none !important; }
          .sidebar-user     { display: none !important; }
          .mobile-avatar    { display: flex !important; }
          .mobile-location  { display: flex !important; }
          .dashboard-main   { padding-bottom: 70px !important; }
        }
        @media (min-width: 769px) {
          .mobile-avatar    { display: none !important; }
          .mobile-location  { display: none !important; }
          .sidebar-user     { display: block !important; }
          .mobile-menu-portal { display: none !important; }
        }
        @media (max-width: 380px) {
          .sidebar-nav a { min-width: 44px !important; padding: 5px 6px !important; }
          .sidebar-nav a > span:nth-child(2) { font-size: 8px !important; }
        }
      `}</style>

      {}
      {userMenuOpen && (
        <div className="mobile-menu-portal">
          <MobileUserMenu
            user={user}
            theme={theme}
            toggle={toggle}
            onClose={() => setUserMenuOpen(false)}
            onLogout={logout}
          />
        </div>
      )}

      {}
      <aside className="sidebar-inner" style={{ width:sw, background:'#0d1117', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', flexShrink:0, position:'relative', zIndex:50, overflow:'visible' }}>

        {}
        <div className="sidebar-logo" style={{ height:58, display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:collapsed?'0 12px':'0 14px', borderBottom:'1px solid var(--hover-bg)', flexShrink:0 }}>
          <Logo size={collapsed ? 'sm' : 'md'} linkTo="/" collapsed={collapsed} />
          <button onClick={() => setCollapsed(!collapsed)} style={{ background:'var(--hover-bg)', border:'1px solid var(--hover-bg2)', color:'var(--dim)', cursor:'pointer', fontSize:14, padding:'5px 7px', borderRadius:7, flexShrink:0, transition:'all 0.18s', lineHeight:1 }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {}
        <nav className="sidebar-nav" style={{ flex:1, padding:'10px 8px', overflowY:'auto', overflowX:'visible' }}>
          {NAV.map(item => {
            const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
            return <NavItem key={item.href} item={item} active={active} collapsed={collapsed} unread={item.badge ? unreadAlerts : 0} />
          })}
          <div style={{ height:1, background:'var(--hover-bg)', margin:'10px 6px' }} />
          {user.role === 'admin' && (
            <NavItem item={{ href:'/admin', label:'Admin', icon:'🛡', desc:'Platform management', badge:false }} active={pathname.startsWith('/admin')} collapsed={collapsed} unread={0} />
          )}
        </nav>

        {}
        <div className="sidebar-support" style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {/* Location button */}
          {collapsed ? (
            <button onClick={() => setShowStateSelector(true)} title="Change betting state"
              style={{ display:'flex', justifyContent:'center', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:18, padding:4, WebkitTapHighlightColor:'transparent' as any }}>
              📍
            </button>
          ) : (
            <button onClick={() => setShowStateSelector(true)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit', width:'100%', marginBottom:6, WebkitTapHighlightColor:'transparent' as any, transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background='var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background='var(--bg3)')}>
              <span style={{ fontSize:14 }}>📍</span>
              <div style={{ textAlign:'left' as const, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--text)' }}>Betting Location</div>
                <div style={{ fontSize:10, color:'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                  {(() => {
                    try {
                      const s = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('trueodds_market') || '{}' : '{}')
                      return s.state ? `${s.state} · Tap to change` : 'Tap to set location'
                    } catch { return 'Tap to set location' }
                  })()}
                </div>
              </div>
            </button>
          )}
          {collapsed ? (
            <a href="mailto:support@trueodds.ca" title="Support" style={{ display:'flex', justifyContent:'center', color:'var(--dim)', textDecoration:'none', fontSize:18, padding:4 }}>💬</a>
          ) : (
            <a href="mailto:support@trueodds.ca" style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.12)', textDecoration:'none', color:'var(--text)' }}>
              <span style={{ fontSize:14 }}>💬</span>
              <div>
                <div style={{ fontSize:11, fontWeight:800, color:'var(--green)' }}>Email Us</div>
                <div style={{ fontSize:10, color:'var(--dim)' }}>support@trueodds.ca</div>
              </div>
            </a>
          )}
        </div>

        {}
        <div className="sidebar-theme" style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:collapsed?'center':'flex-start' }}>
          {collapsed ? (
            <button onClick={toggle} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:4 }}>{theme==='dark'?'🌙':'☀️'}</button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>{theme==='dark'?'Dark mode':'Light mode'}</span>
              <ThemeToggle size="sm" />
            </div>
          )}
        </div>

        {}
        <div className="sidebar-user" style={{ borderTop:'1px solid var(--hover-bg)', padding:'10px', flexShrink:0, position:'relative', zIndex:300 }} ref={userMenuRef}>
          {!collapsed ? (
            <>
              <div onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:10, cursor:'pointer', transition:'background 0.15s', background:userMenuOpen?'var(--hover-bg2)':'transparent' }}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--hover-bg)')}
                onMouseLeave={e=>(e.currentTarget.style.background=userMenuOpen?'var(--hover-bg2)':'transparent')}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:PLAN_BG[user.plan]||'rgba(107,114,128,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:planColor, flexShrink:0, border:`1px solid ${planColor}33` }}>
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize:10, color:planColor, fontWeight:700, textTransform:'uppercase' as const }}>{user.plan}</div>
                </div>
                <span style={{ fontSize:10, color:'var(--dim)', transition:'transform 0.2s', transform:userMenuOpen?'rotate(180deg)':'rotate(0deg)', display:'inline-block' }}>▾</span>
              </div>

              {userMenuOpen && (
                <div style={{ position:'absolute', bottom:'100%', left:8, right:8, background:'var(--bg2)', border:'1px solid var(--hover-bg2)', borderRadius:14, padding:8, boxShadow:'0 -16px 40px rgba(0,0,0,0.5)', animation:'menuPop 0.25s cubic-bezier(0.34,1.56,0.64,1)', zIndex:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, background:'var(--bg3)', marginBottom:8 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:PLAN_BG[user.plan]||'rgba(107,114,128,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:planColor, flexShrink:0 }}>
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{user.name}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:planColor, textTransform:'uppercase' as const }}>{user.plan} plan</div>
                    </div>
                  </div>
                  <button onClick={() => { setUserMenuOpen(false); logout() }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%', transition:'background 0.15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,0.15)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='rgba(239,68,68,0.08)')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:PLAN_BG[user.plan]||'rgba(107,114,128,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:planColor }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <button onClick={logout} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4, transition:'color 0.15s', display:'flex' }} title="Log out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile location button */}
        <div className="mobile-location"
          style={{ display:'none', alignItems:'center', justifyContent:'center', padding:'0 8px', borderLeft:'1px solid var(--border)', flexShrink:0 }}>
          <button onClick={() => setShowStateSelector(true)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px 6px', WebkitTapHighlightColor:'transparent' as any }}>
            <span style={{ fontSize:18, lineHeight:1 }}>📍</span>
            <span style={{ fontSize:9, color:'var(--dim)', fontWeight:600 }}>Location</span>
          </button>
        </div>

        <div className="mobile-avatar"
          style={{ display:'none', alignItems:'center', justifyContent:'center', padding:'0 10px', borderLeft:'1px solid var(--border)', flexShrink:0 }}>
          <button
            onClick={() => { if (window.innerWidth <= 768) setUserMenuOpen(prev => !prev) }}
            style={{ width:38, height:38, borderRadius:'50%', background:userMenuOpen ? PLAN_BG[user.plan]||'rgba(107,114,128,0.1)' : 'var(--bg3)', border:`2px solid ${userMenuOpen ? planColor : planColor+'55'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:planColor, fontSize:15, cursor:'pointer', WebkitTapHighlightColor:'transparent', transition:'all 0.2s', transform:userMenuOpen?'scale(1.08)':'scale(1)' }}>
            {user.name?.charAt(0).toUpperCase()}
          </button>
        </div>
      </aside>

      <main className="dashboard-main" style={{ flex:1, overflow:'auto', height:'100vh', background:'var(--bg)' }}>
        {children}
        <LiveChat />
        {showStateSelector && (
          <StateSelector onDone={() => setShowStateSelector(false)} />
        )}
      </main>
    </div>
    </GeoProvider>
  )
}
