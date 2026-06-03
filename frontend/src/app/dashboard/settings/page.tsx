'use client'
import { useState } from 'react'
import { api, useAuth } from '@/lib/auth'
import Link from 'next/link'

type Tab = 'password' | 'email' | 'plan'

const PLAN_COLOR: Record<string,string> = { free:'var(--dim)', basic:'#00C853', gold:'#f0a500', platinum:'#8957e5' }
const PLAN_FEATURES: Record<string,string[]> = {
  free:     ['Basic access','Limited features'],
  basic:    ['Arbitrage finder','+EV tools','Email alerts','Unlimited devices'],
  gold:     ['Everything in Basic','ML predictions','Live odds','Emergency hedge','Priority support'],
  platinum: ['Everything in Gold','API access','1:1 coaching','Custom alerts','Account manager'],
}

function InputField({ label, type='text', value, onChange, placeholder, hint, error }: {
  label:string; type?:string; value:string; onChange:(v:string)=>void
  placeholder?:string; hint?:string; error?:string
}) {
  const [focused, setFocused] = useState(false)
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--muted)', marginBottom:6, textTransform:'uppercase' as const, letterSpacing:0.7 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width:'100%', background:'var(--bg)', border:`1.5px solid ${error?'#ef4444':focused?'var(--green)':'var(--border)'}`, borderRadius:10, padding:`11px ${isPassword?'44px':'14px'} 11px 14px`, fontSize:14, color:'var(--text)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const, transition:'border-color 0.2s, box-shadow 0.2s', boxShadow:focused&&!error?'0 0 0 3px rgba(0,200,83,0.1)':'none' }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)}
            style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--dim)', fontSize:16, padding:4, lineHeight:1 }}>
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <div style={{ fontSize:12, color:'#ef4444', marginTop:5, display:'flex', gap:5 }}><span>⚠</span>{error}</div>}
      {hint && !error && <div style={{ fontSize:11, color:'var(--dim)', marginTop:5 }}>{hint}</div>}
    </div>
  )
}

function Alert({ type, msg }: { type:'success'|'error'; msg:string }) {
  return (
    <div style={{ background:type==='success'?'rgba(0,200,83,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${type==='success'?'rgba(0,200,83,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:10, padding:'11px 14px', fontSize:13, color:type==='success'?'var(--green)':'#ef4444', marginBottom:18, display:'flex', alignItems:'center', gap:8, animation:'slideDown 0.3s ease' }}>
      <span>{type==='success'?'✅':'⚠️'}</span>{msg}
    </div>
  )
}

export default function SettingsPage() {
  const { user, refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('password')

  
  const [pw, setPw]   = useState({ current:'', newPw:'', confirm:'' })
  const [pwLoad, setPwLoad]   = useState(false)
  const [pwMsg, setPwMsg]     = useState<{type:'success'|'error';msg:string}|null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoad, setResetLoad] = useState(false)

  
  const [em, setEm]   = useState({ newEmail:'', password:'' })
  const [emLoad, setEmLoad]   = useState(false)
  const [emMsg, setEmMsg]     = useState<{type:'success'|'error';msg:string}|null>(null)

  const pwStrength = pw.newPw.length === 0 ? 0 : pw.newPw.length < 6 ? 1 : pw.newPw.length < 10 ? 2 : /[A-Z]/.test(pw.newPw) && /[0-9]/.test(pw.newPw) ? 4 : 3
  const strengthLabel = ['','Too short','Weak','Good','Strong']
  const strengthColor = ['','#ef4444','#f0a500','#3b82f6','var(--green)']

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null)
    if (pw.newPw.length < 6) { setPwMsg({ type:'error', msg:'New password must be at least 6 characters.' }); return }
    if (pw.newPw !== pw.confirm) { setPwMsg({ type:'error', msg:'Passwords do not match.' }); return }
    setPwLoad(true)
    try {
      await api.put('/auth/profile', { password: pw.newPw, currentPassword: pw.current })
      setPwMsg({ type:'success', msg:'Password updated successfully.' })
      setPw({ current:'', newPw:'', confirm:'' })
    } catch (err: any) {
      setPwMsg({ type:'error', msg: err.response?.data?.message || 'Failed to update password.' })
    } finally { setPwLoad(false) }
  }

  const sendResetLink = async () => {
    if (!user?.email) return
    setResetLoad(true)
    try {
      await api.post('/auth/forgot-password', { email: user.email })
      setResetSent(true)
    } catch { setResetSent(true) } 
    finally { setResetLoad(false) }
  }

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setEmMsg(null)
    if (!em.newEmail.includes('@')) { setEmMsg({ type:'error', msg:'Enter a valid email address.' }); return }
    if (!em.password) { setEmMsg({ type:'error', msg:'Current password is required.' }); return }
    setEmLoad(true)
    try {
      await api.post('/auth/change-email', { newEmail: em.newEmail, currentPassword: em.password })
      await refresh()
      setEmMsg({ type:'success', msg:'Email updated successfully.' })
      setEm({ newEmail:'', password:'' })
    } catch (err: any) {
      setEmMsg({ type:'error', msg: err.response?.data?.message || 'Failed to update email.' })
    } finally { setEmLoad(false) }
  }

  const planColor = PLAN_COLOR[user?.plan || 'free']

  return (
    <div style={{ padding:'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', maxWidth:640, margin:'0 auto' }}>
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .settings-tab { transition: all 0.2s; }
        .settings-tab:hover { background: var(--hover-bg) !important; }
        .save-btn { transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .save-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 4px 16px rgba(0,200,83,0.3); }
        .save-btn:active:not(:disabled) { transform: scale(0.98); }
      `}</style>

      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontWeight:900, fontSize:'clamp(20px,4vw,26px)', margin:'0 0 6px' }}>⚙️ Settings</h1>
        <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>Manage your account, password, and subscription.</p>
      </div>

      {}
      <div style={{ display:'flex', gap:6, marginBottom:24, background:'var(--bg3)', borderRadius:12, padding:4 }}>
        {([
          { id:'password', label:'🔒 Password', },
          { id:'email',    label:'✉️ Email' },
          { id:'plan',     label:'⭐ My Plan' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="settings-tab"
            style={{ flex:1, padding:'9px 8px', borderRadius:9, border:'none', background:tab===t.id?'var(--bg)':'transparent', color:tab===t.id?'var(--text)':'var(--muted)', fontSize:'clamp(12px,2vw,13px)', fontWeight:tab===t.id?700:500, cursor:'pointer', fontFamily:'inherit', boxShadow:tab===t.id?'0 1px 4px rgba(0,0,0,0.3)':'none', transition:'all 0.2s', WebkitTapHighlightColor:'transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {}
      {tab === 'password' && (
        <div style={{ animation:'slideDown 0.3s ease' }}>
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(18px,4vw,24px)', marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:18 }}>Change Password</div>
            {pwMsg && <Alert type={pwMsg.type} msg={pwMsg.msg} />}
            <form onSubmit={savePassword}>
              <InputField label="Current Password" type="password" value={pw.current} onChange={v => setPw({...pw, current:v})} placeholder="Enter current password" />
              <InputField label="New Password" type="password" value={pw.newPw} onChange={v => setPw({...pw, newPw:v})} placeholder="At least 6 characters"
                hint={pw.newPw ? `${strengthLabel[pwStrength]} password` : 'Min 6 characters'} />
              {}
              {pw.newPw && (
                <div style={{ display:'flex', gap:4, marginTop:-10, marginBottom:16 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ flex:1, height:3, borderRadius:3, background:i<=pwStrength?strengthColor[pwStrength]:'var(--border)', transition:'background 0.3s' }} />)}
                </div>
              )}
              <InputField label="Confirm New Password" type="password" value={pw.confirm} onChange={v => setPw({...pw, confirm:v})} placeholder="Repeat new password"
                error={pw.confirm && pw.confirm !== pw.newPw ? "Passwords don't match" : undefined} />
              <button type="submit" disabled={pwLoad} className="save-btn"
                style={{ width:'100%', background:'var(--green)', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:900, color:'#000', cursor:pwLoad?'not-allowed':'pointer', fontFamily:'inherit', opacity:pwLoad?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                {pwLoad ? <><span style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} />Saving...</> : '✓ Update Password'}
              </button>
            </form>
          </div>

          {}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(16px,4vw,22px)' }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>Forgot current password?</div>
            <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.6, margin:'0 0 14px' }}>
              We'll send a reset link to <strong style={{ color:'var(--text)' }}>{user?.email}</strong>. Click the link in the email to set a new password without needing your current one.
            </p>
            {resetSent ? (
              <div style={{ background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--green)', display:'flex', gap:8 }}>
                <span>📧</span> Reset link sent! Check your inbox (and spam folder).
              </div>
            ) : (
              <button onClick={sendResetLink} disabled={resetLoad}
                style={{ background:'transparent', border:'1.5px solid var(--border)', borderRadius:10, padding:'11px 20px', fontSize:13, fontWeight:700, color:'var(--text)', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', WebkitTapHighlightColor:'transparent' }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--green)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                {resetLoad ? 'Sending...' : '📧 Send Reset Link to My Email'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── EMAIL TAB ── */}
      {tab === 'email' && (
        <div style={{ animation:'slideDown 0.3s ease' }}>
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, padding:'clamp(18px,4vw,24px)' }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>Change Email Address</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:18 }}>
              Current: <strong style={{ color:'var(--text)' }}>{user?.email}</strong>
            </div>
            {emMsg && <Alert type={emMsg.type} msg={emMsg.msg} />}
            <form onSubmit={saveEmail}>
              <InputField label="New Email Address" type="email" value={em.newEmail} onChange={v => setEm({...em, newEmail:v})} placeholder="new@example.com" hint="This will be your new login email" />
              <InputField label="Current Password" type="password" value={em.password} onChange={v => setEm({...em, password:v})} placeholder="Confirm your identity" hint="Required to change your email" />
              <button type="submit" disabled={emLoad} className="save-btn"
                style={{ width:'100%', background:'var(--green)', border:'none', borderRadius:10, padding:'13px', fontSize:14, fontWeight:900, color:'#000', cursor:emLoad?'not-allowed':'pointer', fontFamily:'inherit', opacity:emLoad?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                {emLoad ? <><span style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} />Saving...</> : '✓ Update Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── PLAN TAB ── */}
      {tab === 'plan' && (
        <div style={{ animation:'slideDown 0.3s ease' }}>
          {/* Current plan card */}
          <div style={{ background:'var(--bg3)', border:`1.5px solid ${planColor}44`, borderRadius:16, padding:'clamp(16px,4vw,22px)', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap' as const, gap:10 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--dim)', textTransform:'uppercase' as const, letterSpacing:0.8, marginBottom:4 }}>Current Plan</div>
                <div style={{ fontSize:'clamp(22px,4vw,28px)', fontWeight:900, color:planColor, letterSpacing:'-0.5px', textTransform:'capitalize' as const }}>{user?.plan}</div>
              </div>
              <div style={{ background:`${planColor}18`, border:`1px solid ${planColor}33`, borderRadius:12, padding:'8px 16px', textAlign:'center' as const }}>
                <div style={{ fontSize:11, color:'var(--dim)', marginBottom:2 }}>Status</div>
                <div style={{ fontSize:13, fontWeight:800, color: user?.subscriptionStatus==='active'?'var(--green)':user?.subscriptionStatus==='trial'?'#3b82f6':'var(--muted)', textTransform:'capitalize' as const }}>{user?.subscriptionStatus || 'free'}</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:7 }}>
              {(PLAN_FEATURES[user?.plan || 'free'] || []).map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'var(--muted)' }}>
                  <span style={{ color:planColor, fontWeight:700, flexShrink:0 }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade CTA */}
          {user?.plan !== 'platinum' && (
            <Link href="/pricing"
              style={{ display:'block', background:'linear-gradient(135deg,rgba(0,200,83,0.12),rgba(0,200,83,0.06))', border:'1.5px solid rgba(0,200,83,0.3)', borderRadius:16, padding:'clamp(16px,4vw,22px)', textDecoration:'none', marginBottom:16, transition:'all 0.2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--green)';(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(0,200,83,0.3)';(e.currentTarget as HTMLElement).style.transform='translateY(0)'}}>
              <div style={{ fontWeight:900, fontSize:'clamp(15px,3vw,18px)', color:'var(--text)', marginBottom:6 }}>
                ⬆️ Upgrade Your Plan
              </div>
              <p style={{ color:'var(--muted)', fontSize:13, margin:'0 0 14px', lineHeight:1.6 }}>
                {user?.plan === 'free' ? 'Start your 7-day free trial. No charge until the trial ends.' : 'Unlock more features with a higher tier plan.'}
              </p>
              {/* Payment methods */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, marginBottom:16 }}>
                {[
                  { label:'💳 Card', sub:'Visa, Mastercard, Amex' },
                  { label:'🅿️ PayPal', sub:'Pay with PayPal' },
                  { label:' Apple Pay', sub:'Touch ID / Face ID' },
                  { label:'G Google Pay', sub:'One-tap checkout' },
                ].map(pm => (
                  <div key={pm.label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, padding:'7px 12px', fontSize:11, color:'var(--text)' }}>
                    <div style={{ fontWeight:700 }}>{pm.label}</div>
                    <div style={{ color:'var(--dim)', fontSize:10 }}>{pm.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--green)', color:'#000', borderRadius:10, padding:'12px', textAlign:'center' as const, fontWeight:900, fontSize:14 }}>
                View Plans & Pricing →
              </div>
            </Link>
          )}

          {/* Manage / cancel */}
          {user?.plan !== 'free' && (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'clamp(14px,3vw,18px)' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Manage Subscription</div>
              <p style={{ color:'var(--dim)', fontSize:12, lineHeight:1.6, margin:'0 0 12px' }}>
                To cancel or modify your subscription, email <strong style={{ color:'var(--text)' }}>support@trueodds.ca</strong> or manage directly through your Stripe billing portal.
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                <a href="mailto:support@trueodds.ca"
                  style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, color:'var(--text)', textDecoration:'none', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--green)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                  ✉️ Email Support
                </a>
                <Link href="/pricing"
                  style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, color:'var(--text)', textDecoration:'none', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--green)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                  📋 View All Plans
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
