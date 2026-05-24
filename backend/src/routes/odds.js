/**
 * odds.js — Live Odds, Arbitrage, and +EV routes
 *
 * All data flows through apiService.js which:
 *   1. Checks MongoDB cache first (no API call if data is fresh)
 *   2. Falls back to TheOddsAPI if cache is stale
 *   3. Falls back to mock data if API key not configured
 *
 * Response always includes:
 *   { success, data, source: 'cache'|'api'|'mock', cachedAt, quotaRemaining }
 */

const router     = require('express').Router()
const { protect, optionalAuth, requirePlan } = require('../middleware/auth')
const {
  getOdds, getAllOdds, getArbitrage, getPositiveEV,
  getScores, getSportKey, getQuotaInfo,
} = require('../services/apiService')

// ── GET /api/odds ─────────────────────────────────────────────────────────
// Live odds comparison across sportsbooks
// Free plan gets fewer books; Gold/Platinum get all books
router.get('/odds', optionalAuth, async (req, res) => {
  try {
    const { sport = 'NFL', market = 'h2h' } = req.query
    const sportKey = getSportKey(sport)

    const { data, source } = await getOdds(sportKey, market)

    // Gate: free plan users see fewer books per row
    const limited = (!req.user || req.user.plan === 'free')
    const gated   = limited
      ? data.map(game => ({
          ...game,
          markets: game.markets.map(mkt => ({
            ...mkt,
            rows: mkt.rows.map(row => ({
              ...row,
              books: Object.fromEntries(Object.entries(row.books).slice(0, 3)),
            })),
          })),
        }))
      : data

    res.json({
      success: true,
      sport, market, source,
      count: gated.length,
      data:  gated,
      quota: getQuotaInfo(),
    })
  } catch (err) {
    console.error('Odds route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/arbitrage ────────────────────────────────────────────────────
// Arbitrage opportunities — free plan gets 3 results as preview
router.get('/arbitrage', protect, async (req, res) => {
  try {
    const { minProfit = 0, sport } = req.query
    const { data, source } = await getArbitrage(parseFloat(minProfit), sport && sport !== 'All' ? sport : null)

    const plan = req.user?.plan || 'free'
    const isFree = plan === 'free'
    const limited = isFree ? data.slice(0, 3) : data

    res.json({
      success:  true,
      source,
      count:    limited.length,
      total:    data.length,
      limited:  isFree,
      hot:      limited.filter(a => a.hot).length,
      data:     limited,
      quota:    getQuotaInfo(),
    })
  } catch (err) {
    console.error('Arb route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ev ───────────────────────────────────────────────────────────
// +EV bets — requires Gold or Platinum plan
router.get('/ev', protect, requirePlan('gold', 'platinum'), async (req, res) => {
  try {
    const { minEV = 0, sport } = req.query
    const { data, source } = await getPositiveEV(parseFloat(minEV), sport && sport !== 'All' ? sport : null)

    res.json({
      success: true,
      source,
      count: data.length,
      data,
      quota: getQuotaInfo(),
    })
  } catch (err) {
    console.error('EV route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/scores ───────────────────────────────────────────────────────
// Live scores & fixtures from APISports
router.get('/scores', optionalAuth, async (req, res) => {
  try {
    const { sport = 'NBA', date } = req.query
    const { data, source } = await getScores(sport, date || null)

    res.json({
      success: true,
      sport, source,
      count: data.length,
      data,
    })
  } catch (err) {
    console.error('Scores route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/quota ────────────────────────────────────────────────────────
// API quota status (admin use)
router.get('/quota', protect, (req, res) => {
  res.json({ success: true, quota: getQuotaInfo() })
})

module.exports = router
