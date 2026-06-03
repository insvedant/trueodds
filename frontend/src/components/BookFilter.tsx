'use client'
import { useGeo } from '@/lib/geoContext'

const BOOK_META: Record<string, { label: string; color: string }> = {
  fanduel:            { label:'FanDuel',            color:'#1493ff' },
  draftkings:         { label:'DraftKings',         color:'#53d337' },
  betmgm:             { label:'BetMGM',             color:'#c9a84c' },
  caesars:            { label:'Caesars',            color:'#0047ab' },
  betrivers:          { label:'BetRivers',          color:'#e30613' },
  espnbet:            { label:'ESPN Bet',           color:'#cc0000' },
  hardrockbet:        { label:'Hard Rock Bet',      color:'#b8860b' },
  pointsbet:          { label:'PointsBet',          color:'#ff6600' },
  fanatics:           { label:'Fanatics',           color:'#d4001f' },
  unibet:             { label:'Unibet',             color:'#147b45' },
  barstool:           { label:'Barstool',           color:'#f5c518' },
  pinnacle:           { label:'Pinnacle',           color:'#ffcc00' },
  bet365:             { label:'Bet365',             color:'#028a0f' },
  williamhill:        { label:'William Hill',       color:'#7b1fa2' },
  williamhill_us:     { label:'William Hill',       color:'#7b1fa2' },
  bovada:             { label:'Bovada',             color:'#e53935' },
  betonlineag:        { label:'BetOnline',          color:'#c62828' },
  mybookieag:         { label:'MyBookie',           color:'#1565c0' },
  lowvig:             { label:'LowVig',             color:'#2e7d32' },
  superbook:          { label:'SuperBook',          color:'#4a148c' },
  betparx:            { label:'BetParx',            color:'#e65100' },
  betus:              { label:'BetUS',              color:'#880e4f' },
  betway:             { label:'Betway',             color:'#00897b' },
  casumo:             { label:'Casumo',             color:'#d81b60' },
  circasports:        { label:'Circa Sports',       color:'#37474f' },
  fliff:              { label:'Fliff',              color:'#7c4dff' },
  tab:                { label:'TAB',                color:'#1976d2' },
  thescore:           { label:'theScore Bet',       color:'#e53935' },
  sports_interaction: { label:'Sports Interaction', color:'#1a73e8' },
  tooniebet:          { label:'ToonieBet',          color:'#e6b800' },
  tonybet:            { label:'TonyBet',            color:'#e63946' },
  playnow:            { label:'PlayNow',            color:'#005baa' },
  betfair:            { label:'Betfair',            color:'#ffb300' },
  '1xbet':            { label:'1xBet',              color:'#0288d1' },
  betsson:            { label:'Betsson',            color:'#006064' },
}

function getLabel(key: string) {
  return BOOK_META[key]?.label || key.replace(/_/g,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g, l => l.toUpperCase())
}
function getColor(key: string) {
  return BOOK_META[key]?.color || '#6b7280'
}

export default function BookFilter() {
  const { market, state, selectedBooks, setSelectedBooks, liveBooks, regionalBooks, allBooks, bookFreq } = useGeo()

  const books  = liveBooks.length > 0 ? liveBooks : (regionalBooks.length > 0 ? regionalBooks : allBooks)
  const isAll  = selectedBooks.length === 0
  const flag   = market === 'CA' ? '🇨🇦' : '🇺🇸'
  const region = market === 'CA' ? (state === 'ON' ? 'Ontario, Canada' : 'Canada') : `${state}, USA`
  const total  = Object.values(bookFreq).reduce((s,v) => s+v, 0)

  const toggle = (b: string) =>
    setSelectedBooks(selectedBooks.includes(b) ? selectedBooks.filter(x=>x!==b) : [...selectedBooks, b])

  return (
    <div style={{ marginBottom:16 }}>
      <style>{`
        .bf-card { transition: all 0.18s; -webkit-tap-highlight-color: transparent; cursor: pointer; }
        .bf-card:hover { transform: translateY(-2px); filter: brightness(1.08); }
        .bf-card:active { transform: scale(0.96); }
        @media (max-width:480px) { .bf-region-label { display:none!important; } .bf-grid { grid-template-columns: repeat(3,1fr)!important; } }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' as const }}>
        <span style={{ fontSize:13 }}>{flag}</span>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{region}</span>
        <span className="bf-region-label" style={{ fontSize:11, color:'var(--dim)', opacity:0.65 }}>— books in current data</span>
        {!isAll && (
          <button onClick={() => setSelectedBooks([])}
            style={{ marginLeft:'auto', fontSize:11, color:'var(--green)', background:'none', border:'1px solid rgba(0,200,83,0.3)', borderRadius:20, cursor:'pointer', padding:'2px 10px', fontFamily:'inherit' }}>
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="bf-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:7 }}>

        {/* All Books card */}
        <div className="bf-card" onClick={() => setSelectedBooks([])}
          style={{ padding:'10px 10px 8px', borderRadius:10, border: isAll ? '2px solid #00C853' : '1.5px solid var(--border)', background: isAll ? 'rgba(0,200,83,0.08)' : 'var(--bg3)', display:'flex', flexDirection:'column' as const, gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#00C853', flexShrink:0, boxShadow: isAll ? '0 0 6px #00C85388' : 'none' }} />
            <span style={{ fontSize:11, fontWeight:isAll?800:600, color: isAll?'#00C853':'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>All Books</span>
            {isAll && <span style={{ marginLeft:'auto', fontSize:10, color:'#00C853' }}>✓</span>}
          </div>
          <div style={{ fontSize:10, color:'var(--dim)' }}>{total > 0 ? `${total} opportunities` : 'Show all'}</div>
        </div>

        {books.map(b => {
          const active = selectedBooks.includes(b)
          const color  = getColor(b)
          const label  = getLabel(b)
          const count  = bookFreq[b] || 0
          const pct    = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={b} className="bf-card" onClick={() => toggle(b)}
              style={{ padding:'10px 10px 8px', borderRadius:10, border: active ? `2px solid ${color}` : '1.5px solid var(--border)', background: active ? `${color}15` : 'var(--bg3)', display:'flex', flexDirection:'column' as const, gap:4, position:'relative' as const }}>
              {/* Top row */}
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0, boxShadow: active ? `0 0 6px ${color}88` : 'none' }} />
                <span style={{ fontSize:11, fontWeight:active?800:600, color: active?color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, flex:1 }}>{label}</span>
                {active && <span style={{ fontSize:9, color:color, fontWeight:900 }}>✓</span>}
              </div>
              {/* Count bar */}
              {count > 0 && (
                <>
                  <div style={{ fontSize:10, color:'var(--dim)' }}>{count} arbs · {pct}%</div>
                  <div style={{ height:3, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width 0.5s ease' }} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!isAll && (
        <div style={{ marginTop:8, fontSize:11, color:'var(--dim)' }}>
          Filtering: {selectedBooks.map(b => getLabel(b)).join(', ')}
        </div>
      )}
    </div>
  )
}
