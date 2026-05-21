/**
 * subscriptions.js
 * Handles plan selection, Stripe subscription creation with 7-day trial,
 * cancellation, and payment method updates.
 */

const router  = require('express').Router()
const { protect } = require('../middleware/auth')
const User    = require('../models/User')
const {
  PLAN_META,
  TRIAL_DAYS,
  createSubscriptionWithTrial,
  cancelSubscription,
  createSetupIntent,
} = require('../services/stripeService')

// ── GET /api/subscriptions/plans ─────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    trialDays: TRIAL_DAYS,
    plans: [
      {
        id: 'gold',
        name: 'Gold',
        price: 15.99,
        yearlyPrice: 12.99,
        description: 'Full arbitrage + +EV tools for consistent bettors',
        features: [
          'Full Arbitrage Finder',
          '+EV Betting Tools',
          '40+ US Sportsbooks',
          'Smart Bet Alerts',
          'Unlimited Bet Tracker',
          'Line Movement History',
          'Cancel anytime',
        ],
      },
      {
        id: 'platinum',
        name: 'Platinum',
        price: 49.99,
        yearlyPrice: 39.99,
        description: 'Maximum edge for serious professional bettors',
        features: [
          'Everything in Gold',
          '100+ Global Sportsbooks',
          'Live In-Play Odds',
          'Sub-second refresh',
          'API Access',
          '1:1 Coaching Calls',
          'Priority Support',
        ],
      },
    ],
  })
})

// ── GET /api/subscriptions/me ────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  const u = req.user
  res.json({
    success: true,
    subscription: {
      plan:             u.plan,
      status:           u.subscriptionStatus,
      trialEndsAt:      u.trialEndsAt,
      subscriptionExpiry: u.subscriptionExpiry,
      totalPaid:        u.totalPaid,
      hasPaymentMethod: !!u.stripePaymentMethodId,
      stripeCustomerId: u.stripeCustomerId,
    },
  })
})

// ── POST /api/subscriptions/create-with-trial ────────────────────────────
// Called during signup — receives plan + Stripe PaymentMethod ID
// Creates customer, attaches card, starts subscription with 7-day trial
router.post('/create-with-trial', protect, async (req, res) => {
  try {
    const { planId, paymentMethodId } = req.body

    if (!['gold', 'platinum'].includes(planId))
      return res.status(400).json({ success: false, message: 'Invalid plan. Choose gold or platinum.' })

    if (!paymentMethodId)
      return res.status(400).json({ success: false, message: 'Payment method required.' })

    // If user already has a Stripe subscription, don't create another
    if (req.user.stripeSubscriptionId)
      return res.status(400).json({ success: false, message: 'Active subscription already exists.' })

    const result = await createSubscriptionWithTrial({
      name:            req.user.name,
      email:           req.user.email,
      planId,
      paymentMethodId,
    })

    // Update user in DB
    req.user.plan                = planId
    req.user.subscriptionStatus  = 'trial'
    req.user.subscriptionStartDate = new Date()
    req.user.trialEndsAt         = result.trialEnd
    req.user.stripeCustomerId    = result.customerId
    req.user.stripeSubscriptionId = result.subscriptionId
    req.user.stripePaymentMethodId = paymentMethodId

    await req.user.save({ validateBeforeSave: false })

    res.json({
      success: true,
      message: `${PLAN_META[planId].name} trial started. Card will be charged $${PLAN_META[planId].price} on ${result.trialEnd.toLocaleDateString()}.`,
      trialEndsAt: result.trialEnd,
      user: req.user.toPublicJSON(),
    })
  } catch (err) {
    console.error('Stripe subscription error:', err.message)

    // If Stripe keys aren't set yet, simulate trial mode for dev
    if (err.message?.includes('REPLACE_WITH')) {
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      req.user.plan               = req.body.planId
      req.user.subscriptionStatus = 'trial'
      req.user.trialEndsAt        = trialEnd
      await req.user.save({ validateBeforeSave: false })
      return res.json({
        success: true,
        message: `[DEV MODE] Trial started — add real Stripe keys to enable actual billing.`,
        trialEndsAt: trialEnd,
        devMode: true,
        user: req.user.toPublicJSON(),
      })
    }

    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/subscriptions/cancel ───────────────────────────────────────
router.post('/cancel', protect, async (req, res) => {
  try {
    if (req.user.stripeSubscriptionId) {
      await cancelSubscription(req.user.stripeSubscriptionId)
      req.user.stripeSubscriptionId = null
    }
    req.user.subscriptionStatus = 'cancelled'
    await req.user.save({ validateBeforeSave: false })
    res.json({ success: true, message: 'Subscription cancelled. Access continues until trial/period ends.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/subscriptions/update-card ──────────────────────────────────
router.post('/update-card', protect, async (req, res) => {
  try {
    if (!req.user.stripeCustomerId)
      return res.status(400).json({ success: false, message: 'No Stripe customer found.' })

    const setupIntent = await createSetupIntent(req.user.stripeCustomerId)
    res.json({ success: true, clientSecret: setupIntent.client_secret })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/subscriptions/trial-status ──────────────────────────────────
router.get('/trial-status', protect, (req, res) => {
  const now = new Date()
  const trialEnd = req.user.trialEndsAt ? new Date(req.user.trialEndsAt) : null
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0
  const isExpired = trialEnd ? now > trialEnd : false

  res.json({
    success: true,
    inTrial: req.user.subscriptionStatus === 'trial' && !isExpired,
    daysLeft,
    trialEndsAt: trialEnd,
    isExpired,
    chargeAmount: PLAN_META[req.user.plan]?.price || 0,
    plan: req.user.plan,
  })
})

module.exports = router
