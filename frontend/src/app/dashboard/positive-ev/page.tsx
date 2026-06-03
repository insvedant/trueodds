'use client'
import { useState, useEffect, useCallback } from 'react'
import { api, useAuth } from '@/lib/auth'
import { LEAGUE_SEASONS } from '@/lib/seasonDates'
import { SPORTS, BOOK_COLOR, BOOK_ABBR, getBookUrl, trackAndOpen } from '@/lib/constants'
import type { EVBet } from '@/lib/constants'
import Link from 'next/link'
import UpgradeWall from '@/components/UpgradeWall'
import LoadingMessage from '@/components/LoadingMessage'
import BookFilter from '@/components/BookFilter'
import BookFilterCompact from '@/components/BookFilterCompact'
import { useGeo } from '@/lib/geoContext'
import EmptyState from '@/components/EmptyState'

const PAGE_SIZE = 10

function BookBadge({ book }: { book: string }) {
  const key  = book.toLowerCase().replace(/\s/g, '')
  const bg   = BOOK_COLOR[book] || BOOK_COLOR[key] || '#333'
  const abbr = BOOK_ABBR[book] || BOOK_ABBR[key] || book.slice(0, 2).toUpperCase()
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:30, height:22, borderRadius:5, background:bg, color:'#fff', fontSize:9, fontWeight:900, flexShrink:0 }}>{abbr}</span>
  )
}

function EVBadge({ ev }: { ev: number }) {
  const color = ev >= 10 ? '#00C853' : ev >= 5 ? '#3b82f6' : '#f0a500'
  const bg    = ev >= 10 ? 'rgba(0,200,83,0.12)' : ev >= 5 ? 'rgba(59,130,246,0.12)' : 'rgba(240,165,0,0.12)'
  return (
    <span style={{ background:bg, color, fontSize:12, fontWeight:900, padding:'3px 9px', borderRadius:20, whiteSpace:'nowrap' as const }}>+{ev}%</span>
  )
}

function Pagination({ page, totalPages, total, pageSize, onChange }: {
  page:number; totalPages:number; total:number; pageSize:number; onChange:(p:number)=>void
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }


  // Sort sports: active first, off-season last
  const sortedSports = ['All', ...['NFL','CFL','NBA','MLB','NHL','UFC','Soccer','Tennis'].sort((a,b) => {
    const sa = LEAGUE_SEASONS[a]?.status || 'active'
    const sb = LEAGUE_SEASONS[b]?.status || 'active'
    const order = { active:0, playoffs:0, preseason:1, off_season:2 }
    return (order[sa as keyof typeof order]||0) - (order[sb as keyof typeof order]||0)
  })]

  return (
    <div style={{ marginTop:20 }}>
      <style>{`
        .pg-btn { transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1); -webkit-tap-highlight-color:transparent; }
        .pg-btn:hover:not(:disabled) { transform:scale(1.1); }
        .pg-btn:active:not(:disabled) { transform:scale(0.9); }
        @media (max-width:480px) {
          .pg-jump { display:none!important; }
          .pg-info { font-size:11px!important; }
        }
      `}</style>

      {}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:10, marginBottom:12 }}>
        <span className="pg-info" style={{ fontSize:12, color:'var(--dim)' }}>
          Showing <strong style={{ color:'var(--text)' }}>{from}–{to}</strong> of <strong style={{ color:'var(--text)' }}>{total}</strong>
        </span>

        {}
        <div className="pg-jump" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--dim)' }}>
          Page
          <input type="number" min={1} max={totalPages} value={page}
            onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onChange(v) }}
            style={{ width:44, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:7, padding:'4px 6px', fontSize:12, color:'var(--text)', fontFamily:'inherit', textAlign:'center' as const, outline:'none' }} />
          of {totalPages}
        </div>
      </div>

      {}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, flexWrap:'wrap' as const }}>
        {}
        <button className="pg-btn" onClick={() => onChange(page - 1)} disabled={page === 1}
          style={{ width:34, height:34, borderRadius:9, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--muted)', fontSize:14, cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.35:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>
          ‹
        </button>

        {pages.map((p, i) => p === '…' ? (
          <span key={`e${i}`} style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'var(--dim)' }}>…</span>
        ) : (
          <button key={p} className="pg-btn" onClick={() => onChange(p as number)}
            style={{ minWidth:34, height:34, borderRadius:9, paddingInline:6, border:'none', background:page===p?'#3b82f6':'var(--bg3)', color:page===p?'#fff':'var(--muted)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:page===p?800:400, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:page===p?'0 3px 10px rgba(59,130,246,0.35)':'none', transform:page===p?'scale(1.08)':'scale(1)', transition:'all 0.15s' }}>
            {p}
          </button>
        ))}

        {}
        <button className="pg-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages}
          style={{ width:34, height:34, borderRadius:9, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--muted)', fontSize:14, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.35:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>
          ›
        </button>
      </div>
    </div>
  )
}

function EVCard({ b, i }: { b: EVBet; i: number }) {

  // Sort sports: active first, off-season last
  const sortedSports = ['All', ...['NFL','CFL','NBA','MLB','NHL','UFC','Soccer','Tennis'].sort((a,b) => {
    const sa = LEAGUE_SEASONS[a]?.status || 'active'
    const sb = LEAGUE_SEASONS[b]?.status || 'active'
    const order = { active:0, playoffs:0, preseason:1, off_season:2 }
    return (order[sa as keyof typeof order]||0) - (order[sb as keyof typeof order]||0)
  })]

  return (
    <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', animation:`fadeRow 0.3s ease ${i*40}ms both` }}>
      {}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', lineHeight:1.3, marginBottom:4 }}>{b.game}</div>
          <div style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:5, flexWrap:'wrap' as const }}>
            <span style={{ background:'var(--bg4)', padding:'2px 7px', borderRadius:20 }}>{b.sport}</span>
            <span style={{ background:'var(--bg4)', padding:'2px 7px', borderRadius:20 }}>{b.market}</span>
            <span>{b.time}</span>
          </div>
        </div>
        <EVBadge ev={b.ev} />
      </div>

      {}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
        <BookBadge book={b.book} />
        <div style={{ display:'flex', gap:6, alignItems:'center', flex:1, flexWrap:'wrap' as const }}>
          <span style={{ fontWeight:800, fontSize:14, color:'var(--green)' }}>{b.bookOdds}</span>
          <span style={{ fontSize:11, color:'var(--dim)' }}>fair: {b.fairOdds}</span>
          <span style={{ fontSize:11, color:'var(--dim)' }}>{b.prob}</span>
        </div>
        <button onClick={() => trackAndOpen(b.book || '', 'ev_card')}
          style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit', flexShrink:0, WebkitTapHighlightColor:'transparent' as any }}>
          Bet ${b.size} ↗
        </button>
      </div>
    </div>
  )
}

export default function PositiveEVPage() {
  const { user } = useAuth()
  const { market, state, regionalBooks, selectedBooks, setLiveBooks, setBookFreq } = useGeo()
  const [bets, setBets]         = useState<EVBet[]>([])
  const [loading, setLoading]   = useState(true)
  const [source, setSource]     = useState<'api'|'cache'|'mock'>('mock')
  const [sport, setSport]       = useState('All')
  const [soccerLeague, setSoccerLeague] = useState('All')
  const [cflTeam, setCflTeam]           = useState('All')
  const [minEV, setMinEV]       = useState(0)
  const [showInfo, setShowInfo] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date|null>(null)
  const [page, setPage]         = useState(1)

  const SOCCER_LEAGUES = [
    { key:'All',       label:'All Leagues',        active: true },
    { key:'FIFA',      label:'🏆 FIFA World Cup',  active: true  },
    { key:'Friendly',  label:'🌍 Friendlies',      active: true  },
    { key:'MLS',       label:'🇺🇸 MLS',            active: true  },
    { key:'CPL',       label:'🇨🇦 CPL',            active: true  },
    { key:'Brazil',    label:'🇧🇷 Brasileirao',    active: true  },
    { key:'Argentina', label:'🇦🇷 Argentina',      active: true  },
    { key:'Champions', label:'⭐ Champions League', active: false },
    { key:'Europa',    label:'🟠 Europa League',   active: false },
    { key:'EPL',       label:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 EPL',          active: false },
    { key:'Bundesliga',label:'🇩🇪 Bundesliga',     active: false },
    { key:'La Liga',   label:'🇪🇸 La Liga',        active: false },
    { key:'Serie A',   label:'🇮🇹 Serie A',        active: false },
    { key:'Ligue 1',   label:'🇫🇷 Ligue 1',        active: false },
  ]

  const CFL_TEAMS = [
    { key:'All',        label:'All Teams' },
    { key:'Hamilton',   label:'🐱 Tiger-Cats' },
    { key:'Montreal',   label:'🦅 Alouettes' },
    { key:'Winnipeg',   label:'💙 Blue Bombers' },
    { key:'Calgary',    label:'🔴 Stampeders' },
    { key:'Edmonton',   label:'🟢 Elks' },
    { key:'Ottawa',     label:'⚫ Redblacks' },
    { key:'Saskatchewan',label:'🌿 Roughriders' },
    { key:'Toronto',    label:'🔵 Argonauts' },
    { key:'BC',         label:'🦁 Lions' },
  ]

  const fetchEV = useCallback(async () => {
    if (user?.plan === 'free') { setLoading(false); return }
    try {
      const params = new URLSearchParams()
      if (minEV > 0) params.set('minEV', String(minEV))
      // Soccer has many leagues — don't filter by sport on backend, get all and filter client-side
      if (sport !== 'All' && sport !== 'Soccer') params.set('sport', sport)
      const res = await api.get(`/ev?${params}`)
      setBets(res.data.data || [])
      setSource(res.data.source || 'mock')
      setLastFetch(new Date())
      setPage(1)
      // Build book freq from EV data
      const evData = res.data.data || []
      const freq: Record<string, number> = {}
      evData.forEach((b: any) => { if (b.book) freq[b.book] = (freq[b.book]||0) + 1 })
      const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
      if (sorted.length > 0) { setLiveBooks(sorted); setBookFreq(freq) }
    } catch { setBets([]); setSource('mock') }
    finally { setLoading(false) }
  }, [minEV, sport, user?.plan])

  useEffect(() => { fetchEV() }, [fetchEV])
  useEffect(() => { const t = setInterval(fetchEV, 5*60*1000); return () => clearInterval(t) }, [fetchEV])

  if (user?.plan === 'free') return (
    <UpgradeWall requiredPlan="gold" featureName="+EV Betting Tools"
      featureDesc="Find mathematically profitable bets where the sportsbook odds are in your long-term favour."
      icon="📈" currentPlan={user.plan} />
  )

  const filtered = bets.filter(b => {
    if (sport !== 'All' && b.sport !== sport) return false
    if (b.ev < minEV) return false
    if (sport === 'Soccer' && soccerLeague !== 'All') {
      const game = (b.game || '').toLowerCase()
      const mkt  = (b.market || '').toLowerCase()
      const leagueMap: Record<string, string[]> = {
        'Friendly':  ['friendly','international','nations league'],
        'FIFA':      ['fifa','world cup','copa america','concacaf'],
        'Champions': ['champions league','ucl','uefa champions'],
        'Europa':    ['europa league','uel','conference league'],
        'EPL':       ['premier league','epl','english premier'],
        'Bundesliga':['bundesliga','german'],
        'La Liga':   ['la liga','laliga','spanish'],
        'Serie A':   ['serie a','italian'],
        'Ligue 1':   ['ligue 1','ligue1','french ligue'],
        'MLS':       ['mls','major league soccer','usa soccer','us soccer'],
        'CPL':       ['canadian premier','cpl','canada soccer'],
        'Brazil':    ['brasileiro','brazil','serie a brazil','campeonato'],
        'Argentina': ['primera division','argentina','liga profesional'],
      }
      const league = (b.league || '').toLowerCase()
      const keywords = leagueMap[soccerLeague] || []
      if (!keywords.some(kw => game.includes(kw) || mkt.includes(kw) || league.includes(kw))) return false
    }
    if (sport === 'CFL' && cflTeam !== 'All') {
      if (!(b.game || '').toLowerCase().includes(cflTeam.toLowerCase())) return false
    }
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const sourceLabel = source==='api'?'🟢 Live':source==='cache'?'🔵 Cached':'⚪ Mock'


  // Sort sports: active first, off-season last
  const sortedSports = ['All', ...['NFL','CFL','NBA','MLB','NHL','UFC','Soccer','Tennis'].sort((a,b) => {
    const sa = LEAGUE_SEASONS[a]?.status || 'active'
    const sb = LEAGUE_SEASONS[b]?.status || 'active'
    const order = { active:0, playoffs:0, preseason:1, off_season:2 }
    return (order[sa as keyof typeof order]||0) - (order[sb as keyof typeof order]||0)
  })]

  return (
    <div style={{ padding:'clamp(14px,3vw,24px)' }}>
      <style>{`
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeRow { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .ev-row { transition:background 0.12s; }
        .ev-row:hover { background:var(--hover-bg)!important; }
        .sport-btn { transition:all 0.15s; -webkit-tap-highlight-color:transparent; }
        .sport-btn:hover { opacity:0.85; }

        /* Desktop table */
        .ev-desktop { display:block; }
        .ev-mobile  { display:none; }

        /* Book filter responsive */
        .ev-book-desktop { display:block; }
        .ev-book-mobile  { display:none; }

        @media (max-width:640px) {
          .ev-desktop { display:none!important; }
          .ev-mobile  { display:flex!important; }
          .ev-header-row { flex-direction:column!important; align-items:flex-start!important; }
          .ev-stats-grid { grid-template-columns:1fr 1fr!important; }
          .ev-filters-row { flex-direction:column!important; align-items:stretch!important; }
          .ev-min-ev-row { justify-content:flex-start!important; }
          .ev-book-desktop { display:none!important; }
          .ev-book-mobile  { display:block!important; }
        }
        @media (max-width:380px) {
          .ev-stats-grid { grid-template-columns:1fr 1fr!important; }
        }
      `}</style>

      {}
      <div className="ev-header-row" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, gap:10, flexWrap:'wrap' as const }}>
        <div>
          <h1 style={{ fontSize:'clamp(18px,3vw,22px)', fontWeight:900, marginBottom:4 }}>📈 Positive EV Bets</h1>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const }}>
            <span style={{ color:'var(--muted)', fontSize:13 }}>
              {loading ? 'Loading...' : `${filtered.length} opportunities · ${sourceLabel}`}
            </span>
            {lastFetch && <span style={{ fontSize:11, color:'var(--dim)' }}>Updated {lastFetch.toLocaleTimeString()}</span>}
          </div>
        </div>
        <button onClick={async () => { try { await api.post('/refresh') } catch {} fetchEV() }} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:9, padding:'8px 16px', fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0, transition:'background 0.15s' }}
          onMouseEnter={e=>(e.currentTarget.style.background='var(--hover-bg)')}
          onMouseLeave={e=>(e.currentTarget.style.background='var(--bg3)')}>
          ↻ Refresh
        </button>
      </div>

      {}
      <div className="ev-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Live +EV Bets', val:String(filtered.length), color:'#3b82f6' },
          { label:'Best EV',       val:filtered.length?`+${Math.max(...filtered.map(b=>b.ev),0).toFixed(1)}%`:'—', color:'#00C853' },
          { label:'Average EV',    val:filtered.length?`${(filtered.reduce((s,b)=>s+b.ev,0)/filtered.length).toFixed(1)}%`:'—', color:'#00C853' },
          { label:'Avg Bet Size',  val:filtered.length?`$${Math.round(filtered.reduce((s,b)=>s+(b.size||10),0)/filtered.length)}`:'—', color:'#f0a500' },
        ].map(st => (
          <div key={st.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'clamp(10px,2vw,14px)' }}>
            <div style={{ fontSize:'clamp(16px,3vw,22px)', fontWeight:900, color:st.color, letterSpacing:'-0.5px' }}>{st.val}</div>
            <div style={{ color:'var(--dim)', fontSize:'clamp(9px,1.8vw,11px)', marginTop:3, lineHeight:1.3 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {}
      {showInfo && (
        <div style={{ background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, flexShrink:0 }}>ℹ️</span>
          <span style={{ fontSize:12, color:'var(--muted)', flex:1, lineHeight:1.5 }}>Filtered to Main Markets. Hit at least 20 +EV bets before exploring Player Props.</span>
          <button onClick={() => setShowInfo(false)} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:18, flexShrink:0, lineHeight:1, padding:'0 2px' }}>×</button>
        </div>
      )}

      {}
      <div className="ev-filters-row" style={{ display:'flex', gap:10, marginBottom: sport==='Soccer' ? 8 : 16, paddingBottom:14, borderBottom: sport==='Soccer' ? 'none' : '1px solid var(--border)', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, flex:1, overflowX:'auto', scrollbarWidth:'none' as any }}>
          {sortedSports.map(sp => (
            <button key={sp} onClick={() => { setSport(sp); setSoccerLeague('All'); setCflTeam('All'); setPage(1) }} className="sport-btn"
              style={{ padding:'5px 13px', borderRadius:20, fontSize:11, cursor:'pointer', border:'none', background:sport===sp?'#3b82f6':'var(--bg3)', color:sport===sp?'#fff':'var(--muted)', fontWeight:sport===sp?700:400, fontFamily:'inherit', flexShrink:0 }}>
              {sp}
            </button>
          ))}
        </div>
        <div className="ev-min-ev-row" style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' as const }}>Min EV</span>
          <input type="range" min={0} max={20} step={0.5} value={minEV}
            style={{ width:70, accentColor:'#3b82f6' }}
            onChange={e => { setMinEV(+e.target.value); setPage(1) }} />
          <span style={{ fontSize:12, color:'#3b82f6', fontWeight:700, minWidth:28 }}>{minEV}%</span>
        </div>
      </div>

      {/* Desktop: card grid filter */}
      <div className="ev-book-desktop">
        <BookFilter />
      </div>
      {/* Mobile: compact dropdown filter */}
      <div className="ev-book-mobile">
        <BookFilterCompact />
      </div>

      {/* Soccer league filter — shown only when Soccer tab active */}
      {sport === 'Soccer' && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' as any, paddingBottom:14, marginBottom:16, borderBottom:'1px solid var(--border)', WebkitOverflowScrolling:'touch' as any }}>
          {SOCCER_LEAGUES.map(l => (
            <button key={l.key} onClick={() => { setSoccerLeague(l.key); setPage(1) }}
              style={{ padding:'4px 11px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${soccerLeague===l.key?'rgba(59,130,246,0.5)':'var(--border)'}`, background:soccerLeague===l.key?'rgba(59,130,246,0.12)':'var(--bg3)', color:soccerLeague===l.key?'#3b82f6': l.active ? 'var(--muted)' : 'var(--dim)', fontWeight:soccerLeague===l.key?700:400, fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap' as const, transition:'all 0.15s', opacity: !l.active && soccerLeague !== l.key ? 0.55 : 1, display:'flex', alignItems:'center', gap:4 }}>
              {l.key !== 'All' && <span style={{ width:5, height:5, borderRadius:'50%', background: l.active ? '#00C853' : '#6b7280', flexShrink:0, display:'inline-block' }} />}
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* CFL team filter — shown only when CFL tab active */}
      {sport === 'CFL' && (
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none' as any, paddingBottom:14, marginBottom:16, borderBottom:'1px solid var(--border)', WebkitOverflowScrolling:'touch' as any }}>
          {CFL_TEAMS.map(t => (
            <button key={t.key} onClick={() => { setCflTeam(t.key); setPage(1) }}
              style={{ padding:'4px 11px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${cflTeam===t.key?'rgba(0,200,83,0.5)':'var(--border)'}`, background:cflTeam===t.key?'rgba(0,200,83,0.1)':'var(--bg3)', color:cflTeam===t.key?'var(--green)':'var(--muted)', fontWeight:cflTeam===t.key?700:400, fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap' as const, transition:'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {}
      {loading && <LoadingMessage type="ev" sport={sport} />}

      {!loading && (
        <>
          {}
          <div className="ev-desktop" style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', marginBottom:4 }}>
            {}
            <div style={{ display:'grid', gridTemplateColumns:'minmax(180px,2fr) 72px 84px 76px 52px 58px 86px', padding:'9px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--dim)', fontWeight:700, letterSpacing:'0.6px', textTransform:'uppercase' as const, gap:8 }}>
              <span>Event</span><span>EV%</span><span>Odds</span><span>Fair</span><span>Book</span><span>Prob</span><span>Action</span>
            </div>
            {paginated.map((b, i) => (
              <div key={b.id} className="ev-row"
                style={{ display:'grid', gridTemplateColumns:'minmax(180px,2fr) 72px 84px 76px 52px 58px 86px', padding:'12px 16px', borderBottom:'1px solid var(--border)', alignItems:'center', gap:8, animation:`fadeRow 0.3s ease ${i*40}ms both` }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{b.game}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{b.sport} · {b.market} · {b.time}</div>
                </div>
                <EVBadge ev={b.ev} />
                <span style={{ fontWeight:700, color:'var(--green)', fontSize:13 }}>{b.bookOdds}</span>
                <span style={{ color:'var(--muted)', fontSize:12 }}>{b.fairOdds}</span>
                <BookBadge book={b.book} />
                <span style={{ color:'var(--muted)', fontSize:12 }}>{b.prob}</span>
                <button onClick={() => trackAndOpen(b.book || '', 'ev_card')}
                  style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'6px 10px', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}>
                  Bet ${b.size} ↗
                </button>
              </div>
            ))}
            {paginated.length === 0 && (
              <EmptyState sport={sport} soccerLeague={soccerLeague} type="ev" minValue={minEV} />
            )}
          </div>

          {/* Mobile cards */}
          <div className="ev-mobile" style={{ flexDirection:'column', gap:10, marginBottom:4, display:'none' }}>
            {paginated.map((b, i) => <EVCard key={b.id} b={b} i={i} />)}
            {paginated.length === 0 && (
              <EmptyState sport={sport} soccerLeague={soccerLeague} type="ev" minValue={minEV} />
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top:0, behavior:'smooth' }) }}
          />
        </>
      )}
    </div>
  )
}
