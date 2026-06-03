'use client'
import Logo from '@/components/Logo'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, api } from '@/lib/auth'
import { ThemeToggle } from '@/lib/theme'

const STATS = [
  { icon: '⚡', label: '+3.2% arb', sub: 'Wild vs Avalanche', color: '#00C853' },
  { icon: '📈', label: '+48.9% EV', sub: 'DraftKings +322', color: '#58a6ff' },
  { icon: '💰', label: '+$387 P&L', sub: 'This month', color: '#00C853' },
  { icon: '🔥', label: '8 live arbs', sub: 'Right now', color: '#f0a500' },
  { icon: '🎯', label: '71% win rate', sub: 'Last 30 days', color: '#8957e5' },
]

const PLAN_DATA = {
  basic: {
    name: 'Basic', price: 15.99, color: '#00C853', bg: 'rgba(0,200,83,0.08)',
    border: 'rgba(0,200,83,0.35)',
    features: ['Arbitrage finder', '+EV betting tools', '40+ US sportsbooks', 'Smart email alerts', 'Unlimited bet tracker'],
  },
  gold: {
    name: 'Gold', price: 49.99, color: '#f0a500', bg: 'rgba(240,165,0,0.08)',
    border: 'rgba(240,165,0,0.35)',
    features: ['Everything in Basic', 'ML predictions & EV scoring', '100+ global sportsbooks', 'Emergency Hedge button', 'Priority email support'],
  },
  platinum: {
    name: 'Platinum', price: 99.99, color: '#8957e5', bg: 'rgba(137,87,229,0.08)',
    border: 'rgba(137,87,229,0.35)',
    features: ['Everything in Gold', 'API access', 'Sub-second alerts', 'Custom line alerts', 'Dedicated account manager'],
  },
}

function formatCard(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(val: string) {
  const clean = val.replace(/\D/g, '').slice(0, 4)
  return clean.length > 2 ? clean.slice(0, 2) + '/' + clean.slice(2) : clean
}

function CardPreview({ number, name, expiry, cvc, flipped }: any) {
  const display = (number || '').replace(/\D/g, '').padEnd(16, '·')
  const chunks  = [display.slice(0,4), display.slice(4,8), display.slice(8,12), display.slice(12,16)]

  return (
    <div style={{ perspective: 1000, width: 320, height: 190, margin: '0 auto 24px' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
            <Logo size="sm" linkTo="/" />
            <div style={{ width: 36, height: 26, background: 'linear-gradient(90deg, #f0a500, #ef4444)', borderRadius: 4, opacity: 0.9 }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 18, color: '#e6edf3', letterSpacing: 3, marginBottom: 20 }}>
            {chunks.join(' ')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '1px' }}>Card holder</div>
              <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{name || 'YOUR NAME'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '1px' }}>Expires</div>
              <div style={{ fontSize: 13, color: '#e6edf3', fontWeight: 600, fontFamily: 'monospace' }}>{expiry || 'MM/YY'}</div>
            </div>
          </div>
        </div>
        {}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ height: 44, background: '#111', margin: '28px 0 20px' }} />
          <div style={{ padding: '0 24px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '10px 14px', display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 16, color: '#e6edf3', letterSpacing: 3 }}>{cvc || '•••'}</span>
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.5 }}>
              Secured by Stripe · PCI DSS compliant · We never see your card details
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = ['Account', 'Choose Plan', 'Add Card']

export function SignupInner() {
  const { register } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [focusedField, setFocusedField] = useState('')
  const [referralCode, setReferralCode] = useState('')

  
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [searchParams])

  
  const [account, setAccount] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  
  const [plan, setPlan] = useState<'basic' | 'gold' | 'platinum'>('basic')
  
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvc: '' })

  
  const [activeStat, setActiveStat] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActiveStat(p => (p + 1) % STATS.length), 2200)
    return () => clearInterval(t)
  }, [])

  const validateAccount = () => {
    if (!account.name.trim()) return 'Name is required'
    if (!account.email.includes('@')) return 'Valid email required'
    if (!account.phone.trim()) return 'Phone number is required'
    const cleaned = account.phone.replace(/[\s\-\(\)]/g, '')
    if (!/^\+?[0-9]{7,15}$/.test(cleaned)) return 'Invalid phone number format'
    if (account.password.length < 6) return 'Password must be 6+ characters'
    if (account.password !== account.confirm) return 'Passwords do not match'
    return ''
  }

  const validateCard = () => {
    const num = card.number.replace(/\s/g, '')
    if (num.length < 16) return 'Card number must be 16 digits'
    if (!card.name.trim()) return 'Name on card required'
    if (card.expiry.length < 5) return 'Valid expiry required (MM/YY)'
    if (card.cvc.length < 3) return 'CVC required'
    return ''
  }

  const nextStep = () => {
    setError('')
    if (step === 0) {
      const err = validateAccount()
      if (err) { setError(err); return }
    }
    setStep(s => s + 1)
  }

  const submit = async () => {
    const err = validateCard()
    if (err) { setError(err); return }
    setLoading(true); setError('')

    try {
      
      await register(account.name, account.email, account.password, account.phone, referralCode || undefined)

      
      
      
      
      await api.post('/subscriptions/create-with-trial', {
        planId: plan,
        
        paymentMethodId: `pm_demo_${plan}_${Date.now()}`, 
      })

      router.push('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Something went wrong. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const inp = (focused: string): React.CSSProperties => ({
    width: '100%', background: 'var(--bg)',
    border: `1px solid ${focusedField === focused ? 'var(--green)' : 'var(--border2)'}`,
    borderRadius: 9, padding: '11px 14px', color: 'var(--text)',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  })

  const planInfo = PLAN_DATA[plan]
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes floatUp   { 0%{opacity:0;transform:translateY(20px)} 20%{opacity:1;transform:translateY(0)} 80%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-20px)} }
        @keyframes pulse     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes slideRight{ from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .stat-bubble { animation: floatUp 2.2s ease-in-out; }
        .step-content { animation: fadeInUp 0.35s ease; }
        @media (max-width: 768px) {
          .signup-split { grid-template-columns: 1fr !important; }
          .signup-left  { display: none !important; }
          .signup-right { padding: 16px !important; }
          .signup-name-row  { grid-template-columns: 1fr !important; }
          .signup-pass-row  { grid-template-columns: 1fr !important; }
          .signup-plan-row  { grid-template-columns: 1fr !important; }
          .signup-card-row  { grid-template-columns: 1fr !important; }
          .signup-step-wrap { padding: 20px 16px !important; border-radius: 12px !important; }
        }
        .plan-card:hover { transform: translateY(-3px); }
        .plan-card { transition: all 0.2s; }
      `}</style>

      {}
      <nav style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          <Logo size="md" linkTo="/" />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeToggle size="sm" />
          <span style={{ color: 'var(--dim)', fontSize: 13 }}>Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
          </span>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }} className="signup-split">

        {}
        <div style={{ background: 'linear-gradient(135deg, #080b12 0%, #0d1520 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          {}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,200,83,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

          {}
          <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 300, background: 'radial-gradient(ellipse, rgba(0,200,83,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {}
          <div key={activeStat} className="stat-bubble" style={{ position: 'absolute', top: '15%', right: '10%', background: 'rgba(13,17,23,0.9)', border: `1px solid ${STATS[activeStat].color}44`, borderRadius: 12, padding: '10px 16px', backdropFilter: 'blur(8px)', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{STATS[activeStat].icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: STATS[activeStat].color }}>{STATS[activeStat].label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{STATS[activeStat].sub}</div>
              </div>
            </div>
          </div>

          {}
          <div style={{ position: 'relative', textAlign: 'center', maxWidth: 380 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#00C853', fontWeight: 700, marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, background: '#00C853', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block' }} />
              7-day free trial · No charge today
            </div>

            <h1 style={{ fontSize: 38, fontWeight: 900, color: '#e6edf3', lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 16 }}>
              Start winning<br />
              <span style={{ background: 'linear-gradient(90deg, #00C853, #58a6ff)', backgroundSize: '200%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 3s linear infinite' }}>
                with data.
              </span>
            </h1>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.75, marginBottom: 32 }}>
              Join 10,000+ bettors using real-time arbitrage and +EV tools to build a consistent edge.
            </p>

            {}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { val: '$420', label: 'Avg monthly profit' },
                { val: '94%', label: 'Profitable month 1' },
                { val: '100+', label: 'Sportsbooks' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#00C853', marginBottom: 4 }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {}
            <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['🔒 256-bit SSL', '💳 Stripe Secured', '✓ Cancel anytime'].map(b => (
                <span key={b} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)' }}>{b}</span>
              ))}
            </div>
          </div>
        </div>

        {}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 48px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 440 }}>

            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: i < step ? 'var(--green)' : i === step ? 'rgba(0,200,83,0.15)' : 'var(--bg3)', color: i < step ? '#fff' : i === step ? 'var(--green)' : 'var(--dim)', border: i === step ? '2px solid var(--green)' : 'none', transition: 'all 0.3s' }}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--text)' : 'var(--dim)' }}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, margin: '0 8px', background: i < step ? 'var(--green)' : 'var(--border)', transition: 'background 0.3s', borderRadius: 2 }} />
                  )}
                </div>
              ))}
            </div>

            {}
            {error && (
              <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 9, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 18 }}>
                ⚠ {error}
              </div>
            )}

            {}
            {step === 0 && (
              <div className="step-content">
                <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>Create your account</h2>
                <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Free for 7 days. Card required for trial.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Full Name</label>
                    <input value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} placeholder="John Smith" style={inp('name')} onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField('')} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
                    <input type="email" value={account.email} onChange={e => setAccount({ ...account, email: e.target.value })} placeholder="you@example.com" style={inp('email')} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField('')} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Phone Number</label>
                  <input type="tel" value={account.phone} onChange={e => setAccount({ ...account, phone: e.target.value })} placeholder="+1 234 567 8900" style={inp('phone')} onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField('')} />
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>Used for account security only. Never shared.</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
                    <input type="password" value={account.password} onChange={e => setAccount({ ...account, password: e.target.value })} placeholder="6+ characters" style={inp('pass')} onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField('')} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Confirm</label>
                    <input type="password" value={account.confirm} onChange={e => setAccount({ ...account, confirm: e.target.value })} placeholder="Repeat password" style={inp('confirm')} onFocus={() => setFocusedField('confirm')} onBlur={() => setFocusedField('')} />
                  </div>
                </div>

                <button onClick={nextStep} style={{ width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,200,83,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                  Continue →
                </button>
              </div>
            )}

            {}
            {step === 1 && (
              <div className="step-content">
                <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>Choose your plan</h2>
                <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>7-day free trial. Cancel before it ends and pay nothing.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {(['basic', 'gold', 'platinum'] as const).map(p => {
                    const d = PLAN_DATA[p]
                    const selected = plan === p
                    return (
                      <div key={p} className="plan-card" onClick={() => setPlan(p)} style={{ background: selected ? d.bg : 'var(--bg3)', border: `2px solid ${selected ? d.border : 'var(--border)'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? d.color : 'var(--border)'}`, background: selected ? d.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                              {selected && <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />}
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 16 }}>{d.name}</span>
                            {p === 'gold' && <span style={{ background: 'rgba(240,165,0,0.12)', color: '#f0a500', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>POPULAR</span>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 24, fontWeight: 900 }}>${d.price}</span>
                            <span style={{ color: 'var(--muted)', fontSize: 13 }}>/mo</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {d.features.map(f => (
                            <span key={f} style={{ fontSize: 11, color: selected ? d.color : 'var(--muted)', background: selected ? `${d.color}11` : 'var(--bg4)', padding: '2px 8px', borderRadius: 20 }}>✓ {f}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  🎁 <strong style={{ color: 'var(--text)' }}>7-day free trial</strong> — Full {planInfo.name} access with no charge today. After {trialEnd}, you'll be billed <strong style={{ color: 'var(--text)' }}>${planInfo.price}/month</strong>. Cancel anytime.
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep(0)} style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                  <button onClick={nextStep} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,200,83,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                    Add Card →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Card Details ── */}
            {step === 2 && (
              <div className="step-content">
                <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4, letterSpacing: '-0.5px' }}>Add your card</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                  Secured by Stripe. You won't be charged until <strong style={{ color: 'var(--text)' }}>{trialEnd}</strong>.
                </p>

                {}
                <CardPreview number={card.number} name={card.name} expiry={card.expiry} cvc={card.cvc} flipped={cardFlipped} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Card Number</label>
                    <input
                      value={card.number}
                      onChange={e => setCard({ ...card, number: formatCard(e.target.value) })}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      style={{ ...inp('cardnum'), fontFamily: 'monospace', letterSpacing: 2 }}
                      onFocus={() => { setFocusedField('cardnum'); setCardFlipped(false) }}
                      onBlur={() => setFocusedField('')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Name on Card</label>
                    <input
                      value={card.name}
                      onChange={e => setCard({ ...card, name: e.target.value })}
                      placeholder="JOHN SMITH"
                      style={{ ...inp('cardname'), textTransform: 'uppercase' }}
                      onFocus={() => { setFocusedField('cardname'); setCardFlipped(false) }}
                      onBlur={() => setFocusedField('')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Expiry</label>
                      <input
                        value={card.expiry}
                        onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                        placeholder="MM/YY"
                        maxLength={5}
                        style={{ ...inp('expiry'), fontFamily: 'monospace', letterSpacing: 1 }}
                        onFocus={() => { setFocusedField('expiry'); setCardFlipped(false) }}
                        onBlur={() => setFocusedField('')}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>CVC</label>
                      <input
                        value={card.cvc}
                        onChange={e => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        placeholder="•••"
                        maxLength={4}
                        style={{ ...inp('cvc'), fontFamily: 'monospace', letterSpacing: 3 }}
                        onFocus={() => { setFocusedField('cvc'); setCardFlipped(true) }}
                        onBlur={() => { setFocusedField(''); setCardFlipped(false) }}
                      />
                    </div>
                  </div>
                </div>

                {}
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>📋 Billing Agreement (Mandate)</strong>
                  By clicking "Start Free Trial" you authorise TrueOdds to charge your card <strong style={{ color: 'var(--text)' }}>${planInfo.price}/month</strong> starting <strong style={{ color: 'var(--text)' }}>{trialEnd}</strong> until cancelled. No charge today. Cancel anytime at Settings → Billing.
                </div>

                {}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {['🔒 SSL Encrypted', '💳 Powered by Stripe', '🛡 PCI DSS Compliant'].map(b => (
                    <span key={b} style={{ fontSize: 11, color: 'var(--dim)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: 20 }}>{b}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                  <button onClick={submit} disabled={loading} style={{ flex: 2, background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'all 0.18s' }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,200,83,0.35)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                    {loading ? 'Activating...' : `🚀 Start Free Trial`}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:28, height:28, border:'3px solid rgba(0,200,83,0.2)', borderTopColor:'#00C853', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <SignupInner />
    </Suspense>
  )
}
