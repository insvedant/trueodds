'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/auth'
import { ThemeToggle } from '@/lib/theme'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Enter a valid email address.'); return }
    setError(''); setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes iconFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes checkIn    { from{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.15)} to{opacity:1;transform:scale(1)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .forgot-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .forgot-input:focus { border-color: var(--green) !important; box-shadow: 0 0 0 3px rgba(0,200,83,0.12) !important; outline: none; }
        .submit-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .submit-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 6px 20px rgba(0,200,83,0.3); }
        .submit-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      {}
      <nav style={{ height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 clamp(16px,4vw,24px)', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        <Link href="/" style={{ fontWeight:900, fontSize:18, color:'var(--text)', textDecoration:'none', letterSpacing:'-0.5px' }}>
          True<span style={{ color:'var(--green)' }}>Odds</span>
        </Link>
        <ThemeToggle size="sm" />
      </nav>

      {}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'clamp(24px,5vw,48px) clamp(16px,5vw,24px)' }}>
        <div style={{ width:'100%', maxWidth:420, animation:'fadeUp 0.5s ease' }}>

          {sent ? (
            
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:64, marginBottom:16, animation:'checkIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>📧</div>
              <h1 style={{ fontSize:'clamp(20px,4vw,24px)', fontWeight:900, marginBottom:10 }}>Check your inbox</h1>
              <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,15px)', lineHeight:1.75, marginBottom:28 }}>
                We sent a password reset link to{' '}
                <strong style={{ color:'var(--text)' }}>{email}</strong>.<br />
                The link expires in <strong style={{ color:'var(--text)' }}>10 minutes</strong>.<br />
                Don't forget to check your spam folder.
              </p>
              <div style={{ background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:12, padding:'14px 18px', marginBottom:24, fontSize:13, color:'var(--muted)', textAlign:'left', lineHeight:1.7 }}>
                <strong style={{ color:'var(--green)' }}>Tip:</strong> The email comes from <strong>support@trueodds.ca</strong>. If you don't see it in 2 minutes, check spam.
              </div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
                <button onClick={() => { setSent(false); setEmail('') }}
                  style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:'12px', fontSize:14, cursor:'pointer', fontFamily:'inherit', transition:'background 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--hover-bg)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='var(--bg3)')}>
                  Try a different email
                </button>
                <Link href="/login" style={{ background:'var(--green)', color:'#000', textDecoration:'none', borderRadius:12, padding:'12px', fontSize:14, fontWeight:900, display:'block', textAlign:'center', transition:'filter 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.filter='brightness(1.1)')}
                  onMouseLeave={e=>(e.currentTarget.style.filter='brightness(1)')}>
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            
            <>
              <div style={{ textAlign:'center', marginBottom:32 }}>
                <div style={{ fontSize:52, marginBottom:14, animation:'iconFloat 3s ease-in-out infinite', display:'inline-block' }}>🔑</div>
                <h1 style={{ fontSize:'clamp(20px,4vw,24px)', fontWeight:900, marginBottom:10 }}>Forgot your password?</h1>
                <p style={{ color:'var(--muted)', fontSize:'clamp(13px,2vw,14px)', lineHeight:1.6 }}>
                  No worries. Enter your email and we'll send you a reset link instantly.
                </p>
              </div>

              <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(20px,4vw,28px)' }}>
                {error && (
                  <div style={{ background:'rgba(248,81,73,0.08)', border:'1px solid rgba(248,81,73,0.25)', borderRadius:10, padding:'10px 14px', color:'var(--red)', fontSize:13, marginBottom:18, display:'flex', alignItems:'flex-start', gap:8, animation:'slideDown 0.3s ease' }}>
                    <span style={{ flexShrink:0 }}>⚠️</span>{error}
                  </div>
                )}

                <form onSubmit={submit}>
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--muted)', marginBottom:7, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>
                    Email Address
                  </label>
                  <input
                    className="forgot-input"
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:15, fontFamily:'inherit', boxSizing:'border-box' as const, marginBottom:20 }}
                  />
                  <button type="submit" disabled={loading} className="submit-btn"
                    style={{ width:'100%', background:'var(--green)', color:'#000', border:'none', borderRadius:12, padding:'13px', fontSize:15, fontWeight:900, cursor:loading?'wait':'pointer', fontFamily:'inherit', opacity:loading?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                    {loading ? (
                      <><span style={{ width:16, height:16, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> Sending...</>
                    ) : 'Send Reset Link →'}
                  </button>
                </form>
              </div>

              <div style={{ textAlign:'center', marginTop:20 }}>
                <span style={{ color:'var(--dim)', fontSize:13 }}>Remember your password? </span>
                <Link href="/login" style={{ color:'var(--green)', fontWeight:700, textDecoration:'none', fontSize:13 }}>Log in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
