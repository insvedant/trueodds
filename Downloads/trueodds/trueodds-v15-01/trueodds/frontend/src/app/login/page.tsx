'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ThemeToggle } from '@/lib/theme'

const LIVE_BETS = [
  { sport:'🏒', game:'Wild vs Avalanche',   profit:'+3.2%', books:'DK / FD',  type:'ARB',  color:'#00C853' },
  { sport:'🎾', game:'Djokovic vs Alcaraz', profit:'+2.7%', books:'PIN / MGM', type:'ARB',  color:'#00C853' },
  { sport:'🏈', game:'Chiefs vs Ravens',    profit:'+14.3%',books:'1X',        type:'+EV',  color:'#58a6ff' },
  { sport:'⚽', game:'Man City vs Arsenal', profit:'+1.5%', books:'B3 / FD',   type:'ARB',  color:'#00C853' },
  { sport:'🥊', game:'Jones vs Miocic',     profit:'+3.8%', books:'DK / B3',   type:'ARB',  color:'#00C853' },
  { sport:'🏀', game:'Lakers vs Celtics',   profit:'+9.2%', books:'FD',        type:'+EV',  color:'#58a6ff' },
  { sport:'⚾', game:'Yankees vs Red Sox',  profit:'+1.2%', books:'FD / CZ',   type:'ARB',  color:'#00C853' },
]

const WINS = ['+$127', '+$84', '+$243', '+$56', '+$188', '+$312', '+$67', '+$95']

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState('')
  const [ticker, setTicker]   = useState(0)
  const [winIdx, setWinIdx]   = useState(0)
  const [showWin, setShowWin] = useState(true)

  // Rotate ticker
  useEffect(() => {
    const t = setInterval(() => setTicker(p => (p + 1) % LIVE_BETS.length), 3000)
    return () => clearInterval(t)
  }, [])

  // Animate win notifications
  useEffect(() => {
    const t = setInterval(() => {
      setShowWin(false)
      setTimeout(() => { setWinIdx(p => (p + 1) % WINS.length); setShowWin(true) }, 300)
    }, 2500)
    return () => clearInterval(t)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.email, form.password); router.push('/dashboard') }
    catch (err: any) { setError(err.response?.data?.message || 'Invalid email or password') }
    finally { setLoading(false) }
  }

  const current = LIVE_BETS[ticker]

  const inp = (f: string): React.CSSProperties => ({
    width: '100%', background: 'var(--bg)',
    border: `1px solid ${focused === f ? 'var(--green)' : 'var(--border2)'}`,
    borderRadius: 9, padding: '12px 14px', color: 'var(--text)',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes winPop   { from{opacity:0;transform:translateY(8px) scale(0.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scanline { 0%{top:0%} 100%{top:100%} }
        @keyframes blink2   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeInRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        .win-badge { animation: winPop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .ticker-row { animation: fadeInRight 0.4s ease; }
      `}</style>

      {/* Nav */}
      <nav style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          True<span style={{ color: 'var(--green)' }}>Odds</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ThemeToggle size="sm" />
          <span style={{ color: 'var(--dim)', fontSize: 13 }}>
            No account?{' '}
            <Link href="/signup" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Start free trial →</Link>
          </span>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* ── LEFT — animated betting panel ── */}
        <div style={{ background: 'linear-gradient(160deg, #080b12 0%, #0a1628 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48, borderRight: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          {/* Grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,200,83,0.03) 1px, transparent 1px),linear-gradient(90deg,rgba(0,200,83,0.03) 1px,transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />

          {/* Glow */}
          <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: 320, height: 320, background: 'radial-gradient(circle, rgba(88,166,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            {/* Live badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#00C853', fontWeight: 700, marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, background: '#00C853', borderRadius: '50%', animation: 'blink2 1.2s ease-in-out infinite', display: 'inline-block' }} />
              LIVE · {LIVE_BETS.length} opportunities now
            </div>

            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#e6edf3', lineHeight: 1.12, letterSpacing: '-1.5px', marginBottom: 10 }}>
              Welcome back.<br />
              <span style={{ color: '#00C853' }}>Let's find your edge.</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 32 }}>Real-time arbs and +EV bets updating every second.</p>

            {/* Live opportunity card */}
            <div key={ticker} className="ticker-row" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{current.sport}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>{current.game}</span>
                </div>
                <span style={{ background: current.type === 'ARB' ? 'rgba(0,200,83,0.15)' : 'rgba(88,166,255,0.15)', color: current.color, fontSize: 10, fontWeight: 900, padding: '3px 9px', borderRadius: 20 }}>{current.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Books: {current.books}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: current.color }}>{current.profit}</span>
              </div>
            </div>

            {/* Win notification */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Member just won</div>
                {showWin && (
                  <div className="win-badge" style={{ fontSize: 20, fontWeight: 900, color: '#00C853' }}>{WINS[winIdx]}</div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>just now</div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { val: '$420', label: 'Avg/month', color: '#00C853' },
                { val: '71%', label: 'Win rate', color: '#58a6ff' },
                { val: '8', label: 'Live arbs', color: '#f0a500' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color, marginBottom: 3 }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,200,83,0.1)', border: '2px solid rgba(0,200,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>📈</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.5px' }}>Welcome back</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Log in to your TrueOdds account</p>
            </div>

            {error && (
              <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 9, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 18 }}>⚠ {error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" style={inp('email')} onFocus={() => setFocused('email')} onBlur={() => setFocused('')} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
                <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={inp('pass')} onFocus={() => setFocused('pass')} onBlur={() => setFocused('')} />
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <Link href="/forgot-password" style={{ color: 'var(--dim)', fontSize: 12, textDecoration: 'none' }}>Forgot password?</Link>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'all 0.18s', marginBottom: 16 }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,200,83,0.35)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
                {loading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              No account?{' '}
              <Link href="/signup" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Start 7-day free trial →</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
