'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const ALL_POSTS = [
  {
    id: '1', slug: 'what-is-arbitrage-betting', category: 'Guide', date: 'Jan 10, 2024',
    readTime: 6, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['arbitrage', 'beginners', 'strategy'],
    title: 'What is Arbitrage Betting?',
    excerpt: 'Arbitrage betting lets you guarantee profit by backing all outcomes at different sportsbooks — regardless of who wins.',
    body: `Arbitrage betting (also called "arbing" or "sure betting") is a strategy where you place bets on all possible outcomes of an event across different sportsbooks that have priced the odds in a way that guarantees a profit regardless of the result.

## The core concept

The key is finding situations where sportsbooks disagree on the probability of an outcome. When Book A gives Team X odds of +150 and Book B gives Team Y odds of +130, there may be an opportunity where backing both sides costs less than the guaranteed return.

This happens because sportsbooks price their odds independently and don't always agree. Sharp money, different data sources, and varying vig all create these gaps — sometimes briefly, sometimes for hours.

## How to calculate an arb

Convert American odds to decimal, then sum the inverse (implied) probabilities. If the sum is less than 100%, you have an arbitrage opportunity.

The formula:
1. Convert +322 to decimal: 1 + 3.22 = 4.22
2. Convert -280 to decimal: 1 + 100/280 = 1.357
3. Implied prob leg 1: 1/4.22 = 23.7%
4. Implied prob leg 2: 1/1.357 = 73.7%
5. Sum: 23.7% + 73.7% = 97.4%

Since 97.4% is less than 100%, you have a 2.6% arbitrage.

## Real example

DraftKings offers Minnesota Wild at +322 (decimal: 4.22) and FanDuel offers Colorado Avalanche at -280 (decimal: 1.357).

On a $1,000 total stake:
- Bet $237 on Wild at +322 → Win: $998
- Bet $763 on Avalanche at -280 → Win: $1,036

Wait — these don't match! You need to split stakes optimally.

Optimal split: Stake1 = total / (1 + dec1/dec2) = 1000 / (1 + 4.22/1.357) = $243
Stake2 = $757

- Wild wins: $243 × 4.22 = $1,025
- Avalanche wins: $757 × 1.357 = $1,027
- Profit: ~$25–27 regardless of result

## Risks and limitations

Arbitrage betting is not completely risk-free in practice:

**Account restriction** — Sportsbooks limit or ban winning accounts. Use proper bet sizing and spread bets across many books.

**Line movement** — Odds can change between placing leg 1 and leg 2. Always place the smaller (more unique) leg first.

**Minimum/maximum limits** — If a book has a $50 max on a market, your profit is capped regardless of stake.

**Withdrawal friction** — You need funds distributed across multiple books at all times.

## Getting started with TrueOdds

TrueOdds scans 100+ sportsbooks every second and surfaces all arbitrage opportunities automatically — with the exact stakes pre-calculated. No spreadsheets, no manual math.

The average arb on TrueOdds lasts 4–12 minutes before one book moves. Speed matters.`,
  },
  {
    id: '2', slug: 'positive-ev-betting-explained', category: 'Strategy', date: 'Jan 5, 2024',
    readTime: 8, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['expected value', 'kelly', 'long-term'],
    title: 'Positive EV Betting Explained',
    excerpt: 'Expected value betting is the most sustainable long-term sports betting strategy. Learn the math behind it.',
    body: `Positive Expected Value (+EV) betting means placing bets where the price offered by a sportsbook is higher than the true probability of the outcome. Over time, this builds a mathematical edge that compounds into consistent profit.

## What is Expected Value?

EV is the average outcome of a bet over many trials. A bet with positive EV is one that, on average, returns more than it costs.

Formula: EV = (probability of winning × profit) − (probability of losing × stake)

## Finding true probability

The tricky part: sportsbooks bake a margin (vig) into their odds, which inflates the implied probabilities above 100%. To find the true probability, you need to remove the vig.

The best way to do this is to use sharp, low-margin books like Pinnacle as your reference. Pinnacle's no-vig odds are close to the true market probability.

## A worked example

Pinnacle (no-vig) has Team A at -115 implied (fair prob: 53.5%)
DraftKings has Team A at -105 (implied prob: 51.2%)

Since the true probability (53.5%) is higher than what DraftKings implies (51.2%), this is a +EV bet.

EV% = (true_prob × decimal_odds) − 1
EV% = (0.535 × 1.952) − 1 = 0.044 = +4.4%

For every $100 you bet, you expect to gain $4.40 on average.

## The Kelly Criterion

Once you know your edge, the Kelly Criterion tells you how much to bet.

Kelly% = (b × p − q) / b
Where b = decimal_odds − 1, p = true prob, q = 1 − p

Most professionals bet 1/4 Kelly (quarter Kelly) to reduce variance while capturing most of the long-run growth.

## Why it beats arbitrage long-term

Arbs are guaranteed but rare and require fast action. +EV betting offers more volume, less time pressure, and scales better with larger bankrolls — though it requires variance tolerance (you'll have losing days).

The best strategy combines both: arb when opportunities arise, +EV the rest of the time.`,
  },
  {
    id: '3', slug: 'best-sportsbooks-arb-2024', category: 'Analysis', date: 'Jan 3, 2024',
    readTime: 10, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['sportsbooks', 'review', 'arbitrage'],
    title: 'Best Sportsbooks for Arb Betting 2024',
    excerpt: 'Not all sportsbooks are equal. Here are the ones with the highest limits, the slowest restrictions, and the softest lines.',
    body: `When arbitrage betting, your choice of sportsbooks matters enormously. You need books with high limits, slow account restrictions, and lines that diverge from the market enough to create opportunities.

## What to look for

**High max bets** — A book that only lets you bet $50 per market is not useful for arbs above that size.

**Slow to restrict** — Square books (DraftKings, FanDuel, BetMGM) are slower to limit winning accounts than sharp books.

**Soft pricing** — The softer a book prices their lines, the more arb opportunities they create.

**Fast withdrawals** — You need liquidity across multiple books at all times.

## US Books (ranked for arb betting)

**DraftKings** — High limits, promotional credits you can leverage, slow to restrict compared to others. Best for parlays and live betting arbs.

**FanDuel** — Similar profile to DraftKings. Strong for same-game parlay arbs. Slightly faster to restrict on heavy winners.

**BetMGM** — Softer lines than DK/FD, especially on props. Good limits. Active promotions.

**Caesars** — Often has unique pricing on NFL, NBA. Large max bets on major markets.

**PointsBet** — PointsBetting markets create unique arb angles. Standard limits.

## Sharp books (use as reference)

**Pinnacle** — The sharpest book in the world. Use their no-vig odds as your true probability reference. Not available in most US states.

**Circa Sports** — Las Vegas-based, very sharp. High limits, quick to restrict.

## Recommendations

Start with DraftKings, FanDuel, and BetMGM. These three alone create hundreds of arb opportunities per week. Add Caesars and PointsBet as you grow your bankroll.

Always keep funds distributed across 4+ books. This gives you flexibility to act on opportunities immediately without waiting for transfers.`,
  },
  {
    id: '4', slug: 'kelly-criterion-bet-sizing', category: 'Strategy', date: 'Dec 28, 2023',
    readTime: 7, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['kelly', 'bankroll', 'sizing'],
    title: 'Kelly Criterion: How Much to Bet',
    excerpt: 'Bet too small and you\'re leaving profit on the table. Bet too large and you go broke. Kelly solves this precisely.',
    body: `The Kelly Criterion is a mathematical formula for calculating the optimal fraction of your bankroll to bet on any given opportunity. It maximizes long-run geometric growth while preventing ruin.

## The formula

Kelly % = (b × p − q) / b

Where:
- b = net odds (decimal odds − 1)
- p = probability of winning
- q = probability of losing (1 − p)

## A simple example

You find a bet at +150 (decimal: 2.5) where you believe the true win probability is 45%.

b = 1.5, p = 0.45, q = 0.55
Kelly = (1.5 × 0.45 − 0.55) / 1.5 = (0.675 − 0.55) / 1.5 = 0.125 / 1.5 = 8.3%

Kelly says to bet 8.3% of your bankroll.

## Why use fractional Kelly?

Full Kelly is mathematically optimal but produces extreme variance in the short term. A single bad run can draw down your bankroll by 30–50%.

Most professionals use quarter Kelly (multiply by 0.25). This captures ~75% of the growth with dramatically lower variance.

Quarter Kelly on our example: 8.3% × 0.25 = 2.1% of bankroll.

On a $5,000 bankroll: bet $105.

## Kelly for arbitrage

For arbitrage, Kelly doesn't apply the same way — the profit is guaranteed. The main consideration is how much capital you want tied up per arb relative to your total float across books.

A common approach: size arbs at 10–20% of available float per book, keeping the rest available for other opportunities.

## The bottom line

Never bet more than full Kelly on a single bet. The math is clear: overbetting Kelly leads to long-run ruin even on +EV bets. Quarter Kelly is a safe starting point.`,
  },
  {
    id: '5', slug: 'avoid-sportsbook-restrictions', category: 'Tips', date: 'Dec 20, 2023',
    readTime: 9, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['limits', 'strategy', 'longevity'],
    title: 'How to Avoid Sportsbook Restrictions',
    excerpt: 'Sportsbooks limit winning accounts. Here are the strategies professionals use to stay under the radar and keep their limits.',
    body: `Sportsbooks are businesses. When you win consistently, you threaten their margin. Most books will reduce your max bet limits — sometimes to as little as $1 — if you win too consistently on markets they care about.

## How restrictions work

Sportsbooks track your win rate, your bet patterns, and the markets you bet. Accounts that:
- Win above 54% on spread/total bets
- Consistently take the best available line
- Bet immediately when lines are released
- Never play parlays or prop bets

...are flagged as sharp and get limited.

## Strategies to preserve limits

**Mix in recreational bets** — Occasionally bet small amounts on popular markets like NFL futures, team props, or parlays. This mimics recreational behavior.

**Delay your bets slightly** — Don't always bet the moment a line opens. Waiting 30–60 minutes makes you look less like a line-shopper.

**Vary your bet sizes** — Betting exactly $100 every time is a pattern. Mix in $85, $112, $95, etc.

**Use bonuses** — Taking advantage of deposit bonuses and promotions signals recreational intent.

**Spread across books** — If you're limited at one book, you have others. Don't overconcentrate on a single book.

**Bet smaller at sharp books** — Pinnacle and Circa will limit you faster. Use them for reference, bet bigger at soft books.

## When you do get limited

It happens to everyone eventually. Don't close the account — you can still get small bets through. A $20 limit is annoying but still profitable at scale across 10+ books.

Focus on opening new accounts at books you haven't used yet. There are always new books entering the market.`,
  },
  {
    id: '6', slug: 'sharp-vs-square', category: 'Guide', date: 'Dec 14, 2023',
    readTime: 5, author: 'TrueOdds Team', authorBio: 'Sports betting analysts and quant researchers.',
    tags: ['sharp', 'beginners', 'psychology'],
    title: "Sharp vs Square: What's the Difference?",
    excerpt: "Sharp bettors win long term. Square bettors lose. Understanding what separates them is the first step to crossing over.",
    body: `In sports betting, "sharp" bettors are those who win consistently through skill and edge. "Square" bettors are the recreational majority who bet on feelings, fandom, and hunches — and lose in the long run.

## The square bettor

Square bettors bet with their heart, not their head. They:
- Bet their favorite team
- Take the popular side without checking lines
- Ignore line value in favor of who they think will win
- Chase losses by increasing bet sizes
- Don't track their bets or analyze results

The average square bettor loses about 5% of their total handle per year — that's the sportsbook's margin.

## The sharp bettor

Sharp bettors treat betting as an investment. They:
- Find edges through data, not opinion
- Only bet when they have a calculable advantage
- Size bets mathematically (Kelly or similar)
- Track every bet meticulously
- Adapt when strategies stop working

Sharps make 3–8% ROI long-term. It doesn't sound like much, but on a $10,000 bankroll with 500 bets per year at $200 average, that's $3,000–$8,000 profit.

## How to cross over

The mindset shift is the hardest part. You have to stop caring about who wins and start caring only about price and edge.

Tools like TrueOdds handle the math — finding where sportsbooks have mispriced their lines. Your job is to execute the bets, manage your bankroll, and stay disciplined during losing streaks (which happen to everyone).

The path from square to sharp starts with the first tracked bet. Start today.`,
  },
]

const CAT_COLOR: Record<string, string> = {
  Guide: 'var(--blue)', Strategy: 'var(--green)', Analysis: 'var(--purple)',
  Tips: 'var(--amber)', 'Tool Updates': 'var(--red)',
}

export default function BlogPostPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [scrolled, setScrolled] = useState(false)
  const [readProgress, setReadProgress] = useState(0)

  const post = ALL_POSTS.find(p => p.slug === slug)
  const related = ALL_POSTS.filter(p => p.slug !== slug && (p.category === post?.category || p.tags.some(t => post?.tags.includes(t)))).slice(0, 3)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      const el = document.documentElement
      const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      setReadProgress(Math.min(100, progress))
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!post) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>📭</div>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Article not found</h1>
      <Link href="/blog" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>← Back to Blog</Link>
    </div>
  )

  // Parse body into sections
  const sections = post.body.split('\n\n').map((block, i) => {
    if (block.startsWith('## ')) return { type: 'h2', content: block.slice(3), key: i }
    if (block.startsWith('# '))  return { type: 'h1', content: block.slice(2), key: i }
    if (block.startsWith('**') && block.endsWith('**')) return { type: 'bold', content: block.slice(2, -2), key: i }
    return { type: 'p', content: block, key: i }
  })

  // Extract headings for ToC
  const headings = sections.filter(s => s.type === 'h2')

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh', fontFamily: 'inherit' }}>

      {/* Read progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'var(--bg4)', zIndex: 200 }}>
        <div style={{ height: '100%', background: 'var(--green)', width: `${readProgress}%`, transition: 'width 0.1s' }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100, height: 60,
        display: 'flex', alignItems: 'center', padding: '0 32px',
        justifyContent: 'space-between',
        background: scrolled ? 'var(--bg2)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'all 0.3s',
      }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          True<span style={{ color: 'var(--green)' }}>Odds</span>
        </Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/blog"    style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>Blog</Link>
          <Link href="/about"   style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>About</Link>
          <Link href="/contact" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>Contact</Link>
          <Link href="/signup"  style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 7, display: 'inline-block' }}>Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '56px 24px 48px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>← Blog</Link>
            <span style={{ color: 'var(--border2)' }}>/</span>
            <span style={{ color: CAT_COLOR[post.category] || 'var(--green)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{post.category}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.12, marginBottom: 18, color: 'var(--text)' }}>
            {post.title}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 17, lineHeight: 1.75, marginBottom: 28 }}>{post.excerpt}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,200,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--green)', fontSize: 15 }}>
              {post.author.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{post.author}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{post.date} · {post.readTime} min read</div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {post.tags.map(t => (
                <span key={t} style={{ background: 'var(--bg4)', color: 'var(--muted)', fontSize: 11, padding: '3px 9px', borderRadius: 20 }}>#{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '48px 24px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 48, alignItems: 'flex-start' }}>

        {/* Article body */}
        <article>
          {sections.map(s => {
            if (s.type === 'h2') return (
              <h2 key={s.key} id={`h-${s.key}`} style={{ fontSize: 22, fontWeight: 900, margin: '36px 0 14px', letterSpacing: '-0.5px', color: 'var(--text)', scrollMarginTop: 80 }}>
                {s.content}
              </h2>
            )
            if (s.type === 'h1') return (
              <h1 key={s.key} style={{ fontSize: 28, fontWeight: 900, margin: '40px 0 16px', letterSpacing: '-1px', color: 'var(--text)' }}>
                {s.content}
              </h1>
            )
            // Bold intro lines (lines with ** ... **)
            const hasBold = s.content.includes('**')
            if (hasBold) {
              const parts = s.content.split(/\*\*(.*?)\*\*/g)
              return (
                <p key={s.key} style={{ fontSize: 16, lineHeight: 1.9, color: 'var(--text2)', marginBottom: 18 }}>
                  {parts.map((part, pi) => pi % 2 === 1 ? <strong key={pi} style={{ color: 'var(--text)', fontWeight: 800 }}>{part}</strong> : part)}
                </p>
              )
            }
            // Code/formula lines (contains = or formula-like content)
            if (s.content.includes('EV =') || s.content.includes('Kelly =') || s.content.startsWith('b =') || s.content.match(/^\d+\./)) {
              return (
                <div key={s.key} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)', borderRadius: 8, padding: '14px 18px', margin: '18px 0', fontFamily: 'monospace', fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
                  {s.content}
                </div>
              )
            }
            return (
              <p key={s.key} style={{ fontSize: 16, lineHeight: 1.95, color: 'var(--text2)', marginBottom: 20 }}>
                {s.content}
              </p>
            )
          })}

          {/* CTA */}
          <div style={{ background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 14, padding: '28px 28px', marginTop: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>⚡</div>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, color: 'var(--text)' }}>Put this into practice</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>TrueOdds automatically finds every arbitrage and +EV opportunity across 100+ sportsbooks. Start your free trial today.</p>
            <Link href="/signup" style={{ display: 'inline-block', background: 'var(--green)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, padding: '12px 28px', borderRadius: 9 }}>
              Start Free Trial →
            </Link>
          </div>

          {/* Tags */}
          <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Tags</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {post.tags.map(t => (
                <span key={t} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13, padding: '5px 12px', borderRadius: 20 }}>#{t}</span>
              ))}
            </div>
          </div>

          {/* Author */}
          <div style={{ marginTop: 32, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,200,83,0.12)', border: '2px solid rgba(0,200,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--green)', fontSize: 20 }}>
                {post.author.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{post.author}</div>
                <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>TrueOdds Staff</div>
              </div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.75, margin: 0 }}>{post.authorBio}</p>
          </div>
        </article>

        {/* Sidebar — Table of Contents */}
        <aside style={{ position: 'sticky', top: 80 }}>
          {headings.length > 0 && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Contents</div>
              {headings.map((h, i) => (
                <a key={i} href={`#h-${h.key}`} style={{ display: 'block', color: 'var(--muted)', textDecoration: 'none', fontSize: 13, marginBottom: 10, lineHeight: 1.5, padding: '2px 0', borderLeft: '2px solid var(--border)', paddingLeft: 10, transition: 'color 0.15s, border-color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderLeftColor = 'var(--green)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderLeftColor = 'var(--border)' }}>
                  {h.content}
                </a>
              ))}
            </div>
          )}

          {/* Share */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Share</div>
            {[
              { label: '🐦 Twitter/X', color: '#1da1f2' },
              { label: '💼 LinkedIn', color: '#0a66c2' },
              { label: '🔗 Copy Link', color: 'var(--green)' },
            ].map(btn => (
              <button key={btn.label} style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: 8, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = btn.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                {btn.label}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '56px 24px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 28, letterSpacing: '-0.5px' }}>Related Articles</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
              {related.map(p => (
                <Link key={p.id} href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', height: '100%', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,200,83,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <div style={{ color: CAT_COLOR[p.category] || 'var(--green)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{p.category} · {p.readTime} min</div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: 'var(--text)', lineHeight: 1.3 }}>{p.title}</div>
                    <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{p.excerpt.slice(0, 100)}...</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.5px' }}>
            True<span style={{ color: 'var(--green)' }}>Odds</span>
          </Link>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Blog', '/blog'], ['About', '/about'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, h]) => (
              <Link key={l} href={h} style={{ color: 'var(--dim)', textDecoration: 'none', fontSize: 13 }}>{l}</Link>
            ))}
          </div>
          <span style={{ color: 'var(--dim)', fontSize: 12 }}>© 2025 TrueOdds</span>
        </div>
      </footer>
    </div>
  )
}
