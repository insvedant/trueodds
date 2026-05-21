'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'

import { SPORTS, BOOK_COLOR, BOOK_ABBR } from '@/lib/constants'
import type { ArbBet } from '@/lib/constants'
import Link from 'next/link'

function BookBadge({ book }: { book: string }) {
  const key = book.toLowerCase().replace(/\s/g, '')
  const bg  = BOOK_COLOR[book] || BOOK_COLOR[key] || '#333'
  const abbr= BOOK_ABBR[book] || BOOK_ABBR[key] || book.slice(0, 2).toUpperCase()
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:22, borderRadius:4, background:bg, color:'#fff', fontSize:9, fontWeight:900 }}>{abbr}</span>
  )
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background:'var(--bg3)', border:'1px solid rgba(0,200,83,0.5)', borderRadius:10, padding:'12px 18px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600, maxWidth:340, animation:'slideIn 0.3s ease' }}>
      <span style={{ color:'var(--green)', fontSize:18 }}>✓</span>
      {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:18 }}>×</button>
    </div>
  )
}

export default function ArbitragePage() {
  const [arbs, setArbs]       = useState<ArbBet[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource]   = useState<'api'|'cache'|'mock'>('mock')
  const [sport, setSport]     = useState('All')
  const [minProfit, setMinProfit] = useState(0)
  const [bookFilter, setBookFilter] = useState('')
  const [alertsOn, setAlertsOn]     = useState(true)
  const [stake, setStake]     = useState(1000)
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [toast, setToast]     = useState('')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [quota, setQuota]     = useState<any>(null)

  const fetchArbs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (minProfit > 0) params.set('minProfit', String(minProfit))
      if (sport !== 'All') params.set('sport', sport)

      const res = await api.get(`/arbitrage?${params}`)
      const data = res.data.data || []
      setArbs(data)
      setSource(res.data.source || 'mock')
      setQuota(res.data.quota)
      setLastFetch(new Date())
    } catch {
      // Backend not running — fall back to mock data
      setArbs([])
      setSource('mock')
    } finally {
      setLoading(false)
    }
  }, [minProfit, sport])

  useEffect(() => { fetchArbs() }, [fetchArbs])

  // Auto-refresh every 5 minutes to conserve API quota
  useEffect(() => {
    const t = setInterval(fetchArbs, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchArbs])

  const filtered = arbs.filter(r =>
    (sport === 'All' || r.sport === sport) &&
    r.profit >= minProfit &&
    (!bookFilter || r.b1 === bookFilter || r.b2 === bookFilter)
  )
  const hot = filtered.filter(r => r.hot)

  const addToTracker = (arb: ArbBet) => {
    const key = arb.id?.toString() || arb.game
    setTracked(prev => new Set([...prev, key]))
    try {
      const existing = JSON.parse(localStorage.getItem('to_tracked_arbs') || '[]')
      localStorage.setItem('to_tracked_arbs', JSON.stringify([{
        id: `arb-${key}-${Date.now()}`, game: arb.game, sport: arb.sport,
        market: arb.market, book: arb.b1, odds: arb.o1,
        stake: Math.round((arb.stake1 / 1000) * stake),
        result: 'pending', profit: 0, betType: 'arbitrage',
        date: new Date().toISOString().split('T')[0],
      }, ...existing]))
    } catch {}
    setToast(`Added to Tracker: ${arb.game}`)
  }

  const sourceLabel = source === 'api' ? '🟢 Live · TheOddsAPI' : source === 'cache' ? '🔵 Cached (< 1 min)' : '⚪ Mock data'

  return (
    <div style={{ padding:'20px 24px' }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>⚡ Arbitrage Finder</h1>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
              {loading ? 'Loading...' : `${filtered.length} opportunities · ${sourceLabel}`}
            </p>
            {lastFetch && <span style={{ fontSize:11, color:'var(--dim)' }}>Updated {lastFetch.toLocaleTimeString()}</span>}
            
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <label style={{ fontSize:12, color:'var(--muted)' }}>Stake $</label>
            <input type="number" value={stake} onChange={e => setStake(+e.target.value)}
              style={{ width:80, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'5px 8px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }} onClick={() => setAlertsOn(!alertsOn)}>
            <div style={{ width:32, height:18, borderRadius:9, background:alertsOn?'var(--green)':'var(--border)', position:'relative', transition:'background .2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left:alertsOn?14:2, width:14, height:14, background:'#fff', borderRadius:'50%', transition:'left .2s' }} />
            </div>
            <span style={{ fontSize:12, color:alertsOn?'var(--green)':'var(--dim)' }}>Alerts {alertsOn?'on':'off'}</span>
          </div>
          <button onClick={fetchArbs} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Live Arbs',   val:filtered.length,                                                                     color:'var(--green)' },
          { label:'🔥 Hot Now',  val:hot.length,                                                                           color:'var(--amber)' },
          { label:'Best Profit', val:`+${filtered.length ? Math.max(...filtered.map(r=>r.profit),0).toFixed(1) : '0.0'}%`, color:'var(--green)' },
          { label:`On $${stake.toLocaleString()}`, val:`+$${((filtered.length ? Math.max(...filtered.map(r=>r.profit),0) : 0)/100*stake).toFixed(0)}`, color:'var(--green)' },
        ].map(st => (
          <div key={st.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:900, color:st.color }}>{st.val}</div>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {alertsOn && hot.length > 0 && (
        <div style={{ background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.35)', borderRadius:10, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:8, height:8, background:'var(--green)', borderRadius:'50%', flexShrink:0, display:'inline-block', animation:'blink 1s ease-in-out infinite' }} />
          <div style={{ flex:1, fontSize:13 }}>
            🔔 <strong style={{ color:'var(--green)' }}>Hot arb: {hot[0].game}</strong> — <strong style={{ color:'var(--green)' }}>+{hot[0].profit}%</strong> on {hot[0].b1} / {hot[0].b2}
          </div>
          <button onClick={() => addToTracker(hot[0])} style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:6, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>+ Track</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)', alignItems:'center' }}>
        {SPORTS.map(sp => (
          <button key={sp} onClick={() => setSport(sp)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none', background:sport===sp?'var(--green)':'var(--bg3)', color:sport===sp?'#000':'var(--muted)', fontWeight:sport===sp?700:400, fontFamily:'inherit' }}>
            {sp}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label style={{ fontSize:12, color:'var(--muted)' }}>Min %</label>
          <input type="number" value={minProfit} step="0.1" min="0" max="10" onChange={e => setMinProfit(+e.target.value)}
            style={{ width:60, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'4px 8px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
          <select value={bookFilter} onChange={e => setBookFilter(e.target.value)}
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'4px 8px', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>
            <option value="">All books</option>
            {['DraftKings','FanDuel','BetMGM','Caesars','Pinnacle','Bet365'].map(b=><option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Cards */}
      {!loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map(arb => {
            const key      = arb.id?.toString() || arb.game
            const isTracked= tracked.has(key)
            const payout   = ((stake * arb.profit) / 100).toFixed(0)
            return (
              <div key={key} style={{ background:'var(--bg3)', border:`1px solid ${arb.hot?'rgba(0,200,83,0.35)':'var(--border)'}`, borderRadius:12, padding:'18px 20px', transition:'border-color 0.2s' }}>
                <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
                  <div>
                    <div style={{ display:'flex', gap:8, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
                      {arb.hot && <span style={{ background:'rgba(240,165,0,0.12)', color:'var(--amber)', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>🔥 HOT</span>}
                      <span style={{ background:'rgba(88,166,255,0.1)', color:'var(--blue)', fontSize:11, padding:'2px 8px', borderRadius:10 }}>{arb.sport}</span>
                      <span style={{ color:'var(--dim)', fontSize:11 }}>{arb.time || (arb.ageMin === 0 ? 'just now' : `${arb.ageMin}m ago`)}</span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:2 }}>{arb.game}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{arb.market}</div>
                  </div>
                  <div style={{ display:'flex', gap:24, textAlign:'right' }}>
                    <div>
                      <div style={{ fontSize:28, fontWeight:900, color:'var(--green)', lineHeight:1, letterSpacing:'-1px' }}>+{arb.profit}%</div>
                      <div style={{ fontSize:11, color:'var(--dim)' }}>Guaranteed profit</div>
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:'var(--text)' }}>+${payout}</div>
                      <div style={{ fontSize:11, color:'var(--dim)' }}>On ${stake.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Legs */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {[{book:arb.b1, odds:arb.o1, stake:arb.stake1},{book:arb.b2, odds:arb.o2, stake:arb.stake2}].map((leg,i)=>(
                    <div key={i} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <BookBadge book={leg.book} />
                        <div>
                          <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{leg.book}</div>
                          <div style={{ fontSize:11, color:'var(--dim)' }}>Bet ${Math.round((leg.stake/1000)*stake)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:20, fontWeight:900, color:leg.odds?.toString().startsWith('+')?'var(--green)':'var(--red)' }}>{leg.odds}</div>
                        <div style={{ fontSize:10, color:'var(--blue)', cursor:'pointer' }}>→ BET ↗</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💰 Place Bets</button>
                  <button onClick={() => addToTracker(arb)} disabled={isTracked}
                    style={{ background:isTracked?'rgba(0,200,83,0.1)':'transparent', border:`1px solid ${isTracked?'rgba(0,200,83,0.4)':'var(--border)'}`, color:isTracked?'var(--green)':'var(--text)', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:isTracked?'default':'pointer', fontFamily:'inherit', fontWeight:isTracked?700:400, transition:'all .2s' }}>
                    {isTracked ? '✓ Added to Tracker' : '+ Add to Tracker'}
                  </button>
                </div>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:60, color:'var(--dim)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
              No arbitrage bets found.{minProfit > 0 ? ` Try lowering the minimum profit below ${minProfit}%.` : ''}
              
            </div>
          )}
        </div>
      )}
    </div>
  )
}
