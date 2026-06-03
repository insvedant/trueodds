'use client'
import Logo from '@/components/Logo'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { detectAndRedirect, dismissRedirect } from '@/lib/geoRedirect'

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
  { q:'What is the Free plan?', a:'A preview of the platform — see a sample of live arbitrage opportunities and odds across major sports. A payment method is required to start a paid plan with a 7-day free trial.' },
  { q:'Is arbitrage betting legal?', a:'100% legal. You\'re placing normal bets at licensed sportsbooks. Books may limit accounts that win consistently, which is why we teach proper bet sizing and book management.' },
  { q:'How do I cancel?', a:'Cancel anytime from Profile → Billing → Manage Plan. Access continues to the end of your billing period. No questions asked, no cancellation fees.' },
]

const REVIEWS = [
  { name:'Alex M.',     handle:'@alexbets',    avatar:'A', plan:'Gold',     text:'Made back my subscription in the first 3 bets. The arb finder is insane — I had no idea how much I was leaving on the table.',                            profit:'+$847/mo' },
  { name:'Sarah K.',    handle:'@sharpsk',     avatar:'S', plan:'Platinum', text:'Been on TrueOdds 4 months. ROI consistently above 8%. The +EV bets are where the real long-term money is.',                                              profit:'+$2,340/mo' },
  { name:'James T.',    handle:'@jtbets',      avatar:'J', plan:'Gold',     text:'As someone brand new to betting, the alerts tell me exactly when and where to bet. No guesswork at all.',                                                profit:'+$412/mo' },
  { name:'Mike R.',     handle:'@mikerbet',    avatar:'M', plan:'Platinum', text:'Turned a $2k bankroll into $8k in 3 months. The math doesn\'t lie — this is completely legitimate and it works.',                                       profit:'+$1,890/mo' },
  { name:'Danny L.',    handle:'@danlbets',    avatar:'D', plan:'Gold',     text:'I was skeptical at first but the arbitrage calculator is genuinely foolproof. Got +$312 in my first weekend just following the alerts.',                  profit:'+$638/mo' },
  { name:'Priya N.',    handle:'@priyawinss',  avatar:'P', plan:'Platinum', text:'The ML insights are next level. Sharp money alerts told me to fade the public on 3 straight games — all won. This tool pays for itself daily.',           profit:'+$3,120/mo' },
  { name:'Carlos V.',   handle:'@cvbetting',   avatar:'C', plan:'Gold',     text:'Moved from losing $200/month to making $600. Took about a week to learn the system. Now I check TrueOdds before every single bet.',                       profit:'+$612/mo' },
  { name:'Emma W.',     handle:'@emmawinbet',  avatar:'E', plan:'Gold',     text:'The line movement alerts are my favourite feature. Caught three steam moves last week alone. Unreal value at the Gold price point.',                      profit:'+$975/mo' },
  { name:'Tyler B.',    handle:'@tylerbb99',   avatar:'T', plan:'Platinum', text:'I was paying $299/month for a worse product elsewhere. TrueOdds has better arb coverage, faster refresh, and the +EV tool is genuinely elite.',           profit:'+$2,850/mo' },
  { name:'Jordan K.',   handle:'@jksharpbets', avatar:'J', plan:'Gold',     text:'Honestly the bet tracker alone is worth the subscription. Seeing your actual CLV over time is eye-opening. I finally know what edges are real.',          profit:'+$730/mo' },
  { name:'Megan S.',    handle:'@megbets22',   avatar:'M', plan:'Platinum', text:'Got into arbitrage with zero experience. The walkthrough guides + alert system made it idiot-proof. Hit $1,200 profit in month one.',                    profit:'+$1,240/mo' },
  { name:'Ryan P.',     handle:'@ryanprof',    avatar:'R', plan:'Gold',     text:'What gets me is the speed. By the time other tools show an arb, it\'s gone. TrueOdds had me in and out in under 90 seconds on a 3.8% arb yesterday.',    profit:'+$540/mo' },
  { name:'Lisa H.',     handle:'@lisahbets',   avatar:'L', plan:'Platinum', text:'The API access on Platinum is incredible for building my own tracking tools. Plus the human support actually responds. 10/10 would recommend.',           profit:'+$4,200/mo' },
  { name:'Ben O.',      handle:'@benbetting',  avatar:'B', plan:'Gold',     text:'Showed TrueOdds to my buddy who\'s been betting for 10 years and he said he wished this existed when he started. That\'s a strong endorsement.',         profit:'+$890/mo' },
]

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
      
    ],
  },
} as const

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
      {}
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
      {}
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

function Navbar() {
  const [scrolled, setScrolled]     = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Geo-redirect: US visitors → trueodds.us
  useEffect(() => {
    // Check if came back intentionally from geo redirect
    if (window.location.search.includes('ref=geo')) {
      dismissRedirect()
      return
    }
    detectAndRedirect()
  }, [])
  const [openMenu, setOpenMenu]     = useState<keyof typeof MENU | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
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
        background: scrolled ? 'rgba(8,11,18,0.95)' : 'rgba(8,11,18,0.4)',
        backdropFilter: 'blur(14px)',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'background 0.35s, border-color 0.35s',
      }}>
        <Logo size="md" linkTo="/" />

        <div className="lp-nav-links" style={{ display:'flex', alignItems:'center', gap:4, position:'relative' }}>
          {}
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

          {}
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

        {}
        <div className="lp-nav-cta" style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Link href="/login" style={{ color:'#9ca3af', textDecoration:'none', fontSize:13, fontWeight:500, padding:'8px 16px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; e.currentTarget.style.color='#e6edf3' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#9ca3af' }}>
            Log in
          </Link>
          <Link href="/signup" style={{ background:'#00C853', color:'#000', textDecoration:'none', fontSize:13, fontWeight:800, padding:'8px 18px', borderRadius:8, display:'inline-block' }}>
            Start Free →
          </Link>
        </div>

        {}
        <div className="lp-nav-mobile" style={{ display:'none', alignItems:'center', gap:12 }}>
          <Link href="/signup" style={{ background:'#00C853', color:'#000', textDecoration:'none', fontSize:12, fontWeight:800, padding:'7px 14px', borderRadius:8 }}>
            Start Free
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', flexDirection:'column', gap:5 }}>
            <span style={{ display:'block', width:22, height:2, background:'#e6edf3', borderRadius:2, transition:'all 0.2s', transform:mobileOpen?'rotate(45deg) translate(5px,5px)':'none' }} />
            <span style={{ display:'block', width:22, height:2, background:'#e6edf3', borderRadius:2, opacity:mobileOpen?0:1, transition:'all 0.2s' }} />
            <span style={{ display:'block', width:22, height:2, background:'#e6edf3', borderRadius:2, transition:'all 0.2s', transform:mobileOpen?'rotate(-45deg) translate(5px,-5px)':'none' }} />
          </button>
        </div>
      </nav>

      {}
      {mobileOpen && (
        <div style={{ position:'fixed', top:64, left:0, right:0, zIndex:149, background:'rgba(8,11,18,0.97)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,0.08)', padding:'16px 0' }}>
          {[{href:'/#features',label:'Features'},{href:'/pricing',label:'Pricing'},{href:'/#faq',label:'FAQ'},{href:'/blog',label:'Blog'},{href:'/about',label:'About'}].map(l=>(
            <a key={l.href} href={l.href} onClick={()=>setMobileOpen(false)} style={{ display:'block', padding:'13px 24px', fontSize:15, color:'#e6edf3', textDecoration:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', fontWeight:500 }}>{l.label}</a>
          ))}
          <div style={{ padding:'16px 24px', display:'flex', gap:10 }}>
            <Link href="/login" onClick={()=>setMobileOpen(false)} style={{ flex:1, textAlign:'center', padding:'10px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#e6edf3', textDecoration:'none', borderRadius:8, fontSize:14, fontWeight:600 }}>Log in</Link>
            <Link href="/signup" onClick={()=>setMobileOpen(false)} style={{ flex:1, textAlign:'center', padding:'10px', background:'#00C853', color:'#000', textDecoration:'none', borderRadius:8, fontSize:14, fontWeight:800 }}>Start Free →</Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes menuDrop {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}

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

export default function LandingPage() {
  const { forceDark, restoreTheme } = useTheme()
  const [billing, setBilling] = useState<'monthly'|'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [arbFlipped, setArbFlipped] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [liveTicker, setLiveTicker] = useState(TICKER)
  const [liveArb, setLiveArb]       = useState<any>(null)
  const [liveCount, setLiveCount]   = useState(12)

  // Fetch real arb data after 50s — replace mock ticker + demo card
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://trueodds.onrender.com/api'
    const load = () => {
      fetch(`${API}/arb?t=${Date.now()}`)
        .then(r => r.json())
        .then(d => {
          const arbs = d.data || []
          if (arbs.length > 0) {
            setLiveCount(arbs.length)
            // Build ticker items from real arbs
            const tickerItems = arbs.slice(0, 10).map((a: any) => ({
              sport: ({NHL:'🏒',NBA:'🏀',MLB:'⚾',NFL:'🏈',Soccer:'⚽',Tennis:'🎾',UFC:'🥊',CFL:'🏈'} as any)[a.sport] || '🏅',
              game:  a.game || '',
              market:'Moneyline',
              profit: `+${(a.profit || 0).toFixed(1)}%`,
              books: `${(a.b1||'').slice(0,2).toUpperCase()} / ${(a.b2||'').slice(0,2).toUpperCase()}`,
            }))
            if (tickerItems.length >= 3) setLiveTicker(tickerItems)
            // Set hottest arb for demo card
            const hot = arbs.find((a: any) => a.hot) || arbs[0]
            if (hot) setLiveArb(hot)
          }
        })
        .catch(() => {})
    }
    const timer = setTimeout(load, 50000)
    // Also try immediately in background
    load()
    return () => clearTimeout(timer)
  }, [])
  
  useEffect(() => {
    forceDark()
    return () => { restoreTheme() }
  }, [])

  const prices = { basic: billing === 'monthly' ? 15.99 : 12.99, gold: billing === 'monthly' ? 49.99 : 39.99, platinum: billing === 'monthly' ? 99.99 : 79.99 }

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
        @keyframes gradShift    { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes tweetScroll1 { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes tweetScroll2 { 0%{transform:translateX(-50%)} 100%{transform:translateX(0)} }

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

        /* ── Mobile: landing page ── */
        @media (max-width: 768px) {
          /* Nav */
          .lp-nav-links   { display: none !important; }
          .lp-nav-mobile  { display: flex !important; }
          .lp-nav-cta     { display: none !important; }

          /* Hero */
          .hero-btns      { flex-direction: column !important; gap: 10px !important; }
          .live-badge     { margin-top: 56px !important; }
          .hero-btns a, .hero-btns button { width: 100% !important; text-align: center !important; }

          /* Pricing — horizontal scroll slider on mobile */
          .pricing-slider-wrap {
            overflow-x: auto !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch !important;
            display: flex !important;
            gap: 16px !important;
            padding-bottom: 16px !important;
            padding: 0 16px 16px !important;
            margin: 0 -16px !important;
            scrollbar-width: none !important;
          }
          .pricing-slider-wrap::-webkit-scrollbar { display: none !important; }
          .pricing-slider-wrap > * {
            flex: 0 0 85vw !important;
            max-width: 320px !important;
            scroll-snap-align: start !important;
          }
          .pricing-dots { display: flex !important; }

          /* Stats grid */
          .stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          /* Testimonials */
          .testimonial-grid { grid-template-columns: 1fr !important; }

          /* Features */
          .features-grid-3 { grid-template-columns: 1fr !important; }
          .features-grid-2 { grid-template-columns: 1fr !important; }

          /* Section padding */
          section { padding-left: 16px !important; padding-right: 16px !important; }
        }
        @media (min-width: 769px) {
          .lp-nav-mobile  { display: none !important; }
          .pricing-dots   { display: none !important; }
        }
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

      {}
      <section style={{ position: 'relative', padding: '148px 24px 100px', textAlign: 'center', overflow: 'hidden' }}>
        <div className="hero-glow grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

        {}
        <div style={{ position: 'absolute', top: '15%', left: '8%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(0,200,83,0.06) 0%, transparent 70%)', borderRadius: '50%', animation: 'heroFloat 7s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '25%', right: '6%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(88,166,255,0.06) 0%, transparent 70%)', borderRadius: '50%', animation: 'heroFloat 9s ease-in-out infinite 1.5s', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 840, margin: '0 auto' }}>
          {}
          <div className="live-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.22)', borderRadius: 24, padding: '6px 16px', fontSize: 12, color: '#00C853', fontWeight: 700, marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, background: '#00C853', borderRadius: '50%', animation: 'blink 1.4s ease-in-out infinite', display: 'inline-block' }} />
            LIVE · {liveCount} arb opportunities right now
          </div>

          <h1 style={{ fontSize: 'clamp(46px,7.5vw,86px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-2px', marginBottom: 32 }}>
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
              Start Free →
            </Link>
            <a href="#how" style={{ color: '#8b949e', textDecoration: 'none', fontWeight: 500, fontSize: 15, padding: '14px 24px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, display: 'inline-block', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#e6edf3' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8b949e' }}>
              See how it works
            </a>
          </div>

          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, color: '#4b5563' }}>
            {['✓ No commitments', '✓ 7-day free trial', '✓ Cancel anytime', '✓ 7-day trial'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>
      </section>

      {}
      <div style={{ background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '11px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(90deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(270deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div className="ticker-wrap" style={{ display: 'flex', animation: 'marquee 30s linear infinite', width: 'max-content' }}>
          {[...liveTicker, ...liveTicker].map((item, i) => (
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

      {}
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

      {}
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

      {}
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
            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${arbFlipped ? 'rgba(0,200,83,0.45)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 18, transition: 'all 0.3s', boxShadow: arbFlipped ? '0 0 40px rgba(0,200,83,0.1)' : 'none', overflow: 'hidden' }}>
              <div onClick={() => setArbFlipped(!arbFlipped)} style={{ padding: '26px 28px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onMouseEnter={e => { if (!arbFlipped) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { if (!arbFlipped) (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <span style={{ background: 'rgba(240,165,0,0.12)', color: '#f0a500', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>🔥 HOT</span>
                <span style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{liveArb?.sport || 'NHL'}</span>
                <span style={{ color: '#4b5563', fontSize: 11 }}>{liveArb ? 'Live now' : '7:30 PM ET'}</span>
                <span style={{ marginLeft: 'auto', color: '#4b5563', fontSize: 12 }}>{arbFlipped ? '▲ Close' : '▼ Tap to expand'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: arbFlipped ? 22 : 0 }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 4 }}>{liveArb?.game || 'Minnesota Wild vs Colorado Avalanche'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{liveArb?.market || 'Moneyline'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 38, fontWeight: 900, color: '#00C853', lineHeight: 1, letterSpacing: '-1px' }}>+{liveArb ? liveArb.profit.toFixed(1) : '3.2'}%</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>Guaranteed profit</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>+${liveArb ? Math.round(liveArb.profit * 10) : 32} on $1,000</div>
                </div>
              </div>
              </div>

              {}
              <div style={{ maxHeight: arbFlipped ? 500 : 0, overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ padding: '0 28px 26px' }}>
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
                      <div style={{ textAlign: 'right' as const }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: leg.odds.startsWith('+') ? '#00C853' : '#f85149' }}>{leg.odds}</div>
                        <div style={{ fontSize: 10, color: '#58a6ff' }}>OPEN ↗</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const }}>
                  <button style={{ background: '#00C853', color: '#000', border: 'none', borderRadius: 9, padding: '12px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>💰 Place Both Bets</button>
                  <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', borderRadius: 9, padding: '12px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}>+ Add to Tracker</button>
                </div>
                <div style={{ background: 'rgba(0,200,83,0.07)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#00C853', textAlign: 'center' as const }}>
                  ✓ Profit is <strong>guaranteed</strong> regardless of who wins — this is math, not gambling.
                </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {}
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

      {}
      <section style={{ padding: '88px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ color: '#00C853', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: 12 }}>Real bettors. Real results.</p>
              <h2 style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: 900, letterSpacing: '-1px' }}>Join 10,000+ winning bettors</h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 40 }}>
              {[{ val:'$380', label:'Avg monthly profit', sub:'Across all paid plans' }, { val:'2,400+', label:'Active members', sub:'Canada & USA' }, { val:'89%', label:'Found arb in week 1', sub:'New members' }, { val:'6.4%', label:'Average ROI', sub:'Settled arb bets' }].map((s,i) => (
                <div key={i} className="stat-card-hover" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 12px', textAlign: 'center', cursor: 'default', minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(20px,5vw,28px)', fontWeight: 900, color: '#00C853', marginBottom: 4 }}>{s.val}</div>
                  <div style={{ fontSize: 'clamp(10px,2.5vw,12px)', fontWeight: 700, color: '#d0d7de', marginBottom: 2, lineHeight: 1.3 }}>{s.label}</div>
                  <div style={{ fontSize: 'clamp(9px,2vw,11px)', color: '#4b5563' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </Reveal>

          {}
          <div style={{ position: 'relative', overflow: 'hidden', margin: '0 -24px' }}>
            {}
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:80, background:'linear-gradient(90deg,#080b12,transparent)', zIndex:2, pointerEvents:'none' }} />
            <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:'linear-gradient(270deg,#080b12,transparent)', zIndex:2, pointerEvents:'none' }} />

            {}
            <div style={{ overflow:'hidden', marginBottom:14 }}>
              <div style={{ display:'flex', gap:14, animation:'tweetScroll1 60s linear infinite', width:'max-content' }}
                onMouseEnter={e=>(e.currentTarget.style.animationPlayState='paused')}
                onMouseLeave={e=>(e.currentTarget.style.animationPlayState='running')}>
                {[...REVIEWS.slice(0,7), ...REVIEWS.slice(0,7)].map((r,i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px', width:280, flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(0,200,83,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#00C853', fontSize:14, flexShrink:0 }}>{r.avatar}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'#e6edf3' }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#4b5563' }}>{r.handle}</div>
                      </div>
                      <div style={{ background:r.plan==='Platinum'?'rgba(137,87,229,0.12)':'rgba(240,165,0,0.1)', color:r.plan==='Platinum'?'#8957e5':'#f0a500', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>{r.plan}</div>
                    </div>
                    <p style={{ color:'#9ca3af', fontSize:12, lineHeight:1.7, marginBottom:10 }}>"{r.text}"</p>
                    <div style={{ background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.15)', borderRadius:8, padding:'5px 10px', fontSize:12, fontWeight:700, color:'#00C853', display:'inline-block' }}>{r.profit}</div>
                  </div>
                ))}
              </div>
            </div>

            {}
            <div style={{ overflow:'hidden' }}>
              <div style={{ display:'flex', gap:14, animation:'tweetScroll2 70s linear infinite', width:'max-content' }}
                onMouseEnter={e=>(e.currentTarget.style.animationPlayState='paused')}
                onMouseLeave={e=>(e.currentTarget.style.animationPlayState='running')}>
                {[...REVIEWS.slice(7), ...REVIEWS.slice(7)].map((r,i) => (
                  <div key={i} style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'18px', width:280, flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(0,200,83,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#00C853', fontSize:14, flexShrink:0 }}>{r.avatar}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'#e6edf3' }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'#4b5563' }}>{r.handle}</div>
                      </div>
                      <div style={{ background:r.plan==='Platinum'?'rgba(137,87,229,0.12)':'rgba(240,165,0,0.1)', color:r.plan==='Platinum'?'#8957e5':'#f0a500', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>{r.plan}</div>
                    </div>
                    <p style={{ color:'#9ca3af', fontSize:12, lineHeight:1.7, marginBottom:10 }}>"{r.text}"</p>
                    <div style={{ background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.15)', borderRadius:8, padding:'5px 10px', fontSize:12, fontWeight:700, color:'#00C853', display:'inline-block' }}>{r.profit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <div style={{ background: '#0a0d13', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(90deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, background: 'linear-gradient(270deg,#0a0d13,transparent)', zIndex: 2, pointerEvents: 'none' }} />
        <div className="ticker-wrap" style={{ display: 'flex', animation: 'marqueeRev 38s linear infinite', width: 'max-content' }}>
          {[...liveTicker.slice().reverse(), ...liveTicker.slice().reverse()].map((item, i) => (
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

      {}
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

          {}
          <div className="pricing-slider-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {[
              { name:'🌱 Basic', price:`$${prices.basic}`, sub:'Start finding edges', color:'rgba(0,200,83,0.06)', accent:'#00C853', featured:false,
                features:['Arbitrage finder','+EV betting tools','40+ US sportsbooks','Smart email alerts','Unlimited bet tracker','Cancel anytime'] },
              { name:'⚡ Gold', price:`$${prices.gold}`, sub:'For consistent edge', color:'rgba(240,165,0,0.08)', accent:'#f0a500', featured:true,
                features:['Everything in Basic','ML predictions & EV scoring','100+ global sportsbooks','Emergency Hedge button','Priority email support','Sub-second odds refresh'] },
              { name:'💎 Platinum', price:`$${prices.platinum}`, sub:'Maximum edge', color:'rgba(137,87,229,0.07)', accent:'#8957e5', featured:false,
                features:['Everything in Gold','API access','Sub-second alerts','Custom line alerts','Dedicated account manager','Unlimited devices'] },
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
                    Start 7-Day Trial →
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          {}
          <div className="pricing-dots" style={{ justifyContent: 'center', gap: 6, marginTop: 16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 1 ? '#00C853' : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      </section>

      {}
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

      {}
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
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.05)', padding:'52px 24px 32px', background:'#060810' }}>
        <style>{`
          .lp-footer-grid { display:grid; grid-template-columns:1.8fr 1fr 1fr 1fr; gap:32px; margin-bottom:44px; }
          @media(max-width:768px) { .lp-footer-grid { grid-template-columns:1fr 1fr; gap:24px; } }
          @media(max-width:480px) { .lp-footer-grid { grid-template-columns:1fr; gap:20px; } }
          .lp-footer-bottom { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.04); }
          @media(max-width:640px) { .lp-footer-bottom { flex-direction:column; text-align:center; } }
        `}</style>
        <div style={{ maxWidth:980, margin:'0 auto' }}>
          <div className="lp-footer-grid">
            {/* Brand */}
            <div>
              <Logo size="md" linkTo="/" />
              <p style={{ color:'#4b5563', fontSize:13, lineHeight:1.8, maxWidth:220, marginBottom:20 }}>Real-time arbitrage, +EV betting, and ML-powered insights for serious sports bettors.</p>
              <Link href="/signup" style={{ background:'#00C853', color:'#000', textDecoration:'none', padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:800, display:'inline-block' }}>
                Start Free Trial →
              </Link>
            </div>
            {[
              { title:'Product', links:[['Arbitrage','/dashboard/arbitrage'],['+EV Bets','/dashboard/positive-ev'],['Live Odds','/dashboard/odds'],['Bet Tracker','/dashboard/tracker'],['Calculators','/dashboard/calculators'],['ML Insights','/dashboard/insights']] },
              { title:'Resources', links:[['Pricing','/pricing'],['Blog','/blog'],['About','/about'],['Contact','/contact']] },
              { title:'Legal', links:[['Privacy','/privacy'],['Terms','/terms'],['Responsible Gaming','/responsible-gaming']] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'1px', marginBottom:14 }}>{col.title}</div>
                {col.links.map(([label, href]) => (
                  <div key={label} style={{ marginBottom:10 }}>
                    <Link href={href} style={{ color:'#4b5563', textDecoration:'none', fontSize:13, transition:'color 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget.style.color='#e6edf3')}
                      onMouseLeave={e=>(e.currentTarget.style.color='#4b5563')}>{label}</Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="lp-footer-bottom">
            <span style={{ color:'#374151', fontSize:12 }}>© {new Date().getFullYear()} TrueOdds, Inc. All rights reserved.</span>
            <span style={{ color:'#374151', fontSize:11 }}>Must be 19+. Problem gambling? Call 1-866-531-2600 (ConnexOntario) or 1-800-522-4700 (NCPG).</span>
            <div style={{ display:'flex', gap:16 }}>
              {[['Privacy','/privacy'],['Terms','/terms'],['Responsible Gaming','/responsible-gaming']].map(([l,h])=>(
                <Link key={l} href={h} style={{ color:'#374151', fontSize:11, textDecoration:'none' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#6b7280')}
                  onMouseLeave={e=>(e.currentTarget.style.color='#374151')}>{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
