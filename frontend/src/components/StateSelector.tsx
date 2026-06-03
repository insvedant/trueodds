'use client'
import { useState, useEffect } from 'react'
import { US_STATES, detectMarket, saveMarketToStorage, getMarketFromStorage } from '@/lib/geo'

interface Props {
  onDone: (state: string) => void
}

export default function StateSelector({ onDone }: Props) {
  const [selected, setSelected]   = useState('')
  const [remember, setRemember]   = useState(true)
  const [detecting, setDetecting] = useState(true)
  const [suggested, setSuggested] = useState('')

  useEffect(() => {
    // Pre-fill with saved state if already set
    const saved = getMarketFromStorage()
    if (saved?.state) {
      setSelected(saved.state)
      setDetecting(false)
      return
    }
    detectMarket().then(({ countryCode }) => {
      if (countryCode === 'CA') { setSuggested('ON'); setSelected('ON') }
      setDetecting(false)
    })
  }, [])

  const confirm = () => {
    if (!selected) return
    const market = selected === 'ON' || selected === 'CA_OTHER' ? 'CA' : 'US'
    if (remember) {
      saveMarketToStorage(market, selected)
    }
    window.dispatchEvent(new Event('trueodds:marketchange'))
    onDone(selected)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:0 }}>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        .state-btn { transition:all 0.15s; -webkit-tap-highlight-color:transparent; user-select:none; }
        .state-btn:active { transform:scale(0.96); }
        .state-btn.sel { background:rgba(0,200,83,0.15)!important; border-color:var(--green)!important; }
      `}</style>

      <div style={{ background:'var(--bg)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:540, height:'92dvh', display:'flex', flexDirection:'column', animation:'slideUp 0.3s ease', overflow:'hidden' }}>

        {/* Handle bar */}
        <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px', flexShrink:0 }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ textAlign:'center', padding:'8px 20px 12px', flexShrink:0 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📍</div>
          <h2 style={{ fontSize:'clamp(16px,4vw,19px)', fontWeight:900, marginBottom:6 }}>Where are you betting from?</h2>
          <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.5, margin:0 }}>
            We'll show only sportsbooks legally available in your area.
          </p>
          {suggested && !detecting && (
            <div style={{ background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:8, padding:'6px 12px', fontSize:12, color:'var(--green)', marginTop:8 }}>
              📡 Canada detected — Ontario pre-selected
            </div>
          )}
        </div>

        {/* State grid — takes remaining space and scrolls */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto', flex:1, padding:'0 16px', WebkitOverflowScrolling:'touch' as any }}>
          {US_STATES.map(s => (
            <button key={s.code} onClick={() => setSelected(s.code)}
              className={`state-btn${selected === s.code ? ' sel' : ''}`}
              style={{ padding:'10px 12px', borderRadius:10, border:`1.5px solid ${selected===s.code?'var(--green)':'var(--border)'}`, background:'var(--bg3)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, position:'relative', WebkitTapHighlightColor:'transparent' as any }}>
              {selected === s.code && (
                <span style={{ position:'absolute', top:6, right:7, width:18, height:18, borderRadius:'50%', background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#000' }}>✓</span>
              )}
              <div style={{ fontWeight:600, fontSize:13, color:selected===s.code?'var(--green)':'var(--text)', paddingRight:selected===s.code?18:0, lineHeight:1.2 }}>{s.name}</div>
              <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>{s.code}</div>
            </button>
          ))}
          {/* Bottom spacing inside scroll */}
          <div style={{ gridColumn:'1/-1', height:8 }} />
        </div>

        {/* Bottom fixed section */}
        <div style={{ padding:'12px 16px', flexShrink:0, borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
          {/* Remember toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 12px', background:'var(--bg3)', borderRadius:10, cursor:'pointer' }}
            onClick={() => setRemember(r => !r)}>
            <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${remember?'var(--green)':'var(--border)'}`, background:remember?'var(--green)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
              {remember && <span style={{ color:'#000', fontSize:13, fontWeight:900, lineHeight:1 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>Remember my choice</div>
              <div style={{ fontSize:11, color:'var(--dim)' }}>
                {remember ? "Won't ask again — change anytime in Settings" : 'Will ask every time you log in'}
              </div>
            </div>
          </div>

          {/* Confirm */}
          <button onClick={confirm} disabled={!selected}
            style={{ width:'100%', background:selected?'var(--green)':'var(--bg3)', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:800, color:selected?'#000':'var(--dim)', cursor:selected?'pointer':'not-allowed', fontFamily:'inherit', transition:'background 0.2s', WebkitTapHighlightColor:'transparent' as any }}>
            {selected ? `Continue with ${US_STATES.find(s=>s.code===selected)?.name} →` : 'Select your state / province'}
          </button>
        </div>
      </div>
    </div>
  )
}
