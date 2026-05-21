'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/lib/theme'

const NAV_LINKS = [
  { href: '/dashboard/arbitrage', label: 'Arbitrage' },
  { href: '/dashboard/positive-ev', label: '+EV' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
]

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 60, display: 'flex', alignItems: 'center',
      padding: '0 32px', justifyContent: 'space-between',
      background: scrolled ? 'var(--bg2)' : 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      transition: 'all 0.3s',
    }}>
      <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
        True<span style={{ color: 'var(--green)' }}>Odds</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {NAV_LINKS.map(link => (
          <Link key={link.href} href={link.href} style={{
            color: pathname === link.href ? 'var(--text)' : 'var(--muted)',
            textDecoration: 'none', fontSize: 14, fontWeight: pathname === link.href ? 700 : 400,
            padding: '6px 12px', borderRadius: 8, transition: 'color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.color = pathname === link.href ? 'var(--text)' : 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}>
            {link.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <ThemeToggle size="sm" />
        <Link href="/login" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 500, padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 8, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
          Log in
        </Link>
        <Link href="/signup" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800, padding: '7px 16px', borderRadius: 8, display: 'inline-block', transition: 'all 0.18s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,200,83,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
          Start Free →
        </Link>
      </div>
    </nav>
  )
}

export function PublicFooter() {
  const cols = [
    { title: 'Product', links: [['Arbitrage', '/dashboard/arbitrage'], ['+EV Bets', '/dashboard/positive-ev'], ['Live Odds', '/dashboard/odds'], ['Bet Tracker', '/dashboard/tracker'], ['Calculators', '/dashboard/calculators']] },
    { title: 'Company', links: [['About', '/about'], ['Blog', '/blog'], ['Contact', '/contact'], ['Pricing', '/pricing']] },
    { title: 'Legal', links: [['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Responsible Gaming', '/responsible-gaming']] },
  ]

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', padding: '48px 24px 28px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3,1fr)', gap: 40, marginBottom: 40 }}>
          <div>
            <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px', display: 'block', marginBottom: 10 }}>
              True<span style={{ color: 'var(--green)' }}>Odds</span>
            </Link>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.75, maxWidth: 180 }}>Real-time arb and +EV tools for serious bettors.</p>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>{col.title}</div>
              {col.links.map(([label, href]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <Link href={href} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                    {label}
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ color: 'var(--dim)', fontSize: 12 }}>© 2025 TrueOdds, LLC. All rights reserved.</span>
          <span style={{ color: 'var(--dim)', fontSize: 11, maxWidth: 440 }}>For informational purposes only. Must be 21+. Problem gambling? 1-800-GAMBLER.</span>
        </div>
      </div>
    </footer>
  )
}
