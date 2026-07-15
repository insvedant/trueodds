/**
 * TrueOdds — Extra Tools
 * File: backend/src/routes/tools.js
 *
 * GET /api/tools/middles       — spread/total middle opportunities across books
 * GET /api/tools/book-rankings — sportsbook vig/margin ranking (lowest = best value)
 * GET /api/tools/key-numbers   — spread/total lines sitting on/near a key number
 * GET /api/tools/no-vig        — fair (no-vig) odds vs. what each book actually offers
 *
 * All four follow the same free-tier gating pattern as /api/odds/arbitrage:
 * free plan sees a 3-item preview, Basic+ sees the full list.
 */

const router = require('express').Router()
const { protect } = require('../middleware/auth')
const {
  getMiddles, getBookRankings, getKeyNumberWatch, getNoVig, getQuotaInfo,
} = require('../services/apiService')
const {
  getLineMovementSeries, getClosingSnapshot, findOutcomeInSnapshot,
  americanToDecimal, getSteamMoves,
} = require('../services/lineMovementService')
const Bet = require('../models/Bet')

function gate(req, data) {
  const plan   = req.user?.plan || 'free'
  const isFree = plan === 'free'
  return { limited: isFree, data: isFree ? data.slice(0, 3) : data, total: data.length }
}

router.get('/middles', protect, async (req, res) => {
  try {
    const { minGap = 1, sport } = req.query
    const { data, source } = await getMiddles(parseFloat(minGap), sport || null)
    const { limited, data: gated, total } = gate(req, data)
    res.json({ success: true, source, limited, count: gated.length, total, data: gated, quota: getQuotaInfo() })
  } catch (err) {
    console.error('Middles route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/book-rankings', protect, async (req, res) => {
  try {
    const { data, source } = await getBookRankings()
    // Not gated by plan — this one's useful even to free users as a trust signal.
    res.json({ success: true, source, count: data.length, data })
  } catch (err) {
    console.error('Book rankings route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/key-numbers', protect, async (req, res) => {
  try {
    const { sport } = req.query
    const { data, source } = await getKeyNumberWatch(sport || null)
    const { limited, data: gated, total } = gate(req, data)
    res.json({ success: true, source, limited, count: gated.length, total, data: gated })
  } catch (err) {
    console.error('Key numbers route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/no-vig', protect, async (req, res) => {
  try {
    const { sport } = req.query
    const { data, source } = await getNoVig(sport || null)
    const { limited, data: gated, total } = gate(req, data)
    res.json({ success: true, source, limited, count: gated.length, total, data: gated })
  } catch (err) {
    console.error('No-vig route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/tools/line-movement?eventId=xxx&market=spreads&selection=Lakers
// Full point/price time series for one game+market from real snapshot history.
router.get('/line-movement', protect, async (req, res) => {
  try {
    const { eventId, market = 'spreads', selection } = req.query
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required.' })

    const result = await getLineMovementSeries(eventId, market, selection || null)
    if (!result.available) {
      return res.json({ success: true, offline: true, message: 'Line movement database is not configured (ML_MONGODB_URI missing).', data: {} })
    }
    res.json({ success: true, snapshotCount: result.snapshotCount || 0, data: result.byBookSelection || {} })
  } catch (err) {
    console.error('Line movement route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/tools/steam?windowMinutes=15&sport=NFL
router.get('/steam', protect, async (req, res) => {
  try {
    const { windowMinutes = 15, sport } = req.query
    const result = await getSteamMoves(parseFloat(windowMinutes), sport || null)
    if (!result.available) {
      return res.json({ success: true, offline: true, message: 'Steam detection database is not configured (ML_MONGODB_URI missing).', data: [] })
    }
    const { limited, data: gated, total } = gate(req, result.data)
    res.json({ success: true, limited, count: gated.length, total, data: gated })
  } catch (err) {
    console.error('Steam route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// GET /api/tools/clv — Closing Line Value for the logged-in user's own bets.
// Only computes for bets logged with eventId + selection (see models/Bet.js) —
// older/free-text bets are skipped and reported separately.
router.get('/clv', protect, async (req, res) => {
  try {
    const bets = await Bet.find({ user: req.user._id, eventId: { $ne: null }, selection: { $ne: null } })
      .sort({ date: -1 }).limit(100)

    const totalBetsLogged = await Bet.countDocuments({ user: req.user._id })
    const results = []

    for (const bet of bets) {
      const closing = await getClosingSnapshot(bet.eventId)
      const outcome = findOutcomeInSnapshot(closing, bet.market, bet.selection, bet.book)
      if (!outcome) continue

      const betDec    = americanToDecimal(bet.odds)
      const closeDec   = americanToDecimal(outcome.price)
      const betProb    = 1 / betDec
      const closeProb  = 1 / closeDec
      // Positive = closing line implies a higher probability than what you paid for,
      // i.e. you got a better number than the market's final view — you beat the close.
      const clvPct     = (closeProb - betProb) * 100

      results.push({
        betId:        bet._id,
        game:         bet.game,
        sport:        bet.sport,
        market:       bet.market,
        selection:    bet.selection,
        betOdds:      bet.odds,
        betPoint:     bet.point,
        closingOdds:  outcome.price,
        closingPoint: outcome.point,
        closingBook:  outcome.book,
        clvPct:       Math.round(clvPct * 100) / 100,
        beatClose:    clvPct > 0,
        date:         bet.date,
      })
    }

    const avgClv = results.length
      ? Math.round((results.reduce((s, r) => s + r.clvPct, 0) / results.length) * 100) / 100
      : null

    res.json({
      success: true,
      data: results,
      summary: {
        betsWithClv:   results.length,
        totalBetsLogged,
        avgClvPct:     avgClv,
        beatCloseRate: results.length ? Math.round((results.filter(r => r.beatClose).length / results.length) * 1000) / 10 : null,
      },
    })
  } catch (err) {
    console.error('CLV route error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
