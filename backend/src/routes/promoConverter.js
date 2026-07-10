/**
 * TrueOdds — Promo Converter
 * File: backend/src/routes/promoConverter.js
 *
 * Converts a sportsbook promo (free bet, risk-free bet, or profit boost) into
 * a guaranteed/expected cash value by calculating the correct hedge stake at
 * a second book.
 *
 * POST /api/promo-converter/calculate
 *   body: {
 *     promoType: 'free_bet' | 'risk_free_bet' | 'profit_boost',
 *     promoAmount: number,        // face value of the promo / boosted bet stake
 *     bookOdds: number,           // American odds of the promo-side bet
 *     hedgeOdds: number,          // American odds of the opposite side, real cash, other book
 *     bonusConversionRate?: number // risk_free_bet only, 0-100, default 75
 *   }
 */

const router = require('express').Router()
const { protect, requirePlan } = require('../middleware/auth')

function americanToDecimal(american) {
  if (american >= 100) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

const round2 = n => Math.round(n * 100) / 100

router.post('/calculate', protect, requirePlan('basic', 'gold', 'platinum'), (req, res) => {
  try {
    const {
      promoType,
      promoAmount,
      bookOdds,
      hedgeOdds,
      bonusConversionRate = 75,
    } = req.body

    if (!['free_bet', 'risk_free_bet', 'profit_boost'].includes(promoType))
      return res.status(400).json({ success: false, message: 'promoType must be free_bet, risk_free_bet, or profit_boost.' })

    if (!promoAmount || !bookOdds || !hedgeOdds)
      return res.status(400).json({ success: false, message: 'promoAmount, bookOdds, and hedgeOdds are required.' })

    const X        = parseFloat(promoAmount)
    const bookDec  = americanToDecimal(parseFloat(bookOdds))
    const hedgeDec = americanToDecimal(parseFloat(hedgeOdds))
    const bcr      = Math.min(100, Math.max(0, parseFloat(bonusConversionRate))) / 100

    if (isNaN(X) || isNaN(bookDec) || isNaN(hedgeDec) || X <= 0)
      return res.status(400).json({ success: false, message: 'Invalid values provided.' })

    let hedgeStake, ifBookWins, ifHedgeWins, extractionRate, note

    if (promoType === 'free_bet') {
      // Free bets pay winnings only — the stake itself isn't returned if it wins.
      // Hedge so profit is equal whether the free bet or the hedge bet wins.
      hedgeStake  = X * (bookDec - 1) / hedgeDec
      ifBookWins  = X * (bookDec - 1) - hedgeStake
      ifHedgeWins = hedgeStake * (hedgeDec - 1)
      extractionRate = (ifBookWins / X) * 100
      note = 'Free bets only pay out winnings, not the stake — the math accounts for that.'
    } else if (promoType === 'risk_free_bet') {
      // Real cash is at risk. Losing refunds a bonus bet worth roughly
      // bonusConversionRate% of face value once that bonus bet is itself hedged.
      hedgeStake  = X * (bookDec - bcr) / hedgeDec
      ifBookWins  = X * (bookDec - 1) - hedgeStake
      ifHedgeWins = -X + hedgeStake * (hedgeDec - 1) + (X * bcr)
      extractionRate = (Math.min(ifBookWins, ifHedgeWins) / X) * 100
      note = `Assumes the refunded bonus bet converts to ${Math.round(bcr * 100)}% cash value once hedged again.`
    } else {
      // profit_boost: real cash on a boosted line — this is a standard hedge,
      // the "boost" just means bookDec is already higher than the true market price.
      hedgeStake  = (X * bookDec) / hedgeDec
      ifBookWins  = X * (bookDec - 1) - hedgeStake
      ifHedgeWins = hedgeStake * (hedgeDec - 1) - X
      extractionRate = (Math.min(ifBookWins, ifHedgeWins) / X) * 100
      note = 'Boosted odds create extra edge vs. a normal hedge — that edge is what you see captured below.'
    }

    hedgeStake = round2(hedgeStake)
    const guaranteedProfit = round2(Math.min(ifBookWins, ifHedgeWins))

    res.json({
      success: true,
      result: {
        promoType,
        promoAmount: X,
        bookOddsAmerican:  parseFloat(bookOdds),
        hedgeOddsAmerican: parseFloat(hedgeOdds),
        hedgeStake,
        ifBookWins:  round2(ifBookWins),
        ifHedgeWins: round2(ifHedgeWins),
        guaranteedProfit,
        extractionRate: round2(extractionRate),
        isProfitable: guaranteedProfit > 0,
        note,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
