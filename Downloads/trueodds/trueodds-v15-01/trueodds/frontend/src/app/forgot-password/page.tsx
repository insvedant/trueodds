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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          True<span style={{ color: 'var(--green)' }}>Odds</span>
        </Link>
        <ThemeToggle size="sm" />
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Check your inbox</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>
                We've sent a password reset link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />
                The link expires in <strong style={{ color: 'var(--text)' }}>10 minutes</strong>.<br />
                Don't forget to check your spam folder.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { setSent(false); setEmail('') }} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 9, padding: '11px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Try a different email
                </button>
                <Link href="/login" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 9, padding: '11px', fontSize: 14, fontWeight: 800, display: 'block', textAlign: 'center' }}>
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Forgot your password?</h1>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>Enter your email and we'll send you a reset link.</p>
              </div>

              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
                {error && (
                  <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
                    ⚠ {error}
                  </div>
                )}
                <form onSubmit={submit}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Email Address</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input"
                    style={{ marginBottom: 18 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--green)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                  />
                  <button type="submit" disabled={loading} style={{ width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'all 0.18s' }}>
                    {loading ? 'Sending...' : 'Send Reset Link →'}
                  </button>
                </form>
              </div>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                Remember your password?{' '}
                <Link href="/login" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>Log in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
