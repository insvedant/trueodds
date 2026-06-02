const express   = require('express')
const router    = express.Router()
const BlogPost  = require('../models/BlogPost')
const { protect, requireRole } = require('../middleware/auth')

// Seed default posts if none exist
const DEFAULT_POSTS = [
  { title:'What is Arbitrage Betting?', slug:'what-is-arbitrage-betting', category:'Guide', emoji:'📖', status:'published', readTime:6, tags:['arbitrage','beginners'], excerpt:'Arbitrage betting lets you guarantee profit by backing all outcomes at different sportsbooks — regardless of who wins.', content:'Arbitrage betting (arbing) is a risk-free betting strategy that guarantees profit by placing bets on all possible outcomes of a sporting event across different sportsbooks that offer different odds.\n\n## How it works\n\nWhen sportsbook A offers +150 on Team A winning, and sportsbook B offers +160 on Team B winning, the combined implied probability is less than 100%. That gap is your guaranteed profit.\n\n## Example\n\nGame: Toronto Raptors vs Golden State Warriors\n- Sportsbook A: Raptors +155 (implied 39.2%)\n- Sportsbook B: Warriors +145 (implied 40.8%)\n- Combined: 80% → 20% guaranteed profit\n\nStake $500 on each side. Whoever wins, you profit.' },
  { title:'Positive EV Betting Explained', slug:'positive-ev-betting-explained', category:'Strategy', emoji:'♟️', status:'published', readTime:8, tags:['expected value','kelly'], excerpt:'Expected value betting is the most sustainable long-term sports betting strategy. Learn the math behind it.', content:'Positive Expected Value (+EV) betting means placing bets where the true probability of winning is higher than the sportsbook\'s implied probability.\n\n## The Math\n\nEV = (Probability × Profit) - (1 - Probability × Stake)\n\nIf Pinnacle (sharp book) prices a team at -110, the true probability is ~52.4%. If a soft book offers +120, their implied probability is 45.5%. The gap is your edge.\n\n## Sharp vs Soft Books\n\nSharp books like Pinnacle set the market. Soft books follow but lag behind. TrueOdds finds those windows before they close.' },
  { title:'Best Sportsbooks for Arb Betting 2026', slug:'best-sportsbooks-arb-2026', category:'Analysis', emoji:'📊', status:'published', readTime:10, tags:['sportsbooks','review'], excerpt:'Not all sportsbooks are equal. Here are the ones with the highest limits, slowest restrictions, and softest lines.', content:'The best sportsbooks for arbitrage betting share three qualities: high limits, slow restriction policies, and frequent pricing errors.\n\n## Top Picks for Canada\n\n1. **Bet365** — High limits, wide market coverage\n2. **Sports Interaction** — Canadian-focused, slow to restrict\n3. **Pinnacle** — Sharp reference book, never restricts\n4. **DraftKings** — Large player pool, soft on props\n\n## Top Picks for USA\n\n1. **FanDuel** — Widest market in US\n2. **DraftKings** — High limits on major sports\n3. **BetMGM** — Slow to restrict arbers\n4. **Caesars** — Frequent promos create arb windows' },
]

async function seedDefaults() {
  try {
    const count = await BlogPost.countDocuments()
    if (count === 0) {
      await BlogPost.insertMany(DEFAULT_POSTS)
      console.log('[Blog] Seeded default posts')
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

// PUBLIC — get single post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ success: false, message: err.message }) }
})

// ADMIN — get all posts (including drafts)
router.get('/admin/all', protect, requireRole('admin'), async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 })
    res.json({ success: true, data: posts })
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
