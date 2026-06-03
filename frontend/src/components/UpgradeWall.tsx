'use client'
import Link from 'next/link'

type Plan = 'basic' | 'gold' | 'platinum'

const PLAN_COLOR: Record<Plan, string> = {
  basic:    '#00C853',
  gold:     '#f0a500',
  platinum: '#8957e5',
}
const PLAN_BG: Record<Plan, string> = {
  basic:    'rgba(0,200,83,0.07)',
  gold:     'rgba(240,165,0,0.07)',
  platinum: 'rgba(137,87,229,0.07)',
}
const PLAN_BORDER: Record<Plan, string> = {
  basic:    'rgba(0,200,83,0.2)',
  gold:     'rgba(240,165,0,0.2)',
  platinum: 'rgba(137,87,229,0.2)',
}

interface Props {
  requiredPlan: Plan
  featureName: string
  featureDesc?: string
  icon?: string
  currentPlan?: string
}

export default function UpgradeWall({ requiredPlan, featureName, featureDesc, icon = '🔒', currentPlan }: Props) {
  const color  = PLAN_COLOR[requiredPlan]
  const bg     = PLAN_BG[requiredPlan]
  const border = PLAN_BORDER[requiredPlan]

  const planLabel = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)

  
  const accessPlans: Plan[] = requiredPlan === 'basic'
    ? ['basic', 'gold', 'platinum']
    : requiredPlan === 'gold'
    ? ['gold', 'platinum']
    : ['platinum']

  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(24px,5vw,48px) 20px' }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .upgrade-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1) !important; }
        .upgrade-btn:hover { transform: scale(1.04) !important; box-shadow: 0 8px 28px ${color}44 !important; }
      `}</style>
      <div style={{ maxWidth:440, width:'100%', textAlign:'center', animation:'fadeUp 0.4s ease' }}>
        <div style={{ fontSize:'clamp(44px,8vw,56px)', marginBottom:16, animation:'float 3s ease-in-out infinite', display:'inline-block' }}>{icon}</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:bg, border:`1px solid ${border}`, borderRadius:20, padding:'4px 14px', marginBottom:16 }}>
          <span style={{ fontSize:12, fontWeight:800, color, textTransform:'uppercase', letterSpacing:0.8 }}>{planLabel}+ Required</span>
        </div>
        <h2 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:10, color:'var(--text)' }}>
          Unlock {featureName}
        </h2>
        {featureDesc && (
          <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,14px)', lineHeight:1.7, marginBottom:24 }}>
            {featureDesc}
          </p>
        )}

        {}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:28, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--dim)' }}>Available on:</span>
          {accessPlans.map(p => (
            <span key={p} style={{ background:PLAN_BG[p], border:`1px solid ${PLAN_BORDER[p]}`, color:PLAN_COLOR[p], fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20, textTransform:'capitalize' }}>{p}</span>
          ))}
        </div>

        {}
        <Link href="/pricing" className="upgrade-btn"
          style={{ display:'inline-block', background:color, color: requiredPlan === 'gold' ? '#000' : '#fff', textDecoration:'none', borderRadius:12, padding:'13px 32px', fontWeight:900, fontSize:15 }}>
          Upgrade to {planLabel} →
        </Link>

        {currentPlan && currentPlan !== 'free' && (
          <p style={{ fontSize:12, color:'var(--dim)', marginTop:14 }}>
            You're on <strong style={{ color:'var(--text)', textTransform:'capitalize' }}>{currentPlan}</strong>. Upgrade to access this feature.
          </p>
        )}
      </div>
    </div>
  )
}
