'use client'
import { useState, useEffect } from 'react'
import { useAuth, api } from '@/lib/auth'

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, padding:'10px 12px', fontSize:13, color:'var(--text)',
  fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none',
  transition:'border-color 0.2s, box-shadow 0.2s',
}
const lbl: React.CSSProperties = {
  display:'block', fontSize:11, fontWeight:700, color:'var(--muted)',
  marginBottom:6, textTransform:'uppercase' as const, letterSpacing:0.6,
}
const card: React.CSSProperties = {
  background:'var(--bg3)', border:'1px solid var(--border)',
  borderRadius:12, padding:'clamp(16px,3vw,24px)', marginBottom:16,
}

function StatusBadge({ status }: { status: string }) {
  const ok    = status === 'configured' || status === 'set'
  const color = ok ? '#00C853' : '#ef4444'
  const bg    = ok ? 'rgba(0,200,83,0.1)' : 'rgba(239,68,68,0.1)'
  return (
    <span style={{ background:bg, color, fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>
      {ok ? '✓ Active' : '✗ Missing'}
    </span>
  )
}

function Alert({ type, msg }: { type:'success'|'error'; msg:string }) {
  return (
    <div style={{ background:type==='success'?'rgba(0,200,83,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${type==='success'?'rgba(0,200,83,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:8, padding:'9px 14px', color:type==='success'?'var(--green)':'#ef4444', fontSize:13, marginBottom:14 }}>
      {type==='success'?'✓ ':'⚠️ '}{msg}
    </div>
  )
}

export default function AdminSettingsPage() {
  const { user, refresh } = useAuth()

  const [profile, setProfile] = useState({ name: user?.name || '', currentPassword:'', password:'', confirm:'' })
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [social, setSocial]         = useState({ instagram:'', twitter:'', discord:'', facebook:'' })
  const [socialMsg, setSocialMsg]   = useState('')
  const [socialErr, setSocialErr]   = useState('')
  const [savingSocial, setSavingSocial] = useState(false)

  const [health, setHealth] = useState<any>(null)
  const [quota,  setQuota]  = useState<any>(null)

  useEffect(() => {
    api.get('/quota').then(r => setQuota(r.data.quota)).catch(() => {})
    api.get('/settings').then(r => {
      const s = r.data.settings || {}
      setSocial({ instagram: s.instagram||'', twitter: s.twitter||'', discord: s.discord||'', facebook: s.facebook||'' })
    }).catch(() => {})
    fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api','')||'https://trueodds.onrender.com'}/health`)
      .then(r => r.json()).then(setHealth).catch(() => {})
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setProfileMsg(''); setProfileErr('')
    if (profile.password && profile.password !== profile.confirm) { setProfileErr('Passwords do not match.'); return }
    if (profile.password && !profile.currentPassword) { setProfileErr('Current password required.'); return }
    if (profile.password && profile.password.length < 6) { setProfileErr('Min 6 characters.'); return }
    setSavingProfile(true)
    try {
      const payload: any = { name: profile.name }
      if (profile.password) { payload.password = profile.password; payload.currentPassword = profile.currentPassword }
      await api.put('/auth/profile', payload)
      await refresh()
      setProfileMsg('Profile updated.')
      setProfile(p => ({ ...p, currentPassword:'', password:'', confirm:'' }))
    } catch (e: any) { setProfileErr(e.response?.data?.message || 'Failed.') }
    finally { setSavingProfile(false) }
  }

  const saveSocial = async (e: React.FormEvent) => {
    e.preventDefault(); setSocialMsg(''); setSocialErr('')
    setSavingSocial(true)
    try {
      await api.put('/settings', social)
      setSocialMsg('Social links saved.')
      setTimeout(() => setSocialMsg(''), 3000)
    } catch (e: any) { setSocialErr(e.response?.data?.message || 'Failed.') }
    finally { setSavingSocial(false) }
  }

  const integrations = [
    {
      icon:'💳', name:'Stripe',
      items:[
        { label:'Secret Key',       status: health?.stripe    || 'checking' },
        { label:'Basic Price',      status: health?.stripeBasic    || 'checking' },
        { label:'Gold Price',       status: health?.stripeGold     || 'checking' },
        { label:'Platinum Price',   status: health?.stripePlatinum || 'checking' },
      ],
    },
    {
      icon:'📧', name:'Zoho Mail',
      items:[
        { label:'ZOHO_USER + ZOHO_PASSWORD', status: health?.zoho || 'checking' },
      ],
    },
    {
      icon:'📱', name:'Telegram Bot',
      items:[
        { label:'BOT_TOKEN + CHAT_ID', status: health?.telegram || 'checking' },
      ],
    },
    {
      icon:'📊', name:'TheOddsAPI',
      items:[
        { label: quota ? `${quota.remaining?.toLocaleString() || '?'} requests remaining` : 'Checking...', status: quota?.oddsApiConfigured ? 'configured' : 'missing' },
      ],
    },
  ]

  return (
    <div style={{ padding:'clamp(16px,4vw,24px)', maxWidth:700 }}>
      <style>{`
        .set-inp:focus { border-color:var(--green)!important; box-shadow:0 0 0 3px rgba(0,200,83,0.1)!important; }
        .save-btn { transition:all 0.2s; }
        .save-btn:hover:not(:disabled) { opacity:0.88; transform:scale(1.02); }
        @media (max-width:520px) {
          .social-grid { grid-template-columns:1fr!important; }
          .integ-row { flex-wrap:wrap!important; }
        }
      `}</style>

      <h1 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:24 }}>⚙️ Admin Settings</h1>

      {/* 1. Admin Profile — first */}
      <div style={card}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:18 }}>👤 Admin Profile</div>
        {profileErr && <Alert type="error"   msg={profileErr} />}
        {profileMsg && <Alert type="success" msg={profileMsg} />}
        <form onSubmit={saveProfile}>
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Display Name</label>
            <input className="set-inp" style={inp} value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name:e.target.value }))} placeholder="Admin name" />
          </div>
          <div style={{ height:1, background:'var(--border)', margin:'14px 0' }} />
          <div style={{ fontWeight:700, fontSize:12, color:'var(--muted)', marginBottom:12, textTransform:'uppercase' as const, letterSpacing:0.6 }}>Change Password</div>
          {[
            { key:'currentPassword', label:'Current Password', ph:'Required to change' },
            { key:'password',        label:'New Password',     ph:'Min 6 characters' },
            { key:'confirm',         label:'Confirm Password', ph:'Repeat new password' },
          ].map(({ key, label, ph }) => (
            <div key={key} style={{ marginBottom:12 }}>
              <label style={lbl}>{label}</label>
              <input className="set-inp" type="password" style={inp}
                value={profile[key as keyof typeof profile]}
                onChange={e => setProfile(p => ({ ...p, [key]:e.target.value }))}
                placeholder={ph} />
            </div>
          ))}
          <button type="submit" disabled={savingProfile} className="save-btn"
            style={{ background:'var(--green)', border:'none', borderRadius:9, padding:'10px 22px', fontSize:13, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit', opacity:savingProfile?0.7:1 }}>
            {savingProfile ? 'Saving...' : '💾 Save Profile'}
          </button>
        </form>
      </div>

      {/* 2. Social Media Links */}
      <div style={card}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>🌐 Social Media Links</div>
        <p style={{ color:'var(--dim)', fontSize:13, marginBottom:20, margin:'0 0 18px' }}>
          These appear as clickable cards on the Contact page. Leave blank to hide.
        </p>
        {socialErr && <Alert type="error"   msg={socialErr} />}
        {socialMsg && <Alert type="success" msg={socialMsg} />}
        <form onSubmit={saveSocial}>
          <div className="social-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
            {[
              { key:'instagram', icon:'📸', label:'Instagram URL',      ph:'https://instagram.com/trueodds' },
              { key:'twitter',   icon:'🐦', label:'Twitter / X URL',    ph:'https://twitter.com/TrueOddsApp' },
              { key:'facebook',  icon:'👥', label:'Facebook Page URL',  ph:'https://facebook.com/trueodds' },
              { key:'discord',   icon:'💬', label:'Discord Invite Link', ph:'https://discord.gg/trueodds' },
            ].map(({ key, icon, label, ph }) => (
              <div key={key}>
                <label style={lbl}>{icon} {label}</label>
                <div style={{ position:'relative' }}>
                  <input className="set-inp" type="url"
                    value={social[key as keyof typeof social]}
                    onChange={e => setSocial(s => ({ ...s, [key]:e.target.value }))}
                    placeholder={ph}
                    style={{ ...inp, paddingLeft:36 }} />
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:15, pointerEvents:'none' }}>{icon}</span>
                </div>
                {social[key as keyof typeof social] && (
                  <a href={social[key as keyof typeof social]} target="_blank" rel="noreferrer"
                    style={{ fontSize:11, color:'var(--green)', marginTop:4, display:'inline-block', textDecoration:'none' }}>
                    ↗ Preview
                  </a>
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={savingSocial} className="save-btn"
            style={{ background:'var(--green)', border:'none', borderRadius:9, padding:'10px 22px', fontSize:13, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit', opacity:savingSocial?0.7:1 }}>
            {savingSocial ? 'Saving...' : '💾 Save Social Links'}
          </button>
        </form>
      </div>

      {/* 3. Integrations Status */}
      <div style={card}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:6 }}>🔌 Integrations</div>
        <p style={{ color:'var(--dim)', fontSize:13, margin:'0 0 16px' }}>
          All configured in Render → Environment Variables.
        </p>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
          {integrations.map(integ => (
            <div key={integ.name} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:integ.items.length>1?10:0 }}>
                <span style={{ fontSize:18 }}>{integ.icon}</span>
                <span style={{ fontWeight:800, fontSize:13 }}>{integ.name}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:6, paddingLeft:26 }}>
                {integ.items.map((item, i) => (
                  <div key={i} className="integ-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <span style={{ fontSize:12, color:'var(--muted)' }}>{item.label}</span>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:'var(--dim)', marginTop:12, marginBottom:0 }}>
          Status is read live from your Render environment. If an item shows Missing, add the variable in Render → your backend service → Environment.
        </p>
      </div>
    </div>
  )
}
