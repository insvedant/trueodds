'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/lib/theme'

const NAV_LINKS = [
  { href: '/pricing',  label: 'Pricing' },
  { href: '/blog',     label: 'Blog' },
  { href: '/about',    label: 'About' },
  { href: '/contact',  label: 'Contact' },
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

  
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <>
      <style>{`
        .pub-nav {
          position: fixed !important;
          top: 0 !important; left: 0 !important; right: 0 !important;
          z-index: 200 !important;
          height: 60px !important;
          background: #0d1117 !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 0 24px !important;
        }
        .pub-nav * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .pub-nav { padding: 0 16px !important; }
        }
      `}</style>
      <nav className="pub-nav">
        {}
        <Logo size="md" linkTo="/" />

        {}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 13, fontWeight: 500, color: pathname === l.href ? '#00C853' : '#9ca3af', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e6edf3')}
              onMouseLeave={e => (e.currentTarget.style.color = pathname === l.href ? '#00C853' : '#9ca3af')}>
              {l.label}
            </Link>
          ))}
        </div>

        {}
        <div className="nav-cta-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle size="sm" />
          <Link href="/login" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none', padding: '7px 14px' }}>Log in</Link>
          <Link href="/signup" style={{ background: '#00C853', color: '#000', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Get Started</Link>
        </div>

        {}
        <div className="nav-mobile-menu" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size="sm" />
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#e6edf3', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 22, height: 2, background: '#e6edf3', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#e6edf3', borderRadius: 2, transition: 'all 0.2s', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#e6edf3', borderRadius: 2, transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 199, background: 'rgba(8,11,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 0', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ display: 'block', padding: '12px 24px', fontSize: 15, fontWeight: 500, color: pathname === l.href ? '#00C853' : '#e6edf3', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {l.label}
            </Link>
          ))}
          <div style={{ padding: '16px 24px', display: 'flex', gap: 10 }}>
            <Link href="/login" style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e6edf3', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Log in</Link>
            <Link href="/signup" style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#00C853', color: '#000', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Get Started</Link>
          </div>
        </div>
      )}

      {}
      <div style={{ height: 60 }} />
    </>
  )
}

export function PublicFooter() {
  return (
    <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '48px 24px 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {}
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 40 }}>
          {}
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

          {}
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

        {}
        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>© {new Date().getFullYear()} TrueOdds. All rights reserved.</div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            {typeof window !== 'undefined' && window.location.hostname.includes('trueodds.us')
              ? 'Must be 21+. Problem gambling? Call 1-800-522-4700 (NCPG) or text HOME to 741741.'
              : 'Must be 19+. Problem gambling? Call 1-866-531-2600 (ConnexOntario) or 1-800-522-4700 (NCPG).'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Responsible Gaming', href: '/responsible-gaming' }].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12, color: 'var(--dim)', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>
      </div>

      {}
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
