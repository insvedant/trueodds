'use client'
import { useState } from 'react'
import { useAuth, api } from '@/lib/auth'

export default function AdminSettingsPage() {
  const { user, refresh } = useAuth()
  const [form, setForm] = useState({ name: user?.name || '', password: '', confirm: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setErr('')
    if (form.password && form.password !== form.confirm) { setErr('Passwords do not match'); return }
    setSaving(true)
    try {
      const payload: any = { name: form.name }
      if (form.password) payload.password = form.password
      await api.put('/auth/profile', payload)
      await refresh()
      setMsg('Profile updated.'); setForm(f => ({ ...f, password: '', confirm: '' }))
    } catch (e: any) { setErr(e.response?.data?.message || 'Update failed') }
    finally { setSaving(false) }
  }

  const card = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 16 }

  const integrations = [
    { title: '🔌 Odds API', items: [
      { name: 'TheOddsAPI', desc: 'Add THEODDSAPI_KEY to backend/.env for live odds data', badge: 'Configure', color: 'var(--blue)' },
      { name: 'SportsDataIO', desc: 'Alternative odds feed', badge: 'Connect', color: 'var(--muted)' },
    ]},
    { title: '💳 Payments (Stripe)', items: [
      { name: 'Stripe Checkout', desc: 'Add STRIPE_SECRET_KEY to backend .env, then update subscriptions.js subscribe route', badge: 'Setup', color: 'var(--purple)' },
      { name: 'Stripe Webhooks', desc: 'Confirm payment via webhook before activating subscription', badge: 'Docs', color: 'var(--muted)' },
    ]},
    { title: '📧 Email (SendGrid)', items: [
      { name: 'Transactional Email', desc: 'Add SENDGRID_API_KEY to .env for welcome + receipt emails', badge: 'Setup', color: 'var(--amber)' },
    ]},
    { title: '🔒 Security', items: [
      { name: 'JWT Secret', desc: 'Change JWT_SECRET in .env to a strong random string in production', badge: '⚠️ Required', color: 'var(--red)' },
      { name: 'Rate Limiting', desc: '300 req/15min global, 20 req/15min on auth routes', badge: 'Active', color: 'var(--green)' },
    ]},
  ]

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Platform configuration and integrations</p>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>👤 Admin Profile</div>
        {msg && <div style={{ background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 7, padding: '10px 14px', color: 'var(--green)', fontSize: 13, marginBottom: 16 }}>{msg}</div>}
        {err && <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 7, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{err}</div>}
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              { k: 'name', l: 'Name', t: 'text' }, { k: 'password', l: 'New Password', t: 'password' }, { k: 'confirm', l: 'Confirm Password', t: 'password' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 600 }}>{f.l}</label>
                <input type={f.t} className="input" value={(form as any)[f.k]} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
              </div>
            ))}
          </div>
          <button type="submit" className="btn-primary" style={{ fontSize: 13, opacity: saving ? 0.6 : 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      {integrations.map(sec => (
        <div key={sec.title} style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{sec.title}</div>
          {sec.items.map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{item.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.desc}</div>
              </div>
              <span style={{ background: item.color + '22', color: item.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{item.badge}</span>
            </div>
          ))}
        </div>
      ))}

    </div>
  )
}
