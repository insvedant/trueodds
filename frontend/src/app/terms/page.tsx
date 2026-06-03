'use client'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

export default function TermsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)' }}>
      <PublicNavbar />
      <div style={{ maxWidth:720, margin:'0 auto', padding:'60px 24px' }}>
        <Link href="/" style={{ color:'var(--muted)', textDecoration:'none', fontSize:13, display:'inline-block', marginBottom:32 }}>← Back</Link>
        <h1 style={{ fontSize:36, fontWeight:900, letterSpacing:'-1px', marginBottom:8 }}>Terms of Service</h1>
        <p style={{ color:'var(--dim)', fontSize:13, marginBottom:40 }}>Last updated: January 1, 2024</p>
        {[
          ['Information only', 'TrueOdds is an information platform only. We are not a sportsbook and we do not accept bets.'],
          ['Age requirement', 'You must be 21+ (or the legal gambling age in your jurisdiction) to use sportsbooks. You must be 18+ to use TrueOdds.'],
          ['Subscriptions', 'Paid subscriptions are billed monthly or yearly. Cancel anytime from your account settings. Refunds are not provided for partial periods.'],
          ['Liability', 'We are not liable for betting losses. All tools are provided for informational purposes. Past performance does not guarantee future results.'],
          ['Account termination', 'We reserve the right to terminate accounts that violate these terms, engage in fraud, or abuse the platform.'],
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
