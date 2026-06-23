/**
 * TrueOdds — Promotion Routes
 * File: backend/src/routes/promotion.js
 *
 * GET /api/promotion        — public, used by pricing/home page to render the sale banner
 * PUT /api/promotion        — admin only, update banner text / sale prices / coupon IDs
 *
 * Mount in index.js:
 *   app.use('/api/promotion', require('./routes/promotion'))
 */

const router    = require('express').Router()
const Promotion = require('../models/Promotion')
const { protect, adminOnly } = require('../middleware/auth')

// ── GET /api/promotion — public ──────────────────────────────────────────────
// Returns whether the sale is live right now. Checks both the manual `active`
// flag AND the end date, so an expired sale auto-hides on the frontend even
// if the admin forgets to flip the switch off.
router.get('/', async (req, res) => {
  try {
    const promo = await Promotion.getSingleton()

    const expired = promo.endsAt && new Date(promo.endsAt) < new Date()
    const isLive  = promo.active && !expired

    res.json({
      success: true,
      active:  isLive,
      title:    promo.title,
      subtitle: promo.subtitle,
      endsAt:   promo.endsAt,
      // Only expose sale prices when the sale is actually live.
      displayPrices: isLive ? promo.displayPrices : null,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/promotion/admin — admin only, full state including coupon IDs ──
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const promo = await Promotion.getSingleton()
    res.json({ success: true, promotion: promo })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── PUT /api/promotion — admin only ──────────────────────────────────────────
router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const { active, title, subtitle, endsAt, coupons, displayPrices } = req.body
    const promo = await Promotion.getSingleton()

    if (typeof active === 'boolean') promo.active = active
    if (title !== undefined)         promo.title = title
    if (subtitle !== undefined)      promo.subtitle = subtitle
    if (endsAt !== undefined)        promo.endsAt = endsAt ? new Date(endsAt) : null

    if (coupons && typeof coupons === 'object') {
      promo.coupons = {
        basic:    coupons.basic    ?? promo.coupons.basic,
        gold:     coupons.gold     ?? promo.coupons.gold,
        platinum: coupons.platinum ?? promo.coupons.platinum,
      }
    }
    if (displayPrices && typeof displayPrices === 'object') {
      const merge = (planKey) => ({
        monthly: displayPrices[planKey]?.monthly ?? promo.displayPrices[planKey]?.monthly ?? 0,
        yearly:  displayPrices[planKey]?.yearly  ?? promo.displayPrices[planKey]?.yearly  ?? 0,
      })
      promo.displayPrices = {
        basic:    merge('basic'),
        gold:     merge('gold'),
        platinum: merge('platinum'),
      }
    }

    promo.updatedAt = new Date()
    await promo.save()

    res.json({ success: true, promotion: promo })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
