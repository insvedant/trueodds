'use client'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <PublicNavbar />
      <div style={{ maxWidth:720, margin:'0 auto', padding:'60px 24px' }}>
        <Link href="/" style={{ color:'var(--muted)', textDecoration:'none', fontSize:13, display:'inline-block', marginBottom:32 }}>← Back</Link>
        <h1 style={{ fontSize:36, fontWeight:900, letterSpacing:'-1px', marginBottom:8 }}>Privacy Policy</h1>
        <p style={{ color:'var(--dim)', fontSize:13, marginBottom:40 }}>Last updated: January 1, 2024</p>
        {[
          ['What we collect', 'We collect your name, email address, and betting data you voluntarily enter into the platform.'],
          ['How we use your data', 'Your data is used solely to provide and improve TrueOdds services. We never sell your personal data to third parties.'],
          ['Data security', 'All passwords are hashed using bcrypt. All traffic is encrypted via HTTPS. We use industry-standard security practices.'],
          ['Your rights', 'You can request deletion of your account and all associated data at any time by emailing privacy@trueodds.com.'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:20, fontWeight:800, marginBottom:10, color:'var(--text)' }}>{title}</h2>
            <p style={{ color:'var(--muted)', lineHeight:1.85, fontSize:15 }}>{body}</p>
          </div>
        ))}
      </div>
      <PublicFooter />
    </div>
  )
}
