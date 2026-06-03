'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/auth'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const TOPICS = ['General Question','Technical Support','Billing & Subscription','Partnership','Press & Media','Bug Report','Feature Request','Other']
const FAQS = [
  { q:'How quickly will I get a response?', a:'Email within 24 hours on business days. Discord typically responds within minutes around the clock.' },
  { q:'What should I include in a bug report?', a:'Your browser, device, the page you were on, what you expected to happen, and a screenshot if possible.' },
  { q:'I want to partner with TrueOdds.', a:'We work with content creators, communities, and tool developers. Select "Partnership" as the topic above.' },
]

export default function ContactPage() {
  const [form, setForm]   = useState({ name:'', email:'', topic:'General Question', message:'' })
  const [sent, setSent]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string,string>>({})
  const [social, setSocial] = useState({ instagram:'', twitter:'', discord:'', facebook:'' })

  useEffect(() => {
    api.get('/settings/public').then(r => {
      if (r.data.social) setSocial(r.data.social)
    }).catch(() => {})
  }, [])

  const contactInfo = [
    { icon:'📧', label:'Email',      val:'support@trueodds.ca', sub:'Reply within 24 hours', href:'mailto:support@trueodds.ca' },
    ...(social.discord   ? [{ icon:'💬', label:'Discord',   val:'Join our server',  sub:'Fastest response',          href: social.discord }]   : []),
    ...(social.twitter   ? [{ icon:'🐦', label:'Twitter/X', val:'@TrueOddsApp',     sub:'DMs open',                  href: social.twitter }]   : []),
    ...(social.instagram ? [{ icon:'📸', label:'Instagram', val:'@TrueOdds',        sub:'Updates & highlights',      href: social.instagram }] : []),
    ...(social.facebook  ? [{ icon:'👥', label:'Facebook',  val:'TrueOdds',         sub:'Follow our page',           href: social.facebook }]  : []),
  ]

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim())         e.name    = 'Name is required'
    if (!form.email.includes('@')) e.email   = 'Valid email required'
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

  const inp = (err?: string): React.CSSProperties => ({
    width:'100%', background:'var(--bg)', border:`1px solid ${err?'var(--red)':'var(--border2)'}`,
    borderRadius:9, padding:'11px 14px', color:'var(--text)', fontSize:14,
    outline:'none', fontFamily:'inherit', transition:'border-color 0.15s', display:'block',
  })

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', minHeight:'100vh' }}>
      <style>{`
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
          .contact-name-email { grid-template-columns: 1fr !important; }
          .contact-hero h1 { font-size: 28px !important; }
          .contact-hero { padding: 40px 16px 32px !important; }
          .contact-main { padding: 24px 16px !important; }
          .contact-form-card { padding: 20px 16px !important; }
        }
      `}</style>

      <PublicNavbar />

      {}
      <section className="contact-hero" style={{ padding:'64px 24px 48px', textAlign:'center', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
        <div style={{ maxWidth:540, margin:'0 auto' }}>
          <div style={{ display:'inline-block', background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:20, padding:'5px 16px', fontSize:12, color:'var(--green)', fontWeight:700, marginBottom:20 }}>
            We read every message
          </div>
          <h1 style={{ fontSize:'clamp(26px,5vw,52px)', fontWeight:900, letterSpacing:'-1.5px', marginBottom:14 }}>Get in Touch</h1>
          <p style={{ color:'var(--muted)', fontSize:16, lineHeight:1.75 }}>Whether it&apos;s a question, bug report, or partnership idea — we&apos;re here.</p>
        </div>
      </section>

      <div style={{ overflowX:'auto', padding:'20px 16px 0', display:'flex', gap:12, maxWidth:980, margin:'0 auto' }}>
        {contactInfo.map(info => (
          <a key={info.label} href={info.href} target={info.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, flexShrink:0, minWidth:200, textDecoration:'none', color:'inherit', transition:'border-color 0.15s, transform 0.15s', cursor:'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--green)'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLElement).style.transform='translateY(0)' }}>
            <div style={{ fontSize:22, flexShrink:0 }}>{info.icon}</div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' as const, letterSpacing:'0.8px', marginBottom:2 }}>{info.label}</div>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:1 }}>{info.val}</div>
              <div style={{ fontSize:11, color:'var(--dim)' }}>{info.sub}</div>
            </div>
          </a>
        ))}
      </div>

      {}
      <div className="contact-main" style={{ maxWidth:980, margin:'0 auto', padding:'32px 24px' }}>
        <div className="contact-grid" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:24, alignItems:'flex-start' }}>

          {}
          <div className="contact-form-card" style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'28px 28px' }}>
            {sent ? (
              <div style={{ textAlign:'center', padding:'32px 20px' }}>
                <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
                <h2 style={{ fontSize:20, fontWeight:900, marginBottom:8 }}>Message sent!</h2>
                <p style={{ color:'var(--muted)', fontSize:14, marginBottom:20, lineHeight:1.7 }}>
                  Thanks, <strong style={{ color:'var(--text)' }}>{form.name}</strong>. We&apos;ll reply to <strong style={{ color:'var(--text)' }}>{form.email}</strong> within 24 hours.
                </p>
                <button onClick={() => { setSent(false); setForm({ name:'', email:'', topic:'General Question', message:'' }) }}
                  style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:9, padding:'10px 24px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                  Send Another
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize:18, fontWeight:900, marginBottom:4 }}>Send us a message</h2>
                <p style={{ color:'var(--muted)', fontSize:13, marginBottom:22 }}>We&apos;ll get back to you within 24 hours.</p>
                <form onSubmit={submit}>
                  <div className="contact-name-email" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                    {[{k:'name',l:'Your Name',t:'text',ph:'John Smith'},{k:'email',l:'Email Address',t:'email',ph:'you@example.com'}].map(f=>(
                      <div key={f.k}>
                        <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>{f.l}</label>
                        <input type={f.t} value={(form as any)[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.ph}
                          style={inp(errors[f.k])}
                          onFocus={e=>(e.target.style.borderColor='var(--green)')}
                          onBlur={e=>(e.target.style.borderColor=errors[f.k]?'var(--red)':'var(--border2)')} />
                        {errors[f.k] && <div style={{ fontSize:11, color:'var(--red)', marginTop:3 }}>{errors[f.k]}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Topic</label>
                    <select value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} style={{ ...inp(), cursor:'pointer' }}>
                      {TOPICS.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Message</label>
                    <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={5} placeholder="Tell us what's on your mind..."
                      style={{ ...inp(errors.message), resize:'vertical', lineHeight:1.7 }}
                      onFocus={e=>(e.target.style.borderColor='var(--green)')}
                      onBlur={e=>(e.target.style.borderColor=errors.message?'var(--red)':'var(--border2)')} />
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                      {errors.message && <div style={{ fontSize:11, color:'var(--red)' }}>{errors.message}</div>}
                      <span style={{ fontSize:11, color:'var(--dim)', marginLeft:'auto' }}>{form.message.length} chars</span>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:9, padding:'12px', fontSize:14, fontWeight:800, cursor:loading?'wait':'pointer', fontFamily:'inherit', width:'100%', opacity:loading?0.75:1 }}>
                    {loading ? 'Sending...' : 'Send Message →'}
                  </button>
                </form>
              </>
            )}
          </div>

          {}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {}
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14 }}>
              <div style={{ padding:'18px 20px 0', fontWeight:800, fontSize:14, marginBottom:14 }}>Common Questions</div>
              {FAQS.map((faq,i)=>(
                <div key={i} style={{ padding:'0 20px', paddingBottom:14, marginBottom:12, borderBottom:i<FAQS.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:5 }}>{faq.q}</div>
                  <p style={{ color:'var(--muted)', fontSize:12, lineHeight:1.75, margin:0 }}>{faq.a}</p>
                </div>
              ))}
              <div style={{ height:4 }} />
            </div>

            {}
            <div style={{ background:'rgba(88,101,242,0.06)', border:'1px solid rgba(88,101,242,0.15)', borderRadius:14, padding:'20px' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>💬</div>
              <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Join our Discord</div>
              <p style={{ color:'var(--muted)', fontSize:12, lineHeight:1.7, marginBottom:14 }}>2,400+ members sharing alerts, strategy tips, and getting instant support.</p>
              <a href="#" style={{ background:'#5865f2', color:'#fff', textDecoration:'none', fontSize:12, fontWeight:700, padding:'8px 16px', borderRadius:8, display:'inline-block' }}>Join Discord →</a>
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
