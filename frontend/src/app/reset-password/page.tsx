'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/auth'
import { ThemeToggle } from '@/lib/theme'

export default function ResetPasswordPage() {
  const params  = useSearchParams()
  const router  = useRouter()
  const token   = params?.get('token') || ''

  const [form, setForm]       = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [show, setShow]       = useState(false)

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.')
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setError(''); setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: form.password })
      setSuccess(true)
      // Auto-redirect to login after 3 seconds
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.')
    } finally { setLoading(false) }
  }

  // Password strength indicator
  const pw  = form.password
  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 4 : 3
  const strengthLabel = ['', 'Too short', 'Weak', 'Good', 'Strong']
  const strengthColor = ['', 'var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)']

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 9, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s', marginBottom: 14 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          True<span style={{ color: 'var(--green)' }}>Odds</span>
        </Link>
        <ThemeToggle size="sm" />
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Password reset!</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.75 }}>
                Your password has been updated successfully.<br />
                Redirecting to login in 3 seconds...
              </p>
              <Link href="/login" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 14, fontWeight: 800, display: 'inline-block' }}>
                Log In Now →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Set new password</h1>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>Choose a strong password for your account.</p>
              </div>

              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
                {error && (
                  <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 18 }}>
                    ⚠ {error}
                    {error.includes('expired') && (
                      <div style={{ marginTop: 8 }}>
                        <Link href="/forgot-password" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                          Request a new reset link →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {token && !error.includes('Invalid') && (
                  <form onSubmit={submit}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>New Password</label>
                    <div style={{ position: 'relative', marginBottom: 4 }}>
                      <input
                        type={show ? 'text' : 'password'} required
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="At least 6 characters"
                        style={{ ...inp, marginBottom: 0, paddingRight: 40 }}
                        onFocus={e => (e.target.style.borderColor = 'var(--green)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
                      />
                      <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 14 }}>
                        {show ? '🙈' : '👁'}
                      </button>
                    </div>

                    {/* Password strength bar */}
                    {form.password && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                          {[1,2,3,4].map(i => (
                            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColor[strength] : 'var(--border)' }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: strengthColor[strength] }}>{strengthLabel[strength]}</div>
                      </div>
                    )}

                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Confirm Password</label>
                    <input
                      type={show ? 'text' : 'password'} required
                      value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                      placeholder="Repeat new password"
                      style={{ ...inp, borderColor: form.confirm && form.confirm !== form.password ? 'var(--red)' : 'var(--border2)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--green)')}
                      onBlur={e => (e.target.style.borderColor = form.confirm && form.confirm !== form.password ? 'var(--red)' : 'var(--border2)')}
                    />
                    {form.confirm && form.confirm !== form.password && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginTop: -10, marginBottom: 14 }}>Passwords don't match</div>
                    )}

                    <button type="submit" disabled={loading || !token} style={{ width: '100%', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'all 0.18s' }}>
                      {loading ? 'Resetting...' : 'Reset Password →'}
                    </button>
                  </form>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                <Link href="/login" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>← Back to Login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
