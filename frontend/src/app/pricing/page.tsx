'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth, api } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const plans = [
  {
    id: 'basic', name: 'Basic',
    monthlyPrice: 15.99, yearlyPrice: 12.99, yearlyTotal: 155.88,
    highlight: false, accent: '#00C853', accentRgb: '0,200,83',
    emoji: '🌱',
    features: ['Arbitrage finder','+EV betting tools','40+ US sportsbooks','Smart email alerts','Unlimited bet tracker','Line movement history','Unlimited devices','AGCO/iGO regulatory updates','Cancel anytime'],
  },
  {
    id: 'gold', name: 'Gold',
    monthlyPrice: 49.99, yearlyPrice: 39.99, yearlyTotal: 479.88,
    highlight: true, accent: '#f0a500', accentRgb: '240,165,0',
    emoji: '⚡',
    features: ['Everything in Basic','ML predictions & EV scoring','Live in-play odds','100+ global sportsbooks','Sub-second odds refresh','Emergency Hedge button','Priority email support','Unlimited devices','AGCO/iGO regulatory updates'],
  },
  {
    id: 'platinum', name: 'Platinum',
    monthlyPrice: 99.99, yearlyPrice: 79.99, yearlyTotal: 959.88,
    highlight: false, accent: '#8957e5', accentRgb: '137,87,229',
    emoji: '💎',
    features: ['Everything in Gold','API access','Sub-second alerts','Custom line alerts','Dedicated account manager','Unlimited devices','AGCO/iGO regulatory updates'],
  },
]

const faqs = [
  { q: 'Is there a free trial?', a: 'Yes — all paid plans include a 7-day free trial. Your card is only charged after the trial ends.' },
  { q: 'What is the 24-hour refund policy?', a: 'If you are charged and change your mind within 24 hours of your first payment, email support@trueodds.ca for a full refund. No questions asked.' },
  { q: 'How many devices can I use?', a: 'All paid plans include unlimited devices. Log in from your phone, tablet, and laptop simultaneously.' },
  { q: 'What are AGCO/iGO updates?', a: 'We monitor the Alcohol and Gaming Commission of Ontario (AGCO) and iGaming Ontario (iGO) for regulatory changes affecting Canadian sports bettors and surface them in your dashboard.' },
  { q: 'What is the Emergency Hedge button?', a: 'The Emergency Hedge tool (Gold+) calculates the exact stake to place on the opposite outcome to lock in guaranteed profit — or minimise your loss — before a game ends.' },
  { q: 'Is there a referral program?', a: 'Yes! Share your unique link. For every friend who subscribes to any paid plan, you earn 1 free month. No cap on referrals.' },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function FadeIn({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useInView()
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading]           = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly'|'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const subscribe = async (planId: string) => {
    if (!user) { router.push(`/signup?plan=${planId}&billing=${billingPeriod}`); return }
    setLoading(planId)
    try { await api.post('/subscriptions/subscribe', { planId, billingPeriod }); router.push('/dashboard') }
    catch (err: any) { alert(err.response?.data?.message || 'Subscription failed.') }
    finally { setLoading(null) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>
      <PublicNavbar />
      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.5);opacity:0} }
        @keyframes badge-pop { 0%{transform:translateX(-50%) scale(0.7)} 70%{transform:translateX(-50%) scale(1.08)} 100%{transform:translateX(-50%) scale(1)} }
        @keyframes faq-open { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradient-shift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

        .plan-card { transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease; }
        .plan-card:hover { transform: translateY(-8px) !important; }
        .plan-card-gold:hover { box-shadow: 0 24px 60px rgba(240,165,0,0.25) !important; }
        .plan-card-basic:hover { box-shadow: 0 24px 60px rgba(0,200,83,0.15) !important; }
        .plan-card-platinum:hover { box-shadow: 0 24px 60px rgba(137,87,229,0.2) !important; }

        .cta-btn { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s, filter 0.18s; }
        .cta-btn:hover:not(:disabled) { transform: scale(1.03) !important; filter: brightness(1.1); }
        .cta-btn:active:not(:disabled) { transform: scale(0.97) !important; }

        .trust-badge { transition: transform 0.2s, color 0.2s; }
        .trust-badge:hover { transform: scale(1.06); }

        .faq-row { transition: background 0.2s; }
        .faq-row:hover { background: var(--bg3); border-radius: 10px; }

        @media (max-width: 768px) {
          .pricing-grid { display:flex !important; overflow-x:auto !important; scroll-snap-type:x mandatory !important; padding:4px 20px 24px !important; margin:0 -20px !important; scrollbar-width:none !important; gap:14px !important; }
          .pricing-grid::-webkit-scrollbar { display:none !important; }
          .pricing-grid > div { flex:0 0 82vw !important; max-width:320px !important; scroll-snap-align:center !important; }
          .trust-row { gap:12px !important; }
          .trust-badge { font-size:12px !important; }
          .referral-cta { flex-direction:column !important; text-align:center !important; }
          .faq-q { font-size:13px !important; }
        }
        @media (max-width: 400px) {
          .pricing-grid > div { flex:0 0 92vw !important; }
        }
      `}</style>

      {}
      <section style={{ padding: 'clamp(48px,8vw,80px) 20px 56px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,200,83,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <FadeIn>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 800, color: 'var(--green)', marginBottom: 20, letterSpacing: 0.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-ring 1.5s ease-out infinite' }} />
            7-DAY FREE TRIAL ON ALL PLANS
          </div>
        </FadeIn>
        <FadeIn delay={80}>
          <h1 style={{ fontSize: 'clamp(28px,6vw,54px)', fontWeight: 900, letterSpacing: '-2px', marginBottom: 14, lineHeight: 1.05 }}>
            Simple,{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--green), #00e676)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              transparent
            </span>{' '}
            pricing
          </h1>
        </FadeIn>
        <FadeIn delay={160}>
          <p style={{ color: 'var(--muted)', fontSize: 'clamp(14px,2vw,16px)', marginBottom: 10 }}>Start free. No charge for the first 7 days.</p>
          <p style={{ color: 'var(--dim)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' as const }}>
            {['🔒 24-hr refund policy', '∞ Unlimited devices', '🇨🇦 AGCO/iGO updates', '⚡ Cancel anytime'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t}</span>
            ))}
          </p>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, flexWrap:'wrap' as const, marginTop:16 }}>
            <span style={{ fontSize:11, color:'var(--dim)', marginRight:4 }}>Accepted:</span>
            {[
              { icon:'💳', label:'Card' },
              { icon:'🅿️', label:'PayPal' },
              { icon:'', label:'Apple Pay' },
              { icon:'G', label:'Google Pay' },
            ].map(pm => (
              <div key={pm.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:4 }}>
                <span>{pm.icon}</span>{pm.label}
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(32px,5vw,56px) 20px 0' }}>

        {/* Billing period toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:40 }}>
          <span style={{ fontSize:14, fontWeight:billingPeriod==='monthly'?700:400, color:billingPeriod==='monthly'?'var(--text)':'var(--dim)', transition:'color 0.2s' }}>Monthly</span>
          <button onClick={() => setBillingPeriod(p => p==='monthly'?'yearly':'monthly')}
            style={{ width:56, height:30, borderRadius:15, background:billingPeriod==='yearly'?'var(--green)':'var(--bg3)', border:'2px solid var(--border)', cursor:'pointer', position:'relative', transition:'background 0.3s', flexShrink:0 }}>
            <span style={{ position:'absolute', top:3, left:billingPeriod==='yearly'?28:3, width:20, height:20, borderRadius:'50%', background:billingPeriod==='yearly'?'#000':'var(--muted)', transition:'left 0.25s cubic-bezier(0.34,1.56,0.64,1)', display:'block' }} />
          </button>
          <span style={{ fontSize:14, fontWeight:billingPeriod==='yearly'?700:400, color:billingPeriod==='yearly'?'var(--text)':'var(--dim)', transition:'color 0.2s', display:'flex', alignItems:'center', gap:8 }}>
            Yearly
            <span style={{ background:'rgba(0,200,83,0.12)', color:'var(--green)', fontSize:11, fontWeight:800, padding:'2px 9px', borderRadius:20 }}>Save ~20%</span>
          </span>
        </div>

        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 20, marginBottom: 40 }}>
          {plans.map((plan, idx) => {
            const isCurrent = user?.plan === plan.id
            const price     = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
            const desc      = billingPeriod === 'yearly'
              ? `7-day free trial · $${plan.yearlyPrice}/mo billed $${plan.yearlyTotal}/yr`
              : `7-day free trial · then $${plan.monthlyPrice}/mo`
            return (
              <FadeIn key={plan.id} delay={idx * 100} style={{ height: '100%' }}>
                <div
                  className={`plan-card plan-card-${plan.id}`}
                  style={{ background: 'var(--bg3)', border: `${plan.highlight ? '2px' : '1px'} solid ${plan.highlight ? plan.accent : 'var(--border)'}`, borderRadius: 20, padding: 'clamp(24px,4vw,32px)', position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>

                  {plan.highlight && (
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: plan.accent, color: '#000', fontSize: 10, fontWeight: 900, padding: '5px 18px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: 0.8, animation: 'badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
                      ✦ MOST POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div style={{ position: 'absolute', top: 14, right: 14, background: `rgba(${plan.accentRgb},0.12)`, color: plan.accent, fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>CURRENT</div>
                  )}

                  <div style={{ fontSize: 32, marginBottom: 10, animation: `float ${3 + idx * 0.5}s ease-in-out infinite` }}>{plan.emoji}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 4, color: plan.accent }}>{plan.name}</div>
                  <div style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 'clamp(36px,5vw,46px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>${price}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 14, paddingBottom: 4 }}>/mo</span>
                  </div>
                  <p style={{ color: 'var(--dim)', fontSize: 12, marginBottom: 20, marginTop: 0 }}>{desc}</p>

                  <div style={{ height: 1, background: `linear-gradient(90deg, transparent, rgba(${plan.accentRgb},0.3), transparent)`, marginBottom: 18 }} />

                  <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                    {plan.features.map((f, fi) => (
                      <li key={f} style={{ display: 'flex', gap: 9, marginBottom: 10, fontSize: 13, color: 'var(--text2)', alignItems: 'flex-start', opacity: 0, animation: `faq-open 0.4s ease ${300 + idx * 80 + fi * 40}ms both` }}>
                        <span style={{ color: plan.accent, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>

                  <button
                    className="cta-btn"
                    onClick={() => subscribe(plan.id)}
                    disabled={isCurrent || loading === plan.id}
                    style={{ width: '100%', background: plan.highlight ? plan.accent : `rgba(${plan.accentRgb},0.1)`, border: `1.5px solid ${plan.highlight ? plan.accent : `rgba(${plan.accentRgb},0.4)`}`, color: plan.highlight ? '#000' : plan.accent, borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 800, cursor: isCurrent ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isCurrent ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading === plan.id
                      ? <span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: plan.highlight ? '#000' : plan.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                      : isCurrent ? 'Current Plan'
                      : 'Start 7-Day Free Trial →'}
                  </button>
                </div>
              </FadeIn>
            )
          })}
        </div>

        {}
        <FadeIn>
          <div className="trust-row" style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' as const, padding: '24px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 48 }}>
            {[['🔒','24-hr Refund'],['∞','Unlimited Devices'],['🇨🇦','AGCO/iGO'],['🎁','Referral Rewards'],['⚡','Cancel Anytime']].map(([icon, label]) => (
              <div key={label} className="trust-badge" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--muted)', cursor: 'default' }}>
                <span style={{ fontSize: 18 }}>{icon}</span>{label}
              </div>
            ))}
          </div>
        </FadeIn>

        {}
        <FadeIn>
          <div className="referral-cta" style={{ background: 'linear-gradient(135deg,rgba(0,200,83,0.08),rgba(0,200,83,0.03))', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 18, padding: 'clamp(20px,4vw,28px) clamp(20px,4vw,32px)', marginBottom: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 20 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 'clamp(16px,2.5vw,20px)', marginBottom: 6 }}>🎁 Referral Program</div>
              <p style={{ color: 'var(--muted)', fontSize: 'clamp(12px,1.8vw,14px)', margin: 0, lineHeight: 1.6 }}>
                Refer a friend who subscribes → <strong style={{ color: 'var(--green)' }}>you both get 1 free month.</strong><br />
                No limit — more referrals, more free months.
              </p>
            </div>
            <Link href={user ? '/dashboard/referral' : '/signup'} style={{ background: 'var(--green)', color: '#000', borderRadius: 12, padding: '12px 24px', fontWeight: 900, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0, display: 'inline-block', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,200,83,0.35)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
              {user ? 'Get Your Link →' : 'Sign Up to Refer →'}
            </Link>
          </div>
        </FadeIn>

        {}
        <FadeIn>
          <div style={{ marginBottom: 64 }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', marginBottom: 28, textAlign: 'center' }}>Frequently asked questions</h2>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              {faqs.map((faq, i) => (
                <div key={i} className="faq-row" style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden', padding: '0 8px' }}>
                  <button
                    className="faq-q"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontSize: 14, fontWeight: 700, textAlign: 'left' as const, gap: 16, minHeight: 48 }}>
                    <span>{faq.q}</span>
                    <span style={{ fontSize: 20, color: openFaq === i ? 'var(--green)' : 'var(--dim)', flexShrink: 0, transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), color 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)', display: 'inline-block' }}>+</span>
                  </button>
                  {openFaq === i && (
                    <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.75, paddingBottom: 18, marginTop: -4, animation: 'faq-open 0.3s ease' }}>{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {}
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 56, padding: '20px', background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>💬</div>
            <p style={{ color: 'var(--dim)', fontSize: 13, margin: 0 }}>
              Questions?{' '}
              <a href="mailto:support@trueodds.ca" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>support@trueodds.ca</a>
              {' '}— we typically reply within 2 hours.
            </p>
          </div>
        </FadeIn>
      </div>

      <PublicFooter />
    </div>
  )
}
