'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/lib/theme'

const NAV_LINKS = [
  { href: '/dashboard/arbitrage',   label: 'Arbitrage' },
  { href: '/dashboard/positive-ev', label: '+EV' },
  { href: '/pricing',               label: 'Pricing' },
  { href: '/blog',                  label: 'Blog' },
  { href: '/about',                 label: 'About' },
]

const FOOTER_LINKS = {
  Tools:   [{ label: 'Arbitrage Finder', href: '/dashboard/arbitrage' }, { label: '+EV Betting', href: '/dashboard/positive-ev' }, { label: 'Bet Tracker', href: '/dashboard/tracker' }, { label: 'Live Odds', href: '/dashboard/odds' }, { label: 'ML Insights', href: '/dashboard/insights' }],
  Company: [{ label: 'About', href: '/about' }, { label: 'Pricing', href: '/pricing' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }],
  Legal:   [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Service', href: '/terms' }, { label: 'Responsible Gaming', href: '/responsible-gaming' }],
}

export function PublicNavbar() {
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: 60,
        background: scrolled ? 'var(--bg2)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        transition: 'all 0.2s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        {/* Logo */}
        <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px', flexShrink: 0 }}>
          True<span style={{ color: 'var(--green)' }}>Odds</span>
        </Link>

        {/* Desktop nav */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 13, fontWeight: 500, color: pathname === l.href ? 'var(--green)' : 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = pathname === l.href ? 'var(--green)' : 'var(--muted)')}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="nav-cta-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle size="sm" />
          <Link href="/login" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', padding: '7px 14px' }}>Log in</Link>
          <Link href="/signup" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Get Started</Link>
        </div>

        {/* Mobile right side */}
        <div className="nav-mobile-menu" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size="sm" />
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'all 0.2s', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 199, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '16px 0', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ display: 'block', padding: '12px 24px', fontSize: 15, fontWeight: 500, color: pathname === l.href ? 'var(--green)' : 'var(--text)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
              {l.label}
            </Link>
          ))}
          <div style={{ padding: '16px 24px', display: 'flex', gap: 10 }}>
            <Link href="/login" style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Log in</Link>
            <Link href="/signup" style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Get Started</Link>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div style={{ height: 60 }} />
    </>
  )
}

export function PublicFooter() {
  return (
    <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '48px 24px 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Footer grid */}
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10, letterSpacing: '-0.5px' }}>
              True<span style={{ color: 'var(--green)' }}>Odds</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75, maxWidth: 280, marginBottom: 16 }}>
              Real-time arbitrage, +EV betting, and ML-powered insights for serious sports bettors.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/signup" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>Start Free Trial</Link>
              <Link href="/pricing" style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text)', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 12, display: 'inline-block' }}>View Pricing</Link>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>© {new Date().getFullYear()} TrueOdds. All rights reserved.</div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>Must be 21+ to use sportsbooks. Bet responsibly.</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Responsible Gaming', href: '/responsible-gaming' }].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12, color: 'var(--dim)', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile bottom padding (for fixed bottom nav in dashboard) */}
      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid > div:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-cta-desktop { display: none !important; }
          .nav-mobile-menu { display: flex !important; }
        }
      `}</style>
    </footer>
  )
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </>
  )
}
