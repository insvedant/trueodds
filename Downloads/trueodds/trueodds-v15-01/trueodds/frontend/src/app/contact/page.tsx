'use client'
import { useState } from 'react'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const TOPICS = ['General Question','Technical Support','Billing & Subscription','Partnership','Press & Media','Bug Report','Feature Request','Other']

const CONTACT_INFO = [
  { icon:'📧', label:'Email',     val:'support@trueodds.com',  sub:'Reply within 24 hours' },
  { icon:'💬', label:'Discord',   val:'discord.gg/trueodds',   sub:'2,400+ members · fastest response' },
  { icon:'🐦', label:'Twitter/X', val:'@TrueOddsApp',          sub:'DMs open for quick questions' },
]

const FAQS = [
  { q:'How quickly will I get a response?', a:'Email within 24 hours on business days. Discord typically responds within minutes around the clock.' },
  { q:'What should I include in a bug report?', a:'Your browser, device, the page you were on, what you expected to happen, and a screenshot if possible.' },
  { q:'I want to partner with TrueOdds.', a:'We work with content creators, communities, and tool developers. Select "Partnership" as the topic above.' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name:'', email:'', topic:'General Question', message:'' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string,string>>({})

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim())  e.name = 'Name is required'
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (form.message.length < 20)  e.message = 'Message must be at least 20 characters'
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({}); setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false); setSent(true)
  }

  const inpStyle = (err?: string): React.CSSProperties => ({
    width: '100%', background: 'var(--bg)', border: `1px solid ${err ? 'var(--red)' : 'var(--border2)'}`,
    borderRadius: 9, padding: '10px 14px', color: 'var(--text)', fontSize: 14,
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
  })

  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14 }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNavbar />

      {/* Hero */}
      <section style={{ padding: '64px 24px 48px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 20, padding: '5px 16px', fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 20 }}>
            We read every message
          </div>
          <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 14 }}>Get in Touch</h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.75 }}>Whether it's a question, bug report, or partnership idea — we're here.</p>
        </div>
      </section>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '52px 24px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'flex-start' }}>

        {/* Form */}
        <div style={{ ...card, padding: '32px' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Message sent!</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
                Thanks, <strong style={{ color: 'var(--text)' }}>{form.name}</strong>. We'll reply to <strong style={{ color: 'var(--text)' }}>{form.email}</strong> within 24 hours.
              </p>
              <button onClick={() => { setSent(false); setForm({ name:'', email:'', topic:'General Question', message:'' }) }}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                Send Another
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>Send us a message</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>We'll get back to you within 24 hours.</p>
              <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  {[{ k:'name', l:'Your Name', t:'text', ph:'John Smith' }, { k:'email', l:'Email Address', t:'email', ph:'you@example.com' }].map(f => (
                    <div key={f.k}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{f.l}</label>
                      <input type={f.t} value={(form as any)[f.k]} onChange={e => setForm({...form, [f.k]: e.target.value})} placeholder={f.ph}
                        style={inpStyle(errors[f.k])}
                        onFocus={e => (e.target.style.borderColor = 'var(--green)')}
                        onBlur={e => (e.target.style.borderColor = errors[f.k] ? 'var(--red)' : 'var(--border2)')} />
                      {errors[f.k] && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors[f.k]}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Topic</label>
                  <select value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} style={{ ...inpStyle(), cursor: 'pointer' }}>
                    {TOPICS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Message</label>
                  <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows={6} placeholder="Tell us what's on your mind..."
                    style={{ ...inpStyle(errors.message), resize: 'vertical', lineHeight: 1.7 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--green)')}
                    onBlur={e => (e.target.style.borderColor = errors.message ? 'var(--red)' : 'var(--border2)')} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {errors.message && <div style={{ fontSize: 11, color: 'var(--red)' }}>{errors.message}</div>}
                    <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 'auto' }}>{form.message.length} chars</span>
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 14, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', width: '100%', opacity: loading ? 0.75 : 1, transition: 'all 0.18s' }}>
                  {loading ? 'Sending...' : 'Send Message →'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CONTACT_INFO.map(info => (
            <div key={info.label} style={{ ...card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{info.icon}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{info.label}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{info.val}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>{info.sub}</div>
              </div>
            </div>
          ))}

          <div style={card}>
            <div style={{ padding: '18px 20px 0', fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Common Questions</div>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ padding: '0 20px', paddingBottom: 16, marginBottom: 14, borderBottom: i < FAQS.length-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{faq.q}</div>
                <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.75, margin: 0 }}>{faq.a}</p>
              </div>
            ))}
            <div style={{ height: 4 }} />
          </div>

          <div style={{ background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.15)', borderRadius: 14, padding: '20px' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Join our Discord</div>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>2,400+ members sharing alerts, strategy tips, and getting instant support.</p>
            <a href="#" style={{ background: '#5865f2', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, display: 'inline-block' }}>Join Discord →</a>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
