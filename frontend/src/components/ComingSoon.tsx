'use client'
import Link from 'next/link'

interface Props {
  featureName: string
  featureDesc?: string
  icon?: string
  eta?: string
  requiredPlan?: string
}

export default function ComingSoon({ featureName, featureDesc, icon = '🚀', eta, requiredPlan }: Props) {
  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(24px,5vw,48px) 20px' }}>
      <style>{`
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200%} 100%{background-position:200%} }
      `}</style>
      <div style={{ maxWidth:440, width:'100%', textAlign:'center', animation:'fadeUp 0.4s ease' }}>
        <div style={{ fontSize:'clamp(44px,8vw,56px)', marginBottom:16, animation:'float 3s ease-in-out infinite', display:'inline-block' }}>{icon}</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(88,166,255,0.08)', border:'1px solid rgba(88,166,255,0.2)', borderRadius:20, padding:'4px 14px', marginBottom:16 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#58a6ff', display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize:12, fontWeight:800, color:'#58a6ff', textTransform:'uppercase', letterSpacing:0.8 }}>Coming Soon</span>
        </div>
        <h2 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:10, color:'var(--text)' }}>
          {featureName}
        </h2>
        {featureDesc && (
          <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,14px)', lineHeight:1.7, marginBottom: eta || requiredPlan ? 20 : 28 }}>
            {featureDesc}
          </p>
        )}
        {eta && (
          <div style={{ background:'rgba(88,166,255,0.06)', border:'1px solid rgba(88,166,255,0.15)', borderRadius:10, padding:'10px 20px', marginBottom:20, fontSize:13, color:'var(--muted)' }}>
            🗓 Expected: <strong style={{ color:'var(--text)' }}>{eta}</strong>
          </div>
        )}
        {requiredPlan && (
          <div style={{ marginBottom:24 }}>
            <span style={{ fontSize:12, color:'var(--dim)' }}>Will be available on </span>
            <span style={{ fontSize:12, fontWeight:700, color:'#8957e5', background:'rgba(137,87,229,0.1)', padding:'2px 10px', borderRadius:20, textTransform:'capitalize' }}>{requiredPlan}</span>
            <span style={{ fontSize:12, color:'var(--dim)' }}> plan</span>
          </div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <a href="mailto:support@trueodds.ca"
            style={{ display:'inline-block', background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', textDecoration:'none', borderRadius:10, padding:'10px 22px', fontWeight:700, fontSize:13, transition:'all 0.15s' }}>
            ✉️ Get Notified
          </a>
          <Link href="/dashboard"
            style={{ display:'inline-block', background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', textDecoration:'none', borderRadius:10, padding:'10px 22px', fontSize:13 }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
