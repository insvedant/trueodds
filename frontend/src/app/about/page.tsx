'use client'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const TEAM = [
  { name:'Jordan Park',    role:'Co-Founder & CEO',        avatar:'J', bio:'Former quantitative analyst at a top hedge fund. 8+ years in sports betting markets.' },
  { name:'Maya Singh',     role:'Co-Founder & CTO',        avatar:'M', bio:'Ex-Google engineer. Built real-time data pipelines processing 10M+ odds updates per day.' },
  { name:'Carlos Reyes',   role:'Head of Sports Strategy', avatar:'C', bio:'Professional sports bettor for 12 years. Expert in sharp money tracking and +EV methods.' },
  { name:'Priya Nakamura', role:'Head of Product',         avatar:'P', bio:'Former product lead at FanDuel. Obsessed with making complex data simple and actionable.' },
]

const TIMELINE = [
  { year:'2021', n:1, label:'Founded',     desc:'TrueOdds started as a side project by two quant analysts frustrated by the lack of good tools for smart bettors.' },
  { year:'2022', n:2, label:'Beta Launch', desc:'First 500 beta users. Arbitrage finder live with 15 sportsbooks. Average user profit: $210/month.' },
  { year:'2023', n:3, label:'Series A',    desc:'Raised $4.2M seed. Expanded to 60+ sportsbooks. Launched +EV tools and real-time alerts.' },
  { year:'2024', n:4, label:'10K Members', desc:'Crossed 10,000 active members. Launched API access, live in-play odds, and 1:1 coaching.' },
]

const VALUES = [
  { icon:'🎯', title:'Edge, not luck',       desc:'We believe sports betting is a skill game when approached with data. Our tools turn math into money.' },
  { icon:'🔬', title:'Relentlessly precise', desc:'Every odds feed, every calculation, every alert is held to the highest standard of accuracy.' },
  { icon:'🤝', title:'Bettors first',        desc:'No ads. No data sales. Revenue comes entirely from subscriptions — your success is our success.' },
  { icon:'📖', title:'Radical transparency', desc:'We show the math. We explain the edge. We\'re honest when strategies stop working. No black boxes.' },
]

export default function AboutPage() {
  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14 }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <PublicNavbar />

      {/* Hero */}
      <section style={{ padding: '80px 24px', textAlign: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 20, padding: '5px 16px', fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 24 }}>
            Our Mission
          </div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,62px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.06, marginBottom: 20 }}>
            We exist to level<br />the <span style={{ color: 'var(--green)' }}>playing field.</span>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 32 }}>
            Sportsbooks spend hundreds of millions on algorithms to price their lines. TrueOdds gives individual bettors the same quality of tools — so the edge belongs to you, not them.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15, padding: '12px 28px', borderRadius: 9, display: 'inline-block' }}>
              Start Free →
            </Link>
            <Link href="/contact" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 15, padding: '12px 20px', border: '1px solid var(--border)', borderRadius: 9, display: 'inline-block' }}>
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '56px 24px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          {[
            { val: '100+',   label: 'Sportsbooks scanned',  color: 'var(--green)' },
            { val: '10,000+',label: 'Active members',        color: 'var(--blue)' },
            { val: '$420',   label: 'Avg monthly profit',    color: 'var(--green)' },
            { val: '1M+',    label: 'Odds updates per day',  color: 'var(--purple)' },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: '22px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color, marginBottom: 6 }}>{s.val}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 8 }}>What we believe</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 36 }}>The principles that guide every decision we make.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            {VALUES.map(v => (
              <div key={v.title} style={{ ...card, padding: '24px 22px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,200,83,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{v.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{v.title}</div>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '80px 24px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 48, textAlign: 'center' }}>Our story</h2>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 17, top: 18, bottom: 18, width: 2, background: 'var(--border)' }} />
            {TIMELINE.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 22, marginBottom: 28, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: 'var(--green)', flexShrink: 0, zIndex: 1 }}>
                  {t.n}
                </div>
                <div style={{ ...card, padding: '16px 20px', flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 15 }}>{t.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, background: 'rgba(0,200,83,0.08)', padding: '2px 8px', borderRadius: 20 }}>{t.year}</span>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 8 }}>The team</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 36 }}>Quants, engineers, and former professional bettors — all obsessed with your edge.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
            {TEAM.map(person => (
              <div key={person.name} style={{ ...card, padding: '24px 22px', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,200,83,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,200,83,0.1)', border: '2px solid rgba(0,200,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'var(--green)', marginBottom: 14 }}>
                  {person.avatar}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{person.name}</div>
                <div style={{ color: 'var(--green)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{person.role}</div>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.75, margin: 0 }}>{person.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 24px 80px', textAlign: 'center', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 12 }}>Join the community</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 28 }}>10,000+ bettors already using TrueOdds to find their edge.</p>
          <Link href="/signup" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 15, padding: '13px 32px', borderRadius: 9, display: 'inline-block' }}>
            Create Free Account →
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
