'use client'
import { useState } from 'react'

export default function ApiAccessPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(24px,5vw,48px) 20px' }}>
      <style>{`
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes checkIn { from{transform:scale(0)} 70%{transform:scale(1.2)} to{transform:scale(1)} }
        .feat-card { transition:transform 0.2s,box-shadow 0.2s; }
        .feat-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.2); }
        .sub-input:focus { border-color:#8957e5!important; box-shadow:0 0 0 3px rgba(137,87,229,0.15)!important; outline:none!important; }
      `}</style>

      <div style={{ maxWidth:560, width:'100%', animation:'fadeUp 0.5s ease' }}>
        {}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:'clamp(44px,8vw,60px)', marginBottom:16, animation:'float 3s ease-in-out infinite', display:'inline-block' }}>🔌</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(137,87,229,0.08)', border:'1px solid rgba(137,87,229,0.25)', borderRadius:20, padding:'4px 14px', marginBottom:14 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#8957e5', display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize:12, fontWeight:800, color:'#8957e5', textTransform:'uppercase' as const, letterSpacing:0.8 }}>Coming Soon</span>
          </div>
          <h1 style={{ fontSize:'clamp(22px,4vw,28px)', fontWeight:900, marginBottom:12, color:'var(--text)' }}>TrueOdds API Access</h1>
          <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,15px)', lineHeight:1.75, marginBottom:0 }}>
            Programmatic access to live arbitrage opportunities, +EV bets, and odds data — delivered directly to your tools, bots, and spreadsheets.
          </p>
        </div>

        {}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:32 }}>
          {[
            { icon:'⚡', title:'Real-time Odds',      desc:'Live odds from 100+ sportsbooks via REST or WebSocket streams' },
            { icon:'🎯', title:'Arb Opportunities',   desc:'Filtered arbitrage bets with stake sizing, sent as JSON' },
            { icon:'📈', title:'+EV Data Feed',       desc:'Edge scores, fair odds, and Kelly recommendations' },
            { icon:'🔐', title:'Secure & Fast',       desc:'API keys per account, rate limits, 99.9% uptime SLA' },
          ].map(f => (
            <div key={f.title} className="feat-card" style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{f.icon}</div>
              <div style={{ fontWeight:800, fontSize:13, color:'var(--text)', marginBottom:5 }}>{f.title}</div>
              <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {}
        <div style={{ background:'rgba(137,87,229,0.06)', border:'1px solid rgba(137,87,229,0.2)', borderRadius:12, padding:'12px 18px', marginBottom:28, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>⭐</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#8957e5' }}>Platinum Plan exclusive</div>
            <div style={{ fontSize:12, color:'var(--dim)' }}>API access will be available exclusively to Platinum subscribers when launched.</div>
          </div>
        </div>

        {}
        {sent ? (
          <div style={{ background:'rgba(137,87,229,0.08)', border:'1px solid rgba(137,87,229,0.25)', borderRadius:14, padding:'20px 24px', textAlign:'center', animation:'fadeUp 0.4s ease' }}>
            <div style={{ fontSize:36, marginBottom:8, animation:'checkIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>✅</div>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>You're on the list!</div>
            <div style={{ color:'var(--muted)', fontSize:13 }}>We'll email <strong style={{ color:'var(--text)' }}>{email}</strong> the moment API access launches.</div>
          </div>
        ) : (
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'clamp(18px,4vw,24px)' }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>Get notified when it launches</div>
            <div style={{ color:'var(--muted)', fontSize:13, marginBottom:18 }}>Be first to know — we'll send you launch details, pricing, and early access.</div>
            <form onSubmit={subscribe} style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              <input className="sub-input" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ flex:1, minWidth:200, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, padding:'11px 14px', fontSize:14, color:'var(--text)', fontFamily:'inherit', transition:'border-color 0.2s, box-shadow 0.2s' }} />
              <button type="submit" disabled={loading}
                style={{ background:'#8957e5', color:'#fff', border:'none', borderRadius:10, padding:'11px 22px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', flexShrink:0, opacity:loading?0.7:1, display:'flex', alignItems:'center', gap:8 }}>
                {loading ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} />Subscribing...</> : 'Notify Me →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
