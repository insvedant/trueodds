'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'
import { useAuth } from '@/lib/auth'

import { SPORTS, BOOK_COLOR, BOOK_ABBR } from '@/lib/constants'
import type { EVBet } from '@/lib/constants'
import Link from 'next/link'

function BookBadge({ book }: { book: string }) {
  const key  = book.toLowerCase().replace(/\s/g, '')
  const bg   = BOOK_COLOR[book] || BOOK_COLOR[key] || '#333'
  const abbr = BOOK_ABBR[book] || BOOK_ABBR[key] || book.slice(0, 2).toUpperCase()
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:22, borderRadius:4, background:bg, color:'#fff', fontSize:9, fontWeight:900 }}>{abbr}</span>
  )
}

export default function PositiveEVPage() {
  const { user } = useAuth()
  const [bets, setBets]       = useState<EVBet[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource]   = useState<'api'|'cache'|'mock'>('mock')
  const [sport, setSport]     = useState('All')
  const [minEV, setMinEV]     = useState(0)
  const [showInfo, setShowInfo] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date|null>(null)
  const [quota, setQuota]     = useState<any>(null)

  const fetchEV = useCallback(async () => {
    if (user?.plan === 'free') { setLoading(false); return }
    try {
      const params = new URLSearchParams()
      if (minEV > 0) params.set('minEV', String(minEV))
      if (sport !== 'All') params.set('sport', sport)

      const res = await api.get(`/ev?${params}`)
      const data = res.data.data || []
      setBets(data)
      setSource(res.data.source || 'mock')
      setQuota(res.data.quota)
      setLastFetch(new Date())
    } catch {
      setBets([])
      setSource('mock')
    } finally {
      setLoading(false)
    }
  }, [minEV, sport, user?.plan])

  useEffect(() => { fetchEV() }, [fetchEV])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(fetchEV, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchEV])

  // Free plan gate
  if (user?.plan === 'free') {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:48, textAlign:'center', maxWidth:480 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ fontSize:20, fontWeight:800, marginBottom:10 }}>Gold or Platinum required</h2>
          <p style={{ color:'var(--muted)', marginBottom:24, fontSize:14 }}>Upgrade to access +EV betting tools and find mathematically profitable bets.</p>
          <Link href="/pricing" style={{ background:'var(--green)', color:'#fff', textDecoration:'none', fontWeight:800, fontSize:14, padding:'11px 28px', borderRadius:9, display:'inline-block' }}>Upgrade Now →</Link>
        </div>
      </div>
    )
  }

  const filtered = bets.filter(b =>
    (sport === 'All' || b.sport === sport) && b.ev >= minEV
  )

  const sourceLabel = source === 'api' ? '🟢 Live · TheOddsAPI' : source === 'cache' ? '🔵 Cached (< 1 min)' : '⚪ Mock data'

  return (
    <div style={{ padding:'20px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>📈 Positive EV Bets</h1>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
              {loading ? 'Loading...' : `${filtered.length} opportunities · ${sourceLabel}`}
            </p>
            {lastFetch && <span style={{ fontSize:11, color:'var(--dim)' }}>Updated {lastFetch.toLocaleTimeString()}</span>}
            
          </div>
        </div>
        <button onClick={fetchEV} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'+EV Bets',   val:filtered.length,                                                                    color:'var(--blue)' },
          { label:'Best EV',    val:filtered.length?`+${Math.max(...filtered.map(b=>b.ev),0).toFixed(1)}%`:'—',        color:'var(--green)' },
          { label:'Avg EV',     val:filtered.length?`${(filtered.reduce((s,b)=>s+b.ev,0)/filtered.length).toFixed(1)}%`:'—', color:'var(--green)' },
          { label:'Avg Bet Size',val:filtered.length?`$${Math.round(filtered.reduce((s,b)=>s+(b.size||10),0)/filtered.length)}`:'—', color:'var(--amber)' },
        ].map(st=>(
          <div key={st.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:900, color:st.color }}>{st.val}</div>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      {showInfo && (
        <div style={{ background:'rgba(88,166,255,0.07)', border:'1px solid rgba(88,166,255,0.2)', borderRadius:9, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14 }}>ℹ️</span>
          <span style={{ fontSize:12, color:'var(--muted)', flex:1 }}>We've filtered bets to Main Markets. To avoid sportsbook limits, hit at least 20 of these before exploring Player Props.</span>
          <button onClick={() => setShowInfo(false)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:16 }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)', alignItems:'center' }}>
        {SPORTS.map(sp => (
          <button key={sp} onClick={() => setSport(sp)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none', background:sport===sp?'var(--blue)':'var(--bg3)', color:sport===sp?'#fff':'var(--muted)', fontWeight:sport===sp?700:400, fontFamily:'inherit' }}>
            {sp}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <label style={{ fontSize:12, color:'var(--muted)' }}>Min EV</label>
          <input type="range" min={0} max={20} step={0.5} value={minEV} style={{ width:100, accentColor:'var(--blue)' }} onChange={e => setMinEV(+e.target.value)} />
          <span style={{ fontSize:12, color:'var(--blue)', fontWeight:700, minWidth:36 }}>{minEV}%</span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 70px 80px 80px 60px 60px 80px', padding:'9px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--dim)', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' as const, gap:8 }}>
            <span>Event</span><span>EV%</span><span>Book Odds</span><span>Fair Odds</span><span>Book</span><span>Prob</span><span>Action</span>
          </div>
          {filtered.map(b => (
            <div key={b.id} style={{ display:'grid', gridTemplateColumns:'2fr 70px 80px 80px 60px 60px 80px', padding:'12px 16px', borderBottom:'1px solid var(--border)', alignItems:'center', gap:8, transition:'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:2 }}>{b.game}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{b.sport} · {b.market} · {b.time}</div>
              </div>
              <span style={{ fontSize:15, fontWeight:900, color:b.ev>=10?'var(--green)':b.ev>=5?'var(--blue)':'var(--text)' }}>+{b.ev}%</span>
              <span style={{ fontWeight:700, color:'var(--green)' }}>{b.bookOdds}</span>
              <span style={{ color:'var(--muted)' }}>{b.fairOdds}</span>
              <span><BookBadge book={b.book} /></span>
              <span style={{ color:'var(--muted)', fontSize:12 }}>{b.prob}</span>
              <span>
                <button style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:5, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Bet ${b.size}
                </button>
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:48, color:'var(--dim)', fontSize:14 }}>
              No +EV bets above {minEV}% threshold.
              
            </div>
          )}
        </div>
      )}
    </div>
  )
}
