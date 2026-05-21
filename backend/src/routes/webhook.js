/**
 * webhook.js — Stripe Webhook endpoint
 *
 * Mount at POST /api/webhook/stripe (requires raw body — see index.js)
 *
 * Events handled:
 *   customer.subscription.trial_will_end   → send reminder email (3 days before)
 *   invoice.payment_succeeded              → activate subscription, record payment
 *   invoice.payment_failed                 → mark as past_due
 *   customer.subscription.deleted         → mark as cancelled
 *   customer.subscription.updated         → sync plan changes
 */

const router = require('express').Router()
const User   = require('../models/User')
const { constructWebhookEvent } = require('../services/stripeService')

router.post('/stripe',
  // NOTE: express.raw() must be applied to this route in index.js
  // so Stripe can verify the signature — do NOT use express.json() here
  async (req, res) => {
    const sig = req.headers['stripe-signature']

    let event
    try {
      event = constructWebhookEvent(req.body, sig)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    console.log(`Stripe webhook: ${event.type}`)

    try {
      switch (event.type) {

        // ── Trial ending in 3 days ─────────────────────────────────────
        case 'customer.subscription.trial_will_end': {
          const sub  = event.data.object
          const user = await User.findOne({ stripeCustomerId: sub.customer })
          if (user) {
            console.log(`Trial ending soon for ${user.email} — send reminder email here`)
            // TODO: send email via SendGrid
          }
          break
        }

        // ── Successful payment (trial ends → first charge, or renewal) ─
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object
          if (invoice.billing_reason === 'subscription_create') break // free trial started, no charge yet

          const user = await User.findOne({ stripeCustomerId: invoice.customer })
          if (!user) break

          const amount = invoice.amount_paid / 100 // convert cents to dollars
          user.subscriptionStatus  = 'active'
          user.subscriptionExpiry  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          user.totalPaid           = (user.totalPaid || 0) + amount
          user.payments.push({
            amount,
            plan:            user.plan,
            stripeInvoiceId: invoice.id,
            status:          'completed',
          })
          await user.save({ validateBeforeSave: false })
          console.log(`Payment of $${amount} recorded for ${user.email}`)
          // TODO: send receipt email via SendGrid
          break
        }

        // ── Payment failed ─────────────────────────────────────────────
        case 'invoice.payment_failed': {
          const invoice = event.data.object
          const user = await User.findOne({ stripeCustomerId: invoice.customer })
          if (user) {
            user.subscriptionStatus = 'past_due'
            await user.save({ validateBeforeSave: false })
            console.log(`Payment failed for ${user.email} — marked past_due`)
            // TODO: send payment failure email via SendGrid
          }
          break
        }

        // ── Subscription cancelled (by user or Stripe after failures) ──
        case 'customer.subscription.deleted': {
          const sub  = event.data.object
          const user = await User.findOne({ stripeSubscriptionId: sub.id })
          if (user) {
            user.subscriptionStatus  = 'cancelled'
            user.stripeSubscriptionId = null
            user.plan                = 'free'
            await user.save({ validateBeforeSave: false })
            console.log(`Subscription cancelled for ${user.email}`)
          }
          break
        }

        // ── Subscription updated (plan change, etc.) ───────────────────
        case 'customer.subscription.updated': {
          const sub  = event.data.object
          const user = await User.findOne({ stripeSubscriptionId: sub.id })
          if (user) {
            if (sub.status === 'active')   user.subscriptionStatus = 'active'
            if (sub.status === 'trialing') user.subscriptionStatus = 'trial'
            if (sub.status === 'past_due') user.subscriptionStatus = 'past_due'
            if (sub.trial_end) user.trialEndsAt = new Date(sub.trial_end * 1000)
            await user.save({ validateBeforeSave: false })
          }
          break
        }

        default:
          console.log(`Unhandled webhook event: ${event.type}`)
      }
    } catch (err) {
      console.error('Webhook handler error:', err)
      return res.status(500).json({ error: 'Webhook processing failed.' })
    }

    res.json({ received: true })
  }
)

module.exports = router
