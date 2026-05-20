'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'

import { SPORTS, BOOK_COLOR, BOOK_ABBR } from '@/lib/constants'
import type { OddsGame } from '@/lib/constants'

const DISPLAY_BOOKS = ['draftkings','fanduel','betmgm','caesars','pointsbet','bet365','pinnacle']
const BOOK_DISPLAY: Record<string, string> = {
  draftkings:'DraftKings', fanduel:'FanDuel', betmgm:'BetMGM',
  caesars:'Caesars', pointsbet:'PointsBet', bet365:'Bet365', pinnacle:'Pinnacle',
}

function BookHeader({ book }: { book: string }) {
  const name = BOOK_DISPLAY[book] || book
  const bg   = BOOK_COLOR[name] || '#333'
  const abbr = BOOK_ABBR[name] || name.slice(0, 2).toUpperCase()
  return (
    <th style={{ padding:'8px 8px', textAlign:'center', minWidth:72 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
        <div style={{ width:26, height:26, borderRadius:5, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, color:'#fff' }}>{abbr}</div>
        <span style={{ fontSize:9, color:'var(--dim)' }}>{name.slice(0,7)}</span>
      </div>
    </th>
  )
}

function OddsCell({ odds, best }: { odds: string; best: string }) {
  if (!odds || odds === '—') return <td style={{ padding:'10px 8px', textAlign:'center', color:'var(--border2)', fontSize:12 }}>—</td>
  const isPos  = odds.startsWith('+')
  const isBest = odds === best && odds !== '—'
  return (
    <td style={{ padding:'10px 8px', textAlign:'center' }}>
      <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:isBest?900:600, color:isBest?'#000':(isPos?'var(--green)':'var(--red)'), background:isBest?'var(--green)':'transparent' }}>
        {odds}
      </span>
    </td>
  )
}

export default function OddsPage() {
  const [games, setGames]     = useState<OddsGame[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource]   = useState<'api'|'cache'|'mock'>('mock')
  const [sport, setSport]     = useState('All')
  const [search, setSearch]   = useState('')
  const [selectedMarkets, setSelectedMarkets] = useState<Record<string, string>>({})
  const [lastFetch, setLastFetch] = useState<Date|null>(null)
  const [quota, setQuota]     = useState<any>(null)

  const fetchOdds = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (sport !== 'All') params.set('sport', sport)

      const res = await api.get(`/odds?${params}`)
      // Transform API response to OddsGame format for display
      const raw = res.data.data
      if (raw?.length) {
        setGames(raw)
        setSource(res.data.source || 'mock')
        setQuota(res.data.quota)
      } else {
        setGames([])
        setSource('mock')
      }
      setLastFetch(new Date())
    } catch {
      setGames([])
      setSource('mock')
    } finally {
      setLoading(false)
    }
  }, [sport])

  useEffect(() => { fetchOdds() }, [fetchOdds])

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const t = setInterval(fetchOdds, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchOdds])

  const filtered = games.filter(g =>
    (sport === 'All' || g.sport === sport) &&
    g.game?.toLowerCase().includes(search.toLowerCase())
  )

  const getActiveMarket = (game: OddsGame) =>
    selectedMarkets[game.id?.toString()] || game.markets?.[0]?.name || ''

  const setActiveMarket = (gameId: string, market: string) =>
    setSelectedMarkets(prev => ({ ...prev, [gameId]: market }))

  const sourceLabel = source === 'api' ? '🟢 Live · TheOddsAPI' : source === 'cache' ? '🔵 Cached (< 1 min)' : '⚪ Mock data'

  return (
    <div style={{ padding:'20px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>📊 Live Odds Comparison</h1>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
              {loading ? 'Loading...' : `${filtered.length} markets · ${sourceLabel}`}
            </p>
            {lastFetch && <span style={{ fontSize:11, color:'var(--dim)' }}>Updated {lastFetch.toLocaleTimeString()}</span>}
            
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, background:'var(--green)', borderRadius:'50%', animation:'blink 2s ease-in-out infinite' }} />
            <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>Live</span>
          </div>
          <button onClick={fetchOdds} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)', alignItems:'center' }}>
        {SPORTS.map(sp => (
          <button key={sp} onClick={() => setSport(sp)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none', background:sport===sp?'var(--purple)':'var(--bg3)', color:sport===sp?'#fff':'var(--muted)', fontWeight:sport===sp?700:400, fontFamily:'inherit' }}>
            {sp}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..."
          style={{ marginLeft:'auto', width:180, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'5px 10px', fontSize:12, outline:'none', fontFamily:'inherit' }} />
      </div>

      {/* Legend */}
      <div style={{ fontSize:11, color:'var(--dim)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ background:'var(--green)', color:'#000', padding:'1px 8px', borderRadius:4, fontSize:11, fontWeight:700 }}>+xxx</span>
        <span>= Best available odds across all books</span>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--purple)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Games */}
      {!loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {filtered.map(game => {
            const activeMarketName = getActiveMarket(game)
            const marketData = game.markets?.find(m => m.name === activeMarketName) || game.markets?.[0]
            const gameId     = game.id?.toString()

            return (
              <div key={gameId} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                {/* Game header */}
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, marginBottom:2, color:'var(--text)' }}>{game.game}</div>
                    <div style={{ fontSize:12, color:'var(--muted)' }}>{game.time} · {game.league || game.sport}</div>
                  </div>
                  {/* Market tabs */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {(game.markets || []).map(market => (
                      <button key={market.name} onClick={() => setActiveMarket(gameId!, market.name)}
                        style={{ padding:'5px 12px', borderRadius:20, fontSize:11, cursor:'pointer', border:`1px solid ${activeMarketName===market.name?'var(--purple)':'var(--border)'}`, background:activeMarketName===market.name?'rgba(137,87,229,0.12)':'transparent', color:activeMarketName===market.name?'var(--purple)':'var(--muted)', fontWeight:activeMarketName===market.name?700:400, fontFamily:'inherit', transition:'all .15s' }}>
                        {market.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Odds table */}
                {marketData && (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
                          <th style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:'var(--dim)', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.5px', minWidth:140 }}>Selection</th>
                          <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10, color:'var(--dim)', fontWeight:700, minWidth:72 }}>Best</th>
                          <th style={{ padding:'8px 8px', textAlign:'center', fontSize:10, color:'var(--dim)', fontWeight:700, minWidth:72 }}>Avg</th>
                          {DISPLAY_BOOKS.map(b => <BookHeader key={b} book={b} />)}
                        </tr>
                      </thead>
                      <tbody>
                        {(marketData.rows || []).map((row, ri) => (
                          <tr key={ri} style={{ borderBottom:'1px solid var(--border)', transition:'background 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding:'12px 14px', fontWeight:600, fontSize:13, color:'var(--text)' }}>{row.selection}</td>
                            <td style={{ padding:'12px 8px', textAlign:'center' }}>
                              <div style={{ fontWeight:900, fontSize:15, color:'var(--green)' }}>{row.bestOdds}</div>
                              <div style={{ fontSize:9, color:'var(--dim)' }}>{row.bestBook?.slice(0,6)}</div>
                            </td>
                            <td style={{ padding:'12px 8px', textAlign:'center', color:'var(--muted)', fontSize:12 }}>{row.avgOdds}</td>
                            {DISPLAY_BOOKS.map(b => (
                              <OddsCell key={b} odds={row.books?.[b] || '—'} best={row.bestOdds} />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:60, color:'var(--dim)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
              No games found.
              
            </div>
          )}
        </div>
      )}
    </div>
  )
}
