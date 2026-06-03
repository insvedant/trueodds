'use client'
import { useState, useEffect } from 'react'
import { api, useAuth } from '@/lib/auth'
import Link from 'next/link'

type ReferralEntry = { name:string; email:string; plan:string; status:string; totalPaid:number; qualified:boolean; joined:string }
type ReferralData = {
  referralCode:string; referralLink:string; threshold:number; rewardMonths:number
  totalReferrals:number; qualifiedReferrals:number; pendingReferrals:number
  rewardsEarned:number; totalSpentByReferrals:number; referrals:ReferralEntry[]
}

function AnimatedCount({ to, delay=0, prefix='', decimals=0 }: { to:number; delay?:number; prefix?:string; decimals?:number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      const dur = 900; const s = performance.now()
      const tick = (now:number) => {
        const p = Math.min((now-s)/dur, 1)
        setVal(to * (1-Math.pow(1-p,3)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(t)
  }, [to])
  return <>{prefix}{decimals ? val.toFixed(decimals) : Math.round(val)}</>
}

export default function ReferralPage() {
  const { user } = useAuth()
  const [data, setData]       = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)
  const [err, setErr]         = useState('')

  useEffect(() => {
    api.get('/referral/me')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const copy = async () => {
    if (!data?.referralLink) return
    await navigator.clipboard.writeText(data.referralLink)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const planColor: Record<string,string> = { free:'var(--dim)', basic:'#00C853', gold:'#f0a500', platinum:'#8957e5' }

  return (
    <div style={{ padding:'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', maxWidth:760, margin:'0 auto' }}>
      <style>{`
        @keyframes slideUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardIn   { from{opacity:0;transform:scale(0.94) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes checkPop { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes rowIn    { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        .stat-card { transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-4px) scale(1.02); box-shadow:0 12px 32px rgba(0,0,0,0.3); }
        .copy-btn { transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .copy-btn:hover { transform:scale(1.04); }
        .ref-row { transition:background 0.15s; border-radius:10px; }
        .ref-row:hover { background:var(--bg4) !important; }
        @media (max-width:480px) {
          .stats-grid  { grid-template-columns:1fr 1fr !important; }
          .link-row    { flex-direction:column !important; }
          .link-row .copy-btn { width:100% !important; justify-content:center !important; }
          .steps-grid  { grid-template-columns:1fr !important; }
          .earn-grid   { grid-template-columns:1fr !important; }
        }
      `}</style>

      {}
      <div style={{ marginBottom:28, animation:'slideUp 0.5s ease' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'rgba(0,200,83,0.1)', border:'1px solid rgba(0,200,83,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, animation:'float 3s ease-in-out infinite', flexShrink:0 }}>🎁</div>
          <div>
            <h1 style={{ fontWeight:900, fontSize:'clamp(20px,4vw,26px)', margin:0 }}>Referral Program</h1>
            <p style={{ color:'var(--muted)', fontSize:13, margin:'3px 0 0' }}>
              Refer friends → earn <strong style={{ color:'var(--green)' }}>1 free month</strong> when they spend $50+
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:200, gap:12, color:'var(--dim)' }}>
          <span style={{ width:18, height:18, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
          Loading your referrals...
        </div>
      ) : err ? (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:20, color:'#ef4444', textAlign:'center' }}>{err}</div>
      ) : data && (
        <>
          {}
          <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { icon:'👥', label:'Referrals',  value:data.totalReferrals,     color:'var(--text)',  delay:0   },
              { icon:'✅', label:'Qualified',  value:data.qualifiedReferrals, color:'var(--green)', delay:80  },
              { icon:'⏳', label:'Pending',    value:data.pendingReferrals,   color:'#f0a500',      delay:160 },
              { icon:'🎁', label:'Free Months',value:data.rewardsEarned,      color:'#8957e5',      delay:240 },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'clamp(12px,2.5vw,18px)', textAlign:'center', animation:`cardIn 0.5s ease ${s.delay}ms both` }}>
                <div style={{ fontSize:'clamp(18px,3vw,24px)', marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:900, color:s.color, letterSpacing:'-1px', lineHeight:1 }}>
                  <AnimatedCount to={s.value} delay={s.delay+200} />
                </div>
                <div style={{ fontSize:'clamp(9px,1.6vw,11px)', color:'var(--dim)', marginTop:5, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(16px,3vw,22px)', marginBottom:20, animation:'cardIn 0.5s ease 0.3s both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap' as const, gap:8 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase' as const, letterSpacing:0.8 }}>Your Unique Referral Link</div>
              <code style={{ background:'var(--bg)', border:'1px solid var(--border)', padding:'3px 10px', borderRadius:8, fontSize:12, color:'var(--text)', fontWeight:800, letterSpacing:1.5 }}>{data.referralCode}</code>
            </div>
            <div className="link-row" style={{ display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px', fontSize:'clamp(11px,2vw,13px)', color:'var(--muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, minWidth:0 }}>
                {data.referralLink}
              </div>
              <button onClick={copy} className="copy-btn"
                style={{ background:copied?'var(--green)':'var(--bg)', border:`1.5px solid ${copied?'var(--green)':'var(--border)'}`, borderRadius:10, padding:'11px 18px', fontSize:13, fontWeight:800, color:copied?'#000':'var(--text)', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const, flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                {copied ? <><span style={{ animation:'checkPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both', display:'inline-block' }}>✓</span> Copied!</> : <><span>📋</span> Copy</>}
              </button>
            </div>
            <p style={{ fontSize:12, color:'var(--dim)', marginTop:10, marginBottom:0 }}>
              Share this link. When someone signs up and spends <strong style={{ color:'var(--green)' }}>${data.threshold}+</strong>, you earn <strong style={{ color:'var(--green)' }}>{data.rewardMonths} free month</strong> automatically.
            </p>
          </div>

          {}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(16px,3vw,22px)', marginBottom:20, animation:'cardIn 0.5s ease 0.4s both' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>How it works</div>
            <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {[
                { icon:'🔗', step:'1', title:'Share your link', desc:`Send your unique link to friends who want an edge on sports betting.`, color:'rgba(0,200,83,0.15)', tc:'var(--green)' },
                { icon:'💳', step:'2', title:'They subscribe',  desc:`They sign up using your link and subscribe to any paid plan.`, color:'rgba(88,166,255,0.15)', tc:'#58a6ff' },
                { icon:'🎁', step:'3', title:`They spend $${data.threshold}+`, desc:`Once they've paid $${data.threshold} total, 1 free month is credited to your account automatically.`, color:'rgba(240,165,0,0.15)', tc:'#f0a500' },
              ].map(s => (
                <div key={s.step} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:'clamp(12px,2.5vw,16px)', textAlign:'center', animation:`rowIn 0.4s ease ${500+parseInt(s.step)*100}ms both` }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:s.color, color:s.tc, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontWeight:900 }}>{s.icon}</div>
                  <div style={{ fontSize:'clamp(11px,2vw,13px)', fontWeight:800, color:'var(--text)', marginBottom:5 }}>{s.title}</div>
                  <div style={{ fontSize:'clamp(10px,1.7vw,12px)', color:'var(--dim)', lineHeight:1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {}
          <div style={{ background:'linear-gradient(135deg,rgba(0,200,83,0.07),rgba(0,200,83,0.02))', border:'1px solid rgba(0,200,83,0.18)', borderRadius:16, padding:'clamp(16px,3vw,22px)', marginBottom:20, animation:'cardIn 0.5s ease 0.5s both' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>💰 Potential Savings</div>
            <div className="earn-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {[{n:5,s:'~$80'},{n:10,s:'~$160'},{n:20,s:'~$320'}].map(e => (
                <div key={e.n} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--dim)', marginBottom:4 }}>{e.n} qualified referrals</div>
                  <div style={{ fontSize:'clamp(14px,2.5vw,16px)', fontWeight:900, color:'var(--green)' }}>{e.n} free months</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{e.s} saved</div>
                </div>
              ))}
            </div>
            <p style={{ color:'var(--dim)', fontSize:12, margin:'12px 0 0' }}>Based on Basic plan ($15.99/mo). Rewards credited automatically — no manual claiming needed.</p>
          </div>

          {}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(16px,3vw,22px)', animation:'cardIn 0.5s ease 0.6s both' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Your Referrals</span>
              <span style={{ fontWeight:600, color:'var(--dim)', fontSize:12 }}>({data.referrals.length})</span>
            </div>

            {data.referrals.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column' as const, gap:2 }}>
                {}
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, padding:'6px 8px', fontSize:10, fontWeight:700, color:'var(--dim)', textTransform:'uppercase' as const, letterSpacing:0.5 }}>
                  <span>User</span><span>Spent</span><span>Status</span><span>Qualified</span>
                </div>
                {data.referrals.map((r, i) => (
                  <div key={i} className="ref-row" style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, padding:'10px 8px', alignItems:'center', borderBottom: i < data.referrals.length-1 ? '1px solid var(--border)' : 'none', animation:`rowIn 0.4s ease ${700+i*50}ms both` }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.name}</div>
                      <div style={{ fontSize:10, color:'var(--dim)' }}>{new Date(r.joined).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color: r.totalPaid >= data.threshold ? 'var(--green)' : 'var(--muted)', textAlign:'right' as const }}>${r.totalPaid.toFixed(0)}</div>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:r.status==='active'?'rgba(0,200,83,0.1)':'rgba(107,114,128,0.1)', color:r.status==='active'?'var(--green)':'var(--dim)', fontWeight:700, whiteSpace:'nowrap' as const }}>{r.plan}</span>
                    <span style={{ fontSize:16, textAlign:'center' as const }}>{r.qualified ? '✅' : '⏳'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'clamp(24px,4vw,40px) 20px' }}>
                <div style={{ fontSize:40, marginBottom:10, opacity:0.35 }}>🔗</div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>No referrals yet</div>
                <p style={{ color:'var(--dim)', fontSize:13, margin:'0 0 16px' }}>Copy your link above and share it to start earning free months.</p>
                <button onClick={copy} style={{ background:'rgba(0,200,83,0.1)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:9, padding:'9px 20px', fontSize:13, fontWeight:700, color:'var(--green)', cursor:'pointer', fontFamily:'inherit' }}>
                  📋 Copy My Referral Link
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
