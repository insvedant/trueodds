'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth, api } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const plans = [
  { id:'free', name:'Basic', price:0, yearly:0, desc:'Discover the platform risk-free.', highlight:false, accent:'var(--muted)',
    features:['All bet types (3% arb cap)', 'Live odds (delayed)', 'All sports & leagues', 'Bet tracker (10 bets)', 'Community Discord'] },
  { id:'gold', name:'Gold', price: 15.99, yearly: 12.99, desc:'Best for consistent edge.', highlight:true, accent:'var(--amber)',
    features:['Full arbitrage finder', '+EV betting tools', '40+ US sportsbooks', 'Unlimited bet tracker', 'Smart bet alerts', 'Line movement history', 'Cancel anytime'] },
  { id:'platinum', name:'💎 Platinum', price: 49.99, yearly: 39.99, desc:'Maximum edge for serious bettors.', highlight:false, accent:'var(--purple)',
    features:['Everything in Gold', 'Live in-play odds', '100+ global sportsbooks', 'Sub-second refresh', 'API access', '1:1 coaching calls', 'Priority support'] },
]

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly'|'yearly'>('monthly')

  const subscribe = async (planId: string) => {
    if (!user) { router.push('/signup'); return }
    if (planId === 'free') { router.push('/dashboard'); return }
    setLoading(planId)
    try { await api.post('/subscriptions/subscribe', { planId }); router.push('/dashboard') }
    catch (err: any) { alert(err.response?.data?.message || 'Subscription failed.') }
    finally { setLoading(null) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <PublicNavbar />

      {/* Hero */}
      <section style={{ padding: '70px 24px 56px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 12 }}>Simple pricing</h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 28 }}>Start free. Upgrade when you're ready to go sharp.</p>
        <div style={{ display: 'inline-flex', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 28, padding: '5px 6px', gap: 4 }}>
          {(['monthly','yearly'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{ padding: '7px 20px', borderRadius: 22, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: billing===b ? 'var(--green)' : 'transparent', color: billing===b ? '#fff' : 'var(--muted)', transition: 'all 0.2s' }}>
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: billing==='yearly' ? '#fff' : 'var(--green)' }}>2 months free!</span>}
            </button>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20, marginBottom: 24 }}>
          {plans.map(plan => {
            const price = billing === 'yearly' ? plan.yearly : plan.price
            const isCurrent = user?.plan === plan.id
            return (
              <div key={plan.id} style={{ background: 'var(--bg3)', border: `${plan.highlight ? '2px' : '1px'} solid ${plan.highlight ? plan.accent : 'var(--border)'}`, borderRadius: 16, padding: '30px 26px', position: 'relative', display: 'flex', flexDirection: 'column', transition: 'transform 0.25s, box-shadow 0.25s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: plan.accent, color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap' }}>MOST POPULAR</div>}
                {isCurrent && <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,200,83,0.1)', color: 'var(--green)', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>CURRENT</div>}
                <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>{plan.name}</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-1px' }}>{price === 0 ? 'Free' : `$${price}`}</span>
                  {price > 0 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>/mo</span>}
                </div>
                {billing === 'yearly' && price > 0 && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 4 }}>Billed ${price * 12}/yr (save ${(plan.price - plan.yearly) * 12})</div>}
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>{plan.desc}</p>
                <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />
                <div style={{ flex: 1 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 9, marginBottom: 11, fontSize: 13, color: 'var(--text2)', alignItems: 'flex-start' }}>
                      <span style={{ color: plan.accent, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={() => subscribe(plan.id)} disabled={isCurrent || loading === plan.id}
                  style={{ marginTop: 22, width: '100%', background: plan.highlight ? plan.accent : 'transparent', border: `1px solid ${plan.highlight ? plan.accent : 'var(--border)'}`, color: plan.highlight ? '#fff' : 'var(--text)', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 800, cursor: isCurrent ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isCurrent ? 0.5 : 1, transition: 'all 0.18s' }}>
                  {loading===plan.id ? 'Processing...' : isCurrent ? 'Current Plan' : price===0 ? 'Start Free' : 'Start 14-Day Trial →'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Day pass */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Day Pass — $22 one time</div>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>All Platinum features for 24 hours. Test before committing.</p>
          </div>
          <button style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 9, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}>
            Get Day Pass
          </button>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 12, marginTop: 24 }}>All paid plans include a 14-day free trial. Cancel anytime, no questions asked.</p>
      </div>

      <PublicFooter />
    </div>
  )
}
