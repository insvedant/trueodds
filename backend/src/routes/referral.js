/**
 * referral.js — Referral program routes + admin management
 *
 * GET  /api/referral/me          — current user's referral stats + link
 * GET  /api/referral/admin/list  — admin: all referrers with full stats
 * PUT  /api/referral/admin/:id   — admin: manually adjust rewards / override
 */

const router  = require('express').Router()
const crypto  = require('crypto')
const { protect, requireAdmin } = require('../middleware/auth')
const User    = require('../models/User')

const REFERRAL_THRESHOLD = 50   // USD — referred user must spend $50 to trigger reward
const REWARD_MONTHS      = 1    // free months awarded per qualifying referral

// ── Ensure user has a referral code ──────────────────────────────────────
async function ensureReferralCode(user) {
  if (!user.referralCode) {
    user.referralCode = crypto.randomBytes(5).toString('hex').toUpperCase()
    await user.save({ validateBeforeSave: false })
  }
  return user.referralCode
}

// ── GET /api/referral/me ─────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user)
    const link = `https://trueodds.ca/signup?ref=${code}`

    // All users who signed up using this user's referral code
    const referred = await User.find({ referredBy: req.user._id })
      .select('name email plan subscriptionStatus totalPaid createdAt')
      .sort({ createdAt: -1 })

    const qualifiedCount  = referred.filter(r => (r.totalPaid || 0) >= REFERRAL_THRESHOLD).length
    const pendingCount    = referred.filter(r => (r.totalPaid || 0) > 0 && (r.totalPaid || 0) < REFERRAL_THRESHOLD).length
    const totalSpentByRef = referred.reduce((sum, r) => sum + (r.totalPaid || 0), 0)

    res.json({
      success: true,
      referralCode:      code,
      referralLink:      link,
      threshold:         REFERRAL_THRESHOLD,
      rewardMonths:      REWARD_MONTHS,
      totalReferrals:    referred.length,
      qualifiedReferrals: qualifiedCount,
      pendingReferrals:  pendingCount,
      rewardsEarned:     req.user.referralRewards || 0,
      totalSpentByReferrals: totalSpentByRef,
      referrals: referred.map(r => ({
        name:       r.name,
        email:      r.email,
        plan:       r.plan,
        status:     r.subscriptionStatus,
        totalPaid:  r.totalPaid || 0,
        qualified:  (r.totalPaid || 0) >= REFERRAL_THRESHOLD,
        joined:     r.createdAt,
      })),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/referral/admin/list ─────────────────────────────────────────
router.get('/admin/list', protect, requireAdmin, async (req, res) => {
  try {
   const page  = parseInt(req.query.page)  || 1
const limit = parseInt(req.query.limit) || 50
    const skip  = (page - 1) * limit

    // Get all users who have made at least one referral
    const referrers = await User.find({ referralCode: { $exists: true, $ne: null } })
      .select('name email plan referralCode referralCount referralRewards totalPaid createdAt')
      .sort({ referralRewards: -1, referralCount: -1 })
      .skip(skip)
      .limit(limit)

    const total = await User.countDocuments({ referralCode: { $exists: true, $ne: null } })

    // For each referrer, get their referred users' stats
    const result = await Promise.all(referrers.map(async (u) => {
      const refs = await User.find({ referredBy: u._id }).select('name email plan totalPaid subscriptionStatus createdAt')
      const qualified = refs.filter(r => (r.totalPaid || 0) >= REFERRAL_THRESHOLD)
      const totalSpent = refs.reduce((s, r) => s + (r.totalPaid || 0), 0)
      return {
        id:             u._id,
        name:           u.name,
        email:          u.email,
        plan:           u.plan,
        referralCode:   u.referralCode,
        referralLink:   `https://trueodds.ca/signup?ref=${u.referralCode}`,
        totalReferrals: refs.length,
        qualifiedReferrals: qualified.length,
        rewardsEarned:  u.referralRewards || 0,
        totalSpentByReferrals: totalSpent,
        referrals:      refs.map(r => ({
          name:      r.name,
          email:     r.email,
          plan:      r.plan,
          status:    r.subscriptionStatus,
          totalPaid: r.totalPaid || 0,
          qualified: (r.totalPaid || 0) >= REFERRAL_THRESHOLD,
          joined:    r.createdAt,
        })),
        joined: u.createdAt,
      }
    }))

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      threshold: REFERRAL_THRESHOLD,
      data: result,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── PUT /api/referral/admin/:id ──────────────────────────────────────────
// Admin can manually override reward months for a user
router.put('/admin/:id', protect, requireAdmin, async (req, res) => {
  try {
    const { referralRewards, referralCode } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

    if (referralRewards !== undefined) user.referralRewards = referralRewards
    if (referralCode)                  user.referralCode    = referralCode.toUpperCase()
    await user.save({ validateBeforeSave: false })

    res.json({ success: true, message: 'Referral data updated.', user: user.toPublicJSON() })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
module.exports.REFERRAL_THRESHOLD = REFERRAL_THRESHOLD
module.exports.REWARD_MONTHS      = REWARD_MONTHS
