'use client'
import { useState, useEffect, useRef } from 'react'
import { api, useAuth } from '@/lib/auth'
import Link from 'next/link'

type HedgeResult = {
  hedgeStake: number; hedgeOddsAmerican: number; hedgeOddsDecimal: number
  originalStake: number; originalOddsAmerican: number; originalPayout: number
  profitIfOriginalWins: number; profitIfHedgeWins: number
  guaranteedProfit: number; totalStaked: number; roi: number
  isProfitable: boolean; breakEvenHedgeStake: number
}

function AnimatedNumber({ value, prefix = '$', decimals = 2 }: { value: number; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    const start = display; const end = value; const duration = 600; const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(start + (end - start) * ease)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [value])
  const formatted = Math.abs(display).toFixed(decimals)
  return <>{value >= 0 ? `${prefix}${formatted}` : `-${prefix}${formatted}`}</>
}

const MODES = [
  { id: 'guarantee_profit' as const, label: '💰 Guarantee Profit', desc: 'Lock in equal profit either way' },
  { id: 'minimize_loss' as const,    label: '🛡 Minimize Loss',     desc: 'Cap downside at 50% of stake' },
  { id: 'break_even' as const,       label: '⚖️ Break Even',        desc: 'Recover your original stake' },
]

export default function HedgePage() {
  const { user } = useAuth()
  const [originalStake, setOriginalStake] = useState('')
  const [originalOdds, setOriginalOdds]   = useState('')
  const [hedgeOdds, setHedgeOdds]         = useState('')
  const [mode, setMode] = useState<'guarantee_profit'|'minimize_loss'|'break_even'>('guarantee_profit')
  const [result, setResult] = useState<HedgeResult | null>(null)
  const [prevResult, setPrevResult] = useState<HedgeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showResult, setShowResult] = useState(false)
  const isPaid = user?.plan === 'gold' || user?.plan === 'platinum'

  const fmt = (n: number) => n >= 0 ? `+$${Math.abs(n).toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`

  const calculate = async () => {
    setError('')
    if (!originalStake || !originalOdds || !hedgeOdds) { setError('Please fill in all three fields to calculate.'); return }
    setLoading(true); setShowResult(false)
    try {
      const res = await api.post('/hedge/calculate', { originalStake: parseFloat(originalStake), originalOdds: parseFloat(originalOdds), hedgeOdds: parseFloat(hedgeOdds), mode })
      setPrevResult(result)
      setResult(res.data.result)
      setTimeout(() => setShowResult(true), 50)
    } catch (err: any) { setError(err.response?.data?.message || 'Calculation failed.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', maxWidth: 780, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
        @keyframes resultIn { from{opacity:0;transform:scale(0.96) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes shimmerSlide { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes countUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .mode-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .mode-btn:hover { transform: translateY(-2px); }
        .mode-btn.active { transform: translateY(-2px); }

        .input-field { transition: border-color 0.2s, box-shadow 0.2s; }
        .input-field:focus { border-color: var(--green) !important; box-shadow: 0 0 0 3px rgba(0,200,83,0.12) !important; outline: none; }

        .calc-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .calc-btn:hover:not(:disabled) { transform: scale(1.02) translateY(-1px); box-shadow: 0 8px 24px rgba(239,68,68,0.4); }
        .calc-btn:active:not(:disabled) { transform: scale(0.98); }

        .outcome-card { transition: transform 0.2s, box-shadow 0.2s; }
        .outcome-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

        @media (max-width: 640px) {
          .mode-row { flex-direction: column !important; }
          .inputs-grid { grid-template-columns: 1fr !important; }
          .outcomes-grid { grid-template-columns: 1fr 1fr !important; }
          .hedge-stake-num { font-size: 40px !important; }
        }
        @media (max-width: 380px) {
          .outcomes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {}
      <div style={{ marginBottom: 28, animation: 'slideUp 0.5s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' as const }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, animation: 'float 3s ease-in-out infinite', flexShrink: 0 }}>🚨</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
              <h1 style={{ fontWeight: 900, fontSize: 'clamp(20px,4vw,26px)', margin: 0, letterSpacing: '-0.5px' }}>Emergency Hedge</h1>
              <span style={{ background: 'rgba(240,165,0,0.1)', color: '#f0a500', fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(240,165,0,0.25)', letterSpacing: 0.5 }}>GOLD+</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '2px 0 0' }}>Lock in guaranteed profit before the game ends.</p>
          </div>
        </div>
      </div>

      {!isPaid ? (
        <div style={{ background: 'rgba(240,165,0,0.04)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: 20, padding: 'clamp(28px,6vw,48px)', textAlign: 'center', animation: 'slideUp 0.5s ease 0.1s both' }}>
          <div style={{ fontSize: 52, marginBottom: 14, animation: 'float 3s ease-in-out infinite' }}>🔒</div>
          <div style={{ fontWeight: 900, fontSize: 'clamp(18px,3vw,22px)', marginBottom: 10 }}>Gold Plan Required</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28, maxWidth: 340, margin: '0 auto 28px' }}>The Emergency Hedge tool is available on Gold and Platinum plans. Upgrade to unlock it.</p>
          <Link href="/pricing" style={{ background: '#f0a500', color: '#000', borderRadius: 12, padding: '13px 32px', fontWeight: 900, fontSize: 14, textDecoration: 'none', display: 'inline-block', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='scale(1.05)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(240,165,0,0.4)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow='none' }}>
            Upgrade to Gold →
          </Link>
        </div>
      ) : (
        <>
          {}
          <div className="mode-row" style={{ display: 'flex', gap: 10, marginBottom: 24, animation: 'slideUp 0.5s ease 0.1s both' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`mode-btn${mode === m.id ? ' active' : ''}`}
                style={{ flex: 1, background: mode === m.id ? 'rgba(0,200,83,0.1)' : 'var(--bg3)', border: `1.5px solid ${mode === m.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: 'clamp(10px,2vw,12px) clamp(10px,2vw,14px)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, minWidth: 0 }}>
                <div style={{ fontSize: 'clamp(12px,2vw,13px)', fontWeight: 800, color: mode === m.id ? 'var(--green)' : 'var(--text)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.3 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 18, padding: 'clamp(18px,4vw,26px)', marginBottom: 20, animation: 'slideUp 0.5s ease 0.2s both' }}>
            <div className="inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
              {[
                { label: 'Your Original Stake ($)', val: originalStake, set: setOriginalStake, ph: 'e.g. 500', hint: 'Amount already wagered' },
                { label: 'Original Bet Odds', val: originalOdds, set: setOriginalOdds, ph: 'e.g. -110 or +200', hint: 'American odds of your original bet' },
                { label: 'Hedge Odds (other side)', val: hedgeOdds, set: setHedgeOdds, ph: 'e.g. +180', hint: 'Best available opposing odds' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--muted)', marginBottom: 7, textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>{f.label}</label>
                  <input
                    className="input-field"
                    type="number"
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && calculate()}
                    placeholder={f.ph}
                    style={{ width: '100%', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 14px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>{f.hint}</div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#ef4444', marginTop: 18, animation: 'slideUp 0.3s ease' }}>
                ⚠️ {error}
              </div>
            )}

            <button onClick={calculate} disabled={loading}
              className="calc-btn"
              style={{ marginTop: 20, background: loading ? 'rgba(239,68,68,0.5)' : '#ef4444', border: 'none', borderRadius: 12, padding: '14px clamp(20px,4vw,32px)', fontSize: 15, fontWeight: 900, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10, animation: loading ? 'none' : 'pulseGlow 2s ease-in-out infinite' }}>
              {loading
                ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Calculating...</>
                : '🚨 Calculate Emergency Hedge'}
            </button>
          </div>

          {}
          {result && showResult && (
            <div style={{ background: result.isProfitable ? 'rgba(0,200,83,0.05)' : 'rgba(249,168,37,0.05)', border: `1.5px solid ${result.isProfitable ? 'rgba(0,200,83,0.25)' : 'rgba(249,168,37,0.25)'}`, borderRadius: 20, padding: 'clamp(18px,4vw,28px)', animation: 'resultIn 0.5s cubic-bezier(0.16,1,0.3,1)' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 28 }}>{result.isProfitable ? '✅' : '⚠️'}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 'clamp(16px,3vw,20px)', color: result.isProfitable ? 'var(--green)' : '#f0a500' }}>
                    {result.isProfitable
                      ? <>Guaranteed Profit: <AnimatedNumber value={result.guaranteedProfit} /></>
                      : <>Minimized Loss: <AnimatedNumber value={Math.abs(result.guaranteedProfit)} /></>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3 }}>
                    ROI: {result.roi.toFixed(2)}% on <AnimatedNumber value={result.totalStaked} /> total staked
                  </div>
                </div>
              </div>

              {}
              <div style={{ background: 'var(--bg)', border: '2px solid var(--border)', borderRadius: 16, padding: 'clamp(18px,4vw,28px)', marginBottom: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,200,83,0.03) 0%, transparent 50%, rgba(0,200,83,0.03) 100%)', pointerEvents: 'none' }} />
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 8 }}>Stake This on the Opposite Outcome</div>
                <div className="hedge-stake-num" style={{ fontSize: 'clamp(40px,8vw,58px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-2px', lineHeight: 1, animation: 'countUp 0.4s ease' }}>
                  $<AnimatedNumber value={result.hedgeStake} prefix="" />
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                  at odds {result.hedgeOddsAmerican >= 0 ? '+' : ''}{result.hedgeOddsAmerican}
                </div>
              </div>

              {}
              <div className="outcomes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                {[
                  { icon: '🏆', label: 'If Original Bet Wins', profit: result.profitIfOriginalWins },
                  { icon: '🛡', label: 'If Hedge Wins', profit: result.profitIfHedgeWins },
                ].map((o, i) => (
                  <div key={o.label} className="outcome-card" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 'clamp(14px,3vw,18px)', textAlign: 'center', animation: `countUp 0.4s ease ${i * 100}ms both` }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{o.icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>{o.label}</div>
                    <div style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 900, color: o.profit >= 0 ? 'var(--green)' : '#ef4444' }}>
                      <AnimatedNumber value={o.profit} prefix={o.profit >= 0 ? '+$' : ''} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'var(--dim)', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                Break-even hedge: <strong style={{ color: 'var(--text)' }}>${result.breakEvenHedgeStake.toFixed(2)}</strong> recovers your original ${result.originalStake.toFixed(2)} stake exactly.
              </div>
            </div>
          )}

          {}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 'clamp(16px,3vw,22px)', marginTop: 20, animation: 'slideUp 0.5s ease 0.4s both' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>📖 How Emergency Hedging Works</div>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.75, margin: 0 }}>
              Your bet is in a favorable position but you want to guarantee the profit rather than risk the swing. By placing a bet on the opposing outcome at current live odds, you lock in a return regardless of result. This calculator finds the exact stake for your chosen strategy.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
