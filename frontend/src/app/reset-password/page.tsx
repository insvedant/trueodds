'use client'
import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/auth'
import { ThemeToggle } from '@/lib/theme'

function ResetPasswordForm() {
  const params  = useSearchParams()
  const router  = useRouter()
  const token   = params?.get('token') || ''

  const [form, setForm]       = useState({ password:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  useEffect(() => {
    if (!token) setError('Invalid or missing reset link. Please request a new one.')
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: form.password })
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.')
    } finally { setLoading(false) }
  }

  const pw = form.password
  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 4 : 3
  const strengthLabel = ['','Too short','Weak','Good','Strong']
  const strengthColor = ['','#ef4444','#f0a500','#3b82f6','var(--green)']
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password

  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width:'100%', background:'var(--bg)', border:'1.5px solid var(--border)',
    borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:15,
    fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s',
    outline:'none', ...extra,
  })

  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(24px,5vw,48px) clamp(16px,5vw,24px)' }}>
      <div style={{ width:'100%', maxWidth:440, animation:'fadeUp 0.5s ease' }}>
        {success ? (
          
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:64, marginBottom:16, animation:'checkIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>✅</div>
            <h1 style={{ fontSize:'clamp(20px,4vw,24px)', fontWeight:900, marginBottom:10 }}>Password updated!</h1>
            <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,15px)', lineHeight:1.75, marginBottom:24 }}>
              Your password has been reset successfully.<br />
              Redirecting to login in 3 seconds...
            </p>
            <div style={{ height:4, background:'var(--bg3)', borderRadius:4, marginBottom:24, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--green)', borderRadius:4, animation:'progress 3s linear forwards' }} />
            </div>
            <Link href="/login" style={{ background:'var(--green)', color:'#000', textDecoration:'none', borderRadius:12, padding:'13px 32px', fontSize:15, fontWeight:900, display:'inline-block' }}>
              Log In Now →
            </Link>
          </div>
        ) : (
          
          <>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ fontSize:52, marginBottom:14, animation:'iconFloat 3s ease-in-out infinite', display:'inline-block' }}>🔒</div>
              <h1 style={{ fontSize:'clamp(20px,4vw,24px)', fontWeight:900, marginBottom:10 }}>Set new password</h1>
              <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,14px)' }}>Choose a strong password for your account.</p>
            </div>

            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(20px,4vw,28px)' }}>
              {error && (
                <div style={{ background:'rgba(248,81,73,0.08)', border:'1px solid rgba(248,81,73,0.25)', borderRadius:10, padding:'10px 14px', color:'var(--red)', fontSize:13, marginBottom:20, animation:'slideDown 0.3s ease' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom: error.includes('expired') ? 8 : 0 }}>
                    <span style={{ flexShrink:0 }}>⚠️</span>{error}
                  </div>
                  {(error.includes('expired') || error.includes('Invalid')) && (
                    <Link href="/forgot-password" style={{ color:'var(--green)', fontWeight:700, textDecoration:'none', fontSize:12, marginLeft:24 }}>
                      Request a new reset link →
                    </Link>
                  )}
                </div>
              )}

              {token && !error.includes('Invalid') && !error.includes('missing') && (
                <form onSubmit={submit}>
                  {}
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--muted)', marginBottom:7, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>
                    New Password
                  </label>
                  <div style={{ position:'relative', marginBottom: pw ? 8 : 20 }}>
                    <input
                      type={showPw ? 'text' : 'password'} required
                      value={form.password} onChange={e => setForm({ ...form, password:e.target.value })}
                      placeholder="At least 6 characters"
                      style={inp({ paddingRight:46 })}
                      onFocus={e=>(e.target.style.boxShadow='0 0 0 3px rgba(0,200,83,0.12)')}
                      onBlur={e=>(e.target.style.boxShadow='none')}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--dim)', fontSize:16, padding:4, lineHeight:1 }}>
                      {showPw ? '🙈' : '👁'}
                    </button>
                  </div>

                  {}
                  {pw && (
                    <div style={{ marginBottom:20 }}>
                      <div style={{ display:'flex', gap:4, marginBottom:5 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ flex:1, height:4, borderRadius:4, background: i<=strength ? strengthColor[strength] : 'var(--border)', transition:'background 0.3s' }} />
                        ))}
                      </div>
                      <div style={{ fontSize:11, color:strengthColor[strength], fontWeight:600 }}>{strengthLabel[strength]}</div>
                    </div>
                  )}

                  {}
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--muted)', marginBottom:7, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>
                    Confirm Password
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={form.confirm} onChange={e => setForm({ ...form, confirm:e.target.value })}
                    placeholder="Repeat new password"
                    style={inp({ marginBottom: mismatch ? 6 : 20, borderColor: mismatch ? '#ef4444' : 'var(--border)' })}
                    onFocus={e=>(e.target.style.boxShadow='0 0 0 3px rgba(0,200,83,0.12)')}
                    onBlur={e=>(e.target.style.boxShadow='none')}
                  />
                  {mismatch && (
                    <div style={{ fontSize:12, color:'#ef4444', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
                      <span>✗</span> Passwords don't match
                    </div>
                  )}
                  {!mismatch && form.confirm && form.confirm === form.password && (
                    <div style={{ fontSize:12, color:'var(--green)', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
                      <span>✓</span> Passwords match
                    </div>
                  )}

                  <button type="submit" disabled={loading || !token || mismatch}
                    style={{ width:'100%', background:'var(--green)', color:'#000', border:'none', borderRadius:12, padding:'13px', fontSize:15, fontWeight:900, cursor:loading?'wait':'pointer', fontFamily:'inherit', opacity:loading||mismatch?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.2s' }}>
                    {loading
                      ? <><span style={{ width:16, height:16, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> Resetting...</>
                      : 'Reset Password →'}
                  </button>
                </form>
              )}
            </div>

            <div style={{ textAlign:'center', marginTop:20 }}>
              <Link href="/login" style={{ color:'var(--green)', fontWeight:700, textDecoration:'none', fontSize:13 }}>← Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes iconFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes checkIn   { from{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.15)} to{opacity:1;transform:scale(1)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes progress  { from{width:0%} to{width:100%} }
      `}</style>

      {/* Nav */}
      <nav style={{ height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 clamp(16px,4vw,24px)', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <Link href="/" style={{ fontWeight:900, fontSize:18, color:'var(--text)', textDecoration:'none', letterSpacing:'-0.5px' }}>
          True<span style={{ color:'var(--green)' }}>Odds</span>
        </Link>
        <ThemeToggle size="sm" />
      </nav>

      <Suspense fallback={
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:12, color:'var(--dim)' }}>
          <span style={{ width:20, height:20, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }} />
          Loading...
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
