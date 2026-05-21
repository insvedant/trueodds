'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme'

/* ─── DATA ───────────────────────────────────────────────────────────── */
const TICKER = [
  { sport:'🏒', game:'Wild vs Avalanche',   market:'Moneyline',    profit:'+3.2%', books:'DraftKings / FanDuel' },
  { sport:'🎾', game:'Djokovic vs Alcaraz', market:'Match Winner',  profit:'+2.7%', books:'Pinnacle / BetMGM' },
  { sport:'🥊', game:'Jones vs Miocic',     market:'Method',        profit:'+3.8%', books:'DK / Bet365' },
  { sport:'🏈', game:'Chiefs vs Ravens',    market:'Spread -3.5',   profit:'+2.1%', books:'BetMGM / Caesars' },
  { sport:'⚽', game:'Man City vs Arsenal', market:'Draw No Bet',   profit:'+1.5%', books:'Bet365 / FanDuel' },
  { sport:'🏀', game:'Lakers vs Celtics',   market:'Moneyline',     profit:'+1.8%', books:'DK / Pinnacle' },
  { sport:'⚾', game:'Yankees vs Red Sox',  market:'Total O/U 8.5', profit:'+1.2%', books:'FanDuel / Caesars' },
  { sport:'🏒', game:'Leafs vs Canadiens', market:'Puck Line',     profit:'+2.4%', books:'PointsBet / Pinnacle' },
]

const FAQS = [
  { q:'How does TrueOdds work?', a:'TrueOdds scans 100+ sportsbooks every second and surfaces arbitrage bets, +EV opportunities, and sharp line moves — all in one real-time dashboard. No spreadsheets, no manual comparisons.' },
  { q:'How much money do I need to start?', a:'Any bankroll works, but $250+ per sportsbook gives you meaningful flexibility. Most Gold members see profit in their first week. We recommend starting small to learn the tools.' },
  { q:'Will this work in my location?', a:'TrueOdds covers 40+ US sportsbooks (DraftKings, FanDuel, BetMGM, Caesars, etc.) and 60+ global books on Platinum. Check your state — legal sports betting is available in 30+ US states.' },
  { q:'What is the Free plan?', a:'All bet types with a 3% profit cap on arbitrage, plus delayed odds screen. No credit card required — great for learning the system before upgrading.' },
  { q:'Is arbitrage betting legal?', a:'100% legal. You\'re placing normal bets at licensed sportsbooks. Books may limit accounts that win consistently, which is why we teach proper bet sizing and book management.' },
  { q:'How do I cancel?', a:'Cancel anytime from Profile → Billing → Manage Plan. Access continues to the end of your billing period. No questions asked, no cancellation fees.' },
]

const REVIEWS = [
  { name:'Alex M.',  handle:'@alexbets',  avatar:'A', plan:'Gold',     text:'Made back my subscription in the first 3 bets. The arb finder is insane — I had no idea how much I was leaving on the table.',    profit:'+$847/mo' },
  { name:'Sarah K.', handle:'@sharpsk',  avatar:'S', plan:'Platinum', text:'Been on TrueOdds 4 months. ROI consistently above 8%. The +EV bets are where the real long-term money is.',                         profit:'+$2,340/mo' },
  { name:'James T.', handle:'@jtbets',   avatar:'J', plan:'Gold',     text:'As someone brand new to betting, the alerts tell me exactly when and where to bet. No guesswork at all.',                           profit:'+$412/mo' },
  { name:'Mike R.',  handle:'@mikerbet', avatar:'M', plan:'Platinum', text:'Turned a $2k bankroll into $8k in 3 months. The math doesn\'t lie — this is completely legitimate and it works.',                   profit:'+$1,890/mo' },
]

/* ─── NAV MEGA-MENU DATA ─────────────────────────────────────────────── */
const MENU = {
  Tools: {
    featured: { icon:'⚡', label:'Arbitrage Finder', desc:'Lock in guaranteed profit on both sides', href:'/dashboard/arbitrage', badge:'HOT' },
    links: [
      { icon:'📈', label:'Positive EV',     desc:'Mathematically profitable bets', href:'/dashboard/positive-ev' },
      { icon:'📊', label:'Live Odds',        desc:'Compare 100+ books in real time',  href:'/dashboard/odds' },
      { icon:'📋', label:'Bet Tracker',      desc:'P&L, ROI, CLV analytics',         href:'/dashboard/tracker' },
      { icon:'🔔', label:'Smart Alerts',     desc:'Instant arb & +EV notifications', href:'/dashboard/alerts' },
      { icon:'🧮', label:'Calculators',      desc:'Arb, EV, Kelly criterion',        href:'/dashboard/calculators' },
    ],
  },
  Learn: {
    featured: { icon:'🎓', label:'Beginner Guide', desc:'From zero to profitable in one week', href:'/blog', badge:'FREE' },
    links: [
      { icon:'📖', label:'What is Arbitrage?',   desc:'The complete explainer', href:'/blog/what-is-arbitrage-betting' },
      { icon:'📉', label:'What is +EV Betting?', desc:'Long-run edge explained', href:'/blog/positive-ev-betting-explained' },
      { icon:'📝', label:'Blog & Articles',       desc:'Strategy, tips, updates',  href:'/blog' },
      { icon:'🤝', label:'1:1 Onboarding',        desc:'Free call with our team',   href:'/contact' },
    ],
  },
} as const

/* ─── HOOK: scroll-triggered reveal ─────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.65s ${delay}ms ease, transform 0.65s ${delay}ms ease` }}>
      {children}
    </div>
  )
}

/* ─── MEGA MENU ──────────────────────────────────────────────────────── */
function MegaMenu({ section, onClose }: { section: keyof typeof MENU; onClose: () => void }) {
  const data = MENU[section]
  if (!data) return null
  return (
    <div
      onMouseLeave={onClose}
      style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 0, marginTop: 8, width: 560, zIndex: 200,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'menuDrop 0.22s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {/* Featured item */}
      <Link href={data.featured.href} onClick={onClose} style={{ textDecoration: 'none' }}>
        <div style={{ margin: 12, background: 'linear-gradient(135deg, rgba(0,200,83,0.12) 0%, rgba(0,200,83,0.04) 100%)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg,rgba(0,200,83,0.2) 0%,rgba(0,200,83,0.08) 100%)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg,rgba(0,200,83,0.12) 0%,rgba(0,200,83,0.04) 100%)')}
        >
          <div style={{ fontSize: 32, lineHeight: 1 }}>{data.featured.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#e6edf3' }}>{data.featured.label}</span>
              {data.featured.badge && <span style={{ background: '#00C853', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 20 }}>{data.featured.badge}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>{data.featured.desc}</div>
          </div>
          <span style={{ color: '#00C853', fontSize: 18 }}>→</span>
        </div>
      </Link>
      {/* Grid of links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '4px 12px 12px' }}>
        {data.links.map(link => (
          <Link key={link.label} href={link.href} onClick={onClose} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{link.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 1 }}>{link.label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{link.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ─── NAVBAR ─────────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [openMenu, setOpenMenu] = useState<keyof typeof MENU | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const openDelay = (key: keyof typeof MENU) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpenMenu(key)
  }
  const closeDelay = () => {
    timerRef.current = setTimeout(() => setOpenMenu(null), 120)
  }

  const lnk = (active = false): React.CSSProperties => ({
    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
    border: 'none', color: active ? '#e6edf3' : '#9ca3af',
    fontSize: 14, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', padding: '8px 14px', borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'color 0.15s, background 0.15s', textDecoration: 'none',
  })

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150,
        height: 64, display: 'flex', alignItems: 'center', padding: '0 32px',
        justifyContent: 'space-between',
        background: scrolled ? 'rgba(8,11,18,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.35s, border-color 0.35s',
      }}>
        <Link href="/" style={{ fontWeight:900, fontSize:20, color:'#e6edf3', textDecoration:'none', letterSpacing:'-0.5px', flexShrink:0 }}>
          True<span style={{ color:'#00C853' }}>Odds</span>
        </Link>

        <div style={{ display:'flex', alignItems:'center', gap:4, position:'relative' }}>
          {/* Dropdown menus: Tools, Learn */}
          {(Object.keys(MENU) as Array<keyof typeof MENU>).map(key => (
            <div key={key} style={{ position:'relative' }}
              onMouseEnter={() => openDelay(key)} onMouseLeave={closeDelay}>
              <button style={lnk(openMenu === key)}
                onMouseEnter={e => { e.currentTarget.style.color='#e6edf3'; e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (openMenu!==key) { e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.background='transparent' } }}>
                {key}
                <span style={{ fontSize:10, display:'inline-block', transform:openMenu===key?'rotate(180deg)':'rotate(0deg)', transition:'transform 0.2s', color:'#6b7280' }}>▾</span>
              </button>
              {openMenu === key && <MegaMenu section={key} onClose={() => setOpenMenu(null)} />}
            </div>
          ))}

          {/* Pricing — direct link, no dropdown */}
          <Link href="/pricing" style={lnk()}
            onMouseEnter={e => { e.currentTarget.style.color='#e6edf3'; e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.background='transparent' }}>
            Pricing
          </Link>

          <a href="#faq" style={lnk()}
            onMouseEnter={e => { e.currentTarget.style.color='#e6edf3'; e.currentTarget.style.background='rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.background='transparent' }}>
            FAQ
          </a>
        </div>

        {/* CTA — intentionally NO theme toggle on home (always dark) */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Link href="/login" style={{ color:'#9ca3af', textDecoration:'none', fontSize:13, fontWeight:500, padding:'8px 16px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; e.currentTarget.style.color='#e6edf3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#9ca3af' }}>
            Log in
          </Link>
          <Link href="/signup" style={{ background:'#00C853', color:'#000', textDecoration:'none', fontSize:13, fontWeight:800, padding:'8px 18px', borderRadius:8, display:'inline-block', transition:'all 0.18s', letterSpacing:'-0.2px' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,200,83,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}>
            Start Free →
          </Link>
        </div>
      </nav>

      <style>{`
        @keyframes menuDrop {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}

/* ─── FAQ ITEM ───────────────────────────────────────────────────────── */
function FaqItem({ faq, idx, open, onToggle }: { faq: typeof FAQS[0]; idx: number; open: boolean; onToggle: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (contentRef.current) setHeight(open ? contentRef.current.scrollHeight : 0)
  }, [open])

  return (
    <div
      onClick={onToggle}
      style={{
        background: open ? 'rgba(0,200,83,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${open ? 'rgba(0,200,83,0.25)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 14,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.25s, background 0.25s',
        marginBottom: 10,
      }}
      onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
    >
      <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: open ? 'rgba(0,200,83,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: open ? '#00C853' : '#6b7280', fontWeight: 800, flexShrink: 0, transition: 'all 0.25s' }}>
            {String(idx + 1).padStart(2, '0')}
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: open ? '#e6edf3' : '#d0d7de' }}>{faq.q}</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: open ? '#00C853' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <span style={{ fontSize: 16, lineHeight: 1, color: open ? '#000' : '#6b7280', display: 'block', transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)', fontWeight: 300 }}>+</span>
        </div>
      </div>
      <div ref={contentRef} style={{ height, overflow: 'hidden', transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '0 24px 20px 66px', color: '#8b949e', fontSize: 14, lineHeight: 1.85 }}>{faq.a}</div>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { forceDark, restoreTheme } = useTheme()
  const [billing, setBilling] = useState<'monthly'|'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [arbFlipped, setArbFlipped] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  // Home page is always dark — force it on mount, restore user preference on leave
  useEffect(() => {
    forceDark()
    return () => { restoreTheme() }
  }, [])

  const prices = { gold: billing === 'monthly' ? 49 : 39, platinum: billing === 'monthly' ? 49.99 : 39.99 }

  return (
    <div style={{ background: '#080b12', color: '#e6edf3', fontFamily: "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes marquee   { to { transform: translateX(-50%); } }
        @keyframes marqueeRev{ to { transform: translateX(0); } from { transform: translateX(-50%); } }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin      { to { transform:rotate(360deg) } }
        @keyframes gradShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

        .hero-glow {
          background: radial-gradient(ellipse 800px 400px at 50% 0%, rgba(0,200,83,0.11) 0%, transparent 70%);
          animation: gradShift 8s ease infinite;
          background-size: 200% 200%;
        }
        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 52px 52px;
        }
        .shimmer-text {
          background: linear-gradient(90deg, #00C853 0%, #58a6ff 30%, #00C853 60%, #58a6ff 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .stat-card-hover:hover { transform: translateY(-4px) scale(1.02); border-color: rgba(0,200,83,0.3) !important; }
        .stat-card-hover { transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important; }
        .feature-card-hover:hover { transform: translateY(-6px); border-color: rgba(0,200,83,0.4) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
        .feature-card-hover { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .review-card-hover:hover { transform: translateY(-4px); border-color: rgba(0,200,83,0.25) !important; }
        .review-card-hover { transition: all 0.22s ease; }
        .plan-hover:hover { transform: translateY(-6px); box-shadow: 0 24px 72px rgba(0,0,0,0.5); }
        .plan-hover { transition: all 0.28s cubic-bezier(0.4,0,0.2,1); }
        .cta-primary { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
        .cta-primary:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,200,83,0.38); }
        .cta-primary:active { transform: translateY(-1px); }
        .link-hover { transition: color 0.15s; }
        .link-hover:hover { color: #e6edf3 !important; }
        .book-badge { transition: transform 0.18s, box-shadow 0.18s; }
        .book-badge:hover { transform: translateY(-3px) scale(1.06); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
        .step-card:hover .step-icon { transform: scale(1.15) rotate(-6deg); }
        .step-icon { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); display: inline-block; }
        .ticker-wrap:hover { animation-play-state: paused; }
        .arb-leg { transition: transform 0.2s, box-shadow 0.2s; }
        .arb-leg:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
      `}</style>

      <Navbar />

      {/* ── HERO ── */}
      <section style={{ position: 'relative', padding: '148px 24px 100px', textAlign: 'center', overflow: 'hidden' }}>
        <div className="hero-glow grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

        {/* Floating orbs */}
        <div style={{ position: 'absolute', top: '15%', left: '8%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(0,200,83,0.06) 0%, transparent 70%)', borderRadius: '50%', animation: 'heroFloat 7s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '25%', right: '6%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(88,166,255,0.06) 0%, transparent 70%)', borderRadius: '50%', animation: 'heroFloat 9s ease-in-out infinite 1.5s', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 840, margin: '0 auto' }}>
          {/* Live badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.22)', borderRadius: 24, padding: '6px 16px', fontSize: 12, color: '#00C853', fontWeight: 700, marginBottom: 28, animation: 'none' }}>
            <span style={{ width: 7, height: 7, background: '#00C853', borderRadius: '50%', animation: 'blink 1.4s ease-in-out infinite', display: 'inline-block' }} />
            LIVE · 12 arb opportunities right now
          </div>

          <h1 style={{ fontSize: 'clamp(46px,7.5vw,86px)', fontWeight: 900, lineHeight: 1.03, letterSpacing: '-2.5px', marginBottom: 24 }}>
            Make $1,000+<br />
            <span className="shimmer-text">a week.</span>{' '}
            <span style={{ color: '#2a3447' }}>No luck</span><br />
            <span style={{ color: '#2a3447' }}>involved.</span>
          </h1>

          <p style={{ fontSize: 18, color: '#8b949e', maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.75, fontWeight: 400 }}>
            TrueOdds scans 100+ sportsbooks in real time — finding arbitrage, +EV bets, and sharp lines before they disappear.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <Link href="/signup" className="cta-primary" style={{ background: '#00C853', color: '#000', textDecoration: 'none', fontWeight: 800, fontSize: 16, padding: '14px 36px', borderRadius: 10, display: 'inline-block', letterSpacing: '-0.3px' }}>
              Start Free — No CC →
            </Link>
            <a href="#how" style={{ color: '#8b949e', textDecoration: 'none', fontWeight: 500, fontSize: 15, padding: '14px 24px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'inline-block', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#e6edf3' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8b949e' }}>
              See how it works
            </a>
          </div>

          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, color: '#4b5563' }}>
            {['✓ No commitments', '✓ Free 1:1 onboarding', '✓ Cancel anytime', '✓ 14-day trial'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '11px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(90deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(270deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div className="ticker-wrap" style={{ display: 'flex', animation: 'marquee 30s linear infinite', width: 'max-content' }}>
          {[...TICKER, ...TICKER].map((item, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 28px', flexShrink: 0 }}>
              <span style={{ fontSize: 15 }}>{item.sport}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{item.game}</span>
              <span style={{ color: '#374151', fontSize: 12 }}>·</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>{item.market}</span>
              <span style={{ background: 'rgba(0,200,83,0.12)', color: '#00C853', fontWeight: 900, fontSize: 12, padding: '2px 9px', borderRadius: 20 }}>{item.profit}</span>
              <span style={{ color: '#374151', fontSize: 12 }}>{item.books}</span>
              <span style={{ color: '#1f2937', margin: '0 4px' }}>|</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SPORTSBOOKS ── */}
      <Reveal>
        <div style={{ padding: '40px 24px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 22 }}>Supports 100+ sportsbooks including</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {[['DraftKings','#003087'],['FanDuel','#1493ff'],['BetMGM','#8b6914'],['Caesars','#006400'],['Bet365','#cc0000'],['Pinnacle','#6b2424'],['PointsBet','#c05000'],['1XBet','#880000']].map(([name, color]) => (
              <div key={name} className="book-badge" style={{ background: color as string, borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 900, color: '#fff', cursor: 'default' }}>{name}</div>
            ))}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 14px', fontSize: 11, color: '#4b5563' }}>+92 more</div>
          </div>
        </div>
      </Reveal>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: '90px 24px', background: '#0a0d13', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>Not magic. Just data.</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 900, letterSpacing: '-1.5px' }}>How this even works</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
            {[
              { num:'01', icon:'🔍', title:'TrueOdds scans the market', body:'Our engine checks 100+ sportsbooks every second, detecting when any book prices a line above market consensus.' },
              { num:'02', icon:'⚡', title:'We bring them to you',      body:'Arbs, +EV bets, and line moves appear on your dashboard with exact stakes, which books, and step-by-step instructions.' },
              { num:'03', icon:'💰', title:'You place them',            body:'Open both books side by side and copy the bets. Takes under 2 minutes. Profit is mathematically guaranteed on arbs.' },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="step-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 26px', position: 'relative', overflow: 'hidden', cursor: 'default', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,200,83,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                  <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 52, fontWeight: 900, color: 'rgba(0,200,83,0.05)', fontFamily: 'DM Mono,monospace', lineHeight: 1 }}>{step.num}</div>
                  <div className="step-icon" style={{ fontSize: 32, marginBottom: 14 }}>{step.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{step.title}</div>
                  <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.8 }}>{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ARB DEMO ── */}
      <section style={{ padding: '90px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>Interactive Demo</p>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>Try arbitrage right now</h2>
              <p style={{ color: '#6b7280', fontSize: 15 }}>Click the card. Open both sides. See how profit is locked in.</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div onClick={() => setArbFlipped(!arbFlipped)} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${arbFlipped ? 'rgba(0,200,83,0.45)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 18, padding: '26px 28px', cursor: 'pointer', transition: 'all 0.3s', boxShadow: arbFlipped ? '0 0 40px rgba(0,200,83,0.1)' : 'none' }}
              onMouseEnter={e => { if (!arbFlipped) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={e => { if (!arbFlipped) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <span style={{ background: 'rgba(240,165,0,0.12)', color: '#f0a500', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>🔥 HOT</span>
                <span style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>NHL</span>
                <span style={{ color: '#4b5563', fontSize: 11 }}>7:30 PM ET · 2m ago</span>
                <span style={{ marginLeft: 'auto', color: '#4b5563', fontSize: 12 }}>{arbFlipped ? '▲ Close' : '▼ Click to expand'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: arbFlipped ? 22 : 0 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>Minnesota Wild vs Colorado Avalanche</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Moneyline</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 38, fontWeight: 900, color: '#00C853', lineHeight: 1, letterSpacing: '-1px' }}>+3.2%</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>Guaranteed profit</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>+$32 on $1,000</div>
                </div>
              </div>

              <div style={{ maxHeight: arbFlipped ? 400 : 0, overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18, paddingTop: 4 }}>
                  {[{ book:'DraftKings', odds:'+322', stake:'$480', color:'#003087' }, { book:'FanDuel', odds:'-280', stake:'$520', color:'#1493ff' }].map((leg, i) => (
                    <div key={i} className="arb-leg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 22, background: leg.color, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff' }}>{leg.book.slice(0,2).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{leg.book}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>Bet {leg.stake}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: leg.odds.startsWith('+') ? '#00C853' : '#f85149' }}>{leg.odds}</div>
                        <div style={{ fontSize: 10, color: '#58a6ff' }}>OPEN ↗</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button style={{ background: '#00C853', color: '#000', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>💰 Place Both Bets</button>
                  <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', borderRadius: 9, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}>+ Add to Tracker</button>
                </div>
                <div style={{ background: 'rgba(0,200,83,0.07)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#00C853', textAlign: 'center' }}>
                  ✓ Profit is <strong>guaranteed</strong> regardless of who wins — this is math, not gambling.
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '80px 24px', background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>No experience needed</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>What TrueOdds does for you</h2>
              <p style={{ color: '#6b7280', fontSize: 15 }}>Every tool you need to build consistent edge over sportsbooks.</p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {[
              { icon:'⚡', title:'Arbitrage Finder', desc:'Bet both sides and lock in guaranteed profit regardless of outcome.', color:'#00C853', href:'/dashboard/arbitrage' },
              { icon:'📈', title:'Positive EV',      desc:'Mathematically profitable bets where your edge compounds over time.', color:'#58a6ff', href:'/dashboard/positive-ev' },
              { icon:'📊', title:'Live Odds Screen', desc:'Every sportsbook side by side. Always get the best price.', color:'#8957e5', href:'/dashboard/odds' },
              { icon:'📋', title:'Bet Tracker',      desc:'Log bets, track P&L, ROI, win rate, and CLV analytics.',            color:'#f0a500', href:'/dashboard/tracker' },
              { icon:'🔔', title:'Smart Alerts',     desc:'Instant push when high-value arbs or +EV bets appear.',           color:'#f85149', href:'/dashboard/alerts' },
              { icon:'🧮', title:'Calculators',      desc:'Arb calculator, Kelly criterion, EV calculator, odds converter.',  color:'#00C853', href:'/dashboard/calculators' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 60}>
                <Link href={f.href} className="feature-card-hover" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '24px 22px', display: 'block' }}>
                  <div style={{ fontSize: 30, marginBottom: 14 }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: '#e6edf3' }}>{f.title}</div>
                  <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>{f.desc}</p>
                  <span style={{ color: f.color, fontSize: 12, fontWeight: 700 }}>Explore →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section style={{ padding: '88px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>Real bettors. Real results.</p>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px' }}>Join 10,000+ winning bettors</h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 40 }}>
              {[{ val:'$420', label:'Avg monthly profit', sub:'Gold plan' }, { val:'10K+', label:'Active members', sub:'And growing' }, { val:'94%', label:'Profitable in month 1', sub:'Following the system' }, { val:'8.2%', label:'Average ROI', sub:'Settled bets' }].map((s,i) => (
                <div key={i} className="stat-card-hover" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'default' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#00C853', marginBottom: 4 }}>{s.val}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d0d7de', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#4b5563' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {REVIEWS.map((r,i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="review-card-hover" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,200,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#00C853', fontSize: 15 }}>{r.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#4b5563' }}>{r.handle}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', background: r.plan === 'Platinum' ? 'rgba(137,87,229,0.12)' : 'rgba(240,165,0,0.1)', color: r.plan === 'Platinum' ? '#8957e5' : '#f0a500', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{r.plan}</div>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.75, marginBottom: 12 }}>"{r.text}"</p>
                  <div style={{ background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.15)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#00C853' }}>{r.profit}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKER 2 ── */}
      <div style={{ background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(90deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(270deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div className="ticker-wrap" style={{ display: 'flex', animation: 'marqueeRev 38s linear infinite', width: 'max-content' }}>
          {[...TICKER.slice().reverse(), ...TICKER.slice().reverse()].map((item, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 28px', flexShrink: 0 }}>
              <span style={{ fontSize: 15 }}>{item.sport}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>{item.game}</span>
              <span style={{ color: '#374151', fontSize: 12 }}>·</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>{item.market}</span>
              <span style={{ background: 'rgba(0,200,83,0.12)', color: '#00C853', fontWeight: 900, fontSize: 12, padding: '2px 9px', borderRadius: 20 }}>{item.profit}</span>
              <span style={{ color: '#1f2937', margin: '0 4px' }}>|</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '90px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>Pricing</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 22 }}>Premium Features. Minimal Costs.</h2>
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 28, padding: '5px 6px', gap: 4 }}>
                {(['monthly','yearly'] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)} style={{ padding: '7px 20px', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: billing === b ? '#00C853' : 'transparent', color: billing === b ? '#000' : '#6b7280', transition: 'all 0.2s' }}>
                    {b === 'monthly' ? 'Monthly' : 'Yearly'}
                    {b === 'yearly' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: billing === 'yearly' ? '#000' : '#00C853' }}>2 months free!</span>}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {[
              { name:'Basic', price:'Free', sub:'Discover the platform', color:'rgba(255,255,255,0.07)', accent:'#6b7280', featured:false,
                features:['All bet types (3% cap)','Odds screen (delayed)','All sports & leagues','Community Discord'] },
              { name:'Gold', price:`$${prices.gold}`, sub:'For consistent edge', color:'rgba(240,165,0,0.08)', accent:'#f0a500', featured:true,
                features:['Full Arbitrage Finder','+EV Betting Tools','40+ US sportsbooks','Instant odds screen','Smart alerts','Unlimited tracker','Cancel anytime'] },
              { name:'💎 Platinum', price:`$${prices.platinum}`, sub:'Maximum edge', color:'rgba(137,87,229,0.07)', accent:'#8957e5', featured:false,
                features:['Everything in Gold','100+ global books','Live in-play odds','Sub-second refresh','API access','1:1 coaching'] },
            ].map((plan, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="plan-hover" style={{ background: plan.color, border: `1px solid ${plan.featured ? plan.accent : 'rgba(255,255,255,0.07)'}`, borderRadius: 18, padding: '30px 26px', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {plan.featured && <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: plan.accent, color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap' }}>MOST POPULAR</div>}
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{plan.name}</div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1px' }}>{plan.price}</span>
                    {plan.price !== 'Free' && <span style={{ color: '#4b5563', fontSize: 14 }}>/mo</span>}
                  </div>
                  <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 22 }}>{plan.sub}</p>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 18 }} />
                  <div style={{ flex: 1 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 10, marginBottom: 12, fontSize: 13, color: '#d0d7de', alignItems: 'flex-start' }}>
                        <span style={{ color: plan.accent, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                  <Link href="/signup" className="cta-primary" style={{ display: 'block', textAlign: 'center', marginTop: 22, background: plan.featured ? plan.accent : 'transparent', border: `1px solid ${plan.featured ? plan.accent : 'rgba(255,255,255,0.1)'}`, color: plan.featured ? '#000' : '#e6edf3', textDecoration: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 800 }}>
                    {plan.price === 'Free' ? 'Start Free' : 'Start 14-Day Trial →'}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '80px 24px', background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>FAQ</p>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px' }}>Frequently Asked Questions</h2>
            </div>
          </Reveal>
          <div>
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 60}>
                <FaqItem faq={faq} idx={i} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '80px 24px 100px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ maxWidth: 540, margin: '0 auto', background: 'rgba(0,200,83,0.04)', border: '1px solid rgba(0,200,83,0.18)', borderRadius: 22, padding: '52px 40px' }}>
            <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px', marginBottom: 12 }}>Get Full Access.<br />Start Free.</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>Weekly tips, new arb opportunities, and platform updates.</p>
            {emailSent ? (
              <div style={{ background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 10, padding: '14px 20px', color: '#00C853', fontWeight: 700 }}>✓ You're in! Check your inbox.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ flex: 1, background: '#080b12', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', borderRadius: 9, padding: '12px 16px', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,200,83,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                <button onClick={() => { if (email) setEmailSent(true) }} className="cta-primary"
                  style={{ background: '#00C853', color: '#000', border: 'none', borderRadius: 9, padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Send it →
                </button>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '48px 24px 32px', background: '#060810' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4,1fr)', gap: 32, marginBottom: 44, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12, letterSpacing: '-0.5px' }}>True<span style={{ color: '#00C853' }}>Odds</span></div>
              <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.75, maxWidth: 180 }}>Real-time arb and +EV tools for serious bettors.</p>
            </div>
            {[
              { title:'Product', links:[['Arbitrage','/dashboard/arbitrage'],['+EV Bets','/dashboard/positive-ev'],['Live Odds','/dashboard/odds'],['Bet Tracker','/dashboard/tracker'],['Calculators','/dashboard/calculators']] },
              { title:'Resources', links:[['Pricing','/pricing'],['Blog','/blog'],['About','/about'],['Contact','/contact']] },
              { title:'Company', links:[['Privacy','/privacy'],['Terms','/terms'],['Responsible Gaming','/responsible-gaming']] },
              { title:'Social', links:[['Discord','#'],['Twitter/X','#'],['Instagram','#']] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>{col.title}</div>
                {col.links.map(([label, href]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <Link href={href} className="link-hover" style={{ color: '#374151', textDecoration: 'none', fontSize: 13, transition: 'color 0.15s' }}>{label}</Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ color: '#374151', fontSize: 12 }}>© 2025 TrueOdds, LLC.</span>
            <span style={{ color: '#374151', fontSize: 11, maxWidth: 500 }}>For entertainment only. Must be 21+ to use sportsbooks. Problem gambling? Call 1-800-GAMBLER.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
