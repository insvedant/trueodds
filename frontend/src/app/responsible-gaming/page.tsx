'use client'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

export default function ResponsibleGamingPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <PublicNavbar />
      <div style={{ maxWidth:720, margin:'0 auto', padding:'60px 24px' }}>
        <Link href="/" style={{ color:'var(--muted)', textDecoration:'none', fontSize:13, display:'inline-block', marginBottom:32 }}>← Back</Link>
        <h1 style={{ fontSize:36, fontWeight:900, letterSpacing:'-1px', marginBottom:8 }}>Responsible Gaming</h1>
        <p style={{ color:'var(--dim)', fontSize:13, marginBottom:40 }}>Betting should be fun, not harmful.</p>
        {[
          ['Bet within your means', 'Sports betting involves real financial risk. Only ever bet money you can afford to lose. Set a strict budget before you start and stick to it regardless of results.'],
          ["Don't chase losses", 'Chasing losses is the fastest path to problem gambling. If you lose your session bankroll, stop. There will always be more opportunities.'],
          ['Set limits', 'Use sportsbook responsible gambling tools to set deposit limits, session time limits, and cooling-off periods.'],
          ['Get help if you need it', 'If you think you may have a gambling problem, call the National Problem Gambling Helpline: 1-800-522-4700 (US). Help is free, confidential, and available 24/7.'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom:32, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 22px' }}>
            <h2 style={{ fontSize:17, fontWeight:800, marginBottom:10, color:'var(--text)' }}>{title}</h2>
            <p style={{ color:'var(--muted)', lineHeight:1.85, fontSize:14, margin:0 }}>{body}</p>
          </div>
        ))}
        <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'20px 22px', marginTop:8 }}>
          <h2 style={{ fontSize:17, fontWeight:800, marginBottom:8, color:'var(--red)' }}>🆘 Crisis Resources</h2>
          <p style={{ color:'var(--muted)', fontSize:14, margin:0, lineHeight:1.8 }}>
            <strong style={{ color:'var(--text)' }}>National Problem Gambling Helpline:</strong> 1-800-522-4700<br/>
            <strong style={{ color:'var(--text)' }}>Crisis Text Line:</strong> Text HOME to 741741<br/>
            <strong style={{ color:'var(--text)' }}>Gamblers Anonymous:</strong> gamblersanonymous.org
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
