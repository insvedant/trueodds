const express   = require('express')
const router    = express.Router()
const BlogPost  = require('../models/BlogPost')
const { protect, requireRole } = require('../middleware/auth')

// Seed default posts if none exist
const DEFAULT_POSTS = [
  {
    title: 'What is Arbitrage Betting? A Complete Beginner Guide',
    slug: 'what-is-arbitrage-betting',
    category: 'Guide', emoji: '📖', status: 'published', readTime: 6,
    tags: ['arbitrage', 'beginners', 'strategy'],
    excerpt: 'Arbitrage betting lets you guarantee profit by placing bets on all outcomes across different sportsbooks — regardless of who wins. Here is how it works.',
    content: `## What is Arbitrage Betting?

Arbitrage betting (also called "arbing" or "sure betting") is a strategy where you place bets on every possible outcome of a sporting event across different sportsbooks. Because different books price odds differently, you can sometimes find situations where the combined implied probability across all books is less than 100% — meaning a guaranteed profit exists regardless of the result.

## How it Works

Convert each bookmaker's odds to an implied probability. If the sum of all implied probabilities is below 100%, you have an arb.

### Example: NHL Game

- **FanDuel**: Edmonton Oilers +145 (implied: 40.8%)
- **Bet365**: Florida Panthers +162 (implied: 38.2%)
- **Combined**: 79% → **+21% guaranteed profit**

Stake proportionally on each side. No matter who wins, you profit.

## How TrueOdds Finds Arbs

TrueOdds scans 100+ sportsbooks in real time and calculates the implied probability for every market. When the sum drops below 100%, we surface the arb instantly with exact stake amounts.

## Is Arbitrage Betting Legal?

Yes. You are placing legal bets at licensed sportsbooks. No laws are broken. Sportsbooks may limit or close accounts that win consistently — which is why TrueOdds teaches proper bankroll management and bet sizing.`,
    author: 'TrueOdds Team'
  },
  {
    title: 'Positive EV Betting: The Most Sustainable Betting Strategy',
    slug: 'positive-ev-betting-explained',
    category: 'Strategy', emoji: '♟️', status: 'published', readTime: 8,
    tags: ['expected value', 'kelly criterion', 'bankroll'],
    excerpt: 'Expected value betting is the strategy professionals use to win long-term. Learn the math, how to find +EV bets, and how to size your stakes correctly.',
    content: `## What is +EV Betting?

Positive Expected Value (+EV) betting means placing bets where the true probability of an outcome is higher than what the sportsbook's odds imply. Over thousands of bets, this guarantees long-term profit even with normal variance.

## The Formula

**EV = (True Probability × Decimal Odds) − 1**

If the true probability of a team winning is 52% and a sportsbook offers +120 (decimal 2.20):
EV = (0.52 × 2.20) − 1 = **+14.4%**

That is a massive edge. The average +EV bet on TrueOdds is around 4–8%.

## How to Find True Probability

Sharp books like Pinnacle price markets closest to true probability. They have the sharpest lines in the industry and never limit winning players. TrueOdds uses Pinnacle as the reference line and compares every other book against it.

## Kelly Criterion: How Much to Bet

Once you find a +EV bet, use the Kelly Criterion to size your stake:

**Kelly % = (BP − Q) / B**

Where B = decimal odds − 1, P = true probability, Q = 1 − P.

Most professionals use half-Kelly (50% of the Kelly stake) to reduce variance while maintaining strong growth.`,
    author: 'TrueOdds Team'
  },
  {
    title: 'Best Sportsbooks for Arbitrage Betting in Canada (2026)',
    slug: 'best-sportsbooks-arb-canada-2026',
    category: 'Analysis', emoji: '🇨🇦', status: 'published', readTime: 9,
    tags: ['canada', 'sportsbooks', 'review', 'ontario'],
    excerpt: 'The Canadian sports betting market is one of the best in the world for arb bettors. Here are the top books by limit, speed of restriction, and market coverage.',
    content: `## The Canadian Arb Landscape

Since Ontario opened its regulated market in April 2022, Canadian bettors have access to some of the world's best sportsbooks. Many are slow to restrict, offer generous welcome bonuses, and price markets independently — creating frequent arb windows.

## Top Books for Canadian Arb Bettors

### 1. Bet365
High limits, deep markets on all major sports, and excellent Canadian coverage including CFL and NHL. One of the slowest to restrict profitable players.

### 2. Sports Interaction
Canadian-owned and operated. Prices markets independently from offshore books — frequently misaligned with Pinnacle, creating +2 to +4% arb windows several times per week.

### 3. Pinnacle
The sharpest book in the world. Pinnacle never restricts winners — in fact they welcome sharp action. Use as your reference line for true probability.

### 4. DraftKings Canada
High limits especially on NBA and NFL. Slow to restrict and frequently runs boosted odds promotions that create temporary arb opportunities.

### 5. FanDuel Canada
Excellent for same-game parlays and live betting arbs. Deep player props market with pricing errors several times per week.

## Pro Tip

Rotate your bets across all books. Never bet the same side at the same book repeatedly — it flags your account faster.`,
    author: 'TrueOdds Team'
  },
  {
    title: 'Kelly Criterion: The Professional Approach to Bet Sizing',
    slug: 'kelly-criterion-bet-sizing',
    category: 'Strategy', emoji: '📐', status: 'published', readTime: 7,
    tags: ['kelly criterion', 'bankroll management', 'math'],
    excerpt: 'Bet too small and you leave profit on the table. Bet too large and one bad run wipes you out. The Kelly Criterion solves this precisely.',
    content: `## Why Bet Sizing Matters

Most bettors focus entirely on finding winners and ignore how much to bet. This is a critical mistake. Even with a genuine edge, incorrect bet sizing can lead to ruin — or dramatically reduce your long-term growth.

## The Kelly Criterion Formula

**f* = (bp − q) / b**

- **b** = decimal odds − 1 (your profit if you win)
- **p** = probability of winning (true probability)
- **q** = probability of losing (1 − p)
- **f*** = fraction of bankroll to bet

### Example

You find a bet at +150 (decimal 2.50) where your true probability estimate is 46%:

- b = 1.50, p = 0.46, q = 0.54
- f* = (1.50 × 0.46 − 0.54) / 1.50 = **0.10 = 10% of bankroll**

## Half-Kelly in Practice

Full Kelly is mathematically optimal but produces high variance — your bankroll can swing by 30–50% before recovering. Most professionals use **half-Kelly** (5% in the example above) to smooth variance while maintaining excellent long-term growth.

## TrueOdds Stake Calculator

TrueOdds automatically calculates your optimal Kelly stake for every +EV bet based on your bankroll size. Set your bankroll in Settings and every bet card shows your recommended stake.`,
    author: 'TrueOdds Team'
  },
  {
    title: 'How to Avoid Sportsbook Restrictions as an Arb Bettor',
    slug: 'avoid-sportsbook-restrictions',
    category: 'Tips', emoji: '🛡️', status: 'published', readTime: 9,
    tags: ['restrictions', 'limits', 'strategy', 'longevity'],
    excerpt: 'Sportsbooks limit and ban winning accounts. Here are the proven strategies professionals use to protect their accounts and extend their betting lifespan.',
    content: `## Why Sportsbooks Restrict Winners

Sportsbooks are businesses. They profit from losing bettors and lose money to winners. When an account shows a consistent edge — through arbitrage, +EV betting, or sharp line shopping — the book's risk management team will reduce limits or close the account.

## 10 Strategies to Stay Under the Radar

### 1. Round Number Bets
Always bet round numbers ($50, $100, $200). Arbers and sharp bettors bet exact Kelly amounts like $73.42 — this is a red flag.

### 2. Tail Square Action Sometimes
Occasionally bet on popular teams and markets even if there is no edge. This camouflages your profitable bets.

### 3. Use Bonus Offers
Actively use free bets, reload bonuses, and promotions. Regular bonus usage looks like a recreational bettor.

### 4. Bet In-Play
Live betting is harder to flag. Mix in some live bets even when betting pre-game arbs.

### 5. Never Bet the Max
Bet 40–60% of the maximum limit. Consistently hitting max limits is a major restriction trigger.

### 6. Spread Across Books
Never rely on one or two books. TrueOdds tracks your book health and warns you when a book might be flagging your account.

### 7. Accept Reduced Limits Gracefully
When a book reduces your limits, do not complain. Accept it, continue betting smaller, and use other books for larger stakes.

## Which Books Never Restrict?

**Pinnacle** has a no-restriction policy and welcomes sharp bettors. Use Pinnacle for large stakes. Use soft books for smaller stakes spread across many accounts.`,
    author: 'TrueOdds Team'
  },
  {
    title: 'CFL Arbitrage Guide: Finding Edges in Canadian Football',
    slug: 'cfl-arbitrage-guide-2026',
    category: 'Analysis', emoji: '🏈', status: 'published', readTime: 8,
    tags: ['CFL', 'canadian football', 'arbitrage', 'canada'],
    excerpt: 'The CFL is one of the most underserved leagues for sharp bettors. Fewer books cover it, pricing is inconsistent, and arb windows last longer. Here is how to exploit it.',
    content: `## Why the CFL is Great for Arb Bettors

The Canadian Football League runs June through November and is covered by far fewer sportsbooks than NFL or NBA. This creates several advantages for arb bettors:

1. **Fewer books = more pricing disagreement** — Books copy each other less because fewer sharp bettors are active
2. **Slower line movement** — Arb windows stay open longer
3. **Local knowledge edge** — Canadian books like Sports Interaction and Bet365 CA price CFL independently

## Best Books for CFL Arbitrage

| Book | Strength |
|------|----------|
| Sports Interaction | Best CFL coverage, independent pricing |
| Bet365 CA | Deep markets, high limits |
| FanDuel CA | Competitive spreads |
| Pinnacle | Sharp reference line |
| DraftKings CA | Good for totals |

## Key CFL Markets for Arb

**Spreads (point spread)** — Most common arb opportunity. CFL uses a 1-point spread system that creates natural disagreement between books.

**Game totals** — Totals in CFL range from 42 to 58 points. Books disagree by 1–2 points regularly.

**Moneyline on underdogs** — CFL underdogs are frequently mispriced by books unfamiliar with the league.

## Season Schedule

The 2026 CFL season runs June 4 through the Grey Cup in November. TrueOdds will show all CFL arbs automatically as soon as books post lines.`,
    author: 'TrueOdds Team'
  },
]

async function seedDefaults() {
  try {
    for (const post of DEFAULT_POSTS) {
      const exists = await BlogPost.findOne({ slug: post.slug })
      if (!exists) {
        await BlogPost.create(post)
        console.log(`[Blog] Seeded: ${post.title}`)
      }
    }
  } catch (err) { console.warn('[Blog] Seed error:', err.message) }
}
seedDefaults()

// PUBLIC — get all published posts
router.get('/', async (req, res) => {
  try {
    const posts = await BlogPost.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .select('-content')
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// ADMIN — get all posts (including drafts) — MUST be before /:slug
router.get('/admin/all', protect, requireRole('admin'), async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 })
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// PUBLIC — get single post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// ADMIN — create post
router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, emoji, tags, status, readTime, author } = req.body
    const post = await BlogPost.create({ title, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''), excerpt, content, category, emoji, tags, status, readTime, author })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// ADMIN — update post
router.put('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!post) return res.status(404).json({ success: false, message: 'Not found' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// ADMIN — delete post
router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

module.exports = router
