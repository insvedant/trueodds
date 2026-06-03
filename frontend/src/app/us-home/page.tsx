'use client'
// US-specific landing page for trueodds.us
// All content identical to CA page but with 21+ age, US helpline, US sportsbooks
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useTheme } from '@/lib/theme'
import { detectAndRedirect, dismissRedirect } from '@/lib/geoRedirect'

const TICKER = [
  { sport:'🏈', game:'Bills vs Dolphins',       market:'Spread',       profit:'+2.8%', books:'DraftKings / FanDuel' },
  { sport:'⚾', game:'Yankees vs Red Sox',       market:'Moneyline',    profit:'+3.1%', books:'BetMGM / FanDuel' },
  { sport:'🏀', game:'Celtics vs Heat',          market:'Moneyline',    profit:'+2.2%', books:'Pinnacle / DK' },
  { sport:'🎾', game:'Sinner vs Alcaraz',        market:'Match Winner', profit:'+4.5%', books:'Pinnacle / Caesars' },
  { sport:'🏒', game:'Rangers vs Bruins',        market:'Puck Line',    profit:'+3.7%', books:'FanDuel / Pinnacle' },
  { sport:'⚽', game:'LAFC vs LA Galaxy',        market:'Moneyline',    profit:'+2.9%', books:'DK / BetMGM' },
]
const WINS = ['+$134','+$91','+$258','+$62','+$201','+$318','+$74','+$107']

export default function USHomePage() {
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [billing, setBilling]       = useState<'monthly'|'yearly'>('monthly')
  const [openFaq, setOpenFaq]       = useState<number|null>(0)
  const [arbFlipped, setArbFlipped] = useState(false)
  const [email, setEmail]           = useState('')
  const [emailSent, setEmailSent]   = useState(false)
  const [liveTicker, setLiveTicker] = useState(TICKER)
  const [liveArb, setLiveArb]       = useState<any>(null)
  const [liveCount, setLiveCount]   = useState(12)

  const prices = {
    basic:    billing === 'monthly' ? 15.99 : 12.99,
    gold:     billing === 'monthly' ? 49.99 : 39.99,
    platinum: billing === 'monthly' ? 99.99 : 79.99,
  }

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Geo-redirect: non-US visitors → trueodds.ca
  useEffect(() => {
    if (window.location.search.includes('ref=geo')) {
      dismissRedirect()
      return
    }
    detectAndRedirect()
  }, [])

  useEffect(() => {
    const API = (process.env.NEXT_PUBLIC_API_URL || 'https://trueodds.onrender.com') + '/api'
    fetch(`${API}/arb?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => {
        const arbs = d.data || []
        if (arbs.length > 0) {
          setLiveCount(arbs.length)
          const items = arbs.slice(0,10).map((a:any) => ({
            sport: ({NHL:'🏒',NBA:'🏀',MLB:'⚾',NFL:'🏈',Soccer:'⚽',Tennis:'🎾',UFC:'🥊'} as any)[a.sport]||'🏅',
            game: a.game||'', market:'Moneyline',
            profit: `+${(a.profit||0).toFixed(1)}%`,
            books: `${(a.b1||'').slice(0,2).toUpperCase()} / ${(a.b2||'').slice(0,2).toUpperCase()}`,
          }))
          if (items.length >= 3) setLiveTicker(items)
          const hot = arbs.find((a:any)=>a.hot)||arbs[0]
          if (hot) setLiveArb(hot)
        }
      }).catch(()=>{})
  }, [])

  const NAV = [
    { label:'Features', href:'#features' },
    { label:'Pricing',  href:'/pricing' },
    { label:'Blog',     href:'/blog' },
    { label:'About',    href:'/about' },
  ]

  const FAQS = [
    { q:'Is arbitrage betting legal in the US?', a:'100% legal in all states where sports betting is regulated. You\'re placing normal bets at licensed sportsbooks like DraftKings and FanDuel. Must be 21+ to use sportsbooks in the US.' },
    { q:'Which US states does TrueOdds support?', a:'All 38 states plus DC with legal sports betting: NJ, NY, PA, IL, OH, MI, CO, AZ, VA, TN, MA, MD, and more. We cover every licensed sportsbook in your state.' },
    { q:'Which sportsbooks are covered?', a:'All major US books: FanDuel, DraftKings, BetMGM, Caesars, BetRivers, ESPN Bet, Hard Rock Bet, Fanatics, PointsBet, Pinnacle, Bet365, and 30+ more.' },
    { q:'How quickly do arbitrage opportunities disappear?', a:'Usually 30 seconds to 5 minutes. TrueOdds refreshes every 30 seconds and sends instant alerts so you can act before the window closes.' },
    { q:'What is the Free plan?', a:'A preview of the platform — see a sample of live arbitrage opportunities and the odds screen. Upgrade to Basic, Gold, or Platinum for full access.' },
    { q:'How do I cancel?', a:'Cancel anytime from Profile → Billing → Manage Plan. Access continues to the end of your billing period. No cancellation fees.' },
  ]

  return (
    <div style={{ background:'#080b12', color:'#e6edf3', overflowX:'hidden' }}>
      <style>{`
        @keyframes marquee   { to { transform: translateX(-50%); } }
        @keyframes marqueeRev{ from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        .live-badge { animation: fadeUp 0.5s ease; }
        .ticker-item { transition: background 0.15s; }
        .ticker-item:hover { background: rgba(255,255,255,0.06) !important; }
        .pub-nav { background: #0d1117 !important; }
        @media (max-width:640px) {
          .hero-btns { flex-direction:column !important; gap:10px !important; }
          .hero-h1   { font-size: clamp(32px,10vw,52px) !important; }
          .stats-grid{ grid-template-columns:1fr 1fr !important; }
          .plans-grid{ grid-template-columns:1fr !important; }
          .live-badge{ margin-top:56px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="pub-nav" style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, height:60, background:'#0d1117', borderBottom: scrolled?'1px solid rgba(255,255,255,0.08)':'none', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', transition:'border-color 0.2s' }}>
        <Logo size="md" linkTo="/" />
        <div style={{ display:'flex', gap:24, alignItems:'center' }} className="nav-desktop">
          {NAV.map(n => <Link key={n.href} href={n.href} style={{ fontSize:13, color:'#9ca3af', textDecoration:'none', fontWeight:500 }}>{n.label}</Link>)}
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={toggle} title="Toggle theme" style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:4 }}>{theme==='dark'?'🌙':'☀️'}</button>
          <Link href="/login"  style={{ fontSize:13, color:'#9ca3af', textDecoration:'none', padding:'7px 14px' }}>Log in</Link>
          <Link href="/signup" style={{ background:'#00C853', color:'#000', fontWeight:800, fontSize:13, padding:'8px 18px', borderRadius:8, textDecoration:'none' }}>Start Free</Link>
          <button onClick={()=>setMobileOpen(!mobileOpen)} style={{ background:'none', border:'none', cursor:'pointer', display:'none', flexDirection:'column', gap:5, padding:4 }} className="nav-mobile-btn">
            {[0,1,2].map(i=><span key={i} style={{ display:'block', width:22, height:2, background:'#e6edf3', borderRadius:2 }}/>)}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'100px 24px 60px', background:'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,200,83,0.08), transparent)' }}>
        <div className="live-badge" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.22)', borderRadius:24, padding:'6px 16px', fontSize:12, color:'#00C853', fontWeight:700, marginBottom:28 }}>
          <span style={{ width:7, height:7, background:'#00C853', borderRadius:'50%', animation:'blink 1.4s ease-in-out infinite', display:'inline-block' }}/>
          LIVE · {liveCount} arb opportunities right now
        </div>
        <h1 className="hero-h1" style={{ fontSize:'clamp(36px,7vw,80px)', fontWeight:900, letterSpacing:'-3px', lineHeight:1.02, marginBottom:24, maxWidth:900 }}>
          Make <span style={{ color:'#00C853' }}>$1,000+</span><br/>a week. <span style={{ color:'#3b82f6' }}>Guaranteed.</span>
        </h1>
        <p style={{ fontSize:'clamp(16px,2vw,20px)', color:'#9ca3af', maxWidth:620, lineHeight:1.7, marginBottom:40 }}>
          TrueOdds scans 40+ US sportsbooks in real time — finding arbitrage, +EV bets, and sharp lines before they disappear.
        </p>
        <div className="hero-btns" style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center', marginBottom:24 }}>
          <Link href="/signup" style={{ background:'#00C853', color:'#000', fontWeight:800, fontSize:16, padding:'14px 32px', borderRadius:12, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
            Start 7-Day Free Trial →
          </Link>
          <a href="#how" style={{ background:'rgba(255,255,255,0.06)', color:'#e6edf3', fontWeight:600, fontSize:15, padding:'14px 28px', borderRadius:12, textDecoration:'none', border:'1px solid rgba(255,255,255,0.1)' }}>
            See how it works
          </a>
        </div>
        <p style={{ fontSize:13, color:'#4b5563', marginBottom:0 }}>
          ✓ No commitments &nbsp;·&nbsp; ✓ 7-day free trial &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ✓ All US states
        </p>
      </section>

      {/* Ticker */}
      <div style={{ background:'rgba(0,0,0,0.4)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'12px 0', overflow:'hidden', whiteSpace:'nowrap' }}>
        <div style={{ display:'flex', animation:'marquee 32s linear infinite', width:'max-content' }}>
          {[...liveTicker,...liveTicker].map((item,i)=>(
            <div key={i} className="ticker-item" style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'6px 28px', borderRight:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
              <span style={{ fontSize:16 }}>{item.sport}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'#e6edf3' }}>{item.game}</span>
              <span style={{ background:'rgba(0,200,83,0.12)', color:'#00C853', fontSize:12, fontWeight:800, padding:'2px 10px', borderRadius:20 }}>{item.profit}</span>
              <span style={{ fontSize:12, color:'#6b7280' }}>{item.books}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section style={{ padding:'80px 24px', background:'#0a0d14' }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <p style={{ color:'#00C853', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:12 }}>REAL BETTORS. REAL RESULTS.</p>
          <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-1px', marginBottom:48 }}>Join 2,400+ winning bettors</h2>
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {[{ val:'$380', label:'Avg monthly profit', sub:'Across all paid plans' },{ val:'2,400+', label:'Active members', sub:'USA & Canada' },{ val:'89%', label:'Found arb in week 1', sub:'New members' },{ val:'6.4%', label:'Average ROI', sub:'Settled arb bets' }].map((s,i)=>(
              <div key={i} style={{ background:'var(--bg3,#141922)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'24px 20px' }}>
                <div style={{ fontSize:32, fontWeight:900, color:'#00C853', marginBottom:6 }}>{s.val}</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding:'80px 24px', background:'#080b12', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:940, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <p style={{ color:'#00C853', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:12 }}>PRICING</p>
            <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-1px', marginBottom:16 }}>Simple, transparent pricing</h2>
            <div style={{ display:'inline-flex', background:'rgba(255,255,255,0.05)', borderRadius:10, padding:3, gap:2 }}>
              {(['monthly','yearly'] as const).map(b=>(
                <button key={b} onClick={()=>setBilling(b)} style={{ padding:'7px 20px', borderRadius:8, fontSize:13, fontWeight:700, border:'none', background:billing===b?'rgba(255,255,255,0.12)':'transparent', color:billing===b?'#e6edf3':'#6b7280', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {b==='monthly'?'Monthly':'Yearly'}{b==='yearly'&&<span style={{ marginLeft:6, background:'rgba(0,200,83,0.15)', color:'#00C853', fontSize:10, fontWeight:800, padding:'1px 7px', borderRadius:20 }}>SAVE 20%</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="plans-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { name:'🌱 Basic',    price:`$${prices.basic}`,    sub:'Start finding edges', color:'rgba(0,200,83,0.06)',    accent:'#00C853', featured:false, features:['Arbitrage finder','+EV betting tools','40+ US sportsbooks','Smart email alerts','Unlimited bet tracker','Cancel anytime'] },
              { name:'⚡ Gold',     price:`$${prices.gold}`,     sub:'For consistent edge', color:'rgba(240,165,0,0.08)',   accent:'#f0a500', featured:true,  features:['Everything in Basic','ML predictions & EV scoring','100+ global sportsbooks','Emergency Hedge button','Priority email support','Sub-second odds refresh'] },
              { name:'💎 Platinum', price:`$${prices.platinum}`, sub:'Maximum edge',        color:'rgba(137,87,229,0.07)', accent:'#8957e5', featured:false, features:['Everything in Gold','API access','Sub-second alerts','Custom line alerts','Dedicated account manager','Unlimited devices'] },
            ].map((plan,i)=>(
              <div key={i} style={{ background:plan.color, border:`1px solid ${plan.featured?plan.accent+'55':'rgba(255,255,255,0.07)'}`, borderRadius:16, padding:'28px 24px', position:'relative', display:'flex', flexDirection:'column' }}>
                {plan.featured&&<div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.accent, color:'#000', fontSize:11, fontWeight:900, padding:'3px 14px', borderRadius:20, whiteSpace:'nowrap' }}>MOST POPULAR</div>}
                <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>{plan.name}</div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>{plan.sub}</div>
                <div style={{ fontSize:36, fontWeight:900, color:plan.accent, marginBottom:4 }}>{plan.price}</div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:24 }}>/month{billing==='yearly'&&' (billed yearly)'}</div>
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 24px', flex:1 }}>
                  {plan.features.map(f=><li key={f} style={{ fontSize:13, color:'#9ca3af', marginBottom:8, display:'flex', gap:8, alignItems:'flex-start' }}><span style={{ color:plan.accent, flexShrink:0, marginTop:1 }}>✓</span>{f}</li>)}
                </ul>
                <Link href={`/signup?plan=${plan.name.split(' ')[1]?.toLowerCase()||'basic'}`} style={{ display:'block', background:plan.featured?plan.accent:'transparent', color:plan.featured?'#000':plan.accent, border:`1.5px solid ${plan.accent}`, borderRadius:10, padding:'12px', textAlign:'center', fontWeight:800, fontSize:14, textDecoration:'none', transition:'all 0.15s' }}>
                  Start 7-Day Trial →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding:'80px 24px', background:'#0a0d13', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <p style={{ color:'#00C853', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2.5px', marginBottom:12 }}>FAQ</p>
            <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-1px' }}>Frequently Asked Questions</h2>
          </div>
          {FAQS.map((faq,i)=>(
            <div key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', overflow:'hidden' }}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{ width:'100%', background:'none', border:'none', padding:'18px 0', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', fontFamily:'inherit', textAlign:'left', color:'#e6edf3', fontSize:15, fontWeight:600 }}>
                {faq.q}<span style={{ fontSize:18, color:'#6b7280', transition:'transform 0.2s', transform:openFaq===i?'rotate(45deg)':'none' }}>+</span>
              </button>
              {openFaq===i&&<div style={{ paddingBottom:18, fontSize:14, color:'#9ca3af', lineHeight:1.7 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background:'#060810', borderTop:'1px solid rgba(255,255,255,0.06)', padding:'48px 24px 32px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:32, marginBottom:40 }}>
            <div>
              <Logo size="sm" linkTo="/" />
              <p style={{ fontSize:13, color:'#6b7280', marginTop:12, lineHeight:1.6 }}>Real-time arbitrage, +EV betting, and ML-powered insights for US sports bettors.</p>
            </div>
            {[
              { title:'Tools', links:[['Arbitrage Finder','/signup'],['+ EV Betting','/signup'],['Bet Tracker','/signup'],['Hedge Calculator','/signup']] },
              { title:'Company', links:[['About','/about'],['Pricing','/pricing'],['Blog','/blog'],['Contact','/contact']] },
              { title:'Legal', links:[['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Responsible Gaming','/responsible-gaming'],['US Regulations','/dashboard/regulatory']] },
            ].map(col=>(
              <div key={col.title}>
                <div style={{ fontSize:12, fontWeight:700, color:'#e6edf3', marginBottom:14, textTransform:'uppercase', letterSpacing:'1px' }}>{col.title}</div>
                {col.links.map(([label,href])=><Link key={label} href={href} style={{ display:'block', fontSize:13, color:'#6b7280', textDecoration:'none', marginBottom:8 }}>{label}</Link>)}
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:24, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ fontSize:12, color:'#4b5563' }}>© 2026 TrueOdds. All rights reserved.</div>
            <div style={{ fontSize:12, color:'#374151' }}>Must be 21+. Problem gambling? Call <strong>1-800-522-4700</strong> (NCPG) or text HOME to 741741.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
