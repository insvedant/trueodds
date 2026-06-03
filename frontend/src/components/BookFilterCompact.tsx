'use client'
import { useState, useRef, useEffect } from 'react'
import { useGeo } from '@/lib/geoContext'

const BOOK_COLORS: Record<string, string> = {
  fanduel:'#1493ff', draftkings:'#53d337', betmgm:'#c9a84c', caesars:'#0047ab',
  betrivers:'#e30613', espnbet:'#cc0000', hardrockbet:'#b8860b', pointsbet:'#ff6600',
  fanatics:'#d4001f', unibet:'#147b45', barstool:'#f5c518', pinnacle:'#ffcc00',
  bet365:'#028a0f', williamhill:'#7b1fa2', bovada:'#e53935', betonlineag:'#c62828',
  mybookieag:'#1565c0', lowvig:'#2e7d32', betway:'#00897b', casumo:'#d81b60',
  sports_interaction:'#1a73e8', tooniebet:'#e6b800', tonybet:'#e63946', playnow:'#005baa',
  betfair:'#ffb300', thescore:'#e53935', fliff:'#7c4dff', leovegas:'#f4a40a',
  tabtouch:'#1565c0', grosvenor:'#1b5e20', paddypower:'#007a00', sportsbet:'#0077b6',
  unibet_ca:'#147b45', unibet_uk:'#147b45', unibet_se:'#147b45', onexbet:'#0d47a1',
}
const BOOK_LABELS: Record<string, string> = {
  fanduel:'FanDuel', draftkings:'DraftKings', betmgm:'BetMGM', caesars:'Caesars',
  betrivers:'BetRivers', espnbet:'ESPN Bet', hardrockbet:'Hard Rock', pointsbet:'PointsBet',
  fanatics:'Fanatics', unibet:'Unibet', barstool:'Barstool', pinnacle:'Pinnacle',
  bet365:'Bet365', williamhill:'William Hill', bovada:'Bovada', betonlineag:'BetOnline',
  mybookieag:'MyBookie', lowvig:'LowVig', betway:'Betway', casumo:'Casumo',
  sports_interaction:'Sports Interaction', tooniebet:'ToonieBet', tonybet:'TonyBet',
  playnow:'PlayNow', betfair:'Betfair', thescore:'theScore', fliff:'Fliff',
  leovegas:'LeoVegas', tabtouch:'Tabtouch', grosvenor:'Grosvenor', paddypower:'Paddy Power',
  sportsbet:'Sportsbet', unibet_ca:'Unibet CA', unibet_uk:'Unibet UK', unibet_se:'Unibet SE',
  onexbet:'1xBet',
}
function fmt(k: string) { return BOOK_LABELS[k] || k.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) }
function col(k: string) { return BOOK_COLORS[k] || '#6b7280' }

export { fmt as getBookLabel, col as getBookColor }

export default function BookFilterCompact() {
  const { market, state, selectedBooks, setSelectedBooks, liveBooks, regionalBooks, allBooks, bookFreq } = useGeo()
  const books   = liveBooks.length > 0 ? liveBooks : (regionalBooks.length > 0 ? regionalBooks : allBooks)
  const isAll   = selectedBooks.length === 0
  const flag    = market === 'CA' ? '🇨🇦' : '🇺🇸'
  const region  = market === 'CA' ? (state === 'ON' ? 'Ontario, CA' : 'Canada') : `${state}, USA`

  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const dropRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (b: string) =>
    setSelectedBooks(selectedBooks.includes(b) ? selectedBooks.filter(x=>x!==b) : [...selectedBooks, b])

  const filtered = books.filter(b => fmt(b).toLowerCase().includes(search.toLowerCase()))
  const label    = isAll ? 'All Books' : selectedBooks.length === 1 ? fmt(selectedBooks[0]) : `${selectedBooks.length} books selected`

  return (
    <div style={{ marginBottom:14, position:'relative' as const }} ref={dropRef}>
      <style>{`
        .bfc-item { transition:background 0.12s; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .bfc-item:hover { background:var(--hover-bg)!important; }
        .bfc-drop { animation: bfcFadeIn 0.15s ease; }
        @keyframes bfcFadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const }}>
        {/* Region badge */}
        <span style={{ fontSize:11, color:'var(--dim)' }}>{flag} {region}</span>
        <span style={{ fontSize:10, color:'var(--dim)', opacity:0.6 }}>—</span>

        {/* Trigger button */}
        <button onClick={() => setOpen(!open)}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:24, border:`1.5px solid ${isAll ? 'var(--border)' : '#00C853'}`, background:isAll ? 'var(--bg3)' : 'rgba(0,200,83,0.08)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, color:isAll?'var(--muted)':'#00C853', transition:'all 0.15s' }}>
          {/* Dots of selected books */}
          {!isAll && selectedBooks.slice(0,4).map(b => (
            <span key={b} style={{ width:8, height:8, borderRadius:'50%', background:col(b), flexShrink:0 }} />
          ))}
          {!isAll && selectedBooks.length > 4 && <span style={{ fontSize:10, opacity:0.7 }}>+{selectedBooks.length-4}</span>}
          <span>📚 {label}</span>
          <span style={{ fontSize:10, opacity:0.6 }}>{open ? '▲' : '▼'}</span>
        </button>

        {/* Clear button */}
        {!isAll && (
          <button onClick={() => setSelectedBooks([])}
            style={{ fontSize:11, color:'var(--dim)', background:'none', border:'1px solid var(--border)', borderRadius:20, cursor:'pointer', padding:'3px 10px', fontFamily:'inherit' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="bfc-drop" style={{ position:'absolute' as const, top:'calc(100% + 6px)', left:0, zIndex:500, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:12, width:'clamp(280px,90vw,420px)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
          {/* Search */}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search sportsbooks..."
            style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--text)', fontFamily:'inherit', outline:'none', marginBottom:10, boxSizing:'border-box' as const }} />

          {/* Select all / clear */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={() => setSelectedBooks(books)} style={{ flex:1, fontSize:11, fontWeight:600, padding:'5px', border:'1px solid var(--border)', borderRadius:7, background:'var(--bg3)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>Select All</button>
            <button onClick={() => setSelectedBooks([])}   style={{ flex:1, fontSize:11, fontWeight:600, padding:'5px', border:'1px solid var(--border)', borderRadius:7, background:'var(--bg3)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>Clear All</button>
          </div>

          {/* Book list */}
          <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column' as const, gap:2 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:20, color:'var(--dim)', fontSize:12 }}>No books found</div>
            )}
            {filtered.map(b => {
              const active = selectedBooks.includes(b)
              const color  = col(b)
              const count  = bookFreq[b] || 0
              return (
                <div key={b} className="bfc-item" onClick={() => toggle(b)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: active ? `${color}12` : 'transparent', border: active ? `1px solid ${color}33` : '1px solid transparent' }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:12, fontWeight:active?700:400, color:active?color:'var(--text)' }}>{fmt(b)}</span>
                  {count > 0 && <span style={{ fontSize:10, color:'var(--dim)', background:'var(--bg3)', padding:'1px 7px', borderRadius:20 }}>{count}</span>}
                  {active && <span style={{ fontSize:11, color:color, fontWeight:900 }}>✓</span>}
                </div>
              )
            })}
          </div>

          {/* Done */}
          <button onClick={() => setOpen(false)}
            style={{ width:'100%', marginTop:10, padding:'9px', background:'#00C853', border:'none', borderRadius:8, color:'#000', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            Done {!isAll && `(${selectedBooks.length} selected)`}
          </button>
        </div>
      )}
    </div>
  )
}
