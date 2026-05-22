/**
 * hedge.js
 * Emergency Hedge calculator — computes optimal hedge stake to guarantee
 * a profit (or minimise loss) regardless of outcome.
 *
 * POST /api/hedge/calculate
 */

const router = require('express').Router()
const { protect } = require('../middleware/auth')

function americanToDecimal(american) {
  if (american >= 100) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

function decimalToAmerican(decimal) {
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

/**
 * POST /api/hedge/calculate
 * Body:
 *   originalStake    — amount already wagered
 *   originalOdds     — American odds of original bet
 *   hedgeOdds        — American odds available on the opposite outcome
 *   targetProfit     — optional: desired guaranteed profit (default: maximize)
 *   mode             — 'guarantee_profit' | 'minimize_loss' | 'break_even'
 */
router.post('/calculate', protect, (req, res) => {
  try {
    const {
      originalStake,
      originalOdds,
      hedgeOdds,
      mode = 'guarantee_profit',
    } = req.body

    if (!originalStake || !originalOdds || !hedgeOdds)
      return res.status(400).json({ success: false, message: 'originalStake, originalOdds, and hedgeOdds are required.' })

    const stake   = parseFloat(originalStake)
    const origDec = americanToDecimal(parseFloat(originalOdds))
    const hedgeDec = americanToDecimal(parseFloat(hedgeOdds))

    if (isNaN(stake) || isNaN(origDec) || isNaN(hedgeDec) || stake <= 0)
      return res.status(400).json({ success: false, message: 'Invalid values provided.' })

    // Potential payout if original bet wins (including stake return)
    const originalPayout = stake * origDec

    // Optimal hedge stake:
    // If original wins: profit = originalPayout - stake - hedgeStake
    // If hedge wins:    profit = hedgeStake * hedgeDec - hedgeStake - stake
    // Set equal and solve for hedgeStake:
    // originalPayout - stake - hedgeStake = hedgeStake * hedgeDec - hedgeStake - stake
    // originalPayout = hedgeStake * hedgeDec
    // hedgeStake = originalPayout / hedgeDec

    let hedgeStake

    if (mode === 'break_even') {
      // Hedge stake that makes you break even if hedge wins (recover original stake)
      hedgeStake = stake / (hedgeDec - 1)
    } else if (mode === 'minimize_loss') {
      // Minimum hedge to limit total loss to 50% of original stake
      const maxLoss = stake * 0.5
      hedgeStake = (originalPayout - stake + maxLoss) / hedgeDec
      hedgeStake = Math.max(0, hedgeStake)
    } else {
      // Default: guarantee_profit — equal profit either way
      hedgeStake = originalPayout / hedgeDec
    }

    hedgeStake = Math.round(hedgeStake * 100) / 100

    const profitIfOriginalWins = originalPayout - stake - hedgeStake
    const profitIfHedgeWins    = (hedgeStake * hedgeDec) - hedgeStake - stake
    const guaranteedProfit     = Math.min(profitIfOriginalWins, profitIfHedgeWins)
    const totalStaked          = stake + hedgeStake
    const roi                  = (guaranteedProfit / totalStaked) * 100

    res.json({
      success: true,
      result: {
        hedgeStake:           Math.round(hedgeStake * 100) / 100,
        hedgeOddsAmerican:    parseFloat(hedgeOdds),
        hedgeOddsDecimal:     Math.round(hedgeDec * 1000) / 1000,
        originalStake:        stake,
        originalOddsAmerican: parseFloat(originalOdds),
        originalOddsDecimal:  Math.round(origDec * 1000) / 1000,
        originalPayout:       Math.round(originalPayout * 100) / 100,
        profitIfOriginalWins: Math.round(profitIfOriginalWins * 100) / 100,
        profitIfHedgeWins:    Math.round(profitIfHedgeWins * 100) / 100,
        guaranteedProfit:     Math.round(guaranteedProfit * 100) / 100,
        totalStaked:          Math.round(totalStaked * 100) / 100,
        roi:                  Math.round(roi * 100) / 100,
        mode,
        isProfitable:         guaranteedProfit > 0,
        breakEvenHedgeStake:  Math.round((stake / (hedgeDec - 1)) * 100) / 100,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
